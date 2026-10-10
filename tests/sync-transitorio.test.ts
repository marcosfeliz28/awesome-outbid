// N-M3 (auditoría 06 v2): /sales/sync trataba un 503, un interbloqueo o un
// P2028 como «conflicto offline» definitivo: alerta de severidad alta, bitácora
// y la caja bloqueada hasta que gerencia descartaba con su PIN una venta
// buena. Ahora un error transitorio responde `retry` (la venta sigue pendiente
// en la cola y se reenvía con el mismo UUID) y un conflicto real sigue siéndolo
// (con el detalle de lo vendido, N8).
import { afterEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { SalesController } from "../apps/api/src/sales";
import {
  databaseUnavailable,
  isTransientDbError,
} from "../apps/api/src/database-errors";
import { bad, isUnexpectedError } from "../apps/api/src/common";

// Lo que llegaría a Sentry (el SDK real sólo existe con un DSN).
const captured: { error: unknown; area: string }[] = [];
vi.mock("../apps/api/src/monitoring", () => ({
  captureApiException: (error: unknown, area: string) =>
    captured.push({ error, area }),
  initializeApiMonitoring: () => false,
}));

// @nestjs/common es dependencia de la API, no de la raíz.
const { HttpException } = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("@nestjs/common");

const actor: any = {
  id: "cajera-1",
  name: "Cajera",
  email: "c@example.test",
  role: "seller",
  permissions: ["sale:write"],
  branchId: "main",
};
const prisma = (
  code: string,
  name = "PrismaClientKnownRequestError",
  meta?: any,
) => Object.assign(new Error("Prisma " + code), { code, name, meta });
const deadlock = () =>
  prisma("P2010", "PrismaClientKnownRequestError", {
    code: "40P01",
    message: "ERROR: deadlock detected",
  });
const sale = (extra: object = {}) => ({
  offlineUuid: randomUUID(),
  capturedAt: new Date(Date.now() - 60_000).toISOString(),
  customerId: randomUUID(),
  cashSessionId: randomUUID(),
  items: [{ variantId: randomUUID(), qty: 2, discountPercent: 0 }],
  globalDiscount: 0,
  expectedTotal: 236,
  payments: [{ method: "cash", amount: 240, reference: "secreto-no-guardar" }],
  ...extra,
});

function setup(outcome: (input: any) => unknown) {
  const writes: string[] = [];
  const audits: any[] = [];
  const model = (name: string) =>
    new Proxy(
      {},
      {
        get: (_, method) => async (args: any) => {
          writes.push(name + "." + String(method));
          if (name === "auditLog" && String(method) === "create")
            audits.push(args.data);
          return null;
        },
      },
    );
  const db: any = new Proxy(
    {},
    {
      get: (_, prop) => {
        if (prop === "$transaction") return async (fn: any) => fn(db);
        if (prop === "then") return undefined;
        return model(String(prop));
      },
    },
  );
  const controller = new SalesController(db);
  const completed: string[] = [];
  (controller as any).complete = async (_actor: any, input: any) => {
    completed.push(input.offlineUuid);
    const result = outcome(input);
    if (result instanceof Error) throw result;
    return result;
  };
  return { controller, writes, audits, completed };
}

describe("N-M3 · /sales/sync y los errores transitorios", () => {
  it("reconoce lo transitorio y no confunde una regla de negocio", () => {
    expect(isTransientDbError(databaseUnavailable())).toBe(true);
    expect(isTransientDbError(deadlock())).toBe(true);
    expect(isTransientDbError(prisma("P2028"))).toBe(true);
    expect(isTransientDbError(prisma("P2024"))).toBe(true);
    expect(isTransientDbError(prisma("P2034"))).toBe(true);
    expect(
      isTransientDbError(
        new HttpException(
          "Otra operación modificó el inventario. Reintenta.",
          409,
          {
            cause: prisma("P2034"),
          },
        ),
      ),
    ).toBe(true);
    // Reglas de negocio y restricciones: se repiten igual.
    expect(
      isTransientDbError(new HttpException("Stock insuficiente", 409)),
    ).toBe(false);
    expect(isTransientDbError(new HttpException("Sin permiso", 403))).toBe(
      false,
    );
    expect(isTransientDbError(prisma("P2002"))).toBe(false);
    expect(isTransientDbError(prisma("P2003"))).toBe(false);
    expect(
      isTransientDbError(
        Object.assign(
          new Error(
            'PostgresError { code: "23514", message: "violates check constraint \\"x\\"" }',
          ),
          { name: "PrismaClientUnknownRequestError" },
        ),
      ),
    ).toBe(false);
  });

  it.each([
    ["503 DB_UNAVAILABLE", () => databaseUnavailable()],
    ["interbloqueo 40P01", () => deadlock()],
    ["P2028 transacción vencida", () => prisma("P2028")],
    ["P2024 pool lleno", () => prisma("P2024")],
  ])(
    "%s responde retry sin alerta ni bitácora de conflicto",
    async (_, make) => {
      const { controller, writes } = setup(() => make());
      const input = sale();
      const { results } = await controller.sync({ sales: [input] }, actor);
      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        offlineUuid: input.offlineUuid,
        status: "retry",
      });
      expect(results[0].message).toMatch(/se reintentará sola/);
      expect(writes).toEqual([]);
    },
  );

  it("con la base caída, las ventas que faltan se devuelven como retry sin intentarlas", async () => {
    const { controller, completed, writes } = setup(() =>
      databaseUnavailable(),
    );
    const sales = [sale(), sale(), sale()];
    const { results } = await controller.sync({ sales }, actor);
    expect(results.map((r: any) => r.status)).toEqual([
      "retry",
      "retry",
      "retry",
    ]);
    expect(completed).toEqual([sales[0].offlineUuid]);
    expect(writes).toEqual([]);
  });

  it("un interbloqueo no frena a las demás ventas del lote", async () => {
    const sales = [sale(), sale()];
    const { controller, completed } = setup((input) =>
      input.offlineUuid === sales[0].offlineUuid ? deadlock() : { id: "ok" },
    );
    const { results } = await controller.sync({ sales }, actor);
    expect(results.map((r: any) => r.status)).toEqual(["retry", "synced"]);
    expect(completed).toHaveLength(2);
  });

  it("un conflicto real sigue siendo conflicto, con alerta y el detalle de lo vendido (N8)", async () => {
    const { controller, writes, audits } = setup(() => {
      try {
        bad("Stock insuficiente para Jogger Relax");
      } catch (e) {
        return e as Error;
      }
      return new Error("inalcanzable");
    });
    const input = sale();
    const { results } = await controller.sync({ sales: [input] }, actor);
    expect(results[0]).toMatchObject({
      offlineUuid: input.offlineUuid,
      status: "conflict",
    });
    expect(writes).toContain("alert.upsert");
    const conflict = audits.find((a) => a.action === "offline_sale_conflict");
    expect(conflict).toBeTruthy();
    const after = conflict.after;
    expect(after.detail.items).toEqual([
      { variantId: input.items[0].variantId, qty: 2, discountPercent: 0 },
    ]);
    expect(after.detail.payments).toEqual([{ method: "cash", amount: 240 }]);
    expect(after.detail.customerId).toBe(input.customerId);
    // Nunca la referencia del pago.
    expect(JSON.stringify(after)).not.toContain("secreto-no-guardar");
  });
});

