import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const requireApi = createRequire(root + "apps/api/package.json");
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3109/api";
const password = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const qaPassword = "FitStore-Auditoria-R9!";
const output = root + "docs/validacion/auditoria-ronda9-riesgos-contables.json";
const suffix = Date.now().toString(36);
const evidence = {
  generatedAt: new Date().toISOString(),
  api: base,
  scope: "Datos sintéticos de auditoría en una base aislada.",
};
let token = "";
let openSession = null;

async function call(path, data, method = data === undefined ? "GET" : "POST") {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.209",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function ok(path, data, method) {
  const result = await call(path, data, method);
  assert.ok(
    result.status < 400,
    `${path}: ${result.status} ${JSON.stringify(result.body)}`,
  );
  return result.body;
}

const line = (cuadre, key) =>
  cuadre.lines.find((entry) => entry.key === key)?.value;

async function product(name, price, costAvg) {
  const categories = await ok("/categories");
  const category =
    categories.find((item) => item.name === "Ropa deportiva") ??
    categories.find((item) => !item.requiresLot && !item.requiresExpiry);
  assert.ok(category, "No hay una categoría ordinaria para la reproducción.");
  return ok("/products", {
    name: `${name} ${suffix}`,
    sku: `${name}-${suffix}-${randomUUID().slice(0, 8)}`,
    categoryId: category.id,
    taxRate: 0,
    variants: [
      {
        sku: `${name}-v-${suffix}-${randomUUID().slice(0, 8)}`,
        barcode: `${name}-b-${suffix}-${randomUUID().slice(0, 8)}`,
        price,
        costAvg,
      },
    ],
  });
}

async function addStock(variantId, qty) {
  await ok("/inventory/adjustments", {
    variantId,
    qty,
    reason: "Auditoría independiente ronda 9",
  });
}

async function openCash() {
  openSession = await ok("/cash-sessions/open", { openingAmount: 0 });
  return openSession;
}

async function closeCash(countedCash) {
  if (!openSession) return;
  await ok(`/cash-sessions/${openSession.id}/close`, {
    countedCash,
    notes: "Cierre de reproducción independiente ronda 9",
  });
  openSession = null;
}

async function sale(session, variantId, qty, price) {
  return ok("/sales", {
    offlineUuid: randomUUID(),
    cashSessionId: session.id,
    items: [{ variantId, qty }],
    payments: [{ method: "cash", amount: qty * price }],
    expectedTotal: qty * price,
  });
}

