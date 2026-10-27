// 3p · Solicitudes de anulación contra PostgreSQL y la API reales.
// Cubre propiedad de la venta/sucursal, idempotencia, permisos, cancelación,
// rechazo, aprobación concurrente y la misma anulación financiera existente.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { renderEvent } from "../apps/api/src/notifications";

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
const tag = Date.now().toString(36);
const ip = "198.18.24." + ((Date.now() % 240) + 10);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const TEMPORARY_STRONG = "Qa-Aa1!" + randomUUID();
const PASSWORD_STRONG = "Qa-Bb2!" + randomUUID();
// Las cuentas seller reciben y cambian a claves de 6 dígitos no triviales.
const TEMPORARY_CASHIER = "583907";
const PASSWORD_CASHIER = "649283";
const TEST_PIN = String(Math.floor(100000 + Math.random() * 900000));

type ResponseBody = { status: number; body: any };
type Person = {
  id: string;
  name: string;
  email: string;
  token: string;
  terminalId?: string;
  cash?: any;
};

async function request(
  path: string,
  as = "",
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
): Promise<ResponseBody> {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(as ? { Authorization: "Bearer " + as } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Una respuesta de error puede ser texto.
  }
  return { status: response.status, body };
}

async function ok(path: string, as = "", data?: unknown, method?: string) {
  const response = await request(path, as, data, method);
  if (response.status >= 400)
    throw new Error(
      `${path}: ${response.status} ${JSON.stringify(response.body)}`,
    );
  return response.body;
}

const createdUsers: string[] = [];
let owner: Person;
let secondAdmin: Person;
let seller: Person;
let otherSeller: Person;
let warehouse: Person;
let managerToken = "";
let variantId = "";
let productId = "";
let customerId = "";
let tenantId = "";

async function registerTerminal(person: Person, label: string) {
  const id = randomUUID();
  const terminal = await ok("/terminals/register", person.token, {
    id,
    name: `QA anulaciones ${label} ${tag}`,
    secret: "qa-anulacion-" + id,
  });
  if (terminal.status === "pending")
    await ok("/terminals/" + id + "/approve", owner.token, {});
  person.terminalId = id;
}

async function person(label: string, role: string): Promise<Person> {
  const roles = await ok("/roles", owner.token);
  const email = `qa-anula-${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "")}-${tag}@example.com`;
  const name = `QA Anulación ${label} ${tag}`;
  const temporaryPassword =
    role === "seller" ? TEMPORARY_CASHIER : TEMPORARY_STRONG;
  const activePassword = role === "seller" ? PASSWORD_CASHIER : PASSWORD_STRONG;
  const created = await ok("/users", owner.token, {
    name,
    email,
    password: temporaryPassword,
    pin: TEST_PIN,
    roleId: roles.find((candidate: any) => candidate.name === role).id,
  });
  createdUsers.push(created.id);
  const changed = await ok("/auth/change-password", "", {
    login: email,
    currentPassword: temporaryPassword,
    newPassword: activePassword,
    confirmPassword: activePassword,
  });
  const result = { id: created.id, name, email, token: changed.accessToken };
  await registerTerminal(result, label);
  return result;
}

async function openCash(person: Person, openingAmount = 1000) {
  person.cash = await ok("/cash-sessions/open", person.token, {
    registerId: person.terminalId,
    openingAmount,
  });
}

async function sale(
  person: Person,
  method: "cash" | "card" | "transfer" = "card",
  qty = 1,
) {
  return ok("/sales", person.token, {
    offlineUuid: randomUUID(),
    customerId,
    cashSessionId: person.cash.id,
    items: [{ variantId, qty }],
    payments: [
      {
        method,
        amount: 100 * qty,
        ...(method === "card"
          ? {
              reference: "VCH-" + randomUUID().slice(0, 8),
              cardLast4: "4242",
              approvalCode: "QA4242",
              cardType: "credit",
            }
          : {}),
        ...(method === "transfer"
          ? { bank: "BHD", reference: "QA-" + randomUUID().slice(0, 8) }
          : {}),
      },
    ],
    expectedTotal: 100 * qty,
  });
}

