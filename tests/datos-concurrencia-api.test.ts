// Auditoría 06 v2, N-A1 (ALTO, regresión): la FK CreditNote_customerId_fkey
// tomaba FOR KEY SHARE sobre el cliente al insertar la nota de una devolución,
// mientras la venta al mismo cliente ya lo tenía FOR UPDATE y esperaba la
// variante que la devolución tenía: interbloqueo (HTTP 500 en cobros y
// devoluciones). La devolución ahora bloquea Caja → Cliente → Venta →
// Variantes, igual que la venta. Se prueba contra la API y PostgreSQL reales y
// se cuentan los interbloqueos en pg_stat_database, no sólo los HTTP 500
// (el reintento de 40P01 podría ocultarlos).
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
const demo = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const tag = Date.now().toString(36);
const ROUNDS = 30;
const SELLERS = 4;
let hop = 0;
const nextIp = () =>
  "198.19." + (((Date.now() + hop) % 200) + 1) + "." + ((hop++ % 250) + 1);

async function call(path: string, data?: unknown, token = "") {
  const response = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": nextIp(),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  return { status: response.status, body: await response.json() };
}
async function ok(path: string, data?: unknown, token = "") {
  const r = await call(path, data, token);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function enroll(token: string, owner: string) {
  const id = randomUUID();
  const t = await ok(
    "/terminals/register",
    { id, name: "QA N-A1 " + id.slice(0, 6), secret: "qa-na1-" + id },
    token,
  );
  if (t.status === "pending")
    await ok("/terminals/" + id + "/approve", {}, owner);
  return id;
}
const deadlocks = async () => {
  // Las estadísticas se publican con un pequeño retraso.
  await new Promise((r) => setTimeout(r, 1800));
  const rows = await db.$queryRaw<
    { deadlocks: bigint }[]
  >`SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()`;
  return Number(rows[0].deadlocks);
};

let owner = "";
const sellers: { token: string; sessionId: string }[] = [];
let manager: { token: string; sessionId: string };
let customerId = "";
let variantId = "";
const users: string[] = [];
const sessions: string[] = [];

beforeAll(async () => {
  owner = (
    await ok("/auth/login", { email: "admin@fitstore.demo", password: demo })
  ).accessToken;
  await enroll(owner, owner);
  const managerToken = (
    await ok("/auth/login", { email: "gerente@fitstore.demo", password: demo })
  ).accessToken;
  const managerTerminal = await enroll(managerToken, owner);
  const managerSession = await ok(
    "/cash-sessions/open",
    { openingAmount: 0, registerId: "qa-na1-m-" + tag + managerTerminal },
    managerToken,
  );
  manager = { token: managerToken, sessionId: managerSession.id };
  sessions.push(managerSession.id);
  const roles = await ok("/roles", undefined, owner);
  const seller = roles.find((r: any) => r.name === "seller").id;
  for (let n = 1; n <= SELLERS; n++) {
    const email = `qa-na1-${n}-${tag}@example.test`;
    const user = await ok(
      "/users",
      {
        name: "QA Cajera N-A1 " + n,
        email,
        password: "FitStore-QA-2026!",
        pin: "24680" + n,
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
      { openingAmount: 0, registerId: "qa-na1-" + n + "-" + tag },
      login.accessToken,
    );
    sessions.push(session.id);
    sellers.push({ token: login.accessToken, sessionId: session.id });
  }
  customerId = (
    await ok("/customers", { name: "QA Cliente N-A1 " + tag }, owner)
  ).id;
  const categories = await ok("/categories", undefined, owner);
  const product = await ok(
    "/products",
    {
      name: "QA N-A1 " + tag,
      sku: "QA-NA1-" + tag,
      categoryId: categories.find((c: any) => c.name === "Fajas").id,
      variants: [
        {
          sku: "QA-NA1V-" + tag,
          barcode: "QA-NA1B-" + tag,
          price: 1000,
          costAvg: 400,
        },
      ],
    },
    owner,
  );
  variantId = product.variants[0].id;
  await db.variant.update({
    where: { id: variantId },
    data: { stock: 100000 },
  });
});

afterAll(async () => {
  for (const id of sessions)
    await call(
      "/cash-sessions/" + id + "/close",
      { countedCash: 0, countedCard: 0, countedTransfer: 0, notes: "QA N-A1" },
      owner,
    );
  await db.$disconnect();
});

const saleBody = (sessionId: string, qty: number) => ({
  offlineUuid: randomUUID(),
  cashSessionId: sessionId,
  customerId,
  items: [{ variantId, qty, discountPercent: 0 }],
  globalDiscount: 0,
  payments: [{ method: "cash", amount: 1000 * qty }],
});

describe("N-A1 · devolución con nota de crédito contra ventas al mismo cliente", () => {
  it(`${ROUNDS} rondas de 1 devolución + ${SELLERS} ventas simultáneas: 0 interbloqueos y 0 HTTP 500`, async () => {
    const bases: any[] = [];
    for (let r = 0; r < ROUNDS; r++)
      bases.push(
        await ok("/sales", saleBody(sellers[0].sessionId, 2), sellers[0].token),
      );
    const before = await deadlocks();
    const statuses: number[] = [];
    for (let r = 0; r < ROUNDS; r++) {
      const sale = bases[r];
      const results = await Promise.all([
        call(
          "/returns",
          {
            operationId: randomUUID(),
            saleId: sale.id,
            cashSessionId: manager.sessionId,
            reason: "QA N-A1 devolución con nota",
            refundMethod: "credit_note",
            items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
          },
          manager.token,
        ),
        ...sellers.map((s) =>
          call("/sales", saleBody(s.sessionId, 1), s.token),
        ),
      ]);
      statuses.push(...results.map((x) => x.status));
    }
    const after = await deadlocks();
    expect(statuses.filter((s) => s >= 500)).toEqual([]);
    expect(statuses.every((s) => s === 201)).toBe(true);
    expect(after - before).toBe(0);
  }, 300_000);
});

describe("Auditoría 06/04 · fila antigua que viola una restricción NOT VALID", () => {
  it("anular esa venta responde 409 con un mensaje claro, no 500 genérico", async () => {
    const sale = await ok(
      "/sales",
      saleBody(sellers[0].sessionId, 1),
      sellers[0].token,
    );
    const rows = await db.$queryRaw<
      { def: string }[]
    >`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
       WHERE conname = 'sale_amounts_nonnegative'
         AND conrelid = '"Sale"'::regclass`;
    expect(rows).toHaveLength(1);
    const def = rows[0].def.replace(/ NOT VALID$/, "");
    try {
      // Una fila de antes de la restricción: ya violaba la regla, y la
      // restricción quedó NOT VALID (se evalúa en cada UPDATE de la fila).
      await db.$executeRawUnsafe(
        `ALTER TABLE "Sale" DROP CONSTRAINT sale_amounts_nonnegative`,
      );
      await db.$executeRawUnsafe(
        `UPDATE "Sale" SET "taxTotal" = -5 WHERE id = '${sale.id}'::uuid`,
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Sale" ADD CONSTRAINT sale_amounts_nonnegative ${def} NOT VALID`,
      );
      const res = await call(
        "/sales/" + sale.id + "/void",
        { reason: "QA fila antigua" },
        owner,
      );
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("CONSTRAINT_VIOLATION");
      expect(res.body.message).toContain("sale_amounts_nonnegative");
      expect(res.body.message).toMatch(/regla de integridad/);
    } finally {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Sale" DROP CONSTRAINT IF EXISTS sale_amounts_nonnegative`,
      );
      await db.$executeRawUnsafe(
        `UPDATE "Sale" SET "taxTotal" = 0 WHERE id = '${sale.id}'::uuid`,
      );
      await db.$executeRawUnsafe(
        `ALTER TABLE "Sale" ADD CONSTRAINT sale_amounts_nonnegative ${def}`,
      );
    }
  });
});
