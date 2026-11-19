// Auditoría lote A (19-nov-2026): pruebas unitarias de los arreglos A1-A6.
import { describe, expect, it } from "vitest";
import { dateRange } from "../apps/api/src/reports";

describe("A1 · dateRange acepta fecha sola o fecha con hora", () => {
  it("fecha sola cubre el día entero en UTC-4", () => {
    const r = dateRange({ from: "2026-11-19", to: "2026-11-19" });
    expect(r.gte.toISOString()).toBe("2026-11-19T04:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-11-20T03:59:59.999Z");
  });
  it("fecha con hora (lo que manda Caja) se usa tal cual", () => {
    const r = dateRange({
      from: "2026-11-19T00:00:00-04:00",
      to: "2026-11-19T23:59:59-04:00",
    });
    expect(r.gte.toISOString()).toBe("2026-11-19T04:00:00.000Z");
    expect(r.lte.toISOString()).toBe("2026-11-20T03:59:59.000Z");
  });
  it("sigue rechazando fechas inválidas o al revés", () => {
    expect(() => dateRange({ from: "basura" })).toThrow(/Rango de fechas/);
    expect(() =>
      dateRange({ from: "2026-11-20", to: "2026-11-19T00:00:00-04:00" }),
    ).toThrow(/Rango de fechas/);
  });
});

// A2: al recalcular una caja cerrada, la transferencia contada (la pone el
// sistema al cerrar) sigue a la esperada; efectivo y tarjeta no se tocan.
function fakeTx(payments: any[]) {
  const updates: any[] = [];
  return {
    updates,
    payment: { findMany: async () => payments },
    cashMovement: { findMany: async () => [] },
    saleReturn: { findMany: async () => [] },
    cashSession: { update: async (args: any) => updates.push(args) },
  };
}
const closedSession = (extra: Record<string, unknown> = {}) => ({
  id: "s1",
  openingAmount: 1000,
  countedCash: 1500,
  countedCard: 300,
  countedTransfer: 800, // lo esperado al cerrar
  closedAt: new Date("2026-11-18T22:00:00Z"),
  closeDetails: { vouchers: 0, transferBySystem: true },
  ...extra,
});
const pay = (method: string, amount: number) => ({
  method,
  amount,
  currency: "DOP",
  change: 0,
  amountUsd: 0,
});

describe("A2 · caja cerrada: transferencia contada sigue a la esperada", () => {
  it("un abono por transferencia verificado tras el cierre no deja faltante", async () => {
    const { refreshClosedCash } = await import("../apps/api/src/cash");
    // Al cerrar: 500 efectivo, 300 tarjeta, 800 transferencia. Luego se
    // verifica un abono de 200 por transferencia.
    const tx = fakeTx([
      pay("cash", 500),
      pay("card", 300),
      pay("transfer", 800),
      pay("transfer", 200),
    ]);
    const diff = await refreshClosedCash(tx, closedSession());
    expect(diff.transfer).toBe(0);
    expect(diff.cash).toBe(0);
    expect(diff.card).toBe(0);
    const data = tx.updates[0].data;
    expect(Number(data.countedTransfer)).toBe(1000);
    expect(Number(data.expectedTransfer)).toBe(1000);
    expect(Number(data.differenceTransfer)).toBe(0);
    expect(data.countedCash).toBeUndefined();
    expect(data.countedCard).toBeUndefined();
  });
  it("una transferencia rechazada tras el cierre no deja sobrante", async () => {
    const { refreshClosedCash } = await import("../apps/api/src/cash");
    // Se rechazó una transferencia de 300: queda 500 por transferencia.
    const tx = fakeTx([
      pay("cash", 500),
      pay("card", 300),
      pay("transfer", 500),
    ]);
    const diff = await refreshClosedCash(tx, closedSession());
    expect(diff.transfer).toBe(0);
    expect(diff.cash).toBe(0);
    expect(Number(tx.updates[0].data.countedTransfer)).toBe(500);
  });
  it("un cierre viejo con transferencia escrita por la cajera no se pisa", async () => {
    const { refreshClosedCash } = await import("../apps/api/src/cash");
    const tx = fakeTx([
      pay("cash", 500),
      pay("card", 300),
      pay("transfer", 1000),
    ]);
    const diff = await refreshClosedCash(
      tx,
      closedSession({
        closedAt: new Date("2026-10-10T22:00:00Z"),
        closeDetails: { vouchers: 0 },
      }),
    );
    expect(diff.transfer).toBe(-200);
    expect(tx.updates[0].data.countedTransfer).toBeUndefined();
  });
});

