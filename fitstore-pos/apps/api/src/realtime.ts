import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { compare } from "bcryptjs";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { can } from "@fitstore/shared";
import {
  Actor,
  ActorRequest,
  CurrentUser,
  Database,
  Permit,
  audit,
  bad,
  denied,
  parse,
  uuid,
} from "./common";
import { verifyPinAttempt } from "./security";

const hashSecret = (secret: string) =>
  createHash("sha256").update(secret).digest("hex");
const sameSecret = (secret: string, stored: string) => {
  const a = Buffer.from(hashSecret(secret), "hex"),
    b = Buffer.from(stored, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
};
const terminalStatus = (t: {
  revokedAt: Date | null;
  approvedAt: Date | null;
}) => (t.revokedAt ? "revoked" : t.approvedAt ? "approved" : "pending");
// Nunca se devuelve el hash del secreto del dispositivo.
const publicTerminal = (t: any) => {
  const { secretHash, ...rest } = t;
  void secretHash;
  return { ...rest, status: terminalStatus(t) };
};

// Un solo sondeo por proceso reparte los eventos a todas las conexiones SSE
// (antes: una consulta cada 100 ms por conexión).
type Listener = {
  branchId: string;
  cursor: bigint;
  send: (row: { id: bigint; type: string; data: unknown }) => boolean;
};
export class RealtimeHub {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  private cursor = 0n;
  constructor(private db: Database) {}
  async add(listener: Omit<Listener, "cursor">) {
    if (!this.timer) {
      const max = await this.db.realtimeEvent.aggregate({ _max: { id: true } });
      this.cursor = max._max.id ?? 0n;
      this.timer = setInterval(() => void this.poll(), 150);
    }
    const full: Listener = { ...listener, cursor: this.cursor };
    this.listeners.add(full);
    return () => {
      this.listeners.delete(full);
      if (!this.listeners.size && this.timer) {
        clearInterval(this.timer);
        this.timer = undefined;
      }
    };
  }
  count() {
    return this.listeners.size;
  }
  private async poll() {
    if (this.busy || !this.listeners.size) return;
    this.busy = true;
    try {
      const rows = await this.db.realtimeEvent.findMany({
        where: { id: { gt: this.cursor } },
        orderBy: { id: "asc" },
        take: 500,
      });
      for (const row of rows) {
        this.cursor = row.id;
        for (const l of this.listeners)
          if (l.branchId === row.branchId && row.id > l.cursor) {
            l.cursor = row.id;
            l.send(row);
          }
      }
    } catch {
      /* Reintenta en el siguiente ciclo. */
    } finally {
      this.busy = false;
    }
  }
}
const MAX_STREAMS_PER_SESSION = 2,
  MAX_STREAMS_PER_USER = 6;
const openStreams = new Map<string, number>();
const bump = (key: string, delta: number) => {
  const next = (openStreams.get(key) ?? 0) + delta;
  if (next <= 0) openStreams.delete(key);
  else openStreams.set(key, next);
  return next;
};

@Controller()
export class RealtimeController {
  private hub: RealtimeHub;
  constructor(@Inject(Database) private db: Database) {
    this.hub = new RealtimeHub(db);
  }
  // Registro del dispositivo. El navegador guarda id + secreto; un equipo nuevo
  // de un usuario sin permiso de gerencia queda pendiente de aprobación.
  @Post("terminals/register")
  async register(@Body() body: unknown, @CurrentUser() actor: Actor) {
    const data = parse(
      z.object({
        id: uuid,
        name: z.string().trim().min(1).max(80),
        secret: z.string().min(16).max(200),
      }),
      body,
    );
    const manager = can(actor.permissions, "sale:manage");
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.id}))::text`;
      const existing = await tx.terminal.findUnique({ where: { id: data.id } });
      if (existing) {
        if (existing.branchId !== actor.branchId || existing.revokedAt)
          bad("Equipo revocado o de otra sucursal.");
        if (
          existing.secretHash &&
          !sameSecret(data.secret, existing.secretHash)
        )
          throw new HttpException(
            "Este identificador de equipo pertenece a otro dispositivo.",
            403,
          );
      }
      const terminal = existing
        ? await tx.terminal.update({
            where: { id: data.id },
            data: {
              lastActivityAt: new Date(),
              lastUserId: actor.id,
              // Los equipos anteriores a la ronda 4 fijan su secreto ahora.
              ...(existing.secretHash
                ? {}
                : { secretHash: hashSecret(data.secret) }),
            },
          })
        : await tx.terminal.create({
            data: {
              id: data.id,
              name: data.name,
              branchId: actor.branchId,
              secretHash: hashSecret(data.secret),
              createdBy: actor.id,
              lastUserId: actor.id,
              ...(manager
                ? { approvedAt: new Date(), approvedBy: actor.id }
                : {}),
            },
          });
      const oldCash = await tx.cashSession.findFirst({
        where: { userId: actor.id, branchId: actor.branchId, closedAt: null },
      });
      if (
        oldCash &&
        terminal.approvedAt &&
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
      if (!existing)
        await audit(
          tx,
          { ...actor, terminalId: terminal.id },
          "terminal_registered",
          "terminal",
          terminal.id,
          undefined,
          { name: terminal.name, status: terminalStatus(terminal) },
        );
      return publicTerminal(terminal);
    });
  }
  @Post("terminals/:id/approve")
  @Permit("sale:manage")
  async approve(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.approveTerminal(parse(uuid, id), actor, actor.id, "gerente");
  }
  // En la tienda: el gerente escribe su PIN en el equipo nuevo.
  @Post("terminals/:id/approve-with-pin")
  async approveWithPin(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const terminalId = parse(uuid, id);
    if (actor.terminalId !== terminalId) denied();
    const data = parse(
      z.object({ managerPin: z.string().regex(/^\d{4,6}$/) }),
      body,
    );
    const managers = await this.db.user.findMany({
      where: { active: true, branchId: actor.branchId },
      include: { role: true },
    });
    const managerId = await verifyPinAttempt(
      this.db,
      "terminal-approval:" + actor.id,
      async () => {
        for (const m of managers.filter((m) =>
          can(m.role.permissions, "sale:manage"),
        ))
          if (await compare(data.managerPin, m.pinHash)) return m.id;
        return null;
      },
    );
    return this.approveTerminal(terminalId, actor, managerId, "pin");
  }
  private approveTerminal(
    id: string,
    actor: Actor,
    approvedBy: string,
    via: string,
  ) {
    return this.db.$transaction(async (tx) => {
      const t = await tx.terminal.findFirstOrThrow({
        where: { id, branchId: actor.branchId },
      });
      if (t.revokedAt) bad("Un equipo revocado no se puede aprobar.");
      if (t.approvedAt) return publicTerminal(t);
      const row = await tx.terminal.update({
        where: { id },
        data: { approvedAt: new Date(), approvedBy },
      });
      await audit(tx, actor, "terminal_approved", "terminal", id, undefined, {
        approvedBy,
        via,
      });
      return publicTerminal(row);
    });
  }
  @Post("terminals/:id/rename")
  async rename(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() actor: Actor,
  ) {
    const terminalId = parse(uuid, id);
    // Cada quien nombra su propio equipo; un gerente puede renombrar cualquiera.
    if (
      actor.terminalId !== terminalId &&
      !can(actor.permissions, "sale:manage")
    )
      denied();
    const data = parse(
      z.object({ name: z.string().trim().min(1).max(80) }),
      body,
    );
    return this.db.$transaction(async (tx) => {
      const t = await tx.terminal.findFirstOrThrow({
        where: { id: terminalId, branchId: actor.branchId, revokedAt: null },
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
      return publicTerminal(row);
    });
  }
  @Get("terminals/current")
  async current(@CurrentUser() actor: Actor) {
    if (!actor.terminalId) return { status: "unregistered" };
    const t = await this.db.terminal.findUnique({
      where: { id: actor.terminalId },
    });
    return t ? publicTerminal(t) : { status: "unregistered" };
  }
  @Get("terminals")
  @Permit("sale:manage")
  async list(@CurrentUser() actor: Actor) {
    const rows = await this.db.terminal.findMany({
      where: { branchId: actor.branchId },
      orderBy: [{ revokedAt: "asc" }, { lastActivityAt: "desc" }],
    });
    const userIds = [
      ...new Set(
        rows.flatMap((t) => [t.lastUserId, t.createdBy, t.approvedBy]),
      ),
    ].filter(Boolean) as string[];
    const users = await this.db.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const name = (id: string | null) =>
      users.find((u) => u.id === id)?.name ?? null;
    const open = await this.db.cashSession.findMany({
      where: { branchId: actor.branchId, closedAt: null },
    });
    return rows.map((t) => ({
      ...publicTerminal(t),
      connected:
        !t.revokedAt && Date.now() - t.lastActivityAt.getTime() < 45000,
      lastUserName: name(t.lastUserId),
      createdByName: name(t.createdBy),
      approvedByName: name(t.approvedBy),
      openCash: open.find((c) => c.registerId === t.id) ?? null,
    }));
  }
  @Post("terminals/:id/revoke")
  @Permit("sale:manage")
  async revoke(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.db.$transaction(async (tx) => {
      const t = await tx.terminal.findFirstOrThrow({
        where: { id: parse(uuid, id), branchId: actor.branchId },
      });
      if (t.id === actor.terminalId)
        bad("No puedes revocar el equipo que estás usando.");
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
    const sessionKey = "s:" + actor.sessionId,
      userKey = "u:" + actor.id;
    if (
      (openStreams.get(sessionKey) ?? 0) >= MAX_STREAMS_PER_SESSION ||
      (openStreams.get(userKey) ?? 0) >= MAX_STREAMS_PER_USER
    ) {
      res
        .status(429)
        .json({ statusCode: 429, message: "Demasiadas conexiones abiertas." });
      return;
    }
    let closed = false;
    const end = () => {
      if (!closed) res.end();
    };
    let remove: () => void;
    try {
      // El sondeo es asíncrono: ningún evento se escribe antes de las cabeceras.
      remove = await this.hub.add({
        branchId: actor.branchId,
        send: (row) => {
          const ok = res.write(
            `id: ${row.id}\nevent: ${row.type}\ndata: ${JSON.stringify(row.data)}\n\n`,
          );
          // Cliente lento: se cierra y al reconectar recarga el catálogo.
          if (!ok) end();
          return ok;
        },
      });
    } catch {
      res.status(503).json({
        statusCode: 503,
        message: "Tiempo real no disponible. Reintenta.",
      });
      return;
    }
    bump(sessionKey, 1);
    bump(userKey, 1);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write("event: ready\ndata: {}\n\n");
    // Comprobación de sesión, equipo y latido cada 15 segundos.
    const check = setInterval(async () => {
      try {
        const session = await this.db.authSession.findUnique({
          where: { id: actor.sessionId },
        });
        const user = await this.db.user.findUnique({ where: { id: actor.id } });
        const settings = await this.db.settings.findUnique({
          where: { id: actor.branchId },
        });
        if (
          !session ||
          !user?.active ||
          Date.now() - session.lastActivityAt.getTime() >
            Number((settings?.data as any)?.sessionTimeoutMinutes ?? 30) * 60000
        )
          return end();
        if (actor.terminalId)
          await this.db.terminal.update({
            where: { id: actor.terminalId },
            data: { lastActivityAt: new Date() },
          });
        res.write(": heartbeat\n\n");
      } catch {
        end();
      }
    }, 15000);
    const stop = () => {
      if (closed) return;
      closed = true;
      clearInterval(check);
      remove();
      bump(sessionKey, -1);
      bump(userKey, -1);
    };
    req.on("close", stop);
    res.on("close", stop);
  }
}
