import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { compare } from "bcryptjs";
import { z } from "zod";
import { d, money, can } from "@fitstore/shared";
import {
  Actor,
  CurrentUser,
  Database,
  Permit,
  parse,
  uuid,
  amount,
  reason,
  audit,
  bad,
  denied,
} from "./common";
import { cashLock, terminalName } from "./sales";
import { verifyPinAttempt } from "./security";

export async function cashExpected(db: any, session: any) {
  const payments = await db.payment.findMany({
    where: {
      cashSessionId: session.id,
      sale: { status: "completed" },
      OR: [{ entryType: { not: "installment" } }, { status: "ok" }],
    },
  });
  const movements = await db.cashMovement.findMany({
    where: { sessionId: session.id },
  });
  const returns = await db.saleReturn.findMany({
    where: { cashSessionId: session.id },
  });
  const expected = {
    cash: d(session.openingAmount),
    card: d(0),
    transfer: d(0),
  };
  for (const p of payments)
    if (p.method in expected)
      expected[p.method as keyof typeof expected] = expected[
        p.method as keyof typeof expected
      ].plus(p.amount);
  for (const m of movements)
    expected.cash = expected.cash.plus(
      m.type === "in" ? m.amount : d(m.amount).negated(),
    );
  for (const r of returns)
    if (r.refundMethod in expected)
      expected[r.refundMethod as keyof typeof expected] = expected[
        r.refundMethod as keyof typeof expected
      ].minus(r.refundAmount);
  return {
    cash: money(expected.cash),
    card: money(expected.card),
    transfer: money(expected.transfer),
    movements,
  };
}
@Controller("cash-sessions")
export class CashController {
  constructor(@Inject(Database) private db: Database) {}
  @Get()
  @Permit("cash:write")
  async sessions(@CurrentUser() actor: Actor) {
    const sessions = await this.db.cashSession.findMany({
      where: {
        branchId: actor.branchId,
        ...(can(actor.permissions, "sale:manage") ? {} : { userId: actor.id }),
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
    return Promise.all(
      sessions.map(async (s) => ({
        ...s,
        registerName: await terminalName(this.db, s.registerId),
        expected: await cashExpected(this.db, s),
        differences: s.closedAt
          ? {
              cash: Number(s.differenceCash),
              card: Number(s.differenceCard),
              transfer: Number(s.differenceTransfer),
            }
          : null,
      })),
    );
  }
  @Post("open")
  @Permit("cash:write")
  async open(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        openingAmount: amount,
        registerId: z.string().min(1).max(80).default("terminal-1"),
      }),
      body,
    );
    if (actor.terminalId) data.registerId = actor.terminalId;
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${actor.branchId + ":cash:" + actor.id}))::text AS locked`;
      const existing = await tx.cashSession.findFirst({
        where: {
          branchId: actor.branchId,
          closedAt: null,
          OR: [{ userId: actor.id }, { registerId: data.registerId }],
        },
      });
      if (existing)
        bad("Ya existe una caja abierta para este usuario o terminal.");
      const row = await tx.cashSession.create({
        data: { ...data, userId: actor.id, branchId: actor.branchId },
      });
      await audit(tx, actor, "open", "cash", row.id, undefined, row);
      return row;
    });
  }
  @Post(":id/movements")
  @Permit("cash:write")
  async movement(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        type: z.enum(["in", "out"]),
        amount: z.number().positive(),
        reason,
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const session = await cashLock(tx, actor, parse(uuid, id));
      const expected = await cashExpected(tx, session);
      if (data.type === "out" && data.amount > expected.cash)
        bad("No hay suficiente efectivo en caja.");
      const row = await tx.cashMovement.create({
        data: { ...data, sessionId: id, userId: actor.id },
      });
      await audit(tx, actor, "movement", "cash", id, undefined, row);
      return row;
    });
  }
  // Traslada la caja abierta del usuario al equipo desde el que se solicita
  // (por ejemplo, si el equipo original se dañó). Un vendedor necesita el PIN
  // de un gerente; el traslado queda en la bitácora con ambos equipos.
  @Post(":id/transfer")
  @Permit("cash:write")
  async transfer(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        managerPin: z
          .string()
          .regex(/^\d{4,6}$/)
          .optional(),
      }),
      body,
    );
    const target = actor.terminalId;
    if (!target) bad("Este equipo aún no está registrado. Recarga la página.");
    let approvedBy: string | null = null;
    if (!can(actor.permissions, "sale:manage")) {
      if (!data.managerPin)
        bad("Trasladar la caja requiere el PIN de un gerente.");
      const managers = await this.db.user.findMany({
        where: { active: true, branchId: actor.branchId },
        include: { role: true },
      });
      approvedBy = await verifyPinAttempt(
        this.db,
        "approval:" + actor.id,
        async () => {
          for (const manager of managers.filter((m) =>
            can(m.role.permissions, "sale:manage"),
          ))
            if (await compare(data.managerPin!, manager.pinHash))
              return manager.id;
          return null;
        },
      );
    }
    return this.db.$transaction(async (tx) => {
      const sessionId = parse(uuid, id);
      await tx.$queryRaw`SELECT id FROM "CashSession" WHERE id = ${sessionId}::uuid FOR UPDATE`;
      const session = await tx.cashSession.findFirstOrThrow({
        where: { id: sessionId, branchId: actor.branchId, closedAt: null },
      });
      if (session.userId !== actor.id) denied();
      if (session.registerId === target) return session;
      const busy = await tx.cashSession.findFirst({
        where: {
          branchId: actor.branchId,
          closedAt: null,
          registerId: target,
          id: { not: sessionId },
        },
      });
      if (busy) bad("Este equipo ya tiene otra caja abierta.");
      const from = await terminalName(tx, session.registerId);
      const to = await terminalName(tx, target!);
      const row = await tx.cashSession.update({
        where: { id: sessionId },
        data: { registerId: target },
      });
      await audit(
        tx,
        actor,
        "cash_transferred",
        "cash",
        sessionId,
        { registerId: session.registerId, terminal: from },
        { registerId: target, terminal: to, approvedBy },
      );
      return { ...row, registerName: to };
    });
  }
  @Post(":id/close")
  @Permit("cash:write")
  async close(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({
        countedCash: amount,
        countedCard: amount,
        countedTransfer: amount,
        notes: z.string().max(1000).default(""),
      }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const session = await cashLock(
        tx,
        actor,
        parse(uuid, id),
        true,
        undefined,
        { closing: true },
      );
      const expected = await cashExpected(tx, session);
      const difference = money(
        d(data.countedCash)
          .minus(expected.cash)
          .plus(d(data.countedCard).minus(expected.card))
          .plus(d(data.countedTransfer).minus(expected.transfer)),
      );
      const row = await tx.cashSession.update({
        where: { id },
        data: {
          ...data,
          expectedCash: expected.cash,
          expectedCard: expected.card,
          expectedTransfer: expected.transfer,
          difference,
          differenceCash: money(d(data.countedCash).minus(expected.cash)),
          differenceCard: money(d(data.countedCard).minus(expected.card)),
          differenceTransfer: money(
            d(data.countedTransfer).minus(expected.transfer),
          ),
          closedAt: new Date(),
        },
      });
      await audit(tx, actor, "close", "cash", id, session, row);
      if (row.differenceCash || row.differenceCard || row.differenceTransfer)
        await audit(tx, actor, "close_difference", "cash", id, session, row);
      const setting = await tx.settings.findUnique({
        where: { id: actor.branchId },
      });
      if (
        Math.abs(Number(row.differenceCash)) >
        Number((setting?.data as any)?.cashDifferenceLimit ?? 100)
      )
        await tx.alert.upsert({
          where: { key: "cash:" + id },
          create: {
            key: "cash:" + id,
            type: "cash_difference",
            severity: "high",
            entityId: id,
            branchId: actor.branchId,
            message:
              "Diferencia de efectivo en caja: RD$ " + row.differenceCash,
          },
          update: {
            status: "new",
            message:
              "Diferencia de efectivo en caja: RD$ " + row.differenceCash,
          },
        });
      return {
        ...row,
        differences: {
          cash: money(d(data.countedCash).minus(expected.cash)),
          card: money(d(data.countedCard).minus(expected.card)),
          transfer: money(d(data.countedTransfer).minus(expected.transfer)),
        },
      };
    });
  }
}