const ask = (
  who: Person,
  saleId: string,
  operationId = randomUUID(),
  reasonCode = "customer_request",
) =>
  request("/sales/" + saleId + "/void-requests", who.token, {
    operationId,
    reasonCode,
    reason: "El cliente pidió corregir esta venta en caja.",
  });

const requests = (who: Person, status = "all") =>
  ok("/void-requests?status=" + status, who.token);

beforeAll(async () => {
  if (!DEMO)
    throw new Error("SEED_DEMO_PASSWORD es obligatoria para esta prueba.");
  const login = async (email: string): Promise<Person> => {
    const body = await ok("/auth/login", "", { email, password: DEMO });
    return {
      id: body.user.id,
      name: body.user.name,
      email,
      token: body.accessToken,
    };
  };
  owner = await login("admin@fitstore.demo");
  tenantId = (
    await db.user.findUniqueOrThrow({
      where: { id: owner.id },
      select: { tenantId: true },
    })
  ).tenantId;
  await registerTerminal(owner, "dueña");
  managerToken = (await login("gerente@fitstore.demo")).token;
  secondAdmin = await person("admin-dos", "admin");
  seller = await person("vendedora", "seller");
  otherSeller = await person("otra-vendedora", "seller");
  warehouse = await person("almacén", "warehouse");
  await openCash(seller);
  await openCash(otherSeller);
  customerId = (
    await ok("/customers", owner.token, {
      name: "Cliente QA anulación " + tag,
    })
  ).id;

  const categories = await ok("/categories", owner.token);
  const created = await ok("/products", owner.token, {
    name: "Producto QA solicitudes de anulación " + tag,
    sku: "ANULA-P-" + tag,
    categoryId: categories.find((c: any) => c.name === "Fajas").id,
    taxRate: 0,
    variants: [
      {
        sku: "ANULA-V-" + tag,
        barcode: "ANULA-B-" + tag,
        price: 100,
        costAvg: 40,
      },
    ],
  });
  productId = created.id;
  variantId = created.variants[0].id;
  await ok("/inventory/adjustments", owner.token, {
    variantId,
    qty: 50,
    reason: "Existencias QA solicitudes de anulación",
  });
}, 120_000);

afterAll(async () => {
  await db.user
    .updateMany({
      where: { id: { in: createdUsers } },
      data: { active: false, authVersion: { increment: 1 } },
    })
    .catch(() => undefined);
  if (productId)
    await db.product
      .update({ where: { id: productId }, data: { active: false } })
      .catch(() => undefined);
  await db.$disconnect();
});