// W9 (auditoría 07 v2, E-1): el `catch` de /sales/sync convertía CUALQUIER
// excepción en «conflicto» sin dejar rastro. El contrato de la respuesta no
// cambia (sigue siendo `conflict` con alerta), pero un error que no es de
// negocio ahora se registra en la consola y en Sentry; una regla de negocio, un
// conflicto de datos o un error transitorio no.
describe("W9 · /sales/sync registra los errores inesperados", () => {
  const spies = () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    captured.length = 0;
    return logged;
  };
  afterEach(() => vi.restoreAllMocks());

  it("un TypeError sigue siendo conflicto con el mismo contrato, pero se registra con el UUID y se envía a Sentry", async () => {
    const logged = spies();
    const boom = new TypeError("Cannot read properties of undefined");
    const { controller, writes } = setup(() => boom);
    const input = sale();
    const { results } = await controller.sync({ sales: [input] }, actor);
    expect(results).toEqual([
      {
        offlineUuid: input.offlineUuid,
        status: "conflict",
        message:
          "No se pudo completar la operación. Revisa la venta e intenta de nuevo.",
      },
    ]);
    expect(writes).toContain("alert.upsert");
    expect(logged).toHaveBeenCalledTimes(1);
    expect(String(logged.mock.calls[0][0])).toContain(input.offlineUuid);
    expect(logged.mock.calls[0][1]).toBe(boom);
    expect(captured).toEqual([{ error: boom, area: "sales" }]);
  });

  it("un 500 o un error de Prisma desconocido también se registran", async () => {
    const logged = spies();
    const unknown = prisma("P2003", "PrismaClientKnownRequestError");
    const { controller } = setup((input) =>
      input.offlineUuid === first.offlineUuid
        ? new HttpException("fallo interno", 500)
        : unknown,
    );
    const first = sale();
    const second = sale();
    const { results } = await controller.sync(
      { sales: [first, second] },
      actor,
    );
    expect(results.map((r: any) => r.status)).toEqual(["conflict", "conflict"]);
    expect(logged).toHaveBeenCalledTimes(2);
    expect(captured).toHaveLength(2);
  });

  it.each([
    [
      "una regla de negocio (400)",
      () => new HttpException("Stock insuficiente", 400),
    ],
    ["un permiso (403)", () => new HttpException("Sin permiso", 403)],
    [
      "un conflicto de datos (409)",
      () => new HttpException("La caja ya está cerrada", 409),
    ],
    ["P2002 (duplicado)", () => prisma("P2002")],
    ["P2025 (no existe)", () => prisma("P2025")],
    ["un interbloqueo (reintento)", () => deadlock()],
    ["la base caída (reintento)", () => databaseUnavailable()],
  ])("%s no se registra como error inesperado", async (_, make) => {
    const logged = spies();
    const { controller } = setup(() => make());
    await controller.sync({ sales: [sale()] }, actor);
    expect(logged).not.toHaveBeenCalled();
    expect(captured).toEqual([]);
  });

  it("isUnexpectedError separa lo de programación de lo de negocio", () => {
    expect(isUnexpectedError(new TypeError("x"))).toBe(true);
    expect(isUnexpectedError(new HttpException("x", 500))).toBe(true);
    expect(isUnexpectedError(new HttpException("x", 400))).toBe(false);
    expect(isUnexpectedError(prisma("P2002"))).toBe(false);
    expect(isUnexpectedError(deadlock())).toBe(false);
  });
});
