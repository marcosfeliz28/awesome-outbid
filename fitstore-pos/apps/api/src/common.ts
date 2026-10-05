import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  CanActivate,
  ExecutionContext,
  Inject,
  createParamDecorator,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@prisma/client";
import { can } from "@fitstore/shared";
import { z, ZodError } from "zod";
import type { Request, Response } from "express";

@Injectable()
export class Database extends PrismaClient {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
export type Actor = {
  id: string;
  sessionId?: string;
  terminalId?: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branchId: string;
};
export type ActorRequest = Request & { actor: Actor };
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<ActorRequest>().actor,
);
export const Permit = (permission: string) =>
  SetMetadata("permission", permission);
export const Public = () => SetMetadata("public", true);
export function bad(message: string): never {
  throw new HttpException(message, 400);
}
export function denied(): never {
  throw new HttpException("No tienes permiso para realizar esta acción.", 403);
}
export function conflict(message: string): never {
  throw new HttpException(message, 409);
}
export const parse = <T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> => schema.parse(input);
export const uuid = z.string().uuid();
export const amount = z.number().nonnegative().max(100000000);
export const positive = z.number().positive().max(1000000);
export const reason = z.string().trim().min(3).max(1000);
export const json = (value: unknown) => JSON.parse(JSON.stringify(value));
export const scoped = (actor: Actor) => ({ branchId: actor.branchId });
export const audit = (
  db: any,
  actor: Actor,
  action: string,
  entity: string,
  entityId: string,
  before?: unknown,
  after?: unknown,
) =>
  db.auditLog.create({
    data: {
      userId: actor.id,
      terminalId: actor.terminalId,
      action,
      entity,
      entityId,
      branchId: actor.branchId,
      ...(before === undefined ? {} : { before: json(before) }),
      ...(after === undefined ? {} : { after: json(after) }),
    },
  });
export function safe<T>(value: T, actor: Actor): T {
  if (actor.role !== "seller" && can(actor.permissions, "profit:read"))
    return json(value);
  const privateFields = new Set([
    "costAvg",
    "cost",
    "unitCost",
    "landedCost",
    "costTotal",
    "wholesalePrice",
    "grossProfit",
    "netProfit",
    "margin",
    "inventoryCost",
    "capital",
    "score",
    "suggestedDiscount",
    "feeAmount",
    "passwordHash",
    "pinHash",
    "Costo",
    "Utilidad",
    "Margen",
    "Valor",
  ]);
  const sanitize = (v: any): any =>
    Array.isArray(v)
      ? v.map(sanitize)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .filter(([key]) => !privateFields.has(key))
              .map(([k, item]) => [k, sanitize(item)]),
          )
        : v;
  return sanitize(json(value));
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(JwtService) private jwt: JwtService,
    @Inject(Reflector) private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    if (
      this.reflector.getAllAndOverride("public", [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const req = context.switchToHttp().getRequest<ActorRequest>();
    try {
      const token = req.headers.authorization?.replace(/^Bearer /, "");
      if (!token) throw new Error();
      const payload = this.jwt.verify(token);
      if (payload.type !== "access") throw new Error();
      const user = await this.db.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });
      if (!user?.active || (user.lockedUntil && user.lockedUntil > new Date()))
        throw new Error();
      if (payload.version !== user.authVersion || !payload.sid)
        throw new Error();
      const settings = await this.db.settings.findUnique({
        where: { id: user.branchId },
      });
      const cutoff = new Date(
        Date.now() -
          Number((settings?.data as any)?.sessionTimeoutMinutes ?? 30) * 60000,
      );
      const touched = await this.db.authSession.updateMany({
        where: {
          id: payload.sid,
          userId: user.id,
          lastActivityAt: { gte: cutoff },
        },
        data: { lastActivityAt: new Date() },
      });
      if (!touched.count) throw new Error();
      const session = await this.db.authSession.findUnique({
        where: { id: payload.sid },
      });
      if (session?.terminalId) {
        const terminal = await this.db.terminal.findUnique({
          where: { id: session.terminalId },
        });
        if (
          !terminal ||
          terminal.revokedAt ||
          terminal.branchId !== user.branchId
        )
          throw new Error();
        await this.db.terminal.update({
          where: { id: terminal.id },
          data: { lastActivityAt: new Date() },
        });
      }
      req.actor = {
        sessionId: payload.sid,
        terminalId: session?.terminalId ?? undefined,
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.name,
        permissions: user.role.permissions,
        branchId: user.branchId,
      };
    } catch {
      throw new HttpException("Inicia sesión para continuar.", 401);
    }
    const permission = this.reflector.getAllAndOverride<string>("permission", [
      context.getHandler(),
      context.getClass(),
    ]);
    if (permission && !can(req.actor.permissions, permission)) denied();
    return true;
  }
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = "No se pudo completar la operación. Intenta de nuevo.";
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === "string"
          ? response
          : String((response as any).message);
    } else if (exception instanceof ZodError) {
      status = 400;
      message =
        "Revisa los campos: " +
        exception.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; ");
    } else if (exception?.code === "P2002") {
      status = 409;
      message = "Ya existe un registro con esos datos.";
    } else if (exception?.code === "P2025") {
      status = 404;
      message = "El registro no existe.";
    } else if (exception?.code === "P2034") {
      status = 409;
      message = "Otra operación modificó estos datos. Reintenta.";
    }
    if (status === 500) console.error(exception);
    res.status(status).json({ statusCode: status, message });
  }
}

export function safeErrorMessage(error: any): string {
  if (error instanceof HttpException) {
    const response = error.getResponse();
    return typeof response === "string"
      ? response
      : "Revisa los datos de la operación.";
  }
  if (error?.code === "P2025")
    return "El registro no existe o ya no está disponible.";
  if (error?.code === "P2002") return "Ya existe un registro con esos datos.";
  if (error?.code === "P2034")
    return "Otra operación modificó estos datos. Reintenta.";
  return "No se pudo completar la operación. Revisa la venta e intenta de nuevo.";
}
