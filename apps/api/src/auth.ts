import { z } from "@fitstore/shared";
import {
  Body,
  Controller,
  Get,
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

import { verifyAttempt, verifyPinAttempt } from "./security";
import { isDifferentPassword, strongPasswordSchema } from "./password-policy";
import {
  REQUEST_RATE_LIMITS,
  RequestRateLimitService,
  normalizeRequestIp,
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
const credentialAttemptIdentity = (user: any, normalized: string) =>
  user
    ? `${user.id}:${user.authVersion}`
    : `missing:${createHash("sha256").update(normalized).digest("hex")}`;

@Controller("auth")
export class AuthController implements OnModuleInit {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(RequestRateLimitService)
    private requestLimits: RequestRateLimitService,
  ) {}
  private actor(user: any): Actor {
    return {
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
  private limitPublicCredentials(req: Request, identifier: string) {
    const ip = normalizeRequestIp(req.ip);
    const normalized = normalizeUsername(identifier);
    // Ambas comprobaciones ocurren antes de consultar User. El cubo compartido
    // sólo recibe identidades que no existen; cuando se llena, se comprueba
    // antes de crear otro cubo por nombre. Así el barrido no crea miles de
    // consultas ni entradas. Las cuentas precargadas conservan su cubo propio.
    const unknownFlooded = this.requestLimits.limited(
      "auth-unknown-ip",
      [ip],
      REQUEST_RATE_LIMITS.authIp,
    );
    if (!this.requestLimits.knowsAuthIdentity(normalized))
      this.requestLimits.assert(
        "auth-unknown-ip",
        [ip],
        REQUEST_RATE_LIMITS.authIp,
      );
    this.requestLimits.assert(
      "auth-identifier",
      [ip, normalized],
      REQUEST_RATE_LIMITS.authAccount,
    );
    return { ip, normalized, unknownFlooded };
  }
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
          sessionTimeoutMinutes * 60000
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
        })
        .refine((value) => !!(value.login || value.email), {
          message: "Escribe tu usuario.",
          path: ["login"],
        }),
      body,
    );
    const identifier = (data.login ?? data.email ?? "").trim();
    const credentialLimit = this.limitPublicCredentials(req, identifier);
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
    if (credentialLimit.unknownFlooded && !matches)
      this.requestLimits.assert(
        "auth-unknown-ip",
        [credentialLimit.ip],
        REQUEST_RATE_LIMITS.authIp,
      );
    // Los fallos se cuentan por cuenta y dirección IP, como los PIN por
    // solicitante: quien prueba contraseñas ajenas sólo se bloquea a sí mismo,
    // no a la vendedora en su caja. La clave lleva authVersion para que un
    // administrador desbloquee la cuenta al cambiarle la contraseña (R9-seguridad-1).
    await verifyAttempt(
      this.db,
      `login:${credentialAttemptIdentity(user, credentialLimit.normalized)}:${credentialLimit.ip}`,
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
      {
        blocked:
          "Cuenta bloqueada temporalmente. Espera 15 minutos o pide a un administrador que te cambie la contraseña.",
        wrong: "Usuario o contraseña incorrectos.",
      },
    );
    if (!user?.active) bad("Usuario o contraseña incorrectos.");
    await audit(this.db, this.actor(user), "login", "user", user.id);
    if (user.mustChangePassword) return { requiresPasswordChange: true };
    return this.issue(user, res);
  }
  @Public()
  @Post("change-password")
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
    const credentialLimit = this.limitPublicCredentials(req, identifier);
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
      this.requestLimits.assert(
        "auth-unknown-ip",
        [credentialLimit.ip],
        REQUEST_RATE_LIMITS.authIp,
      );
    await verifyAttempt(
      this.db,
      `login:${credentialAttemptIdentity(user, credentialLimit.normalized)}:${credentialLimit.ip}`,
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
      {
        blocked:
          "Cuenta bloqueada temporalmente. Espera 15 minutos o pide a un administrador que te cambie la contraseña.",
        wrong: "Usuario o contraseña incorrectos.",
      },
    );
    if (!user?.active) bad("Usuario o contraseña incorrectos.");
    // Sólo la contraseña válida autoriza revelar el estado del cambio.
    if (!user.mustChangePassword)
      bad("No hay un cambio de contraseña pendiente para esta cuenta.");
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
          authVersion: { increment: 1 },
        },
      });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.authSession.deleteMany({ where: { userId: user.id } });
      await tx.authAttempt.deleteMany({
        where: { key: { startsWith: `login:${user.id}:` } },
      });
      return row;
    });
    const freshUser = await this.db.user.findUniqueOrThrow({
      where: { id: updated.id },
      include: { role: true },
    });
    await audit(
      this.db,
      this.actor(freshUser),
      "password_changed",
      "user",
      user.id,
    );
    return this.issue(freshUser, res);
  }
  @Public()
  @Post("refresh")
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
      [normalizeRequestIp(req.ip), saved.sessionId ?? saved.id],
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
    return actor;
  }
  @Post("pin")
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
    await verifyPinAttempt(this.db, "switch:" + actor.id, async () =>
      user && (await compare(data.pin, user.pinHash)) ? user.id : null,
    );
    if (!user) bad("PIN incorrecto.");
    return this.issue(user, res);
  }
}
export async function passwordHash(password: string) {
  return hash(password, 12);
}
