import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { z } from "zod";
import {
  Actor,
  ActorRequest,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  parse,
  uuid,
} from "./common";

@Controller()
export class RealtimeController {
  constructor(@Inject(Database) private db: Database) {}
  @Post("terminals/register")
  async register(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({ id: uuid, name: z.string().trim().min(1).max(80) }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.id}))::text`;
      const existing = await tx.terminal.findUnique({ where: { id: data.id } });
      if (
        existing &&
        (existing.branchId !== actor.branchId || existing.revokedAt)
      )
        bad("Equipo revocado o de otra sucursal.");
      const terminal = await tx.terminal.upsert({
        where: { id: data.id },
        create: { ...data, branchId: actor.branchId },
        update: { lastActivityAt: new Date() },
      });
      const oldCash = await tx.cashSession.findFirst({
        where: { userId: actor.id, branchId: actor.branchId, closedAt: null },
      });
      if (
        oldCash &&
        !(await tx.terminal.findUnique({
          where: {
            id: /^[0-9a-f-]{36}$/i.test(oldCash.registerId)
              ? oldCash.registerId
              : "00000000-0000-0000-0000-000000000000",
          },
        }))
      )
        await tx.cashSession.update({
          where: { id: oldCash.id },
          data: { registerId: terminal.id },
        });
      await tx.authSession.update({
        where: { id: actor.sessionId },
        data: { terminalId: terminal.id },
      });
      await audit(
        tx,
        { ...actor, terminalId: terminal.id },
        "terminal_registered",
        "terminal",
        terminal.id,
        undefined,
        { name: terminal.name },
      );
      return terminal;
    });
  }
  @Post("terminals/:id/rename")
  @Permit("sale:manage")
  async rename(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const data = parse(
      z.object({ name: z.string().trim().min(1).max(80) }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const t = await tx.terminal.findFirstOrThrow({
        where: {
          id: parse(uuid, id),
          branchId: actor.branchId,
          revokedAt: null,
        },
      });
      const row = await tx.terminal.update({ where: { id: t.id }, data });
      await audit(
        tx,
        actor,
        "terminal_renamed",
        "terminal",
        t.id,
        { name: t.name },
        data,
      );
      return row;
    });
  }
  @Get("terminals")
  @Permit("sale:manage")
  async list(@CurrentUser() actor: Actor) {
    const rows = await this.db.terminal.findMany({
      where: { branchId: actor.branchId },
      orderBy: { lastActivityAt: "desc" },
    });
    return Promise.all(
      rows.map(async (t) => ({
        ...t,
        connected:
          !t.revokedAt && Date.now() - t.lastActivityAt.getTime() < 45000,
        openCash: await this.db.cashSession.findFirst({
          where: { branchId: actor.branchId, registerId: t.id, closedAt: null },
        }),
      })),
    );
  }
  @Post("terminals/:id/revoke")
  @Permit("sale:manage")
  async revoke(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.db.$transaction(async (tx) => {
      const t = await tx.terminal.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      await tx.terminal.update({
        where: { id: t.id },
        data: { revokedAt: new Date() },
      });
      await tx.authSession.deleteMany({ where: { terminalId: t.id } });
      await audit(tx, actor, "terminal_revoked", "terminal", t.id);
      return { ok: true };
    });
  }
  @Get("events")
  @Permit("catalog:read")
  async events(
    @Req() req: ActorRequest,
    @Res() res: Response,
    @CurrentUser() actor: Actor,
  ) {
    const max = await this.db.realtimeEvent.aggregate({
      where: { branchId: actor.branchId },
      _max: { id: true },
    });
    let cursor = max._max.id ?? 0n;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write("event: ready\ndata: {}\n\n");
    let closed = false,
      busy = false,
      lastCheck = 0;
    const timer = setInterval(async () => {
      if (closed || busy) return;
      busy = true;
      try {
        if (Date.now() - lastCheck > 15000) {
          lastCheck = Date.now();
          const session = await this.db.authSession.findUnique({
            where: { id: actor.sessionId },
          });
          const user = await this.db.user.findUnique({
            where: { id: actor.id },
          });
          const settings = await this.db.settings.findUnique({
            where: { id: actor.branchId },
          });
          if (
            !session ||
            !user?.active ||
            Date.now() - session.lastActivityAt.getTime() >
              Number((settings?.data as any)?.sessionTimeoutMinutes ?? 30) *
                60000
          ) {
            res.end();
            return;
          }
          if (actor.terminalId)
            await this.db.terminal.update({
              where: { id: actor.terminalId },
              data: { lastActivityAt: new Date() },
            });
          res.write(": heartbeat\n\n");
        }
        const rows = await this.db.realtimeEvent.findMany({
          where: { branchId: actor.branchId, id: { gt: cursor } },
          orderBy: { id: "asc" },
          take: 200,
        });
        for (const row of rows) {
          if (
            !res.write(
              `id: ${row.id}\nevent: ${row.type}\ndata: ${JSON.stringify(row.data)}\n\n`,
            )
          ) {
            res.end();
            break;
          }
          cursor = row.id;
        }
      } catch {
        res.end();
      } finally {
        busy = false;
      }
    }, 100);
    const stop = () => {
      closed = true;
      clearInterval(timer);
    };
    req.on("close", stop);
    res.on("close", stop);
  }
}