// A3: abrir con menos fondo que el último cierre no se bloquea, pero deja una
// alerta alta con el faltante, quién abrió y la nota.
function fakeOpenDb(lastLeft: number) {
  const alerts: any[] = [];
  const created: any[] = [];
  const tx: any = {
    $queryRaw: async () => [],
    cashSession: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        const row = { id: "new-session", ...data };
        created.push(row);
        return row;
      },
    },
    auditLog: { create: async () => ({}) },
    alert: { upsert: async (args: any) => alerts.push(args) },
  };
  const db: any = {
    cashSession: {
      findFirst: async ({ where }: any) =>
        where.closedAt === null
          ? null
          : { id: "last", countedCash: lastLeft, closeDetails: {} },
    },
    $transaction: async (fn: any) => fn(tx),
  };
  return { db, alerts, created };
}
const opener = {
  id: "u1",
  name: "Cajera Prueba",
  branchId: "main",
  permissions: ["cash:write"],
  terminalId: "t1",
} as any;

describe("A3 · fondo de apertura menor deja alerta alta", () => {
  it("abre la caja y crea la alerta opening_shortfall", async () => {
    const { CashController } = await import("../apps/api/src/cash");
    const { db, alerts, created } = fakeOpenDb(2000);
    const row: any = await new CashController(db).open(
      { openingAmount: 1500, openingNote: "Me dieron menos cambio" },
      opener,
    );
    expect(row.id).toBe("new-session");
    expect(created).toHaveLength(1);
    expect(alerts).toHaveLength(1);
    const alert = alerts[0].create;
    expect(alert.type).toBe("opening_shortfall");
    expect(alert.severity).toBe("high");
    expect(alert.entityId).toBe("new-session");
    expect(alert.message).toContain("Cajera Prueba");
    expect(alert.message).toContain("500.00");
    expect(alert.message).toContain("Me dieron menos cambio");
  });
  it("con fondo igual o mayor no crea alerta", async () => {
    const { CashController } = await import("../apps/api/src/cash");
    const { db, alerts } = fakeOpenDb(2000);
    await new CashController(db).open({ openingAmount: 2000 }, opener);
    expect(alerts).toHaveLength(0);
  });
  it("es un tipo manual (la evaluación periódica no la borra)", async () => {
    const { MANUAL_ALERT_TYPES } = await import("../apps/api/src/alerts");
    expect(MANUAL_ALERT_TYPES).toContain("opening_shortfall");
  });
});

// A4: ajuste/merma/devolución con clave repetida no mueve existencias otra vez.
const VARIANT = "11111111-1111-4111-8111-111111111111";
const OP = "22222222-2222-4222-8222-222222222222";
function fakeInventoryDb(previous: any) {
  const calls: string[] = [];
  const tx: any = {
    $queryRaw: async () => [],
    auditLog: {
      findFirst: async () => {
        calls.push("audit.findFirst");
        return previous;
      },
    },
    variant: {
      findFirstOrThrow: async () => ({
        id: VARIANT,
        stock: 7,
        costAvg: 100,
        product: { category: { requiresLot: false } },
        lots: [],
      }),
      update: async () => calls.push("variant.update"),
    },
    settings: { findUnique: async () => null },
    variantStock: { findMany: async () => [] },
    warehouse: {
      findFirst: async () => {
        calls.push("warehouse");
        throw new Error("camino normal");
      },
    },
    inventoryMovement: { create: async () => calls.push("movement") },
    supplier: { findFirstOrThrow: async () => ({}) },
  };
  const db: any = { $transaction: async (fn: any) => fn(tx) };
  return { db, calls };
}
const inventoryActor = {
  id: "u1",
  name: "Gerente",
  branchId: "main",
  permissions: ["*"],
  terminalId: "t1",
} as any;

describe("A4 · ajustes de inventario con clave de operación", () => {
  it("clave repetida devuelve la variante sin mover existencias", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db, calls } = fakeInventoryDb({
      action: "waste",
      after: { operationId: OP, qty: -2, variantId: VARIANT },
    });
    const result: any = await new InventoryController(db).adjustment(
      {
        variantId: VARIANT,
        qty: -2,
        reason: "Se rompió",
        type: "waste",
        operationId: OP,
      },
      inventoryActor,
    );
    expect(result.id).toBe(VARIANT);
    expect(calls).toContain("audit.findFirst");
    expect(calls).not.toContain("movement");
    expect(calls).not.toContain("variant.update");
    expect(calls).not.toContain("warehouse");
  });
  it("la misma clave con otra cantidad es un error", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db } = fakeInventoryDb({
      action: "waste",
      after: { operationId: OP, qty: -2 },
    });
    await expect(
      new InventoryController(db).adjustment(
        {
          variantId: VARIANT,
          qty: -5,
          reason: "Se rompió",
          type: "waste",
          operationId: OP,
        },
        inventoryActor,
      ),
    ).rejects.toThrow(/clave de la operación/);
  });
  it("sin clave sigue el camino de siempre (compatible)", async () => {
    const { InventoryController } = await import("../apps/api/src/inventory");
    const { db, calls } = fakeInventoryDb(null);
    await expect(
      new InventoryController(db).adjustment(
        {
          variantId: VARIANT,
          warehouseId: OP,
          qty: -1,
          reason: "Ajuste de prueba",
        },
        inventoryActor,
      ),
    ).rejects.toThrow(/camino normal/);
    expect(calls).not.toContain("audit.findFirst");
  });
});

