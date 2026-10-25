// Tablero A · liquidez contra la API HTTP y PostgreSQL reales.
// Los datos llevan un sufijo único, se comparan como deltas contra el estado
// inicial y se eliminan al terminar. Nunca usa ni modifica producción.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

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
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const tag = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const branch = `qa-liquidity-other-${tag}`;
const ip = `198.18.72.${10 + (Date.now() % 230)}`;
const saleIds: string[] = [];
const paymentIds: string[] = [];
const customerIds: string[] = [];
const operationIds: string[] = [];
const sessionIds: string[] = [];
const terminalId = randomUUID();
let owner = "";
let seller = "";
let ownerId = "";
let ownerBranch = "";
let firstRealtimeId = BigInt(0);

type Liquidity = {
  pockets: {
    drawers: { amount: string; openRegisters: number };
    owner: { amount: string };
    banks: { verified: string; pending: string };
    street: { cod: string; credit: string; unclassified: string };
  };
};

async function request(
  path: string,
  token = "",
  data?: unknown,
  method = data === undefined ? "GET" : "POST",
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Conserva el texto para que un fallo HTTP sea diagnosticable.
  }
  return { status: response.status, body };
}

async function ok(path: string, token = "", data?: unknown, method?: string) {
  const response = await request(path, token, data, method);
  if (response.status >= 400)
    throw new Error(
      `${path}: HTTP ${response.status} ${JSON.stringify(response.body)}`,
    );
  return response.body;
}

function sessionFrom(token: string) {
  const payload = JSON.parse(
    Buffer.from(token.split(".")[1], "base64url").toString(),
  );
  if (typeof payload.sid !== "string") throw new Error("Token sin sesión");
  sessionIds.push(payload.sid);
  return payload.sid as string;
}

const cents = (value: string | number) => Math.round(Number(value) * 100);
const delta = (after: string, before: string) => cents(after) - cents(before);

async function login(email: string) {
  const result = await ok("/auth/login", "", { email, password: DEMO });
  sessionFrom(result.accessToken);
  return result;
}

async function createCustomer(branchId = ownerBranch) {
  const customer = await db.customer.create({
    data: {
      name: `QA liquidez ${tag}`,
      branchId,
      createdBy: ownerId,
    },
  });
  customerIds.push(customer.id);
  return customer.id;
}

async function createSale({
  amount,
  branchId = ownerBranch,
  receivableKind = null,
  customerId = null,
  createdAt = new Date(),
}: {
  amount: string;
  branchId?: string;
  receivableKind?: "cod" | "credit" | null;
  customerId?: string | null;
  createdAt?: Date;
}) {
  const sale = await db.sale.create({
    data: {
      number: `QA-LIQ-${tag}-${saleIds.length + 1}`,
      offlineUuid: randomUUID(),
      requestHash: `qa-liquidity-${tag}`,
      customerId,
      sellerId: ownerId,
      subtotal: amount,
      discountTotal: 0,
      taxTotal: 0,
      total: amount,
      costTotal: 0,
      creditBalance: receivableKind === null ? 0 : amount,
      receivableKind,
      branchId,
      createdAt,
    },
  });
  saleIds.push(sale.id);
  return sale;
}

async function addPayment(
  saleId: string,
  method: string,
  amount: string,
  options: {
    status?: string;
    entryType?: string;
    createdAt?: Date;
    reference?: string;
  } = {},
) {
  const payment = await db.payment.create({
    data: {
      saleId,
      method,
      amount,
      tendered: amount,
      status: options.status ?? "ok",
      entryType: options.entryType ?? "sale",
      createdAt: options.createdAt ?? new Date(),
      reference: options.reference,
      bank: method === "transfer" ? "Banco QA" : undefined,
    },
  });
  paymentIds.push(payment.id);
  return payment;
}

async function receivable(
  kind: "cod" | "credit" | null,
  amount: string,
  customerId: string,
  branchId = ownerBranch,
) {
  const sale = await createSale({
    amount,
    branchId,
    receivableKind: kind,
    customerId,
  });
  // Las ventas históricas no tenían receivableKind; su fuente era el método.
  if (kind === null)
    await db.sale.update({
      where: { id: sale.id },
      data: { creditBalance: amount },
    });
  await addPayment(sale.id, kind === "credit" ? "credit" : "cod", amount);
  return sale;
}

