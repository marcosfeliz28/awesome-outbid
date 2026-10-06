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
import { can, stockQty, z, ZodError } from "@fitstore/shared";
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
  terminalApproved?: boolean;
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
// Rutas que mueven inventario o dinero: exigen un equipo registrado, aprobado
// por un gerente y no revocado (Configuración › Equipos).
export const RequireTerminal = () => SetMetadata("terminal", true);
export function bad(message: string): never {
  throw new HttpException(message, 400);
}
export function denied(): never {
  throw new HttpException("No tienes permiso para realizar esta acción.", 403);
}
export function conflict(message: string): never {
  throw new HttpException(message, 409);
}
// Mensajes de validación en español y con nombres de campo comprensibles.
const FIELD_NAMES: Record<string, string> = {
  lines: "línea",
  items: "línea",
  payments: "pago",
  variants: "variante",
  qty: "cantidad",
  unitCost: "costo unitario",
  cost: "costo",
  costAvg: "costo",
  price: "precio",
  amount: "monto",
  name: "nombre",
  email: "correo",
  password: "contraseña",
  pin: "PIN",
  managerPin: "PIN del gerente",
  reason: "motivo",
  description: "descripción",
  code: "código",
  barcode: "código de barras",
  sku: "SKU",
  expiryDate: "vencimiento",
  lotNumber: "lote",
  openingAmount: "efectivo inicial",
  countedCash: "efectivo contado",
  countedCard: "tarjetas contadas",
  countedTransfer: "transferencias contadas",
  customerId: "cliente",
  categoryId: "categoría",
  supplierId: "proveedor",
  total: "total",
  freight: "flete",
  taxes: "impuestos",
  offlineUuid: "identificador de la operación",
  id: "identificador",
  cashSessionId: "caja",
  variantId: "producto",
  productId: "producto",
  saleId: "venta",
  saleItemId: "artículo vendido",
  globalDiscount: "descuento global",
  discountPercent: "descuento %",
  discountAmount: "descuento",
  method: "forma de pago",
  reference: "referencia",
  bank: "banco",
  approvalCode: "número de aprobación",
  cardLast4: "últimos 4 dígitos",
  expectedTotal: "total esperado",
  phone: "teléfono",
  legalId: "cédula/RNC",
  creditLimit: "límite de crédito",
  stock: "existencias",
  minStock: "stock mínimo",
  maxStock: "stock máximo",
  attributes: "atributos",
  mapping: "columnas",
};
export function fieldLabel(path: (string | number)[]) {
  const parts: string[] = [];
  for (const p of path) {
    if (typeof p === "number") {
      if (parts.length) parts[parts.length - 1] += " " + (p + 1);
      else parts.push("elemento " + (p + 1));
    } else parts.push(FIELD_NAMES[p] ?? p);
  }
  return parts.join(" · ") || "datos";
}
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined" || issue.received === "null")
        return { message: "es obligatorio" };
      return {
        message:
          issue.expected === "number"
            ? "debe ser un número"
            : issue.expected === "string"
              ? "debe ser texto"
              : "tiene un formato inválido",
      };
    case "too_small":
      return {
        message:
          issue.type === "string"
            ? `debe tener al menos ${issue.minimum} caracteres`
            : issue.type === "array"
              ? `debe tener al menos ${issue.minimum} elemento(s)`
              : issue.inclusive
                ? `debe ser mayor o igual a ${issue.minimum}`
                : `debe ser mayor que ${issue.minimum}`,
      };
    case "too_big":
      return {
        message:
          issue.type === "string"
            ? `admite como máximo ${issue.maximum} caracteres`
            : issue.type === "array"
              ? `admite como máximo ${issue.maximum} elementos`
              : `debe ser como máximo ${issue.maximum}`,
      };
    case "invalid_string":
      return { message: "tiene un formato inválido" };
    case "invalid_enum_value":
      return { message: "no es una opción válida" };
    case "invalid_date":
      return { message: "no es una fecha válida" };
    default:
      return { message: ctx.defaultError };
  }
});
// Reconoce el error de validación por su forma y no sólo por instanceof: así
// sigue siendo 400 aunque otro paquete cargue una copia distinta de zod (R4-08).
const isZodError = (e: any): e is ZodError =>
  e instanceof ZodError ||
  (e?.name === "ZodError" &&
    Array.isArray(e.issues) &&
    e.issues.every((i: any) => Array.isArray(i?.path)));
export const parse = <T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> => schema.parse(input);
export const uuid = z.string().uuid();
export const amount = z.number().nonnegative().max(100000000);
export const positive = z.number().positive().max(1000000);
// Toda cantidad que mueve o reserva existencias usa esta validación (R4-03).
export const qty = stockQty();
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
      // El bloqueo por contraseñas erróneas sólo impide iniciar sesión: si
      // cerrara las sesiones abiertas, cualquiera que conozca el correo
      // dejaría la caja sin cobrar (R9-seguridad-1).
      if (!user?.active) throw new Error();
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
      let terminalApproved = false;
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
          data: { lastActivityAt: new Date(), lastUserId: user.id },
        });
        // Un equipo sin secreto (anterior a la ronda 4) nunca opera.
        terminalApproved = !!terminal.approvedAt && !!terminal.secretHash;
      }
      req.actor = {
        sessionId: payload.sid,
        terminalId: session?.terminalId ?? undefined,
        terminalApproved,
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
    if (
      this.reflector.getAllAndOverride("terminal", [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      if (!req.actor.terminalId)
        throw new HttpException(
          {
            code: "TERMINAL_REQUIRED",
            message:
              "Este equipo no está registrado. Recarga la página para registrarlo.",
          },
          403,
        );
      if (!req.actor.terminalApproved)
        throw new HttpException(
          {
            code: "TERMINAL_PENDING",
            message:
              "Este equipo espera aprobación de un gerente (Configuración › Equipos o PIN de gerente en este equipo).",
          },
          403,
        );
    }
    return true;
  }
}
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      code: string | undefined,
      message = "No se pudo completar la operación. Intenta de nuevo.";
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      message =
        typeof response === "string"
          ? response
          : String((response as any).message);
      if (typeof response === "object" && (response as any).code)
        code = String((response as any).code);
    } else if (isZodError(exception)) {
      status = 400;
      message =
        "Revisa los campos: " +
        exception.issues
          .slice(0, 5)
          .map((i) => fieldLabel(i.path) + " " + i.message)
          .join("; ") +
        ".";
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
    res
      .status(status)
      .json({ statusCode: status, message, ...(code ? { code } : {}) });
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
