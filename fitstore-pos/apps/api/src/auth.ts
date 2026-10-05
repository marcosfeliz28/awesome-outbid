import { z } from "@fitstore/shared";
import { Body, Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
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
  parse,
  audit,
} from "./common";

import { verifyPinAttempt } from "./security";

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(JwtService) private jwt: JwtService,
  ) {}
  private actor(user: any): Actor {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
      branchId: user.branchId,
    };
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
      if (!current.active || current.authVersion !== user.authVersion)
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
      user: { ...this.actor(user), sessionTimeoutMinutes },
    };
  }
  @Public()
  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = parse(
      z.object({
        email: z.string().email(),
        password: z.string().min(1).max(128),
      }),
      body,
    );
    const user = await this.db.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: { role: true },
    });
    if (!user) bad("Correo o contraseña incorrectos.");
    const matches =
      user.active && (await compare(data.password, user.passwordHash));
    const result = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      if (current.lockedUntil && current.lockedUntil > new Date())
        return "locked";
      if (!matches || current.passwordHash !== user.passwordHash) {
        await tx.$queryRaw`UPDATE "User" SET "failedAttempts"=CASE WHEN "lockedUntil" < NOW() THEN 1 ELSE "failedAttempts"+1 END,
          "lockedUntil"=CASE WHEN (CASE WHEN "lockedUntil" < NOW() THEN 1 ELSE "failedAttempts"+1 END)>=5 THEN NOW()+INTERVAL '15 minutes' ELSE NULL END
          WHERE id=${user.id}::uuid RETURNING "failedAttempts"`;
        return "wrong";
      }
      await tx.user.update({
        where: { id: user.id },
        data: { failedAttempts: 0, lockedUntil: null },
      });
      return "ok";
    });
    if (result === "locked")
      bad("Cuenta bloqueada temporalmente. Espera 15 minutos.");
    if (result !== "ok") bad("Correo o contraseña incorrectos.");
    await audit(this.db, this.actor(user), "login", "user", user.id);
    return this.issue(user, res);
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