async function liquidity(): Promise<Liquidity> {
  return ok("/dashboard/liquidity", owner);
}

let before: Liquidity;
let after: Liquidity;
let codNumber = "";
let creditNumber = "";
let ambiguousNumber = "";

beforeAll(async () => {
  const ownerLogin = await login("admin@fitstore.demo");
  owner = ownerLogin.accessToken;
  ownerId = ownerLogin.user.id;
  ownerBranch = ownerLogin.user.branchId ?? "main";
  seller = (await login("vendedor@fitstore.demo")).accessToken;

  const latestRealtime = await db.realtimeEvent.findFirst({
    orderBy: { id: "desc" },
    select: { id: true },
  });
  firstRealtimeId = latestRealtime?.id ?? BigInt(0);

  const terminal = await ok("/terminals/register", owner, {
    id: terminalId,
    name: `QA liquidez ${tag}`,
    secret: `qa-liquidity-${randomUUID()}`,
  });
  if (terminal.status === "pending")
    await ok(`/terminals/${terminalId}/approve`, owner, {});

  before = await liquidity();

  const customerId = await createCustomer();
  const otherCustomerId = await createCustomer(branch);
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // La fecha del pago no decide "verificadas hoy": la bitácora de /verify sí.
  const oldTransferSale = await createSale({
    amount: "7.07",
    createdAt: yesterday,
  });
  const oldTransfer = await addPayment(oldTransferSale.id, "transfer", "7.07", {
    status: "pending_verification",
    createdAt: yesterday,
    reference: `VER-${tag}`,
  });
  await ok(`/payments/${oldTransfer.id}/verify`, owner, {});

  const pendingSale = await createSale({ amount: "8.08" });
  await addPayment(pendingSale.id, "transfer", "8.08", {
    status: "pending_verification",
    reference: `PEN-${tag}`,
  });

  const codSale = await receivable("cod", "10.01", customerId);
  const creditSale = await receivable("credit", "20.02", customerId);
  const ambiguousSale = await receivable(null, "30.03", customerId);
  const mixedHistorical = await createSale({
    amount: "40.04",
    receivableKind: null,
    customerId,
  });
  await db.sale.update({
    where: { id: mixedHistorical.id },
    data: { creditBalance: "40.04" },
  });
  await addPayment(mixedHistorical.id, "credit", "40.04");
  await addPayment(mixedHistorical.id, "cod", "40.04");
  codNumber = codSale.number;
  creditNumber = creditSale.number;
  ambiguousNumber = ambiguousSale.number;

  // Flujo 1: cobro de una factura individual.
  const individual = await receivable("credit", "1.11", customerId);
  const individualOperation = randomUUID();
  operationIds.push(individualOperation);
  await ok(`/sales/${individual.id}/credit-collections`, owner, {
    operationId: individualOperation,
    lines: [{ method: "cash", amount: 1.11, ownerConfirmed: true }],
  });

  // Flujo 2: cobro distribuido desde la cuenta del cliente.
  const accountCustomerId = await createCustomer();
  await receivable("cod", "2.22", accountCustomerId);
  const accountOperation = randomUUID();
  operationIds.push(accountOperation);
  await ok(`/credit-accounts/${accountCustomerId}/collections`, owner, {
    operationId: accountOperation,
    lines: [{ method: "cash", amount: 2.22, ownerConfirmed: true }],
  });

  // Ruido de otra sucursal: cubre todos los bolsillos y debe quedar fuera.
  const foreignSale = await receivable(
    "credit",
    "900.09",
    otherCustomerId,
    branch,
  );
  await addPayment(foreignSale.id, "transfer", "800.08", {
    status: "pending_verification",
    reference: `OTHER-PEN-${tag}`,
  });
  const foreignVerified = await addPayment(
    foreignSale.id,
    "transfer",
    "700.07",
    { reference: `OTHER-VER-${tag}` },
  );
  await db.auditLog.create({
    data: {
      userId: ownerId,
      action: "verify",
      entity: "payment",
      entityId: foreignVerified.id,
      branchId: branch,
    },
  });
  await addPayment(foreignSale.id, "cash", "600.06", {
    entryType: "installment",
    reference: "Recibido por la dueña · QA otra sucursal",
  });
  await db.cashSession.create({
    data: {
      registerId: `qa-liquidity-${tag}`,
      userId: ownerId,
      openingAmount: "500.05",
      branchId: branch,
    },
  });

  // Recoge también los pagos creados por ambos endpoints para limpiarlos.
  const generated = await db.payment.findMany({
    where: { saleId: { in: saleIds } },
    select: { id: true },
  });
  for (const row of generated)
    if (!paymentIds.includes(row.id)) paymentIds.push(row.id);

  after = await liquidity();
}, 120_000);