describe("3p · solicitud de anulación", () => {
  it("solicitar es idempotente y todavía no toca venta, stock, caja ni incentivo", async () => {
    const beforeStock = await db.variant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });
    const sold = await sale(seller, "cash");
    const afterSaleStock = await db.variant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });
    const beforeExpected = await ok("/cash-sessions", owner.token).then(
      (rows: any[]) => rows.find((row) => row.id === seller.cash.id).expected,
    );
    const beforeIncentive = await db.incentiveEntry.aggregate({
      where: { saleId: sold.id },
      _sum: { amount: true },
      _count: true,
    });
    const operationId = randomUUID();
    const first = await ask(seller, sold.id, operationId);
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      sale: { id: sold.id, number: sold.number, status: "completed" },
      requester: { id: seller.id },
      status: "pending",
      operationId,
    });
    const repeated = await ask(seller, sold.id, operationId);
    expect(repeated.status).toBe(201);
    expect(repeated.body.id).toBe(first.body.id);
    const otherOperation = await ask(seller, sold.id);
    expect(otherOperation.status).toBe(409);

    const savedSale = await db.sale.findUniqueOrThrow({
      where: { id: sold.id },
    });
    const savedStock = await db.variant.findUniqueOrThrow({
      where: { id: variantId },
      select: { stock: true },
    });
    const afterExpected = await ok("/cash-sessions", owner.token).then(
      (rows: any[]) => rows.find((row) => row.id === seller.cash.id).expected,
    );
    const afterIncentive = await db.incentiveEntry.aggregate({
      where: { saleId: sold.id },
      _sum: { amount: true },
      _count: true,
    });
    expect(savedSale.status).toBe("completed");
    expect(Number(savedStock.stock)).toBe(Number(afterSaleStock.stock));
    expect(Number(beforeStock.stock) - Number(savedStock.stock)).toBe(1);
    expect(afterExpected).toEqual(beforeExpected);
    expect(afterIncentive).toEqual(beforeIncentive);

    const alert = await db.alert.findUnique({
      where: {
        tenantId_key: { tenantId, key: "sale-void-request:" + first.body.id },
      },
    });
    expect(alert).toMatchObject({
      type: "sale_void_request",
      entityId: first.body.id,
      status: "new",
      branchId: "main",
    });
    const notice = await renderEvent(db, "void_request", first.body.id);
    expect(notice?.text).toContain(sold.number);
    expect(notice?.text).not.toContain("Cliente QA");
    expect(
      (await request("/alerts?type=sale_void_request", managerToken)).body.some(
        (item: any) => item.id === alert?.id,
      ),
    ).toBe(false);
    expect(
      (
        await request(
          "/alerts/" + alert?.id,
          managerToken,
          { status: "resolved" },
          "PATCH",
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(
          "/alerts/" + alert?.id,
          owner.token,
          { status: "resolved" },
          "PATCH",
        )
      ).status,
    ).toBe(409);
  });

  it("rechaza de forma clara el mismo operationId simultáneo en dos ventas", async () => {
    const firstSale = await sale(seller);
    const secondSale = await sale(seller);
    const operationId = randomUUID();
    const results = await Promise.all([
      ask(seller, firstSale.id, operationId),
      ask(seller, secondSale.id, operationId),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await db.saleVoidRequest.count({ where: { operationId } })).toBe(1);
  });

  it("impide IDOR: otra vendedora no solicita, ve ni cancela la venta ajena", async () => {
    const sold = await sale(seller);
    const created = await ask(seller, sold.id);
    expect(created.status).toBe(201);
    expect(
      (await requests(otherSeller)).some((r: any) => r.id === created.body.id),
    ).toBe(false);
    expect((await ask(otherSeller, sold.id)).status).toBe(404);
    expect(
      (
        await request(
          "/void-requests/" + created.body.id + "/cancel",
          otherSeller.token,
          {},
        )
      ).status,
    ).toBe(404);
  });

  it("la solicitante cancela una pendiente y luego puede crear una nueva", async () => {
    const sold = await sale(seller);
    const created = await ask(seller, sold.id);
    const cancelled = await request(
      "/void-requests/" + created.body.id + "/cancel",
      seller.token,
      {},
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({ status: "cancelled" });
    const repeated = await request(
      "/void-requests/" + created.body.id + "/cancel",
      seller.token,
      {},
    );
    expect(repeated.status).toBe(200);
    expect(repeated.body.status).toBe("cancelled");
    const next = await ask(seller, sold.id);
    expect(next.status).toBe(201);
    expect(next.body.id).not.toBe(created.body.id);
  });

  it("solo administración rechaza y la nota es obligatoria", async () => {
    const sold = await sale(seller);
    const created = await ask(seller, sold.id);
    expect(created.status).toBe(201);
    expect(
      (
        await request(
          "/void-requests/" + created.body.id + "/reject",
          managerToken,
          { note: "Gerencia intenta decidir" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/void-requests/" + created.body.id + "/reject",
          warehouse.token,
          { note: "Almacén intenta decidir" },
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/void-requests/" + created.body.id + "/reject",
          owner.token,
          { note: "" },
        )
      ).status,
    ).toBe(400);
    const rejected = await request(
      "/void-requests/" + created.body.id + "/reject",
      owner.token,
      { note: "La venta corresponde y debe conservarse." },
    );
    expect(rejected.status).toBe(200);
    expect(rejected.body).toMatchObject({
      status: "rejected",
      resolutionNote: "La venta corresponde y debe conservarse.",
      reviewer: { id: owner.id },
    });
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sold.id } })).status,
    ).toBe("completed");
  });

  it("dos administradores aprueban a la vez: una anulación y un 409 claro", async () => {
    const stockBefore = Number(
      (
        await db.variant.findUniqueOrThrow({
          where: { id: variantId },
          select: { stock: true },
        })
      ).stock,
    );
    const sold = await sale(seller, "cash");
    const expectedAfterSale = await ok("/cash-sessions", owner.token).then(
      (rows: any[]) => rows.find((row) => row.id === seller.cash.id).expected,
    );
    const created = await ask(seller, sold.id);
    expect(created.status).toBe(201);

    const [a, b] = await Promise.all([
      request(
        "/void-requests/" + created.body.id + "/approve",
        owner.token,
        {},
      ),
      request(
        "/void-requests/" + created.body.id + "/approve",
        secondAdmin.token,
        {},
      ),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(JSON.stringify(a.status === 409 ? a.body : b.body)).toMatch(
      /ya fue aprobada|ya no est[aá] pendiente/i,
    );

    const savedSale = await db.sale.findUniqueOrThrow({
      where: { id: sold.id },
    });
    const savedRequest = await (db as any).saleVoidRequest.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    const stockAfter = Number(
      (
        await db.variant.findUniqueOrThrow({
          where: { id: variantId },
          select: { stock: true },
        })
      ).stock,
    );
    const expectedAfterVoid = await ok("/cash-sessions", owner.token).then(
      (rows: any[]) => rows.find((row) => row.id === seller.cash.id).expected,
    );
    const incentive = await db.incentiveEntry.aggregate({
      where: { saleId: sold.id },
      _sum: { amount: true },
      _count: true,
    });
    expect(savedSale).toMatchObject({
      status: "voided",
      voidedReason: "Solicitud: El cliente pidió corregir esta venta en caja.",
    });
    expect(savedRequest.status).toBe("approved");
    expect(savedRequest.reviewedById).toMatch(
      new RegExp(`^(${owner.id}|${secondAdmin.id})$`),
    );
    expect(savedRequest.reviewedAt).toBeInstanceOf(Date);
    expect(stockAfter).toBe(stockBefore);
    expect(
      Number(expectedAfterSale.cash) - Number(expectedAfterVoid.cash),
    ).toBe(100);
    expect(Number(incentive._sum.amount ?? 0)).toBe(0);
    expect(incentive._count).toBe(2);
    expect(
      await db.inventoryMovement.count({
        where: { type: "void", refId: sold.id },
      }),
    ).toBe(1);
    expect(
      await db.cashMovement.count({
        where: { reason: { contains: sold.number } },
      }),
    ).toBe(0);
    expect(
      (
        await db.alert.findUniqueOrThrow({
          where: {
            tenantId_key: {
              tenantId,
              key: "sale-void-request:" + created.body.id,
            },
          },
        })
      ).status,
    ).toBe("resolved");
  });

  it("nadie aprueba su propia solicitud, incluso con permiso administrativo", async () => {
    const sold = await sale(seller);
    const row = await (db as any).saleVoidRequest.create({
      data: {
        saleId: sold.id,
        requestedById: owner.id,
        operationId: randomUUID(),
        reasonCode: "other",
        reason: "Solicitud creada para probar separación de funciones.",
        branchId: "main",
      },
    });
    const response = await request(
      "/void-requests/" + row.id + "/approve",
      owner.token,
      {},
    );
    expect(response.status).toBe(403);
    expect(JSON.stringify(response.body)).toMatch(/propia solicitud/i);
    expect(
      (await db.sale.findUniqueOrThrow({ where: { id: sold.id } })).status,
    ).toBe("completed");
  });

  it("muestra por qué una venta con abonos o devoluciones no se puede aprobar", async () => {
    const withInstallment = await sale(seller);
    await db.payment.create({
      data: {
        saleId: withInstallment.id,
        cashSessionId: seller.cash.id,
        entryType: "installment",
        method: "cash",
        amount: 1,
        tendered: 1,
        status: "ok",
      },
    });
    const installmentRequest = await ask(seller, withInstallment.id);
    expect(installmentRequest.status).toBe(201);
    expect(installmentRequest.body.approvalBlocker).toMatch(
      /revisión de gerencia después del cierre/i,
    );
    expect(installmentRequest.body.approvalBlocker).not.toMatch(/abonos/i);
    const installmentDetail = (await requests(owner, "pending")).find(
      (row: any) => row.id === installmentRequest.body.id,
    );
    expect(installmentDetail.approvalBlocker).toMatch(/abonos/i);
    expect(
      (
        await request(
          "/void-requests/" + installmentRequest.body.id + "/approve",
          owner.token,
          {},
        )
      ).status,
    ).toBe(400);

    const withReturn = await sale(seller);
    await db.saleReturn.create({
      data: {
        saleId: withReturn.id,
        number: "DEV-QA-" + randomUUID().slice(0, 8),
        reason: "Registro QA",
        total: 0,
        taxTotal: 0,
        costTotal: 0,
        refundAmount: 0,
        refundMethod: "credit_note",
        userId: owner.id,
        items: [],
        branchId: "main",
      },
    });
    const returnRequest = await ask(seller, withReturn.id);
    expect(returnRequest.status).toBe(201);
    const returnDetail = (await requests(owner, "pending")).find(
      (row: any) => row.id === returnRequest.body.id,
    );
    expect(returnDetail.approvalBlocker).toMatch(/devoluciones/i);
    const blocked = await request(
      "/void-requests/" + returnRequest.body.id + "/approve",
      owner.token,
      {},
    );
    expect(blocked.status).toBe(400);
    expect(JSON.stringify(blocked.body)).toMatch(/devoluciones/i);
  });

  it("la anulación directa aprueba la solicitud pendiente en la misma transacción", async () => {
    const sold = await sale(seller);
    const created = await ask(seller, sold.id);
    expect(created.status).toBe(201);
    const direct = await request("/sales/" + sold.id + "/void", owner.token, {
      reason: "Administración confirmó la solicitud desde Ventas.",
    });
    expect(direct.status).toBe(201);
    const saved = await (db as any).saleVoidRequest.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(saved).toMatchObject({
      status: "approved",
      reviewedById: owner.id,
    });
    expect(saved.reviewedAt).toBeInstanceOf(Date);
  });

  it("una solicitud de otra sucursal no aparece ni se puede decidir", async () => {
    const source = await db.user.findUniqueOrThrow({
      where: { id: seller.id },
    });
    const role = await db.role.findUniqueOrThrow({
      where: { tenantId_name: { tenantId: source.tenantId, name: "seller" } },
    });
    const foreignUser = await db.user.create({
      data: {
        name: "QA Otra sucursal " + tag,
        email: `qa-anula-otra-sucursal-${tag}@example.com`,
        passwordHash: source.passwordHash,
        pinHash: source.pinHash,
        roleId: role.id,
        branchId: "otra-sucursal",
        active: false,
      },
    });
    createdUsers.push(foreignUser.id);
    const foreignSale = await db.sale.create({
      data: {
        number: "QA-OTRA-" + tag,
        offlineUuid: randomUUID(),
        sellerId: foreignUser.id,
        subtotal: 0,
        discountTotal: 0,
        taxTotal: 0,
        total: 0,
        costTotal: 0,
        branchId: "otra-sucursal",
      },
    });
    const foreignRequest = await (db as any).saleVoidRequest.create({
      data: {
        saleId: foreignSale.id,
        requestedById: foreignUser.id,
        operationId: randomUUID(),
        reasonCode: "other",
        reason: "Solicitud de otra sucursal.",
        branchId: "otra-sucursal",
      },
    });
    expect(
      (await requests(owner)).some((row: any) => row.id === foreignRequest.id),
    ).toBe(false);
    expect(
      (
        await request(
          "/void-requests/" + foreignRequest.id + "/approve",
          owner.token,
          {},
        )
      ).status,
    ).toBe(404);
  });
});