// A5: mensajes de validación en español claro y con plural correcto.
describe("A5 · mensajes de validación legibles", () => {
  const message = async (schema: any, input: unknown) => {
    const { validationMessage } = await import("../apps/api/src/common");
    return validationMessage(schema.safeParse(input).error.issues);
  };
  it("usuario vacío: «Escribe tu usuario.»", async () => {
    const { z } = await import("../packages/shared/src");
    const login = z.object({
      login: z.string().trim().min(1).max(120),
      password: z.string().min(1),
    });
    expect(await message(login, { login: "", password: "x" })).toBe(
      "Escribe tu usuario.",
    );
    expect(await message(login, { login: "", password: "" })).toBe(
      "Escribe tu usuario. Escribe tu contraseña.",
    );
    // La frase de un refine no lleva delante el nombre del campo.
    const refined = z
      .object({ login: z.string().optional() })
      .refine((v) => !!v.login, {
        message: "Escribe tu usuario.",
        path: ["login"],
      });
    expect(await message(refined, {})).toBe("Escribe tu usuario.");
  });
  it("otro campo vacío: «es obligatorio», nunca «1 caracteres»", async () => {
    const { z } = await import("../packages/shared/src");
    const text = await message(z.object({ reason: z.string().min(1) }), {
      reason: "",
    });
    expect(text).toBe("Revisa los campos: motivo es obligatorio.");
    expect(text).not.toMatch(/1 caracteres/);
  });
  it("plural correcto: «1 carácter», «3 caracteres», «1 elemento»", async () => {
    const { z } = await import("../packages/shared/src");
    expect(
      await message(z.object({ code: z.string().min(3) }), { code: "a" }),
    ).toBe("Revisa los campos: código debe tener al menos 3 caracteres.");
    expect(
      await message(z.object({ code: z.string().max(1) }), { code: "ab" }),
    ).toBe("Revisa los campos: código admite como máximo 1 carácter.");
    expect(
      await message(z.object({ items: z.array(z.number()).min(1) }), {
        items: [],
      }),
    ).toBe("Revisa los campos: línea debe tener al menos 1 elemento.");
  });
});

// A6: «Entradas por cuenta» separa las transferencias sin verificar.
describe("A6 · entradas por cuenta: transferencias por verificar aparte", () => {
  it("la consulta separa por estado y la fila dice «Por verificar»", async () => {
    const { dinero } = await import("../apps/api/src/reportes/dinero");
    let sql = "";
    const db: any = {
      $queryRaw: async (strings: TemplateStringsArray) => {
        sql = strings.join("?");
        return [
          {
            dia: "2026-11-19",
            method: "transfer",
            cuenta: "BHD",
            unverified: false,
            amount: 500,
            n: 1,
          },
          {
            dia: "2026-11-19",
            method: "transfer",
            cuenta: "BHD",
            unverified: true,
            amount: 300,
            n: 2,
          },
          {
            dia: "2026-11-19",
            method: "cash",
            cuenta: "Sin indicar",
            unverified: false,
            amount: 100,
            n: 1,
          },
        ];
      },
      cashSession: { findFirst: async () => null },
    };
    const actor: any = { id: "u1", branchId: "main", permissions: ["*"] };
    const rows: any[] = await dinero["entradas-cuenta"].run(
      db,
      actor,
      dateRange({ from: "2026-11-19", to: "2026-11-19" }),
      {},
    );
    expect(sql).toMatch(/p\.status <> 'ok'/);
    const bhd = rows.filter((r) => r["Cuenta / terminal"] === "BHD");
    expect(bhd.map((r) => [r.Estado, r.Monto])).toEqual([
      ["Llegó", 500],
      ["Por verificar", 300],
    ]);
    expect(rows.find((r) => r.Forma === "Efectivo").Estado).toBe("Llegó");
  });
});