afterAll(async () => {
  try {
    await db.notificationOutbox.deleteMany({
      where: { refId: { in: paymentIds } },
    });
    await db.incentiveEntry.deleteMany({ where: { saleId: { in: saleIds } } });
    await db.creditAllocationOperation.deleteMany({
      where: { operationId: { in: operationIds } },
    });
    await db.alert.deleteMany({ where: { entityId: { in: saleIds } } });
    await db.auditLog.deleteMany({
      where: {
        OR: [
          { entityId: { in: [...saleIds, ...paymentIds, terminalId] } },
          { entityId: { in: customerIds } },
          { branchId: branch },
        ],
      },
    });
    await db.realtimeEvent.deleteMany({
      where: { branchId: ownerBranch, id: { gt: firstRealtimeId } },
    });
    await db.realtimeEvent.deleteMany({ where: { branchId: branch } });
    await db.payment.deleteMany({ where: { saleId: { in: saleIds } } });
    await db.cashSession.deleteMany({
      where: { registerId: `qa-liquidity-${tag}` },
    });
    await db.sale.deleteMany({ where: { id: { in: saleIds } } });
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
    await db.refreshToken.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });
    await db.authSession.deleteMany({ where: { id: { in: sessionIds } } });
    await db.terminal.deleteMany({ where: { id: terminalId } });
    await db.authAttempt.deleteMany({ where: { key: { contains: ip } } });
  } finally {
    await db.$disconnect();
  }
}, 60_000);

describe("GET /api/dashboard/liquidity · PostgreSQL", () => {
  it("rechaza con 403 a una persona autenticada sin permiso *", async () => {
    const response = await request("/dashboard/liquidity", seller);
    expect(response.status).toBe(403);
  });

  it("aísla la sucursal y usa la verificación, no la creación, como fecha", () => {
    expect(
      delta(after.pockets.banks.verified, before.pockets.banks.verified),
    ).toBe(707);
    expect(
      delta(after.pockets.banks.pending, before.pockets.banks.pending),
    ).toBe(808);
    expect(
      delta(after.pockets.drawers.amount, before.pockets.drawers.amount),
    ).toBe(0);
    expect(
      after.pockets.drawers.openRegisters -
        before.pockets.drawers.openRegisters,
    ).toBe(0);
  });

  it("suma el efectivo de la dueña desde ambos flujos con centavos exactos", () => {
    expect(delta(after.pockets.owner.amount, before.pockets.owner.amount)).toBe(
      333,
    );
  });

  it("separa contraentrega, crédito e histórico igual que sus fuentes", async () => {
    expect(delta(after.pockets.street.cod, before.pockets.street.cod)).toBe(
      1001,
    );
    expect(
      delta(after.pockets.street.credit, before.pockets.street.credit),
    ).toBe(2002);
    expect(
      delta(
        after.pockets.street.unclassified,
        before.pockets.street.unclassified,
      ),
    ).toBe(7007);

    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Santo_Domingo",
    });
    const report = await ok(
      `/reports/creditos-por-antiguedad?from=${today}&to=${today}`,
      owner,
    );
    const rows = report.rows as any[];
    const details = new Map(
      rows
        .filter((row: any) =>
          [codNumber, creditNumber, ambiguousNumber].includes(row.Factura),
        )
        .map((row: any) => [row.Factura, row]),
    );
    expect(details.get(codNumber)).toMatchObject({
      Tipo: "Contraentrega",
      Saldo: 10.01,
    });
    expect(details.get(creditNumber)).toMatchObject({
      Tipo: "Crédito",
      Saldo: 20.02,
    });
    expect(details.get(ambiguousNumber)).toMatchObject({
      Tipo: "Crédito / contraentrega",
      Saldo: 30.03,
    });
  });
});