describe("conciliación de transferencias · API real", () => {
  it("solo gerencia lee pendientes de su sucursal y desaparecen al verificar o rechazar", async () => {
    const first = await sale(seller, "transfer");
    const second = await sale(otherSeller, "transfer");
    const firstId = first.payments[0].id;
    const secondId = second.payments[0].id;
    const path = "/payments/pending-transfers";
    expect((await request(path, seller.token)).status).toBe(403);
    expect((await request(path, "")).status).toBe(401);
    const listed = await ok(path, owner.token);
    expect(listed.find((row: any) => row.id === firstId)).toMatchObject({
      invoice: first.number,
      customer: "Cliente QA anulación " + tag,
      amount: "100",
      bank: "BHD",
      cashier: seller.name,
      seller: seller.name,
    });
    expect(listed.find((row: any) => row.id === secondId)).toMatchObject({
      invoice: second.number,
      cashier: otherSeller.name,
      seller: otherSeller.name,
    });
    expect(
      JSON.stringify(listed.find((row: any) => row.id === firstId)),
    ).not.toContain("costTotal");
    const day = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santo_Domingo",
    }).format(new Date(listed.find((row: any) => row.id === firstId).date));
    expect(
      (await ok(path + "?date=" + day, owner.token)).some(
        (row: any) => row.id === firstId,
      ),
    ).toBe(true);
    expect(
      (
        await request(
          path + "?date=" + new Date().getUTCFullYear() + "-02-31",
          owner.token,
        )
      ).status,
    ).toBe(400);
    await db.sale.update({
      where: { id: second.id },
      data: { branchId: "qa-otra-" + tag },
    });
    try {
      expect(
        (await ok(path, owner.token)).some((row: any) => row.id === secondId),
      ).toBe(false);
    } finally {
      await db.sale.update({
        where: { id: second.id },
        data: { branchId: "main" },
      });
    }
    await ok("/payments/" + firstId + "/verify", owner.token, {});
    await ok("/payments/" + secondId + "/reject", owner.token, {
      reason: "No llegó al banco en la prueba.",
    });
    const after = await ok(path, owner.token);
    expect(
      after.some((row: any) => row.id === firstId || row.id === secondId),
    ).toBe(false);
  });
});

