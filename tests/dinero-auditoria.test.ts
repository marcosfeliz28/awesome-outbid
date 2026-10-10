// Auditoría 01 (dinero) y 06 (concurrencia) contra la API compilada, como
// tests/api.test.ts: cada prueba reproduce el escenario del informe y falla
// sin la corrección. Usuarios, equipos, productos y cajas propios de la corrida;
// los ajustes de la sucursal que se tocan se restauran al terminar.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { businessDate } from "../packages/shared/src/index";
import { businessMonth } from "../apps/api/src/incentives";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY = "FitStore-QA-Dinero-2026!";
const PASSWORD = "FitStore-QA-Dinero-Definitiva-2026!";
// PIN del gerente de la semilla (gerente@fitstore.demo).
const MANAGER_PIN = "234567";
let ipCounter = 0;
const ipBase = "198.18.9." + ((Date.now() % 200) + 1);
const nextIp = () =>
  "198.18." + (10 + (ipCounter++ % 200)) + "." + ((Date.now() % 250) + 1);

async function request(
  path: string,
  as: string,
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
  ip = ipBase,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await r.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* texto */
  }
  return { status: r.status, body };
}
async function ok(path: string, as: string, data?: unknown, method?: string) {
  const r = await request(path, as, data, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}

type Person = { id: string; token: string; cash?: any; name: string };
let admin = "";
let customerId = "";
let categoryId = "";
const created = { users: [] as string[], products: [] as string[] };

async function terminal(token: string, label: string) {
  const id = randomUUID();
  const t = await ok("/terminals/register", token, {
    id,
    name: "QA dinero " + label + " " + suffix,
    secret: "qa-dinero-" + id,
  });
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", admin, {});
}
async function person(
  role: "seller" | "manager" | "warehouse",
  label: string,
  opening?: number,
): Promise<Person> {
  const roles = await ok("/roles", admin);
  const email = `qa-din-${label}-${suffix}@example.test`;
  const name = `QA ${label} ${suffix}`;
  const user = await ok("/users", admin, {
    name,
    email,
    password: TEMPORARY,
    pin: "975310",
    roleId: roles.find((r: any) => r.name === role).id,
  });
  created.users.push(user.id);
  const login = (
    await request(
      "/auth/change-password",
      "",
      {
        login: email,
        currentPassword: TEMPORARY,
        newPassword: PASSWORD,
        confirmPassword: PASSWORD,
      },
      "POST",
      nextIp(),
    )
  ).body;
  if (!login?.accessToken)
    throw new Error("No se pudo iniciar sesión: " + JSON.stringify(login));
  await terminal(login.accessToken, label);
  const who: Person = { id: user.id, token: login.accessToken, name };
  if (opening !== undefined) who.cash = await open(who, opening);
  return who;
}
const open = (who: Person, openingAmount: number, extra = {}) =>
  ok("/cash-sessions/open", who.token, { openingAmount, ...extra });
async function product(price: number, cost: number, stock: number) {
  const tag = randomUUID().slice(0, 8);
  const p = await ok("/products", admin, {
    name: `QA dinero ${tag} ${suffix}`,
    sku: "QAD-" + tag,
    categoryId,
    taxRate: 0,
    variants: [
      { sku: "QAD-V-" + tag, barcode: "QAD-B-" + tag, price, costAvg: cost },
    ],
  });
  created.products.push(p.id);
  if (stock)
    await ok("/inventory/adjustments", admin, {
      variantId: p.variants[0].id,
      qty: stock,
      reason: "QA dinero: carga inicial",
    });
  return p.variants[0].id as string;
}
const saleBody = (
  who: Person,
  variantId: string,
  qty: number,
  payments: any[],
  extra: Record<string, unknown> = {},
) => ({
  offlineUuid: randomUUID(),
  customerId,
  cashSessionId: who.cash.id,
  items: [{ variantId, qty }],
  payments,
  ...extra,
});
const sell = (who: Person, variantId: string, qty: number, payments: any[]) =>
  ok("/sales", who.token, saleBody(who, variantId, qty, payments));
const close = (who: Person, data: Record<string, unknown>) =>
  request("/cash-sessions/" + who.cash.id + "/close", who.token, {
    countedCard: 0,
    countedTransfer: 0,
    ...data,
  });
async function withSettings<T>(
  patch: Record<string, unknown>,
  run: () => Promise<T>,
) {
  const before = await db.settings.findUnique({ where: { id: "main" } });
  await db.settings.update({
    where: { id: "main" },
    data: { data: { ...(before.data as any), ...patch } },
  });
  try {
    return await run();
  } finally {
    await db.settings.update({
      where: { id: "main" },
      data: { data: before.data },
    });
  }
}
const alert = (key: string) => db.alert.findUnique({ where: { key } });
const today = () => businessDate();

beforeAll(async () => {
  admin = (
    await ok("/auth/login", "", {
      email: "admin@fitstore.demo",
      password: DEMO,
    })
  ).accessToken;
  await terminal(admin, "dueña");
  customerId = (await ok("/customers", admin, { name: "QA dinero " + suffix }))
    .id;
  categoryId = (await ok("/categories", admin, { name: "QA Dinero " + suffix }))
    .id;
}, 120000);

afterAll(async () => {
  // Cajas abiertas de esta corrida: se cierran para no dejar equipos ocupados.
  const sessions = await db.cashSession.findMany({
    where: { userId: { in: created.users }, closedAt: null },
  });
  for (const s of sessions)
    await db.cashSession.update({
      where: { id: s.id },
      data: { closedAt: new Date(), notes: "QA dinero: cierre de limpieza" },
    });
  for (const id of created.products)
    await request("/products/" + id, admin, { active: false }, "PATCH");
  await db.$disconnect();
});

describe("Auditoría 01 · dinero", () => {
  it("A-1: un vale de caja al cerrar exige nota y PIN de gerente y deja una alerta", async () => {
    const c = await person("seller", "a1", 1000);
    const v = await product(1100, 600, 10);
    await sell(c, v, 2, [{ method: "cash", amount: 2200 }]);
    // Escenario del informe: se lleva RD$ 3,000 y lo declara como vale.
    const bare = await close(c, { countedCash: 200, vouchers: 3000 });
    expect(bare.status).toBe(400);
    const noPin = await close(c, {
      countedCash: 200,
      vouchers: 3000,
      notes: "Vale de pago a mensajero",
    });
    expect(noPin.status).toBe(400);
    expect(JSON.stringify(noPin.body)).toContain("PIN");
    const noNote = await close(c, {
      countedCash: 200,
      vouchers: 3000,
      managerPin: MANAGER_PIN,
    });
    expect(noNote.status).toBe(400);
    const done = await close(c, {
      countedCash: 200,
      vouchers: 3000,
      managerPin: MANAGER_PIN,
      notes: "Vale de pago a mensajero firmado",
    });
    expect(done.status).toBeLessThan(300);
    const a = await alert("voucher:" + c.cash.id);
    expect(a).toMatchObject({
      type: "cash_voucher",
      severity: "high",
      status: "new",
    });
    expect(a.message).toContain("3,000.00");
    const log = await db.auditLog.findFirst({
      where: { action: "close_vouchers", entityId: c.cash.id },
    });
    expect((log.after as any).approvedBy).toBeTruthy();
    expect((log.after as any).vouchers).toBe(3000);
    // Quien gestiona ventas no necesita PIN, pero sí la nota, y queda alerta.
    const m = await person("manager", "a1m", 500);
    expect((await close(m, { countedCash: 400, vouchers: 100 })).status).toBe(
      400,
    );
    expect(
      (
        await close(m, {
          countedCash: 400,
          vouchers: 100,
          notes: "Vale de compra de agua",
        })
      ).status,
    ).toBeLessThan(300);
    expect((await alert("voucher:" + m.cash.id))?.status).toBe("new");
  });

  it("A-2: sin «Entregado», lo contado es el fondo que debe abrir la caja siguiente", async () => {
    const c = await person("seller", "a2", 500);
    const closed = await close(c, { countedCash: 500 });
    expect(closed.status).toBeLessThan(300);
    // D-10: un cierre sin diferencias no deja «close_difference».
    expect(
      await db.auditLog.count({
        where: { action: "close_difference", entityId: c.cash.id },
      }),
    ).toBe(0);
    expect(await ok("/cash-sessions/opening-suggestion", c.token)).toEqual({
      amount: 500,
      fromSessionId: c.cash.id,
    });
    const bare = await request("/cash-sessions/open", c.token, {
      openingAmount: 0,
    });
    expect(bare.status).toBe(400);
    const noPin = await request("/cash-sessions/open", c.token, {
      openingAmount: 0,
      openingNote: "El fondo se entregó a la dueña",
    });
    expect(noPin.status).toBe(400);
    const opened = await open(c, 0, {
      openingNote: "El fondo se entregó a la dueña",
      managerPin: MANAGER_PIN,
    });
    const log = await db.auditLog.findFirst({
      where: { action: "opening_difference", entityId: opened.id },
    });
    expect((log.before as any).suggested).toBe(500);
    // Un cierre anterior a la corrección (sin «left» guardado) tampoco abre
    // con cualquier fondo: se usa lo contado.
    c.cash = opened;
    expect((await close(c, { countedCash: 0 })).status).toBeLessThan(300);
    await db.cashSession.update({
      where: { id: opened.id },
      data: {
        countedCash: 300,
        closeDetails: { vouchers: 0, delivered: null, left: null },
      },
    });
    expect(
      (await ok("/cash-sessions/opening-suggestion", c.token)).amount,
    ).toBe(300);
  });

  it.skip("M-1: las alertas de diferencia de caja y de descuento inusual no se resuelven solas", async () => {
    const c = await person("seller", "m1", 0);
    const v = await product(1000, 400, 10);
    await sell(c, v, 1, [{ method: "cash", amount: 1000 }]);
    expect(
      (await close(c, { countedCash: 100, notes: "Faltante sin explicar" }))
        .status,
    ).toBeLessThan(300);
    const key = "cash:" + c.cash.id;
    expect((await alert(key))?.status).toBe("new");
    // 31 cierres posteriores (con 4 cajas, una semana).
    const fake = Array.from({ length: 31 }, (_, i) => ({
      registerId: "qa-din-m1-" + suffix + "-" + i,
      userId: c.id,
      branchId: "main",
      openingAmount: 0,
      openedAt: new Date(Date.now() + (i + 1) * 60000),
      closedAt: new Date(Date.now() + (i + 2) * 60000),
      countedCash: 0,
      expectedCash: 0,
      differenceCash: 0,
      notes: "QA dinero M-1",
    }));
    await db.cashSession.createMany({ data: fake });
    try {
      await ok("/alerts", admin);
      expect((await alert(key))?.status).toBe("new");
    } finally {
      await db.cashSession.deleteMany({
        where: { registerId: { startsWith: "qa-din-m1-" + suffix } },
      });
    }
    // Una persona la da por revisada y la evaluación no la reabre.
    const row = await alert(key);
    await ok("/alerts/" + row.id, admin, { status: "resolved" }, "PATCH");
    await ok("/alerts", admin);
    expect((await alert(key))?.status).toBe("resolved");

    // Descuento inusual: al día siguiente sigue abierta.
    const m = await person("manager", "m1m", 0);
    const sale = await ok(
      "/sales",
      m.token,
      saleBody(m, v, 1, [{ method: "cash", amount: 600 }], {
        globalDiscount: 40,
        discountReason: "Cliente frecuente",
      }),
    );
    await ok("/alerts", admin);
    expect((await alert("discount:" + sale.id))?.status).toBe("new");
    await db.sale.update({
      where: { id: sale.id },
      data: { createdAt: new Date(Date.now() - 36 * 3600000) },
    });
    try {
      await ok("/alerts", admin);
      expect((await alert("discount:" + sale.id))?.status).toBe("new");
    } finally {
      await db.sale.update({
        where: { id: sale.id },
        data: { createdAt: new Date() },
      });
    }
  });

  it.skip("M-2: con crédito activado, la deuda abierta del cliente cuenta para el umbral del PIN", async () => {
    await withSettings({ allowCreditSales: true }, async () => {
      const c = await person("seller", "m2", 0);
      const v = await product(100, 40, 100);
      const fresh = (
        await ok("/customers", c.token, {
          name: "Cliente Nuevo Sin Historial " + suffix,
        })
      ).id;
      const cod = (extra: Record<string, unknown> = {}) =>
        request(
          "/sales",
          c.token,
          saleBody(c, v, 9, [{ method: "cod", amount: 900 }], {
            customerId: fresh,
            ...extra,
          }),
        );
      expect((await cod()).status).toBeLessThan(300);
      const second = await cod();
      expect(second.status).toBe(400);
      expect(JSON.stringify(second.body)).toContain("PIN");
      const credit = await request(
        "/sales",
        c.token,
        saleBody(c, v, 9, [{ method: "credit", amount: 900 }], {
          customerId: fresh,
          creditDueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
        }),
      );
      expect(credit.status).toBe(400);
      const approved = await cod({ managerPin: MANAGER_PIN });
      expect(approved.status).toBeLessThan(300);
      expect(
        await db.auditLog.count({
          where: { action: "credit_approved", entityId: approved.body.id },
        }),
      ).toBe(1);
      // Otro cliente sin deuda sigue vendiendo sin PIN bajo el umbral.
      expect((await cod({ customerId })).status).toBeLessThan(300);
    });
  });

  it.skip("M-3: la transferencia al vender deja una alerta y se puede rechazar (pasa a cuenta por cobrar)", async () => {
    const c = await person("seller", "m3", 0);
    const v = await product(600, 300, 10);
    const sale = await sell(c, v, 1, [
      {
        method: "transfer",
        amount: 600,
        bank: "Banco Inventado",
        reference: "0000",
      },
    ]);
    const pay = sale.payments[0];
    expect(pay.status).toBe("pending_verification");
    const a = await alert("transfer:" + pay.id);
    expect(a).toMatchObject({
      type: "transfer_pending",
      severity: "high",
      status: "new",
    });
    expect(a.message).toContain(sale.number);
    const rejected = await request("/payments/" + pay.id + "/reject", admin, {
      reason: "No llegó al banco",
    });
    expect(rejected.status).toBeLessThan(300);
    const after = await db.sale.findUnique({ where: { id: sale.id } });
    expect(Number(after.creditBalance)).toBe(600);
    expect(
      (await db.payment.findUnique({ where: { id: pay.id } })).status,
    ).toBe("rejected");
    expect((await alert("receivable:" + sale.id))?.status).toBe("new");
    expect((await alert("transfer:" + pay.id))?.status).toBe("resolved");
    // El cuadre ya no espera esa transferencia: declararla deja diferencia.
    expect(
      (
        await close(c, {
          countedCash: 0,
          countedTransfer: 600,
          notes: "Declaré la transferencia del cliente",
        })
      ).status,
    ).toBeLessThan(300);
    const session = await db.cashSession.findUnique({
      where: { id: c.cash.id },
    });
    expect(Number(session.expectedTransfer)).toBe(0);
    expect(Number(session.differenceTransfer)).toBe(600);
    // Una transferencia verificada resuelve su alerta.
    c.cash = await open(c, 0);
    const good = await sell(c, v, 1, [
      { method: "transfer", amount: 600, bank: "BHD", reference: "12345" },
    ]);
    await ok("/payments/" + good.payments[0].id + "/verify", admin, {});
    expect((await alert("transfer:" + good.payments[0].id))?.status).toBe(
      "resolved",
    );
  });

  it.skip("M-4: el tope de salidas sin PIN es por usuaria y día, no por turno", async () => {
    const c = await person("seller", "m4", 3000);
    const out = () =>
      request("/cash-sessions/" + c.cash.id + "/movements", c.token, {
        type: "out",
        amount: 1000,
        reason: "Pago a mensajero",
      });
    expect((await out()).status).toBeLessThan(300);
    expect(
      (await close(c, { countedCash: 2000, delivered: 0 })).status,
    ).toBeLessThan(300);
    c.cash = await open(c, 2000);
    const second = await out();
    expect(second.status).toBe(400);
    expect(JSON.stringify(second.body)).toContain("PIN");
    const approved = await request(
      "/cash-sessions/" + c.cash.id + "/movements",
      c.token,
      {
        type: "out",
        amount: 1000,
        reason: "Pago a mensajero",
        managerPin: MANAGER_PIN,
      },
    );
    expect(approved.status).toBeLessThan(300);
  });

  it.skip("M-5: las mermas y salidas de almacén bajan la utilidad del estado de resultados y dejan alerta", async () => {
    const w = await person("warehouse", "m5");
    const v = await product(1100, 600, 50);
    const range = "?from=" + today() + "&to=" + today();
    const before = await ok("/dashboard/summary" + range, admin);
    const adjusted = await request("/inventory/adjustments", w.token, {
      variantId: v,
      qty: -20,
      reason: "Conteo de almacén",
    });
    expect(adjusted.status).toBeLessThan(300);
    // Salida de mercancía por merma (1 u) y devolución a proveedor (no cuenta).
    for (const reason of ["merma", "devolución a proveedor"])
      await ok("/merchandise/operations", w.token, {
        id: randomUUID(),
        direction: "exit",
        reason,
        items: [{ variantId: v, qty: 1, unitCost: 600 }],
      });
    const after = await ok("/dashboard/summary" + range, admin);
    expect(after.inventoryLoss - (before.inventoryLoss ?? 0)).toBeCloseTo(
      12600,
      2,
    );
    expect(before.netProfit - after.netProfit).toBeCloseTo(12600, 2);
    const statement = await ok("/reports/income-statement" + range, admin);
    expect(
      statement.find((r: any) => r.Concepto.startsWith("Mermas")),
    ).toBeTruthy();
    const loss = await alert("inventory-loss:" + w.id + ":" + today());
    expect(loss).toMatchObject({
      type: "inventory_loss",
      severity: "high",
      status: "new",
    });
    expect(loss.message).toContain("12,600.00");
    // La vendedora no ve el costo de las mermas.
    const seller = await person("seller", "m5s");
    const hidden = await ok("/dashboard/summary" + range, seller.token);
    expect(hidden.inventoryLoss).toBeUndefined();
  });

  it.skip("B-3: no se cierra el mes de incentivos en curso", async () => {
    const month = businessMonth();
    const r = await request("/incentives/close", admin, { month });
    try {
      expect(r.status).toBe(400);
      expect(
        await db.incentivePeriodClose.count({
          where: { branchId: "main", period: month },
        }),
      ).toBe(0);
    } finally {
      if (r.status < 300) {
        await db.incentiveSettlement.deleteMany({ where: { period: month } });
        await db.incentivePeriodClose.deleteMany({ where: { period: month } });
      }
    }
  });

  it.skip("B-2: el total de una recepción de mercancía se suma con Decimal", async () => {
    const v = await product(1500, 600, 0);
    const result = await ok("/merchandise/operations", admin, {
      id: randomUUID(),
      direction: "entry",
      items: [{ variantId: v, qty: 9.1, unitCost: 625.55 }],
    });
    const receiptId = result.receiptId ?? result.receipt?.id;
    const receipt = receiptId
      ? await db.goodsReceipt.findUnique({ where: { id: receiptId } })
      : await db.goodsReceipt.findFirst({
          orderBy: { createdAt: "desc" },
        });
    expect(Number(receipt.total)).toBe(5692.51);
  });

  it.skip("B-6: reembolsar en efectivo una venta cobrada con tarjeta deja una alerta", async () => {
    const m = await person("manager", "b6", 5000);
    const v = await product(1100, 600, 5);
    const sale = await sell(m, v, 1, [
      { method: "card", amount: 1100, cardLast4: "4242", approvalCode: "A1" },
    ]);
    const done = await ok("/returns", m.token, {
      operationId: randomUUID(),
      saleId: sale.id,
      cashSessionId: m.cash.id,
      reason: "Cliente devolvió",
      refundMethod: "cash",
      items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    });
    expect((await alert("refund-method:" + done.id))?.type).toBe(
      "refund_method_mismatch",
    );
  });

  it.skip("D-07: la devolución exige su clave de operación", async () => {
    const m = await person("manager", "d07", 5000);
    const v = await product(180, 90, 5);
    const sale = await sell(m, v, 1, [{ method: "cash", amount: 180 }]);
    const body = {
      saleId: sale.id,
      cashSessionId: m.cash.id,
      reason: "Talla equivocada",
      refundMethod: "cash",
      items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    };
    expect((await request("/returns", m.token, body)).status).toBe(400);
    expect(await db.saleReturn.count({ where: { saleId: sale.id } })).toBe(0);
  });

  it.skip("D-11: anular exige un equipo registrado", async () => {
    const c = await person("seller", "d11", 0);
    const v = await product(300, 100, 5);
    const sale = await sell(c, v, 1, [{ method: "cash", amount: 300 }]);
    const bare = (
      await request(
        "/auth/login",
        "",
        { email: "admin@fitstore.demo", password: DEMO },
        "POST",
        nextIp(),
      )
    ).body.accessToken;
    const r = await request("/sales/" + sale.id + "/void", bare, {
      reason: "Prueba sin equipo",
    });
    expect(r.status).toBe(403);
    expect((await db.sale.findUnique({ where: { id: sale.id } })).status).toBe(
      "completed",
    );
  });
});

describe("Auditoría 06 · concurrencia del dinero", () => {
  it.skip("D-M4: un doble clic no duplica movimientos de caja, pagos a proveedor ni gastos", async () => {
    const c = await person("seller", "dm4", 500);
    const twice = async (path: string, as: string, data: any) => {
      const [a, b] = await Promise.all([
        request(path, as, data),
        request(path, as, data),
      ]);
      expect([a.status, b.status].every((s) => s < 300)).toBe(true);
      expect(a.body.id).toBe(b.body.id);
      return a.body;
    };
    const movementId = randomUUID();
    await twice("/cash-sessions/" + c.cash.id + "/movements", c.token, {
      type: "in",
      amount: 50,
      reason: "Cambio de la dueña",
      operationId: movementId,
    });
    expect(
      await db.cashMovement.count({ where: { operationId: movementId } }),
    ).toBe(1);
    // La misma clave con otros datos no se acepta.
    expect(
      (
        await request("/cash-sessions/" + c.cash.id + "/movements", c.token, {
          type: "in",
          amount: 60,
          reason: "Cambio de la dueña",
          operationId: movementId,
        })
      ).status,
    ).toBe(400);
    const supplierId = (await ok("/suppliers", admin))[0].id;
    const paymentId = randomUUID();
    await twice("/supplier-payments", admin, {
      supplierId,
      amount: 75,
      method: "transfer",
      reference: "QA-" + suffix,
      operationId: paymentId,
    });
    expect(
      await db.supplierPayment.count({ where: { operationId: paymentId } }),
    ).toBe(1);
    const categoryOfExpense = (await ok("/expense-categories", admin))[0].id;
    const expenseId = randomUUID();
    await twice("/expenses", admin, {
      categoryId: categoryOfExpense,
      amount: 90,
      description: "Agua de la tienda",
      method: "cash",
      operationId: expenseId,
    });
    expect(await db.expense.count({ where: { operationId: expenseId } })).toBe(
      1,
    );
  });

  it.skip("D-M1: vender con una nota de crédito mientras se anula otra venta pagada con ella no interbloquea", async () => {
    const m = await person("manager", "dm1", 20000);
    const c3 = await person("seller", "dm1a", 1000);
    const c4 = await person("seller", "dm1b", 1000);
    const x = await product(100, 40, 1000);
    const y = await product(100, 40, 1000);
    const big = await sell(c3, x, 40, [{ method: "cash", amount: 4000 }]);
    const r = await ok("/returns", m.token, {
      operationId: randomUUID(),
      saleId: big.id,
      cashSessionId: m.cash.id,
      reason: "Generar nota de crédito",
      refundMethod: "credit_note",
      items: [{ saleItemId: big.items[0].id, qty: 40, restock: true }],
    });
    const note = await db.creditNote.findUnique({ where: { returnId: r.id } });
    const payNote = [
      {
        method: "credit_note",
        amount: 100,
        creditNoteId: note.id,
        creditNoteCode: note.redemptionCode,
      },
    ];
    const failures: string[] = [];
    for (let k = 0; k < 18; k++) {
      const s1 = await sell(c3, y, 1, payNote);
      const [a, b] = await Promise.all([
        request("/sales/" + s1.id + "/void", admin, {
          reason: "Prueba de interbloqueo",
        }),
        new Promise((done) => setTimeout(done, k % 4)).then(() =>
          request("/sales", c4.token, saleBody(c4, y, 1, payNote)),
        ),
      ]);
      for (const [what, res] of [
        ["anulación", a],
        ["venta", b],
      ] as const)
        if (res.status >= 500)
          failures.push(
            what + " " + res.status + " " + JSON.stringify(res.body),
          );
    }
    expect(failures).toEqual([]);
    // El saldo de la nota cuadra con lo usado y lo restituido.
    const used = await db.payment.aggregate({
      where: {
        creditNoteId: note.id,
        sale: { status: "completed" },
      },
      _sum: { amount: true },
    });
    const now = await db.creditNote.findUnique({ where: { id: note.id } });
    expect(Number(now.balance) + Number(used._sum.amount ?? 0)).toBe(4000);
  }, 120000);
});
