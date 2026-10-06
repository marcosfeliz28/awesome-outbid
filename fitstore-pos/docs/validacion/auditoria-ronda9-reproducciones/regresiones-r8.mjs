import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, writeFileSync } from "node:fs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const requireApi = createRequire(root + "apps/api/package.json");
const { PrismaClient } = requireApi("@prisma/client");
const ExcelJS = requireApi("exceljs");
const db = new PrismaClient();
const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3109/api";
const dbUrl = process.env.DATABASE_URL;
const seedPassword = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const qaPassword = "FitStore-R8-Regresiones!";
const suffix = Date.now().toString(36);
const filesDir =
  root + "docs/validacion/auditoria-ronda9-reproducciones/archivos-r8";
const output = root + "docs/validacion/auditoria-ronda9-regresiones-r8.json";
mkdirSync(filesDir, { recursive: true });
let token = "";
let cash = null;
const evidence = {
  generatedAt: new Date().toISOString(),
  scope:
    "Reproducción independiente con datos sintéticos; API compilada y base aislada.",
};

async function call(path, data, method = data === undefined ? "GET" : "POST") {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": "192.0.2.208",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const body = await response.json();
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

async function workbook(name, rows) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Inventario 2026");
  sheet.addRow([
    "ID",
    "DESCRIPCION",
    "REFERENCIA",
    "SUB-GRUPO DE ARTICULO",
    "EXISTENCIA",
    "COSTO",
    "PRECIO DETALLE",
  ]);
  rows.forEach((row) => sheet.addRow(row));
  const path = `${filesDir}/${name}.xlsx`;
  await book.xlsx.writeFile(path);
  return path;
}

function runImporter(path, ...flags) {
  const result = spawnSync(
    process.execPath,
    [
      requireApi.resolve("tsx/cli"),
      "scripts/import-inventario.ts",
      path,
      ...flags,
    ],
    {
      cwd: root + "apps/api",
      env: { ...process.env, DATABASE_URL: dbUrl },
      encoding: "utf8",
      timeout: 60000,
    },
  );
  assert.equal(result.signal, null);
  return {
    status: result.status,
    output: (result.stdout + result.stderr).trim(),
  };
}

const counts = async () => ({
  categories: await db.category.count(),
  products: await db.product.count(),
  variants: await db.variant.count(),
  movements: await db.inventoryMovement.count(),
});

async function makeProduct(categoryId, label, price = 20, costAvg = 10) {
  return ok("/products", {
    name: `${label} ${suffix}`,
    sku: `${label}-p-${suffix}-${randomUUID().slice(0, 6)}`,
    categoryId,
    taxRate: 0,
    variants: [
      {
        sku: `${label}-v-${suffix}-${randomUUID().slice(0, 6)}`,
        barcode: `${label}-b-${suffix}-${randomUUID().slice(0, 6)}`,
        price,
        costAvg,
      },
    ],
  });
}

