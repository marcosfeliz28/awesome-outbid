// Auditoría 05-A2 contra la API real: una venta sin conexión en conflicto se
// descarta con aprobación de gerencia (PIN en el equipo de la cajera o la
// sesión del gerente), con bitácora y alerta; nadie más la descarta.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

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
const ip =
  "198.18." + ((Date.now() % 200) + 1) + "." + ((Date.now() % 250) + 1);
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const MANAGER_PIN = "234567"; // gerente del seed (apps/api/prisma/seed.ts)
const tag = Date.now().toString(36);

async function call(path: string, data?: unknown, token = "", method?: string) {
  const response = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
async function ok(path: string, data?: unknown, token = "", method?: string) {
  const r = await call(path, data, token, method);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function enroll(token: string, owner: string) {
  const id = randomUUID();
  const t = await ok(
    "/terminals/register",
    { id, name: "QA A2 " + id.slice(0, 6), secret: "qa-a2-" + id },
    token,
  );
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", {}, owner);
}

let owner = "",
  manager = "";
const cashiers: { token: string; id: string; session: any }[] = [];
let variant: any,
  product: any,
  customerId = "";
const users: string[] = [];

beforeAll(async () => {
  owner = (
    await ok("/auth/login", { email: "admin@fitstore.demo", password: demo })
  ).accessToken;
  await enroll(owner, owner);
  manager = (
    await ok("/auth/login", { email: "gerente@fitstore.demo", password: demo })
  ).accessToken;
  await enroll(manager, owner);
  const roles = await ok("/roles", undefined, owner);
  const seller = roles.find((r: any) => r.name === "seller").id;
  for (const n of [1, 2]) {
    const email = `qa-a2-${n}-${tag}@example.test`;
    const user = await ok(
      "/users",
      {
        name: "QA Cajera A2 " + n,
        email,
        password: "FitStore-QA-2026!",
        pin: "13579" + n,
        roleId: seller,
      },
      owner,
    );
    users.push(user.id);
    const login = await ok("/auth/change-password", {
      login: email,
      currentPassword: "FitStore-QA-2026!",
      newPassword: "FitStore-QA-2026-Definitiva!",
      confirmPassword: "FitStore-QA-2026-Definitiva!",
    });
    await enroll(login.accessToken, owner);
    const session = await ok(
      "/cash-sessions/open",
      { openingAmount: 0, registerId: "qa-a2-" + n + "-" + tag },
      login.accessToken,
    );
    cashiers.push({ token: login.accessToken, id: login.user.id, session });
  }
  customerId = (await ok("/customers", { name: "QA Cliente A2 " + tag }, owner))
    .id;
  const categories = await ok("/categories", undefined, owner);
  product = await ok(
    "/products",
    {
      name: "QA A2 conflicto " + tag,
      sku: "QA-A2-" + tag,
      categoryId: categories.find((c: any) => c.name === "Fajas").id,
      variants: [
        {
          sku: "QA-A2V-" + tag,
          barcode: "QA-A2B-" + tag,
          price: 1000,
          costAvg: 400,
        },
      ],
    },
    owner,
  );
  variant = product.variants[0];
});

afterAll(async () => {
  await call("/products/" + product?.id, { active: false }, owner, "PATCH");
  for (const c of cashiers)
    await call(
      "/cash-sessions/" + c.session.id + "/close",
      { countedCash: 0, countedCard: 0, countedTransfer: 0, notes: "QA A2" },
      owner,
    );
  await db.$disconnect();
});

// Sin stock: la sincronización deja el conflicto y su marca de propiedad.
async function conflict(cashier: (typeof cashiers)[number]) {
  const offlineUuid = randomUUID();
  const sale = {
    offlineUuid,
    capturedAt: new Date().toISOString(),
    customerId,
    cashSessionId: cashier.session.id,
    items: [{ variantId: variant.id, qty: 1, discountPercent: 0 }],
    globalDiscount: 0,
    expectedTotal: 1000,
    payments: [{ method: "cash", amount: 1000 }],
  };
  const result = await ok("/sales/sync", { sales: [sale] }, cashier.token);
  expect(result.results[0].status).toBe("conflict");
  expect(result.results[0].message).toMatch(/stock/i);
  return sale;
}
const detail = {
  receiptNumber: "LOCAL-qa",
  total: 1000,
  items: [{ name: "QA A2", qty: 1, unitPrice: 1000, lineTotal: 1000 }],
  payments: [{ method: "cash", amount: 1000 }],
};

describe("05-A2 · descartar una venta sin conexión en conflicto", () => {
  it("la cajera necesita el PIN de un gerente; con él queda bitácora y alerta", async () => {
    const [first] = cashiers;
    const sale = await conflict(first);
    const body = {
      offlineUuid: sale.offlineUuid,
      reason: "No hay unidades; se devolvió el dinero",
      detail,
    };
    // La ruta anterior no deja: ya fue cobrada.
    const old = await call(
      "/sales/offline-resolution",
      {
        offlineUuid: sale.offlineUuid,
        action: "discard",
        previousTotal: 1000,
        reason: "Prueba QA A2",
      },
      first.token,
    );
    expect(old.status).toBe(403);
    const withoutPin = await call(
      "/sales/offline-review/discard",
      body,
      first.token,
    );
    expect(withoutPin.status).toBe(400);
    expect(withoutPin.body.message).toMatch(/PIN de un gerente/);
    const wrong = await call(
      "/sales/offline-review/discard",
      { ...body, managerPin: "000000" },
      first.token,
    );
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toBe("PIN incorrecto.");
    // Otra cajera, aun con el PIN, no descarta la venta de la primera.
    const other = await call(
      "/sales/offline-review/discard",
      { ...body, managerPin: MANAGER_PIN },
      cashiers[1].token,
    );
    expect(other.status).toBe(404);
    const done = await ok(
      "/sales/offline-review/discard",
      { ...body, managerPin: MANAGER_PIN },
      first.token,
    );
    expect(done).toEqual({ ok: true, approvedBy: "Andrea Gómez" });
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "offline_sale_discarded", entityId: sale.offlineUuid },
    });
    expect(log.userId).toBe(first.id);
    expect(log.before).toMatchObject({
      sellerId: first.id,
      paymentTotal: 1000,
      cashSessionId: first.session.id,
    });
    expect(log.after).toMatchObject({
      reason: body.reason,
      approvedByName: "Andrea Gómez",
      approval: "pin",
      detail: { receiptNumber: "LOCAL-qa", total: 1000 },
    });
    const alerts = await db.alert.findMany({
      where: { entityId: sale.offlineUuid },
      orderBy: { createdAt: "asc" },
    });
    expect(alerts.map((a: any) => [a.key.split(":")[0], a.status])).toEqual([
      ["offline", "resolved"],
      ["offline-discarded", "new"],
    ]);
    expect(alerts[1].message).toContain("Andrea Gómez");
    expect(alerts[1].message).toContain("RD$ 1000.00");
    // No se crea la venta ni se descarta dos veces.
    expect(
      await db.sale.count({ where: { offlineUuid: sale.offlineUuid } }),
    ).toBe(0);
    const again = await call(
      "/sales/offline-review/discard",
      { ...body, managerPin: MANAGER_PIN },
      first.token,
    );
    expect(again.status).toBe(404);
  });

  it("gerencia descarta con su sesión la venta de otra cajera de la sucursal", async () => {
    const sale = await conflict(cashiers[1]);
    const done = await ok(
      "/sales/offline-review/discard",
      {
        offlineUuid: sale.offlineUuid,
        reason: "Revisado por gerencia",
        detail,
      },
      manager,
    );
    expect(done.ok).toBe(true);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "offline_sale_discarded", entityId: sale.offlineUuid },
    });
    expect(log.before).toMatchObject({ sellerId: cashiers[1].id });
    expect(log.after).toMatchObject({ approval: "session" });
  });

  it("una venta que ya entró al servidor no se descarta", async () => {
    const [first] = cashiers;
    const sale = await conflict(first);
    await ok(
      "/inventory/adjustments",
      { variantId: variant.id, qty: 1, reason: "QA A2: reposición" },
      owner,
    );
    const synced = await ok("/sales/sync", { sales: [sale] }, first.token);
    expect(synced.results[0].status).toBe("synced");
    const late = await call(
      "/sales/offline-review/discard",
      {
        offlineUuid: sale.offlineUuid,
        reason: "Tarde",
        managerPin: MANAGER_PIN,
        detail,
      },
      first.token,
    );
    expect(late.status).toBe(409);
  });

  it("sin permiso de venta no se usa", async () => {
    const warehouse = (
      await ok("/auth/login", {
        email: "almacen@fitstore.demo",
        password: demo,
      })
    ).accessToken;
    const denied = await call(
      "/sales/offline-review/discard",
      {
        offlineUuid: randomUUID(),
        reason: "Prueba QA A2",
        managerPin: MANAGER_PIN,
        detail,
      },
      warehouse,
    );
    expect([401, 403]).toContain(denied.status);
  });

  it("M-6: si el cliente se llevó la mercancía, el descarte registra la salida de inventario y la entrada de caja", async () => {
    const [first] = cashiers;
    const stockOf = async () =>
      Number(
        (await ok("/products/" + product.id, undefined, owner)).variants[0]
          .stock,
      );
    // Sin existencias para que la sincronización deje el conflicto.
    const current = await stockOf();
    if (current > 0)
      await ok(
        "/inventory/adjustments",
        { variantId: variant.id, qty: -current, reason: "QA M-6: en cero" },
        owner,
      );
    const sale = await conflict(first);
    await ok(
      "/inventory/adjustments",
      { variantId: variant.id, qty: 3, reason: "QA M-6: reposición" },
      owner,
    );
    const stockBefore = await stockOf();
    const movementsBefore = await db.cashMovement.count({
      where: { sessionId: first.session.id, type: "in" },
    });
    const done = await call(
      "/sales/offline-review/discard",
      {
        offlineUuid: sale.offlineUuid,
        reason: "El cliente se fue con el producto; precio subió",
        outcome: "delivered",
        managerPin: MANAGER_PIN,
        detail: {
          ...detail,
          items: [{ ...detail.items[0], variantId: variant.id }],
        },
      },
      first.token,
    );
    expect(done.status).toBe(201);
    expect(await stockOf()).toBe(stockBefore - 1);
    const movement = await db.inventoryMovement.findFirstOrThrow({
      where: { refId: sale.offlineUuid },
    });
    expect(movement).toMatchObject({ type: "adjustment" });
    expect(Number(movement.qty)).toBe(-1);
    expect(movement.reason).toContain("mercancía entregada");
    const cashIn = await db.cashMovement.findMany({
      where: { sessionId: first.session.id, type: "in" },
    });
    expect(cashIn.length).toBe(movementsBefore + 1);
    expect(Number(cashIn.at(-1).amount)).toBe(1000);
    const log = await db.auditLog.findFirstOrThrow({
      where: { action: "offline_sale_discarded", entityId: sale.offlineUuid },
    });
    expect(log.after).toMatchObject({
      outcome: "delivered",
      consequences: ["salida de inventario", "entrada de caja"],
    });
    const alert = await db.alert.findUniqueOrThrow({
      where: { key: "offline-discarded:" + sale.offlineUuid },
    });
    expect(alert.message).toContain("se llevó la mercancía");
    // Sin mercancía entregada (por defecto) no se mueve nada.
    await ok(
      "/inventory/adjustments",
      {
        variantId: variant.id,
        qty: -(await stockOf()),
        reason: "QA M-6: cero",
      },
      owner,
    );
    const other = await conflict(first);
    await ok(
      "/inventory/adjustments",
      { variantId: variant.id, qty: 2, reason: "QA M-6: reposición" },
      owner,
    );
    const before = await stockOf();
    await ok(
      "/sales/offline-review/discard",
      {
        offlineUuid: other.offlineUuid,
        reason: "Se devolvió todo",
        managerPin: MANAGER_PIN,
        detail: {
          ...detail,
          items: [{ ...detail.items[0], variantId: variant.id }],
        },
      },
      first.token,
    );
    expect(await stockOf()).toBe(before);
  });

  it("M-6: la caja guardada como evidencia no se acepta sin validar sucursal y dueña", async () => {
    const [first, second] = cashiers;
    const stockOf = async () =>
      Number(
        (await ok("/products/" + product.id, undefined, owner)).variants[0]
          .stock,
      );
    const current = await stockOf();
    if (current > 0)
      await ok(
        "/inventory/adjustments",
        { variantId: variant.id, qty: -current, reason: "QA M-6: en cero" },
        owner,
      );
    const foreign = await db.cashSession.create({
      data: {
        registerId: "qa-otra-sucursal-" + tag,
        userId: second.id,
        openingAmount: 0,
        branchId: "otra-" + tag,
      },
    });
    const movements = (sessionId: string) =>
      db.cashMovement.count({ where: { sessionId } });
    try {
      // Una caja ajena (otra sucursal; otra cajera de la misma) enviada en la
      // venta no queda como evidencia ni recibe dinero al descartar.
      for (const target of [foreign.id, second.session.id]) {
        const offlineUuid = randomUUID();
        const sale = {
          offlineUuid,
          capturedAt: new Date().toISOString(),
          customerId,
          cashSessionId: target,
          items: [{ variantId: variant.id, qty: 1, discountPercent: 0 }],
          globalDiscount: 0,
          expectedTotal: 1000,
          payments: [{ method: "cash", amount: 1000 }],
        };
        const synced = await ok("/sales/sync", { sales: [sale] }, first.token);
        expect(synced.results[0].status).toBe("conflict");
        const before = await movements(target);
        const done = await call(
          "/sales/offline-review/discard",
          {
            offlineUuid,
            reason: "Prueba de frontera",
            outcome: "delivered",
            managerPin: MANAGER_PIN,
            detail,
          },
          first.token,
        );
        expect(done.status).toBe(201);
        expect(await movements(target)).toBe(before);
      }
      // Evidencia antigua o alterada que apunta a una caja ajena: se rechaza.
      const sale = await conflict(first);
      await db.auditLog.updateMany({
        where: { action: "offline_sale_conflict", entityId: sale.offlineUuid },
        data: {
          after: { paymentTotal: 1000, cashSessionId: foreign.id },
        },
      });
      const before = await movements(foreign.id);
      const rejected = await call(
        "/sales/offline-review/discard",
        {
          offlineUuid: sale.offlineUuid,
          reason: "Prueba de frontera",
          outcome: "delivered",
          managerPin: MANAGER_PIN,
          detail,
        },
        first.token,
      );
      expect(rejected.status).toBe(400);
      expect(await movements(foreign.id)).toBe(before);
      expect(
        await db.auditLog.count({
          where: {
            action: "offline_sale_discarded",
            entityId: sale.offlineUuid,
          },
        }),
      ).toBe(0);
    } finally {
      await db.cashMovement.deleteMany({ where: { sessionId: foreign.id } });
      await db.cashSession.delete({ where: { id: foreign.id } });
    }
  });
});