describe("envío del mensajero · API real", () => {
  it("separa envío de venta/caja/dashboard, restringe permisos y paga una sola vez", async () => {
    const sold = await sale(seller, "transfer");
    const path = `/sales/${sold.id}/courier`;
    const before = await db.sale.findUniqueOrThrow({ where: { id: sold.id } });
    const cashBefore = await ok("/cash-sessions", owner.token);
    const dashboardBefore = await ok("/dashboard/summary", owner.token);
    const businessDay = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Santo_Domingo",
    }).format(new Date());
    const profitPath = `/reports/profit?from=${businessDay}&to=${businessDay}`;
    const profitBefore = await ok(profitPath, owner.token);
    const stableDashboard = ({ from: _from, to: _to, ...values }: any) =>
      values;
    expect(
      (
        await request(
          path,
          seller.token,
          { reason: "QA envío", fee: 400 },
          "PATCH",
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await request(
          path,
          owner.token,
          { reason: "QA envío", fee: -1 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          path,
          owner.token,
          { reason: "QA envío", fee: "400.001" },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    const changed = await request(
      path,
      owner.token,
      { fee: 400, courierName: "Addison", reason: "QA envío" },
      "PATCH",
    );
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({
      courierFee: "400",
      courierName: "Addison",
    });
    const after = await db.sale.findUniqueOrThrow({ where: { id: sold.id } });
    for (const field of [
      "subtotal",
      "total",
      "costTotal",
      "taxTotal",
      "discountTotal",
    ] as const)
      expect(String(after[field])).toBe(String(before[field]));
    expect(await ok("/cash-sessions", owner.token)).toEqual(cashBefore);
    expect(
      stableDashboard(await ok("/dashboard/summary", owner.token)),
    ).toEqual(stableDashboard(dashboardBefore));
    expect(await ok(profitPath, owner.token)).toEqual(profitBefore);
    const pending = await ok("/courier/pending", owner.token);
    expect(pending.rows.find((row: any) => row.id === sold.id)).toMatchObject({
      courierFee: "400.00",
      courierName: "Addison",
    });
    expect((await request("/courier/pending", seller.token)).status).toBe(403);
    const transfer = (
      await ok("/payments/pending-transfers", owner.token)
    ).find((row: any) => row.id === sold.payments[0].id);
    expect(transfer).toMatchObject({
      amount: "100",
      courierFee: "400.00",
      expected: "500.00",
      difference: "-400.00",
    });
    const operationId = randomUUID();
    const payload = { operationId, saleIds: [sold.id], note: "Pago semanal" };
    expect(
      (await request("/courier/payouts", seller.token, payload)).status,
    ).toBe(403);
    const paid = await request("/courier/payouts", owner.token, payload);
    expect(paid.status).toBe(201);
    expect(paid.body).toMatchObject({ total: "400.00", replayed: false });
    expect(
      (await request("/courier/payouts", owner.token, payload)).body,
    ).toMatchObject({ total: "400.00", replayed: true });
    expect(
      (
        await request("/courier/payouts", owner.token, {
          ...payload,
          note: "Distinto",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request("/courier/payouts", owner.token, {
          ...payload,
          operationId: randomUUID(),
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request(
          path,
          owner.token,
          { reason: "QA envío", fee: 100 },
          "PATCH",
        )
      ).status,
    ).toBe(409);
    expect(
      (await ok("/courier/pending", owner.token)).rows.some(
        (row: any) => row.id === sold.id,
      ),
    ).toBe(false);
    expect(
      (await ok("/courier/payouts", owner.token)).some(
        (row: any) => row.operationId === operationId,
      ),
    ).toBe(true);
    expect(await ok("/cash-sessions", owner.token)).toEqual(cashBefore);
    expect(
      stableDashboard(await ok("/dashboard/summary", owner.token)),
    ).toEqual(stableDashboard(dashboardBefore));
    expect(await ok(profitPath, owner.token)).toEqual(profitBefore);
    expect(await db.courierPayout.count({ where: { operationId } })).toBe(1);
    const logs = await db.auditLog.findMany({
      where: { entityId: { in: [sold.id, operationId] } },
    });
    expect(logs.map((row: any) => row.action)).toEqual(
      expect.arrayContaining(["courier_fee_changed", "courier_payout"]),
    );
  });

  it("rechaza ventas anuladas y oculta otras sucursales", async () => {
    const sold = await sale(seller);
    const path = `/sales/${sold.id}/courier`;
    await db.sale.update({
      where: { id: sold.id },
      data: { status: "voided" },
    });
    try {
      expect(
        (
          await request(
            path,
            owner.token,
            { reason: "QA envío", fee: 100 },
            "PATCH",
          )
        ).status,
      ).toBe(400);
    } finally {
      await db.sale.update({
        where: { id: sold.id },
        data: { status: "completed" },
      });
    }
    await db.sale.update({
      where: { id: sold.id },
      data: { branchId: "qa-otra-" + tag },
    });
    try {
      expect(
        (
          await request(
            path,
            owner.token,
            { reason: "QA envío", fee: 100 },
            "PATCH",
          )
        ).status,
      ).toBe(400);
      expect(
        (await ok("/courier/pending", owner.token)).rows.some(
          (row: any) => row.id === sold.id,
        ),
      ).toBe(false);
    } finally {
      await db.sale.update({
        where: { id: sold.id },
        data: { branchId: "main" },
      });
    }
  });
});