try {
  token = (
    await ok("/auth/login", {
      email: "admin@fitstore.demo",
      password: seedPassword,
    })
  ).accessToken;
  const roles = await ok("/roles");
  const email = `auditoria-r8-en-r9-${suffix}@example.test`;
  await ok("/users", {
    name: "Auditoría independiente R8 en R9",
    email,
    password: qaPassword,
    pin: "731864",
    roleId: roles.find((role) => role.name === "admin").id,
  });
  token = (await ok("/auth/login", { email, password: qaPassword }))
    .accessToken;
  await ok("/terminals/register", {
    id: randomUUID(),
    name: "Regresiones R8 independientes",
    secret: "regresiones-r8-" + randomUUID(),
  });
  const categories = await ok("/categories");
  const ordinary = categories.find(
    (category) => category.name === "Ropa deportiva",
  );
  assert.ok(ordinary);

  // R8-01, además del CLI: alta, edición y producto rápido de Mercancía.
  const tag = randomUUID().slice(0, 8).toUpperCase();
  const owner = await ok("/products", {
    name: `QA dueño código R8 ${suffix}`,
    sku: `R8-OWNER-${tag}`,
    categoryId: ordinary.id,
    taxRate: 0,
    variants: [
      {
        sku: `R8-SKU-${tag}`,
        barcode: `R8-BAR-${tag}`,
        price: 20,
        costAvg: 10,
      },
    ],
  });
  const ownerCode = owner.variants[0].barcode;
  const beforeCollision = await counts();
  const createCollision = await call("/products", {
    name: `QA choque alta R8 ${suffix}`,
    sku: `R8-NEW-${tag}`,
    categoryId: ordinary.id,
    variants: [
      {
        sku: ownerCode.toLowerCase(),
        barcode: `R8-NEW-BAR-${tag}`,
        price: 20,
        costAvg: 10,
      },
    ],
  });
  const editable = await makeProduct(ordinary.id, "r8-edit");
  const originalEditableBarcode = editable.variants[0].barcode;
  const editCollision = await call(
    `/variants/${editable.variants[0].id}`,
    { barcode: ownerCode.toLowerCase() },
    "PATCH",
  );
  const quickCollision = await call("/merchandise/operations", {
    id: randomUUID(),
    direction: "entry",
    items: [
      {
        quick: {
          name: `QA rápido R8 ${suffix}`,
          categoryId: ordinary.id,
          price: 20,
          cost: 10,
          barcode: ownerCode.toLowerCase(),
          variant: "Única",
        },
        qty: 2,
        unitCost: 10,
      },
    ],
  });
  const cliCollisionFile = await workbook("r8-01-colision-mayusculas", [
    [
      ownerCode.toLowerCase(),
      "QA choque CLI R8",
      ownerCode.toLowerCase(),
      ordinary.name,
      2,
      10,
      20,
    ],
  ]);
  const cliCollision = runImporter(cliCollisionFile);
  const editableAfter = await db.variant.findUniqueOrThrow({
    where: { id: editable.variants[0].id },
  });
  const afterCollision = await counts();
  evidence.r8_01 = {
    ownerCode,
    apiCreate: {
      status: createCollision.status,
      message: createCollision.body.message,
    },
    apiEdit: {
      status: editCollision.status,
      message: editCollision.body.message,
    },
    merchandiseQuick: {
      status: quickCollision.status,
      message: quickCollision.body.message,
    },
    importer: cliCollision,
    editableBarcodeBefore: originalEditableBarcode,
    editableBarcodeAfter: editableAfter.barcode,
    countsBefore: beforeCollision,
    countsAfter: afterCollision,
    reproducedFixed:
      createCollision.status === 400 &&
      editCollision.status === 400 &&
      quickCollision.status === 400 &&
      cliCollision.status !== 0 &&
      editableAfter.barcode === originalEditableBarcode &&
      afterCollision.products === beforeCollision.products + 1,
  };
  // El +1 es el producto auxiliar creado expresamente para probar PATCH.
  assert.equal(evidence.r8_01.reproducedFixed, true);

  // R8-03: dos errores en la segunda fila no dejan ni la primera categoría,
  // ni el primer producto, ni movimiento alguno.
  const protectedName = `QA lotes R8 ${suffix}`;
  await ok("/categories", {
    name: protectedName,
    requiresLot: true,
    requiresExpiry: true,
  });
  const baseline = await counts();
  const newCategory = `QA categoría atómica R8 ${suffix}`;
  const policyFile = await workbook("r8-03-politica-atomica", [
    ["R8-ATOMIC-1-" + tag, "QA primera válida", "", newCategory, 1, 10, 20],
    ["R8-ATOMIC-2-" + tag, "QA segunda con lote", "", protectedName, 1, 10, 20],
  ]);
  const policyRun = runImporter(policyFile);
  const afterPolicy = await counts();
  const categoryWritten = await db.category.findUnique({
    where: { name: newCategory },
  });
  const rangeFile = await workbook("r8-03-rango-atomico", [
    ["R8-RANGE-1-" + tag, "QA primera válida", "", ordinary.name, 1, 10, 20],
    [
      "R8-RANGE-2-" + tag,
      "QA segunda fuera de rango",
      "",
      ordinary.name,
      1,
      10,
      1000000000000,
    ],
  ]);
  const rangeRun = runImporter(rangeFile);
  const afterRange = await counts();
  evidence.r8_03 = {
    protectedCategoryRun: policyRun,
    numericRangeRun: rangeRun,
    baseline,
    afterProtectedCategoryFailure: afterPolicy,
    afterNumericRangeFailure: afterRange,
    newCategoryPersisted: Boolean(categoryWritten),
    firstRangeProductPersisted: Boolean(
      await db.variant.findFirst({ where: { sku: "R8-RANGE-1-" + tag } }),
    ),
    reproducedFixed:
      policyRun.status !== 0 &&
      rangeRun.status !== 0 &&
      !categoryWritten &&
      JSON.stringify(afterPolicy) === JSON.stringify(baseline) &&
      JSON.stringify(afterRange) === JSON.stringify(baseline),
  };
  assert.equal(evidence.r8_03.reproducedFixed, true);

  // R8-02: estado de una devolución R7 (línea JSON sin costo) y devolución
  // restante bajo R9. El costo total de la venta termina exactamente en cero.
  const component = await makeProduct(ordinary.id, "r8-component", 30, 10.01);
  const combo = await makeProduct(ordinary.id, "r8-combo", 20, 0);
  await ok("/inventory/adjustments", {
    variantId: component.variants[0].id,
    qty: 10,
    reason: "Auditoría costo histórico R8",
  });
  await ok("/kits", {
    kitVariantId: combo.variants[0].id,
    components: [{ componentVariantId: component.variants[0].id, qty: 0.5 }],
  });
  cash = await ok("/cash-sessions/open", { openingAmount: 0 });
  const sold = await ok("/sales", {
    offlineUuid: randomUUID(),
    cashSessionId: cash.id,
    items: [{ variantId: combo.variants[0].id, qty: 10 }],
    payments: [{ method: "cash", amount: 200 }],
    expectedTotal: 200,
  });
  const saleItem = await db.saleItem.findFirstOrThrow({
    where: { saleId: sold.id },
  });
  const returnPart = (qty) =>
    ok("/returns", {
      saleId: sold.id,
      cashSessionId: cash.id,
      reason: "Auditoría costo histórico R8",
      refundMethod: "credit_note",
      items: [{ saleItemId: saleItem.id, qty, restock: true }],
    });
  const first = await returnPart(3);
  const stored = await db.saleReturn.findUniqueOrThrow({
    where: { id: first.id },
  });
  await db.saleReturn.update({
    where: { id: first.id },
    data: {
      items: stored.items.map((item) => {
        const { cost, ...withoutCost } = item;
        void cost;
        return withoutCost;
      }),
    },
  });
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Santo_Domingo",
  });
  const profit = async () =>
    (await ok(`/reports/profit?from=${today}&to=${today}`)).rows.find(
      (row) => row.Producto === combo.name,
    );
  const afterLegacyPart = await profit();
  const second = await returnPart(7);
  const afterComplete = await profit();
  evidence.r8_02 = {
    saleCost: Number(sold.costTotal),
    legacyReturnCost: Number(first.costTotal),
    legacyReturnItemsAfterSimulation: (
      await db.saleReturn.findUniqueOrThrow({ where: { id: first.id } })
    ).items,
    reportAfterLegacyPartialReturn: afterLegacyPart,
    finalReturnCost: Number(second.costTotal),
    reportAfterFullReturn: afterComplete,
    reproducedFixed:
      Number(sold.costTotal) === 50.05 &&
      Number(first.costTotal) === 15.02 &&
      afterLegacyPart.Costo === 35.03 &&
      Number(second.costTotal) === 35.03 &&
      afterComplete.Costo === 0,
  };
  assert.equal(evidence.r8_02.reproducedFixed, true);
  await ok(`/cash-sessions/${cash.id}/close`, {
    countedCash: 200,
    notes: "Cierre regresiones R8 independientes",
  });
  cash = null;

  writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  if (cash && token) {
    try {
      await ok(`/cash-sessions/${cash.id}/close`, {
        countedCash: 200,
        notes: "Cierre de contingencia de auditoría",
      });
    } catch {
      cash = null;
    }
  }
  await db.$disconnect();
}