try {
  token = (
    await ok("/auth/login", {
      email: "admin@fitstore.demo",
      password,
    })
  ).accessToken;
  const roles = await ok("/roles");
  const email = `auditoria-r9-${suffix}@example.test`;
  await ok("/users", {
    name: "Auditoría independiente ronda 9",
    email,
    password: qaPassword,
    pin: "864209",
    roleId: roles.find((role) => role.name === "admin").id,
  });
  token = (await ok("/auth/login", { email, password: qaPassword }))
    .accessToken;
  const terminalId = randomUUID();
  await ok("/terminals/register", {
    id: terminalId,
    name: "Auditoría independiente R9",
    secret: "auditoria-r9-" + randomUUID(),
  });

  // R9-A01: una devolución posterior cambia retroactivamente la rentabilidad
  // del cuadre ya cerrado y no aparece en la rentabilidad de la caja que la hizo.
  const crossProduct = await product("qa-cross-return", 100, 40);
  const crossVariant = crossProduct.variants[0];
  await addStock(crossVariant.id, 3);
  const firstCash = await openCash();
  const firstSale = await sale(firstCash, crossVariant.id, 1, 100);
  await closeCash(100);
  const firstBefore = await ok(`/cash-sessions/${firstCash.id}/cuadre`);
  assert.equal(line(firstBefore, "profit"), 60);

  const secondCash = await openCash();
  const crossReturn = await ok("/returns", {
    saleId: firstSale.id,
    cashSessionId: secondCash.id,
    reason: "Devolución en caja posterior",
    refundMethod: "credit_note",
    items: [
      {
        saleItemId: firstSale.items[0].id,
        qty: 1,
        restock: true,
      },
    ],
  });
  const firstAfter = await ok(`/cash-sessions/${firstCash.id}/cuadre`);
  const secondAfter = await ok(`/cash-sessions/${secondCash.id}/cuadre`);
  evidence.crossSessionReturn = {
    originalCashSessionId: firstCash.id,
    returnCashSessionId: secondCash.id,
    returnId: crossReturn.id,
    originalProfitBeforeReturn: line(firstBefore, "profit"),
    originalProfitAfterReturn: line(firstAfter, "profit"),
    returnSessionProfit: line(secondAfter, "profit"),
    reproduced:
      line(firstBefore, "profit") === 60 &&
      line(firstAfter, "profit") === 0 &&
      line(secondAfter, "profit") === 0,
  };
  assert.equal(evidence.crossSessionReturn.reproduced, true);

  // R9-A02: perder la respuesta y reenviar exactamente la devolución crea
  // otra nota, otro reembolso y otro incremento de stock.
  const retryProduct = await product("qa-return-retry", 50, 20);
  const retryVariant = retryProduct.variants[0];
  await addStock(retryVariant.id, 4);
  const retrySale = await sale(secondCash, retryVariant.id, 2, 50);
  const stockBefore = Number(
    (await db.variant.findUniqueOrThrow({ where: { id: retryVariant.id } }))
      .stock,
  );
  const retryBody = {
    saleId: retrySale.id,
    cashSessionId: secondCash.id,
    reason: "Reenvío idéntico por respuesta perdida",
    refundMethod: "credit_note",
    items: [
      {
        saleItemId: retrySale.items[0].id,
        qty: 1,
        restock: true,
      },
    ],
  };
  const firstReturn = await ok("/returns", retryBody);
  const secondReturn = await ok("/returns", retryBody);
  const stockAfter = Number(
    (await db.variant.findUniqueOrThrow({ where: { id: retryVariant.id } }))
      .stock,
  );
  const duplicateReturns = await db.saleReturn.findMany({
    where: { saleId: retrySale.id },
    orderBy: { createdAt: "asc" },
  });
  evidence.returnRetry = {
    submittedBody: retryBody,
    first: {
      id: firstReturn.id,
      number: firstReturn.number,
      total: Number(firstReturn.total),
    },
    second: {
      id: secondReturn.id,
      number: secondReturn.number,
      total: Number(secondReturn.total),
    },
    stockBefore,
    stockAfter,
    persistedReturns: duplicateReturns.length,
    reproduced:
      firstReturn.id !== secondReturn.id &&
      duplicateReturns.length === 2 &&
      stockAfter === stockBefore + 2,
  };
  assert.equal(evidence.returnRetry.reproduced, true);

  // R9-A03: la API admite tres decimales en unitCost aunque la base guarda dos.
  // La orden redondea el total desde el dato original; la recepción lo vuelve a
  // calcular desde el costo unitario ya redondeado y cambia un centavo.
  const precisionProduct = await product("qa-unit-cost", 150, 80);
  const supplier = (await ok("/suppliers"))[0];
  assert.ok(supplier, "No hay proveedor semilla.");
  const preciseOrder = await ok("/purchase-orders", {
    supplierId: supplier.id,
    items: [
      {
        variantId: precisionProduct.variants[0].id,
        qty: 2,
        unitCost: 100.005,
      },
    ],
  });
  const preciseReceipt = await ok(
    `/purchase-orders/${preciseOrder.id}/receive`,
    {
      operationId: randomUUID(),
      items: [{ itemId: preciseOrder.items[0].id, qty: 2 }],
    },
  );
  evidence.unitCostPrecision = {
    submittedUnitCost: 100.005,
    quantity: 2,
    orderStoredUnitCost: Number(preciseOrder.items[0].unitCost),
    orderTotal: Number(preciseOrder.total),
    receiptTotal: Number(preciseReceipt.total),
    difference: Number(
      (Number(preciseReceipt.total) - Number(preciseOrder.total)).toFixed(2),
    ),
    reproduced:
      Number(preciseOrder.total) === 200.01 &&
      Number(preciseOrder.items[0].unitCost) === 100.01 &&
      Number(preciseReceipt.total) === 200.02,
  };
  assert.equal(evidence.unitCostPrecision.reproduced, true);

  // R9-A04: invoiceTotal acepta el total facturado que incluye dañados, pero
  // GoodsReceipt no tiene dónde conservarlo y exporta sólo lo recibido bueno.
  const invoiceProduct = await product("qa-invoice-damaged", 150, 80);
  const invoiceOperationId = randomUUID();
  const invoiceResult = await ok("/merchandise/operations", {
    id: invoiceOperationId,
    direction: "entry",
    supplierId: supplier.id,
    supplierInvoice: "QA-R9-DAMAGED-1",
    invoiceTotal: 400,
    items: [
      {
        variantId: invoiceProduct.variants[0].id,
        qty: 3,
        damagedQty: 1,
        damageReason: "Caja rota al recibir",
        unitCost: 100,
      },
    ],
  });
  const invoiceReceipt = await db.goodsReceipt.findUniqueOrThrow({
    where: { id: invoiceResult.receiptId },
  });
  evidence.damagedInvoiceTotal = {
    submittedInvoiceTotal: 400,
    apiResultTotal: Number(invoiceResult.total),
    storedReceiptTotal: Number(invoiceReceipt.total),
    storedDamagedCost: Number(invoiceReceipt.damagedCost),
    invoiceTotalFieldExistsInReceipt: Object.hasOwn(
      invoiceReceipt,
      "invoiceTotal",
    ),
    reproduced:
      Number(invoiceReceipt.total) === 300 &&
      Number(invoiceReceipt.damagedCost) === 100 &&
      !Object.hasOwn(invoiceReceipt, "invoiceTotal"),
  };
  assert.equal(evidence.damagedInvoiceTotal.reproduced, true);

  // R9-A05: el test oficial concurrente sólo cuenta recepciones. Aquí también
  // se conservan los dos estados HTTP que recibe la caja.
  const concurrentAttempts = [];
  for (let attempt = 1; attempt <= 5; attempt++) {
    const concurrentProduct = await product(
      `qa-receive-race-${attempt}`,
      50,
      10,
    );
    const order = await ok("/purchase-orders", {
      supplierId: supplier.id,
      items: [
        {
          variantId: concurrentProduct.variants[0].id,
          qty: 2,
          unitCost: 10,
        },
      ],
    });
    const body = {
      operationId: randomUUID(),
      items: [{ itemId: order.items[0].id, qty: 1 }],
    };
    const responses = await Promise.all([
      call(`/purchase-orders/${order.id}/receive`, body),
      call(`/purchase-orders/${order.id}/receive`, body),
    ]);
    const receipts = await db.goodsReceipt.findMany({
      where: { orderId: order.id },
    });
    concurrentAttempts.push({
      attempt,
      statuses: responses.map((result) => result.status),
      messages: responses.map((result) => result.body?.message ?? null),
      receiptIds: receipts.map((receipt) => receipt.id),
      receiptCount: receipts.length,
    });
  }
  evidence.concurrentOrderReceipt = {
    attempts: concurrentAttempts,
    anyServerError: concurrentAttempts.some((item) =>
      item.statuses.some((status) => status >= 500),
    ),
    everyAttemptPersistedOnce: concurrentAttempts.every(
      (item) => item.receiptCount === 1,
    ),
  };

  await closeCash(100);
  writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (openSession && token) {
    try {
      const sessions = await ok("/cash-sessions");
      const current = sessions.find((item) => item.id === openSession.id);
      if (current && !current.closedAt)
        await closeCash(Math.max(0, Number(current.expected.cash)));
    } catch {
      openSession = null;
    }
  }
  await db.$disconnect();
}
