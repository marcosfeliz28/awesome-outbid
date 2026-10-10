import { z } from "@fitstore/shared";
import {
  Body,
  Controller,
  Get,
  Header,
  HttpException,
  Inject,
  OnModuleInit,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import {
  Actor,
  CurrentUser,
  Database,
  Public,
  bad,
  canSwitchUserTo,
  parse,
  audit,
} from "./common";

import {
  LOGIN_ACCOUNT_FAILURES_PER_HOUR,
  sameTerminalSecret,
  verifyAttempt,
  verifyPinAttempt,
} from "./security";
import {
  TEMPORARY_PASSWORD_EXPIRED_MESSAGE,
  isDifferentPassword,
  strongPasswordSchema,
  temporaryPasswordExpired,
} from "./password-policy";
import { sessionActivityGraceMs } from "./session-activity";
import { enqueue, escapeHtml, telegramSettings } from "./notifications";
import {
  REQUEST_RATE_LIMITS,
  RequestRateLimitService,
  tooManyAttempts,
  clientIp,
} from "./rate-limit";

export function normalizeUsername(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Hash de una entrada aleatoria descartada, coste 12 igual que passwordHash.
// Nunca identifica una cuenta ni permite emitir una sesión.
const DUMMY_PASSWORD_HASH =
  "$2b$12$58blABr79s5ElPAz9aGMQ.z83oBrpFCsoq.7/lRZrXGesMASQql72";
const ABSENT_USER_ID = "00000000-0000-0000-0000-000000000000";
// Las filas de AuthAttempt (también `login:missing:%`, con la IP en la clave)
// se purgan por dos vías que comparten el candado consultivo de verifyAttempt
// (pg_try_advisory_xact_lock(hashtext(key))), así ninguna borra un contador
// en uso ni uno con bloqueo vigente:
// - SecurityMaintenance (security.ts, cada 6 h): rachas cuyo primer fallo
//   («windowStartedAt», 202610200201) tiene más de un día.
// - RetentionWorker (retention.ts, cada hora): por último intento
//   («updatedAt», disparador de 202610210003): `login:missing:%` a los 2 días
//   y el resto a los 30 (incluye filas sin fallos, con windowStartedAt nulo).
// Además su crecimiento queda acotado por los cupos authIp y authUnknownGlobal.
const credentialAttemptIdentity = (user: any, normalized: string) =>
  user
    ? `${user.id}:${user.authVersion}`
    : `missing:${createHash("sha256").update(normalized).digest("hex")}`;
// Equipo de la tienda (Configuración › Equipos) desde el que se intenta
// entrar: el navegador envía el id y el secreto que guardó al registrarlo.
// Un valor mal formado no impide entrar: se trata como equipo no aprobado.
const terminalCredentials = z.unknown().optional();
const terminalShape = z.object({
  id: z.string().uuid(),
  secret: z.string().min(16).max(200),
});
// Iguales para cuentas existentes e inexistentes: no delatan cuentas. Cada
// uno dice qué se puede hacer (esperar, «Restablecer contraseña» o entrar
// desde un equipo aprobado), sin prometer lo que no existe.
const LOGIN_BLOCKED = {
  ip: "Cuenta bloqueada temporalmente. Espera 15 minutos o pide a la administración que use «Restablecer contraseña» en Configuración › Usuarios y permisos. Desde un equipo aprobado de la tienda puedes entrar con tu contraseña.",
  terminal:
    "Cuenta bloqueada temporalmente en este equipo por intentos fallidos. Espera 15 minutos o pide a la administración que use «Restablecer contraseña» en Configuración › Usuarios y permisos.",
  account:
    "Cuenta bloqueada temporalmente por demasiados intentos fallidos desde equipos no aprobados. Durante una hora como máximo sólo se puede entrar desde un equipo aprobado de la tienda, o pide a la administración que use «Restablecer contraseña» en Configuración › Usuarios y permisos.",
};
const HOUR = 3_600_000;

@Controller("auth")
export class AuthController implements OnModuleInit {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(RequestRateLimitService)
    private requestLimits: RequestRateLimitService,
  ) {}
  private actor(user: any, ip?: string, terminalId?: string): Actor {
    return {
      ...(ip ? { ip } : {}),
      ...(terminalId ? { terminalId } : {}),
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
      branchId: user.branchId,
    };
  }
  async onModuleInit() {
    // Una sola lectura acotada al iniciar permite que el freno de barridos
    // rechace identidades desconocidas antes de findFirst sin impedir que una
    // cuenta real inicie sesion desde la misma IP durante el ataque.
    const users = await this.db.user.findMany({
      select: { usernameKey: true, email: true },
    });
    for (const user of users) {
      if (user.usernameKey)
        this.requestLimits.rememberAuthIdentity(
          normalizeUsername(user.usernameKey),
        );
      if (user.email)
        this.requestLimits.rememberAuthIdentity(normalizeUsername(user.email));
    }
  }
  // Desde un equipo aprobado los cupos en memoria se cuentan por equipo y no
  // por IP: un barrido desde la IP del borde compartido (o desde la misma
  // red) no deja a los equipos de la tienda con 429 (S-02). Tampoco les
  // alcanza el cubo global de identidades desconocidas (N-02): ese cubo lo
  // pueden llenar terceros desde fuera, y un equipo aprobado (que exige el
  // secreto del equipo) sólo gasta su propio cupo por equipo.
  private limitPublicCredentials(
    ip: string,
    terminalId: string | null,
    identifier: string,
  ) {
    const approved = !!terminalId;
    const origin = terminalId ? "terminal:" + terminalId : ip;
    const normalized = normalizeUsername(identifier);
    // Ambas comprobaciones ocurren antes de consultar User. El cubo compartido
    // sólo recibe identidades que no existen; cuando se llena, se comprueba
    // antes de crear otro cubo por nombre. Así el barrido no crea miles de
    // consultas ni entradas. Las cuentas precargadas conservan su cubo propio.
    // Con el cupo de desconocidos lleno (de esta IP o, para equipos no
    // aprobados, de todo el servidor), una cuenta real con clave incorrecta
    // también recibe 429: así el 429 no distingue cuentas. Con la clave
    // correcta entra igual.
    const unknownFlooded =
      this.requestLimits.limited(
        "auth-unknown-ip",
        [origin],
        REQUEST_RATE_LIMITS.authIp,
      ) ||
      (!approved &&
        this.requestLimits.limitedShared(
          "auth-unknown",
          REQUEST_RATE_LIMITS.authUnknownGlobal,
        ));
    if (!this.requestLimits.knowsAuthIdentity(normalized)) {
      // Primero el cupo de la IP: lo que ella rechaza no gasta el global, y
      // una sola dirección no puede agotarlo para todas.
      this.requestLimits.assert(
        "auth-unknown-ip",
        [origin],
        REQUEST_RATE_LIMITS.authIp,
      );
      if (!approved)
        this.requestLimits.assertShared(
          "auth-unknown",
          REQUEST_RATE_LIMITS.authUnknownGlobal,
        );
    }
    this.requestLimits.assert(
      "auth-identifier",
      [origin, normalized],
      REQUEST_RATE_LIMITS.authAccount,
    );
    return { ip, normalized, unknownFlooded };
  }
  /** Equipo registrado y aprobado cuyo secreto coincide; si no, null. */
  private async approvedTerminal(value: unknown) {
    const parsed = terminalShape.safeParse(value);
    if (!parsed.success) return null;
    const input = parsed.data;
    const terminal = await this.db.terminal.findUnique({
      where: { id: input.id },
    });
    return terminal &&
      !terminal.revokedAt &&
      terminal.approvedAt &&
      terminal.secretHash &&
      sameTerminalSecret(input.secret, terminal.secretHash)
      ? terminal
      : null;
  }
  // Contadores de la contraseña (S-01, auditoría de seguridad 2026-10-10).
  // El bloqueo de la cuenta no puede depender de la IP: detrás del borde
  // compartido puede ser la misma para todos, y un tercero sin la contraseña
  // no debe dejar fuera a la cajera.
  // - Desde un equipo aprobado de la sucursal: clave propia del equipo
  //   (`login:<cuenta>:terminal:<equipo>`); 5 fallos → 15 min sólo ahí. Sin
  //   el secreto del equipo nadie puede gastarla.
  // - Desde cualquier otro origen: clave por IP (`login:<cuenta>:<ip>`, 5
  //   fallos → 15 min) y además el cupo de la cuenta
  //   (`login-account:<cuenta>`): 30 fallos por hora entre todas las IP
  //   (N-01). Ni cambiando de IP se prueban más de 30 contraseñas por hora y
  //   cuenta; agotado, sólo se entra desde un equipo aprobado (la dueña y la
  //   administración deben tener uno propio) hasta que vence, y se emite una
  //   alerta (`account_locked`, más Telegram si está activo).
  // - Las identidades inexistentes sólo crean la fila por IP (N-03): sin
  //   cupo de cuenta, un barrido de nombres inventados deja 1 fila por
  //   intento y no 2.
  // Las claves llevan authVersion: «Restablecer contraseña» las desbloquea.
  // Se aplican igual a identidades inexistentes (sin oráculo).
  private passwordAttempt(
    user: any,
    identity: string,
    ip: string,
    terminalId: string | null,
    verify: (tx: any) => Promise<string | null>,
    messages: { wrong: string; blocked?: string },
  ) {
    return verifyAttempt(
      this.db,
      terminalId
        ? `login:${identity}:terminal:${terminalId}`
        : `login:${identity}:${ip}`,
      verify,
      {
        wrong: messages.wrong,
        blocked:
          messages.blocked ??
          (terminalId ? LOGIN_BLOCKED.terminal : LOGIN_BLOCKED.ip),
      },
      {
        scope: terminalId ? "terminal" : "ip",
        budgets:
          terminalId || !user
            ? []
            : [
                {
                  key: `login-account:${identity}`,
                  max: LOGIN_ACCOUNT_FAILURES_PER_HOUR,
                  windowMs: HOUR,
                  message: LOGIN_BLOCKED.account,
                  scope: "account",
                },
              ],
        // Cada bloqueo queda en la bitácora con su origen (S-04).
        onLocked: user
          ? async (tx, scope) => {
              await tx.auditLog.create({
                data: {
                  userId: "system",
                  terminalId: terminalId ?? undefined,
                  ip,
                  action: "login_locked",
                  entity: "user",
                  entityId: user.id,
                  branchId: user.branchId,
                  after: { scope },
                },
              });
              if (scope === "account") await this.alertAccountLocked(tx, user);
            }
          : undefined,
      },
    );
  }
  // N-01: el cupo de contraseñas de la cuenta se agotó (30 fallos en una
  // hora desde equipos no aprobados). Sin esto sólo quedaba una fila en la
  // bitácora que nadie mira: ahora la administración ve una alerta y, si
  // Telegram está activo, recibe el aviso. No incluye IP ni contraseñas.
  private async alertAccountLocked(tx: any, user: any) {
    const message =
      `La cuenta de ${user.name} recibió 30 contraseñas incorrectas en una hora ` +
      `desde equipos no aprobados y quedó bloqueada hasta una hora, salvo desde un equipo aprobado. ` +
      `Si no fue ella o él, cambia su contraseña con «Restablecer contraseña».`;
    await tx.alert.upsert({
      where: { key: "login-locked:" + user.id },
      create: {
        key: "login-locked:" + user.id,
        type: "account_locked",
        severity: "high",
        entityId: user.id,
        branchId: user.branchId,
        message,
      },
      update: { message, status: "new" },
    });
    if (telegramSettings().enabled)
      await enqueue(
        tx,
        "security_alert",
        "login-locked:" + user.id + ":" + new Date().toISOString().slice(0, 13),
        user.branchId,
        [
          "🔒 <b>Cuenta bloqueada por intentos fallidos</b>",
          escapeHtml(message),
        ].join("\n"),
      );
  }
  // Las rutas que llaman a issue() (y el restablecimiento, que devuelve una
  // contraseña temporal) responden con Cache-Control: no-store: ni el
  // navegador ni un proxy guardan tokens ni contraseñas.
  private async issue(user: any, res: Response, sessionId?: string | null) {
    const refresh = randomBytes(48).toString("hex");
    const settings = await this.db.settings.findUnique({
      where: { id: user.branchId },
    });
    const sessionTimeoutMinutes = Number(
      (settings?.data as any)?.sessionTimeoutMinutes ?? 30,
    );
    const session = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        !current.active ||
        current.mustChangePassword ||
        current.authVersion !== user.authVersion
      )
        bad("Las credenciales cambiaron. Inicia sesión otra vez.");
      const session = sessionId
        ? await tx.authSession.findFirst({
            where: { id: sessionId, userId: user.id },
          })
        : await tx.authSession.create({ data: { userId: user.id } });
      if (
        !session ||
        Date.now() - session.lastActivityAt.getTime() >
          sessionTimeoutMinutes * 60000 +
            sessionActivityGraceMs(sessionTimeoutMinutes * 60000)
      )
        bad("La sesión ha expirado por inactividad.");
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          authVersion: user.authVersion,
          sessionId: session.id,
          hash: createHash("sha256").update(refresh).digest("hex"),
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
      return session;
    });
    res.cookie("fitstore_refresh", refresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth",
      maxAge: 7 * 86400000,
    });
    return {
      accessToken: this.jwt.sign(
        {
          sub: user.id,
          type: "access",
          version: user.authVersion,
          sid: session.id,
        },
        { expiresIn: "15m" },
      ),
      user: {
        ...this.actor(user),
        sessionTimeoutMinutes,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
  @Public()
  @Post("login")
  @Header("Cache-Control", "no-store")
  async login(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z
        .object({
          login: z.string().trim().min(1).max(120).optional(),
          // Compatibilidad con instaladores y sesiones anteriores.
          email: z.string().email().optional(),
          password: z.string().min(1).max(128),
          terminal: terminalCredentials,
        })
        .refine((value) => !!(value.login || value.email), {
          message: "Escribe tu usuario.",
          path: ["login"],
        }),
      body,
    );
    const identifier = (data.login ?? data.email ?? "").trim();
    const ip = clientIp(req);
    const device = await this.approvedTerminal(data.terminal);
    const credentialLimit = this.limitPublicCredentials(
      ip,
      device?.id ?? null,
      identifier,
    );
    const user = await this.db.user.findFirst({
      where: identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { usernameKey: normalizeUsername(identifier) },
      include: { role: true },
    });
    const passwordMatches = await compare(
      data.password,
      user?.active ? user.passwordHash : DUMMY_PASSWORD_HASH,
    );
    if (user)
      this.requestLimits.rememberAuthIdentity(credentialLimit.normalized);
    const matches = !!user?.active && passwordMatches;
    // Cuando una IP esta barriendo nombres, una clave incorrecta de una cuenta
    // real conserva el mismo 429 que una identidad inventada. Una clave
    // correcta si puede entrar: no hay bloqueo cruzado ni enumeracion.
    if (credentialLimit.unknownFlooded && !matches) tooManyAttempts();
    // Un equipo de otra sucursal no es «aprobado» para esta cuenta.
    const terminalId =
      device && (!user || device.branchId === user.branchId) ? device.id : null;
    await this.passwordAttempt(
      user,
      credentialAttemptIdentity(user, credentialLimit.normalized),
      ip,
      terminalId,
      async (tx) => {
        // Con la transacción del contador: no ocupa otra conexión del pool.
        const current = await tx.user.findUnique({
          where: { id: user?.id ?? ABSENT_USER_ID },
        });
        return matches &&
          current?.active &&
          current?.passwordHash === user?.passwordHash
          ? (user?.id ?? null)
          : null;
      },
      { wrong: "Usuario o contraseña incorrectos." },
    );
    if (!user?.active) bad("Usuario o contraseña incorrectos.");
    await audit(
      this.db,
      this.actor(user, ip, terminalId ?? undefined),
      "login",
      "user",
      user.id,
    );
    // N-08: la clave temporal correcta pero vencida no abre el cambio.
    if (temporaryPasswordExpired(user)) bad(TEMPORARY_PASSWORD_EXPIRED_MESSAGE);
    if (user.mustChangePassword) return { requiresPasswordChange: true };
    return this.issue(user, res);
  }
  @Public()
  @Post("change-password")
  @Header("Cache-Control", "no-store")
  async changePassword(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z
        .object({
          login: z.string().trim().min(1).max(120),
          currentPassword: z.string().min(1).max(128),
          newPassword: strongPasswordSchema,
          confirmPassword: z.string().min(1).max(128),
          terminal: terminalCredentials,
        })
        .refine((value) => value.newPassword === value.confirmPassword, {
          message: "Las contraseñas nuevas no coinciden.",
          path: ["confirmPassword"],
        })
        .refine(
          (value) =>
            isDifferentPassword(value.currentPassword, value.newPassword),
          {
            message: "La contraseña nueva debe ser distinta de la temporal.",
            path: ["newPassword"],
          },
        ),
      body,
    );
    const identifier = data.login.trim();
    const ip = clientIp(req);
    const device = await this.approvedTerminal(data.terminal);
    const credentialLimit = this.limitPublicCredentials(
      ip,
      device?.id ?? null,
      identifier,
    );
    const user = await this.db.user.findFirst({
      where: identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { usernameKey: normalizeUsername(identifier) },
      include: { role: true },
    });
    if (user)
      this.requestLimits.rememberAuthIdentity(credentialLimit.normalized);
    const currentPasswordMatches = await compare(
      data.currentPassword,
      user?.active ? user.passwordHash : DUMMY_PASSWORD_HASH,
    );
    if (credentialLimit.unknownFlooded && !currentPasswordMatches)
      tooManyAttempts();
    const terminalId =
      device && (!user || device.branchId === user.branchId) ? device.id : null;
    await this.passwordAttempt(
      user,
      credentialAttemptIdentity(user, credentialLimit.normalized),
      ip,
      terminalId,
      async (tx) => {
        const current = await tx.user.findUnique({
          where: { id: user?.id ?? ABSENT_USER_ID },
        });
        return current?.active &&
          current?.passwordHash === user?.passwordHash &&
          currentPasswordMatches
          ? (user?.id ?? null)
          : null;
      },
      { wrong: "Usuario o contraseña incorrectos." },
    );
    if (!user?.active) bad("Usuario o contraseña incorrectos.");
    // Sólo la contraseña válida autoriza revelar el estado del cambio.
    if (!user.mustChangePassword)
      bad("No hay un cambio de contraseña pendiente para esta cuenta.");
    if (temporaryPasswordExpired(user)) bad(TEMPORARY_PASSWORD_EXPIRED_MESSAGE);
    const passwordHashValue = await passwordHash(data.newPassword);
    const updated = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        !current.active ||
        !current.mustChangePassword ||
        current.passwordHash !== user.passwordHash
      )
        bad(
          "La cuenta cambió mientras actualizabas la contraseña. Inicia sesión otra vez.",
        );
      const row = await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: passwordHashValue,
          mustChangePassword: false,
          passwordExpiresAt: null,
          authVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.authAttempt.deleteMany({
        where: {
          OR: [
            { key: { startsWith: `login:${user.id}:` } },
            { key: { startsWith: `login-account:${user.id}:` } },
          ],
        },
      });
      return row;
    });
    const freshUser = await this.db.user.findUniqueOrThrow({
      where: { id: updated.id },
      include: { role: true },
    });
    await audit(
      this.db,
      this.actor(freshUser, ip, terminalId ?? undefined),
      "password_changed",
      "user",
      user.id,
    );
    return this.issue(freshUser, res);
  }
  // «Cambiar mi contraseña»: cambio voluntario con la sesión abierta. Exige la
  // contraseña actual con los mismos contadores que el inicio de sesión (los
  // del equipo si la sesión está en un equipo aprobado; si no, los de la IP y
  // el cupo de la cuenta) y las mismas reglas que el cambio obligatorio. Cierra todas las
  // demás sesiones de la cuenta; este equipo sigue en su sesión (y con su
  // registro de equipo) con un token y una cookie de renovación nuevos.
  @Post("password")
  @Header("Cache-Control", "no-store")
  async changeOwnPassword(
    @CurrentUser() actor: Actor,
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z
        .object({
          currentPassword: z.string().min(1).max(128),
          newPassword: strongPasswordSchema,
          confirmPassword: z.string().min(1).max(128),
        })
        .refine((value) => value.newPassword === value.confirmPassword, {
          message: "Las contraseñas nuevas no coinciden.",
          path: ["confirmPassword"],
        })
        .refine(
          (value) =>
            isDifferentPassword(value.currentPassword, value.newPassword),
          {
            message: "La contraseña nueva debe ser distinta de la actual.",
            path: ["newPassword"],
          },
        ),
      body,
    );
    const ip = clientIp(req);
    this.requestLimits.assert(
      "auth-password-session",
      [ip, actor.sessionId ?? actor.id],
      REQUEST_RATE_LIMITS.authAccount,
    );
    const user = await this.db.user.findUniqueOrThrow({
      where: { id: actor.id },
      include: { role: true },
    });
    const currentPasswordMatches = await compare(
      data.currentPassword,
      user.passwordHash,
    );
    await this.passwordAttempt(
      user,
      credentialAttemptIdentity(user, ""),
      ip,
      actor.terminalApproved && actor.terminalId ? actor.terminalId : null,
      async (tx) => {
        const current = await tx.user.findUnique({ where: { id: user.id } });
        return current?.active &&
          current.passwordHash === user.passwordHash &&
          currentPasswordMatches
          ? user.id
          : null;
      },
      {
        blocked:
          "Cuenta bloqueada temporalmente por intentos fallidos. Espera 15 minutos y vuelve a intentarlo.",
        wrong: "La contraseña actual no es correcta.",
      },
    );
    const passwordHashValue = await passwordHash(data.newPassword);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (
        !current.active ||
        current.passwordHash !== user.passwordHash ||
        current.authVersion !== user.authVersion
      )
        bad(
          "La cuenta cambió mientras actualizabas la contraseña. Inicia sesión otra vez.",
        );
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash: passwordHashValue,
          mustChangePassword: false,
          passwordExpiresAt: null,
          authVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({
        where: { userId: user.id, id: { not: actor.sessionId } },
      });
      await tx.authAttempt.deleteMany({
        where: {
          OR: [
            { key: { startsWith: `login:${user.id}:` } },
            { key: { startsWith: `login-account:${user.id}:` } },
          ],
        },
      });
      // En la misma transacción: si la auditoría falla, la contraseña no
      // cambia; y un fallo después del cambio no la deja sin rastro.
      await audit(tx, actor, "password_changed", "user", user.id);
    });
    const freshUser = await this.db.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { role: true },
    });
    return this.issue(freshUser, res, actor.sessionId);
  }
  @Public()
  @Post("refresh")
  @Header("Cache-Control", "no-store")
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.fitstore_refresh;
    if (!token) bad("La sesión ha expirado.");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const saved = await this.db.refreshToken.findUnique({
      where: { hash: tokenHash },
    });
    if (!saved || saved.expiresAt < new Date()) bad("La sesión ha expirado.");
    this.requestLimits.assert(
      "auth-refresh-session",
      [clientIp(req), saved.sessionId ?? saved.id],
      REQUEST_RATE_LIMITS.refreshSession,
    );
    // deleteMany hace la rotación de uso único incluso con peticiones concurrentes.
    const consumed = await this.db.refreshToken.deleteMany({
      where: { id: saved.id },
    });
    if (!consumed.count) bad("La sesión ya fue renovada.");
    const user = await this.db.user.findUnique({
      where: { id: saved.userId },
      include: { role: true },
    });
    if (
      !user?.active ||
      user.mustChangePassword ||
      user.authVersion !== saved.authVersion ||
      !saved.sessionId
    )
      bad("La sesión ha expirado.");
    return this.issue(user, res, saved.sessionId);
  }
  @Post("logout")
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    if (req.cookies?.fitstore_refresh)
      await this.db.refreshToken.deleteMany({
        where: {
          hash: createHash("sha256")
            .update(req.cookies.fitstore_refresh)
            .digest("hex"),
        },
      });
    const payload = req.headers.authorization?.replace(/^Bearer /, "");
    if (payload) {
      const claims = this.jwt.verify(payload);
      if (claims.sid)
        await this.db.authSession.deleteMany({
          where: { id: claims.sid, userId: claims.sub },
        });
    }
    res.clearCookie("fitstore_refresh", { path: "/api/auth" });
    return { ok: true };
  }
  @Get("me") me(@CurrentUser() actor: Actor) {
    // La IP es para la bitácora; no se devuelve.
    const { ip: _ip, ...rest } = actor;
    return rest;
  }
  @Post("pin")
  @Header("Cache-Control", "no-store")
  async pin(
    @CurrentUser() actor: Actor,
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z.object({
        userId: z.string().uuid(),
        pin: z.string().regex(/^\d{4,6}$/),
      }),
      body,
    );
    const user = await this.db.user.findFirst({
      where: { id: data.userId, branchId: actor.branchId, active: true },
      include: { role: true },
    });
    // SEC-03: el PIN solo mantiene o baja privilegios. Se rechaza ANTES de
    // comparar el PIN (sin oráculo para adivinar el del administrador) y el
    // intento queda en la auditoría.
    if (user && !canSwitchUserTo(actor.permissions, user.role.permissions)) {
      await audit(
        this.db,
        actor,
        "pin_switch_denied",
        "user",
        user.id,
        undefined,
        { reason: "privilegios superiores", targetRole: user.role.name },
      );
      throw new HttpException(
        "No puedes cambiar con PIN a un usuario con más permisos que los tuyos. Esa persona debe entrar con su contraseña.",
        403,
      );
    }
    await verifyPinAttempt(
      this.db,
      "switch:" + actor.id,
      async () =>
        user && (await compare(data.pin, user.pinHash)) ? user.id : null,
      { pin: data.pin, actor },
    );
    if (!user) bad("PIN incorrecto.");
    return this.issue(user, res);
  }
}
export async function passwordHash(password: string) {
  return hash(password, 12);
}
