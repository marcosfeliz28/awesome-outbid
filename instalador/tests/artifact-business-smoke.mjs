// Solo API local de una instalacion descartable en GitHub Windows.
import { readFile } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
let stage = "environment";
let token;
let httpStatus;
const completed = [];
const base = "http://127.0.0.1:3001/api/";
function check(ok) {
  if (!ok) throw new Error("validation_failed");
}
async function api(path, method = "GET", body) {
  httpStatus = undefined;
  const response = await fetch(base + path, {
    method,
    redirect: "error",
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  httpStatus = response.status;
  check(response.ok);
  return response.json();
}
function passed() {
  completed.push(stage);
}
function id(value) {
  check(
    typeof value === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      ),
  );
  return value;
}
try {
  check(process.platform === "win32");
  check(process.env.GITHUB_ACTIONS === "true");
  check(process.env.RUNNER_ENVIRONMENT === "github-hosted");
  check(process.env.NEXORA_DISPOSABLE_TEST === "1");
  check(process.env.GITHUB_REPOSITORY === "marcosfeliz28/awesome-outbid");
  check(process.env.GITHUB_REF === "refs/heads/qa/windows-smoke-c02-12nov");
  stage = "credentials";
  check(!!process.argv[2]);
  const creds = JSON.parse(
    (await readFile(process.argv[2], "utf8")).replace(/^\uFEFF/, ""),
  );
  check(typeof creds.email === "string" && typeof creds.password === "string");
  stage = "login";
  const auth = await api("auth/login", "POST", {
    email: creds.email,
    password: creds.password,
  });
  check(!auth.requiresPasswordChange && !!auth.accessToken && !!auth.user);
  const userId = id(auth.user.id);
  token = auth.accessToken;
  delete creds.password;
  passed();
  stage = "fresh_cash_state";
  const existing = await api("cash-sessions");
  check(Array.isArray(existing) && existing.length === 0);
  passed();
  const tag = randomUUID().slice(0, 8);
  stage = "terminal";
  const terminalId = randomUUID();
  const terminal = await api("terminals/register", "POST", {
    id: terminalId,
    name: `Norexos QA ${tag}`,
    secret: randomBytes(32).toString("hex"),
  });
  check(terminal.id === terminalId && terminal.status === "approved");
  const current = await api("terminals/current");
  check(current.id === terminalId && current.status === "approved");
  passed();
  stage = "category";
  const category = await api("categories", "POST", {
    name: `Norexos QA ${tag}`,
    requiresLot: false,
    requiresExpiry: false,
    color: "#7C3AED",
    attributes: [],
  });
  id(category.id);
  passed();
  stage = "product";
  const product = await api("products", "POST", {
    name: `Producto sintetico QA ${tag}`,
    sku: `QA-P-${tag}`,
    categoryId: category.id,
    taxRate: 0,
    variants: [
      { sku: `QA-V-${tag}`, barcode: `QA-B-${tag}`, price: 100, costAvg: 50 },
    ],
  });
  const productId = id(product.id);
  check(product.variants?.length === 1);
  const variantId = id(product.variants[0].id);
  passed();
  async function checkStock(expected) {
    const detail = await api(`products/${productId}`);
    const v = detail.variants.find((x) => x.id === variantId);
    check(
      v && Number(v.stock) === expected && Number(v.sellableStock) === expected,
    );
  }
  stage = "inventory";
  await api("inventory/adjustments", "POST", {
    variantId,
    qty: 3,
    reason: "Norexos QA: carga sintetica",
  });
  await checkStock(3);
  passed();
  stage = "customer";
  const customer = await api("customers", "POST", {
    name: `Cliente sintetico QA ${tag}`,
  });
  id(customer.id);
  passed();
  stage = "cash_open";
  const opening = {
    openingAmount: 500,
    registerId: terminalId,
    openingNote: "Norexos QA: fondo sintetico",
  };
  const cash = await api("cash-sessions/open", "POST", opening);
  const cashId = id(cash.id);
  check(
    cash.userId === userId &&
      cash.registerId === terminalId &&
      Number(cash.openingAmount) === 500 &&
      !cash.closedAt,
  );
  const reopened = await api("cash-sessions/open", "POST", opening);
  check(reopened.id === cashId);
  passed();
  stage = "sale";
  const saleInput = {
    offlineUuid: randomUUID(),
    customerId: customer.id,
    cashSessionId: cashId,
    items: [{ variantId, qty: 1 }],
    globalDiscount: 0,
    expectedTotal: 100,
    notes: "Norexos QA: venta sintetica",
    payments: [{ method: "cash", amount: 100 }],
  };
  const sale = await api("sales", "POST", saleInput);
  const saleId = id(sale.id);
  check(Number(sale.total) === 100);
  await checkStock(2);
  passed();
  stage = "sale_idempotency";
  const replay = await api("sales", "POST", saleInput);
  check(replay.id === saleId && Number(replay.total) === 100);
  await checkStock(2);
  passed();
  stage = "cash_close";
  const closed = await api(`cash-sessions/${cashId}/close`, "POST", {
    countedCash: 600,
    countedCard: 0,
    countedTransfer: 0,
    notes: "Norexos QA: cierre sintetico",
    differenceReason: "",
  });
  check(closed.id === cashId && !!closed.closedAt);
  check(Number(closed.expectedCash) === 600);
  for (const field of [
    "difference",
    "differenceCash",
    "differenceCard",
    "differenceTransfer",
  ])
    check(closed[field] != null && Number(closed[field]) === 0);
  const after = await api("cash-sessions");
  check(
    Array.isArray(after) &&
      after.some((x) => x.id === cashId && !!x.closedAt) &&
      !after.some((x) => x.userId === userId && !x.closedAt),
  );
  passed();
  console.log(
    JSON.stringify({
      status: "passed",
      checks: completed,
      saleTotal: 100,
      stockAfter: 2,
      expectedCash: 600,
      cashDifference: 0,
    }),
  );
} catch {
  // Nunca imprimir cuerpo HTTP, credenciales, token ni error completo.
  console.error(
    JSON.stringify({
      status: "failed",
      stage,
      httpStatus,
      checksCompleted: completed,
    }),
  );
  process.exitCode = 1;
}
