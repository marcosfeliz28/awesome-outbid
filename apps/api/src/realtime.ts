import { tenantUnique } from "./tenant-context";
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
import { can, z } from "@fitstore/shared";
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
import {
  hashTerminalSecret as hashSecret,
  sameTerminalSecret as sameSecret,
  verifyPinAttempt,
} from "./security";
import {
  ACTIVITY_WRITE_INTERVAL_MS,
  TERMINAL_ONLINE_MS,
  sessionActivityGraceMs,
} from "./session-activity";
import { currentTenantId, tenantScope } from "./tenant-context";
import { enforcePlanQuota } from "./billing-plans";
const terminalStatus = (t: {
  revokedAt: Date | null;
  approvedAt: Date | null;
}) => (t.revokedAt ? "revoked" : t.approvedAt ? "approved" : "pending");
// Nunca se devuelve el hash del secreto del dispositivo.
const publicTerminal = (t: any) => {
  const { secretHash, ...rest } = t;
  // identified: el dispositivo ya fijó su secreto y se puede aprobar.
  return { ...rest, identified: !!secretHash, status: terminalStatus(t) };
};

// Un solo sondeo por proceso reparte los eventos a todas las conexiones SSE
// (antes: una consulta cada 100 ms por conexión).
type Listener = {
  tenantId: string;
  branchId: string;
  cursor: bigint;
  send: (row: { id: bigint; type: string; data: unknown }) => boolean;
};
export class RealtimeHub {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private busy = false;
  private cursors = new Map<string, bigint>();
  // Inicialización compartida: varias altas simultáneas esperan la misma
  // consulta inicial y crean un único intervalo (R4-05).
  private starting = new Map<string, Promise<void>>();
  private generation = 0;
  constructor(private db: Database) {}
  private start(tenantId: string) {
    if (this.cursors.has(tenantId)) return Promise.resolve();
    if (!this.starting.has(tenantId)) {
      const gen = this.generation;
      const pending = tenantScope.run({ tenantId }, () => this.db.realtimeEvent
        .aggregate({ _max: { id: true } }))
        .then((max) => {
          if (gen !== this.generation) return;
          this.cursors.set(tenantId, max._max.id ?? 0n);
          if (!this.timer) this.timer = setInterval(() => void this.poll(), 150);
        })
        .finally(() => {
          if (gen === this.generation) this.starting.delete(tenantId);
        });
      this.starting.set(tenantId, pending);
    }
    return this.starting.get(tenantId)!;
  }
  async add(listener: Omit<Listener, "cursor" | "tenantId">, isClosed?: () => boolean) {
    const tenantId = currentTenantId();
    await this.start(tenantId);
    // El cliente cerró durante el alta: no se registra nada.
    if (isClosed?.()) {
      this.stopIfIdle();
      return () => {};
    }
    // Arranque cancelado por quedarse sin clientes durante la espera.
    if (!this.timer) await this.start(tenantId);
    const full: Listener = { ...listener, tenantId, cursor: this.cursors.get(tenantId) ?? 0n };
    this.listeners.add(full);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      this.listeners.delete(full);
      this.stopIfIdle();
    };
  }
  private stopIfIdle() {
    if (this.listeners.size) return;
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    // Invalida cualquier inicialización pendiente.
    this.generation++;
    this.starting.clear();
    this.cursors.clear();
  }
  count() {
    return this.listeners.size;
  }
  running() {
    return Boolean(this.timer);
  }
  private async poll() {
    if (this.busy || !this.listeners.size) return;
    this.busy = true;
    try {
      for (const tenantId of new Set([...this.listeners].map((listener) => listener.tenantId))) {
        const rows = await tenantScope.run({ tenantId }, () => this.db.realtimeEvent.findMany({
          where: { id: { gt: this.cursors.get(tenantId) ?? 0n } },
          orderBy: { id: "asc" },
          take: 500,
        }));
        for (const row of rows) {
          this.cursors.set(tenantId, row.id);
          for (const l of this.listeners)
            if (l.tenantId === tenantId && l.branchId === row.branchId && row.id > l.cursor) {
              l.cursor = row.id;
              l.send(row);
            }
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
  @Permit("authenticated")
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
      // Equipo anterior a la ronda 4 sin secreto: el ID solo no prueba que sea
      // ese dispositivo. Quien lo reclama fija su secreto, pero el equipo queda
      // pendiente hasta que un gerente lo apruebe (R4-01).
      const legacyClaim = !!existing && !existing.secretHash;
      // Con el cupo de equipos del plan lleno, el navegador nuevo de una
      // administradora queda PENDIENTE (no se aprueba solo ni se rechaza con
      // 409, que la página reintentaba en bucle): ella revoca otro y lo aprueba.
      let planLimit: string | undefined;
      // Su propio equipo que quedó pendiente por el cupo se aprueba al
      // volver a entrar si ya hay espacio (por ejemplo, tras revocar otro).
      const retryApproval = !!existing && !legacyClaim && manager &&
        !existing.approvedAt && existing.createdBy === actor.id;
      if ((!existing && manager) || retryApproval || (legacyClaim && manager && !existing?.approvedAt))
        await enforcePlanQuota(tx as any, "boxes").catch((error) => {
          if (error instanceof HttpException && error.getStatus() === 409)
            planLimit = error.message;
          else throw error;
        });
      const autoApprove = manager && !planLimit;
      if (!existing) await enforcePlanQuota(tx as any, "branches", actor.branchId);
      const terminal = existing
        ? await tx.terminal.update({
            where: { id: data.id },
            data: {
              lastActivityAt: new Date(),
              lastUserId: actor.id,
              ...(retryApproval && autoApprove
                ? { approvedAt: new Date(), approvedBy: actor.id }
                : {}),
              ...(legacyClaim
                ? {
                    secretHash: hashSecret(data.secret),
                    createdBy: actor.id,
                    ...(autoApprove
                      ? { approvedAt: new Date(), approvedBy: actor.id }
                      : { approvedAt: null, approvedBy: null }),
                  }
                : {}),
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
              ...(autoApprove
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
      if (!existing || legacyClaim)
        await audit(
          tx,
          { ...actor, terminalId: terminal.id },
          legacyClaim ? "terminal_legacy_claimed" : "terminal_registered",
          "terminal",
          terminal.id,
          legacyClaim
            ? { status: terminalStatus(existing), secret: false }
            : undefined,
          { name: terminal.name, status: terminalStatus(terminal) },
        );
      return { ...publicTerminal(terminal), ...(planLimit ? { planLimit } : {}) };
    });
  }
  @Post("terminals/:id/approve")
  @Permit("sale:manage")
  async approve(@Param("id") id: string, @CurrentUser() actor: Actor) {
    return this.approveTerminal(parse(uuid, id), actor, actor.id, "gerente");
  }
  // En la tienda: el gerente escribe su PIN en el equipo nuevo.
  @Permit("authenticated")
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
      { pin: data.managerPin, actor },
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
      // Sin secreto nadie ha demostrado ser ese dispositivo: aprobarlo dejaría
      // operar al primero que envíe su ID.
      if (!t.secretHash)
        bad(
          "Este equipo todavía no se ha identificado. Abre Nexora POS en ese equipo y vuelve a intentarlo.",
        );
      if (t.approvedAt) return publicTerminal(t);
      await enforcePlanQuota(tx as any, "boxes");
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
  @Permit("authenticated")
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
  @Permit("authenticated")
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
    const cashOwners = new Map(
      (
        await this.db.user.findMany({
          where: { id: { in: open.map((c) => c.userId) } },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return rows.map((t) => ({
      ...publicTerminal(t),
      connected:
        !t.revokedAt &&
        Date.now() - t.lastActivityAt.getTime() < TERMINAL_ONLINE_MS,
      lastUserName: name(t.lastUserId),
      createdByName: name(t.createdBy),
      approvedByName: name(t.approvedBy),
      // Varias personas pueden tener su caja abierta en el mismo equipo
      // (decisión 38): openCash conserva la primera por compatibilidad.
      openCash: open.find((c) => c.registerId === t.id) ?? null,
      openCashes: open
        .filter((c) => c.registerId === t.id)
        .map((c) => ({
          ...c,
          userName: name(c.userId) ?? cashOwners.get(c.userId) ?? null,
        })),
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
    // El cupo se reserva antes del primer await: una ráfaga de altas
    // simultáneas no puede superar el límite (R4-06).
    if (
      (openStreams.get(sessionKey) ?? 0) >= MAX_STREAMS_PER_SESSION ||
      (openStreams.get(userKey) ?? 0) >= MAX_STREAMS_PER_USER
    ) {
      res
        .status(429)
        .json({ statusCode: 429, message: "Demasiadas conexiones abiertas." });
      return;
    }
    bump(sessionKey, 1);
    bump(userKey, 1);
    let closed = false;
    let remove: () => void = () => {};
    const timers: { check?: ReturnType<typeof setInterval> } = {};
    // Libera la conexión una sola vez: cierre normal, error, caída abrupta o
    // desconexión mientras el alta todavía estaba pendiente.
    const stop = () => {
      if (closed) return;
      closed = true;
      clearInterval(timers.check);
      remove();
      bump(sessionKey, -1);
      bump(userKey, -1);
    };
    const end = () => {
      if (closed) return;
      stop();
      // destroy: si el cliente ya no responde, end() no terminaría nunca.
      res.destroy();
    };
    // res "close" cubre fin de la respuesta y corte de la conexión; req "close"
    // puede llegar al terminar de leer el GET y cerraría un flujo sano.
    req.on("error", end);
    res.on("close", stop);
    res.on("error", end);
    try {
      // El sondeo es asíncrono: ningún evento se escribe antes de las cabeceras.
      remove = await this.hub.add(
        {
          branchId: actor.branchId,
          send: (row) => {
            const ok = res.write(
              `id: ${row.id}\nevent: ${row.type}\ndata: ${JSON.stringify(row.data)}\n\n`,
            );
            // Cliente lento: se cierra y al reconectar recarga el catálogo.
            if (!ok) end();
            return ok;
          },
        },
        () => closed || res.destroyed || Boolean(req.socket?.destroyed),
      );
    } catch {
      if (closed) return;
      stop();
      res.status(503).json({
        statusCode: 503,
        message: "Tiempo real no disponible. Reintenta.",
      });
      return;
    }
    // Cerró justo al terminar el alta: se retira el listener recién creado.
    if (closed || res.destroyed || req.socket?.destroyed) {
      if (closed) remove();
      else stop();
      return;
    }
    // TCP keepalive detecta pares caídos sin FIN (corte de red, batería).
    req.socket?.setKeepAlive(true, 10000);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    res.write("event: ready\ndata: {}\n\n");
    // Comprobación de sesión, equipo y latido cada 15 segundos. La actividad
    // del equipo se escribe como mucho una vez por minuto (session-activity).
    let terminalTouchedAt = 0;
    timers.check = setInterval(async () => {
      if (closed) return;
      if (res.destroyed || res.writableEnded || req.socket?.destroyed)
        return stop();
      try {
        const session = await this.db.authSession.findUnique({
          where: { id: actor.sessionId },
        });
        const user = await this.db.user.findUnique({ where: { id: actor.id }, include: { role: true } });
        const settings = await this.db.settings.findUnique({
          where: tenantUnique("id", actor.branchId),
        });
        const timeoutMs =
          Number((settings?.data as any)?.sessionTimeoutMinutes ?? 30) * 60000;
        if (
          !session ||
          session.userId !== actor.id ||
          !user?.active ||
          user.authVersion !== actor.authVersion ||
          (user.role.name === "support" && (!user.supportExpiresAt || user.supportExpiresAt <= new Date())) ||
          Date.now() - session.lastActivityAt.getTime() >
            timeoutMs + sessionActivityGraceMs(timeoutMs)
        )
          return end();
        if (
          actor.terminalId &&
          Date.now() - terminalTouchedAt >= ACTIVITY_WRITE_INTERVAL_MS
        ) {
          await this.db.terminal.update({
            where: { id: actor.terminalId },
            data: { lastActivityAt: new Date() },
          });
          terminalTouchedAt = Date.now();
        }
        // Latido sin consumir: el cliente dejó de leer; se expulsa.
        if (!res.write(": heartbeat\n\n")) end();
      } catch {
        end();
      }
    }, 15000);
  }
}
