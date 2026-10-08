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
let token = "";
let cash;

async function call(path, data, method = data === undefined ? "GET" : "POST") {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.207",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
async function ok(path, data, method) {
  const result = await call(path, data, method);
  assert.ok(result.status < 400, `${path}: ${JSON.stringify(result)}`);
  return result.body;
}

try {
  token = (
    await ok("/auth/login", {
      email: "admin@fitstore.demo",
      password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
    })
  ).accessToken;
  const suffix = Date.now().toString(36);
  const roles = await ok("/roles");
  const email = `auditoria-danada-${suffix}@example.test`;
  await ok("/users", {
    name: "Auditoría devolución dañada",
    email,
    password: "FitStore-Danada-R9!",
    pin: "639174",
    roleId: roles.find((role) => role.name === "admin").id,
  });
  token = (
    await ok("/auth/login", {
      email,
      password: "FitStore-Danada-R9!",
    })
  ).accessToken;
  await ok("/terminals/register", {
    id: randomUUID(),
    name: "Auditoría devolución dañada",
    secret: "devolucion-danada-" + randomUUID(),
  });
  const categories = await ok("/categories");
  const category = categories.find((item) => item.name === "Ropa deportiva");
  const product = await ok("/products", {
    name: `QA devolución dañada ${suffix}`,
    sku: `QA-DANADA-P-${suffix}`,
    categoryId: category.id,
    taxRate: 0,
    variants: [
      {
        sku: `QA-DANADA-V-${suffix}`,
        barcode: `QA-DANADA-B-${suffix}`,
        price: 100,
        costAvg: 20,
      },
    ],
  });
  const variantId = product.variants[0].id;
  await ok("/inventory/adjustments", {
    variantId,
    qty: 1,
    reason: "Stock de reproducción",
  });
  cash = await ok("/cash-sessions/open", { openingAmount: 0 });
  const sale = await ok("/sales", {
    offlineUuid: randomUUID(),
    cashSessionId: cash.id,
    items: [{ variantId, qty: 1 }],
    payments: [{ method: "cash", amount: 100 }],
    expectedTotal: 100,
  });
  const returned = await ok("/returns", {
    saleId: sale.id,
    cashSessionId: cash.id,
    reason: "Producto roto al regresar",
    refundMethod: "credit_note",
    items: [
      {
        saleItemId: sale.items[0].id,
        qty: 1,
        restock: false,
        damaged: true,
      },
    ],
  });
  const movements = await db.inventoryMovement.findMany({
    where: { refId: sale.id, type: "return_waste" },
  });
  const variant = await db.variant.findUniqueOrThrow({
    where: { id: variantId },
  });
  const evidence = {
    generatedAt: new Date().toISOString(),
    sale: { id: sale.id, quantity: 1, costTotal: Number(sale.costTotal) },
    returned: {
      id: returned.id,
      total: Number(returned.total),
      costTotal: Number(returned.costTotal),
      items: returned.items,
    },
    wasteMovements: movements.map((movement) => ({
      id: movement.id,
      qty: Number(movement.qty),
      unitCost: Number(movement.unitCost),
      balanceAfter: Number(movement.balanceAfter),
      reason: movement.reason,
    })),
    stockAfter: Number(variant.stock),
    quantityOfDamagedReturnRecoverableFromKardex: movements.reduce(
      (sum, movement) => sum + Number(movement.qty),
      0,
    ),
    reproduced:
      movements.length === 1 &&
      Number(movements[0].qty) === 0 &&
      Number(returned.items[0].qty) === 1 &&
      Number(returned.items[0].cost) === 0,
  };
  assert.equal(evidence.reproduced, true);
  await ok(`/cash-sessions/${cash.id}/close`, {
    countedCash: 100,
    notes: "Cierre reproducción devolución dañada",
  });
  cash = null;
  writeFileSync(
    root + "docs/validacion/auditoria-ronda9-devolucion-danada.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (cash && token)
    await call(`/cash-sessions/${cash.id}/close`, {
      countedCash: 100,
      notes: "Cierre contingencia auditoría",
    }).catch(() => {});
  await db.$disconnect();
}
