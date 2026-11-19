// GV · US$ sólo efectivo (H-01): la migración 202611010001 deja la restricción
// gv_payment_usd_cash_only como NOT VALID si ya hay un pago GV antiguo en US$ por
// transferencia o tarjeta. Postgres vuelve a evaluar un CHECK NOT VALID en cada UPDATE de
// esa fila, así que anular, verificar o rechazar ese pago antiguo no debe dar 500: debe dar
// un 409 explicado (filtro global, CONSTRAINT_VIOLATION). Contra la API real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { exigirBaseLocal } from "./helpers-base-local";

import { withGvProof } from "./helpers-gv-proof";
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
requireApi("dotenv").config({
  path: fileURLToPath(new URL("../.env", import.meta.url)),
  quiet: true,
});
exigirBaseLocal();
const { PrismaClient } = requireApi("@prisma/client");
const db = new PrismaClient();

const base = process.env.FITSTORE_API_URL || "http://127.0.0.1:3001/api";
const suffix = Date.now().toString(36);
const ip = "198.18.12." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";
const RULE = "gv_payment_usd_cash_only";

async function request(path: string, as: string, data?: unknown) {
  const r = await fetch(base + path, {
    method: data === undefined ? "GET" : "POST",
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
async function ok(path: string, as: string, data?: unknown) {
  const r = await request(path, as, data);
  if (r.status >= 400)
    throw new Error(path + ": " + r.status + " " + JSON.stringify(r.body));
  return r.body;
}
async function login(email: string, password: string, next?: string) {
  let auth = await ok("/auth/login", "", { email, password });
  if (auth.requiresPasswordChange)
    auth = await ok("/auth/change-password", "", {
      login: email,
      currentPassword: password,
      newPassword: next,
      confirmPassword: next,
    });
  return auth.accessToken as string;
}

let manager = "",
  gv = "",
  gvUserId = "",
  courseId = "";
const paymentIds: string[] = [];

// Convierte un pago real en uno «antiguo»: US$ por transferencia con la restricción NOT VALID.
async function makeLegacy(paymentId: string) {
  await db.$transaction([
    db.$executeRawUnsafe(`ALTER TABLE "GvPayment" DROP CONSTRAINT ${RULE}`),
    db.$executeRawUnsafe(
      `UPDATE "GvPayment" SET currency = 'USD', rate = 58 WHERE id = '${paymentId}'::uuid`,
    ),
    db.$executeRawUnsafe(
      `ALTER TABLE "GvPayment" ADD CONSTRAINT ${RULE} CHECK ("currency" = 'DOP' OR "method" = 'efectivo') NOT VALID`,
    ),
  ]);
}

beforeAll(async () => {
  const admin = await login("admin@fitstore.demo", DEMO);
  manager = await login("gerente@fitstore.demo", DEMO);
  const gvRole = (await ok("/roles", admin)).find((r: any) => r.name === "gv");
  const email = `qa-gv-usd-${suffix}@example.test`;
  gvUserId = (
    await ok("/users", admin, {
      name: "QA GV USD " + suffix,
      email,
      password: "FitStore-QA-2026!",
      pin: "583920",
      roleId: gvRole.id,
    })
  ).id;
  gv = await login(email, "FitStore-QA-2026!", "FitStore-QA-Nueva-2026!");
  // Cobrar exige caja GV abierta: sin cajas de otras corridas y con una propia.
  await db.gvCashSession.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });
  await ok("/gv/cash/open", gv, { openingAmount: 0 });
  courseId = (
    await ok("/gv/courses", gv, {
      name: "QA US$ heredado " + suffix,
      type: "automaquillaje",
      date: "2026-11-08",
      price: 4500,
      capacity: 32,
    })
  ).id;
}, 120000);

afterAll(async () => {
  // Se borran los pagos antiguos y se vuelve a validar la restricción: la base queda como estaba.
  await db.gvProof.deleteMany({ where: { paymentId: { in: paymentIds } } });
  await db.gvPayment.deleteMany({ where: { id: { in: paymentIds } } });
  await db.$executeRawUnsafe(
    `ALTER TABLE "GvPayment" VALIDATE CONSTRAINT ${RULE}`,
  );
  await db.gvPayment.deleteMany({ where: { enrollment: { courseId } } });
  await db.gvEnrollment.deleteMany({ where: { courseId } });
  await db.gvCourse.deleteMany({ where: { id: courseId } });
  await db.gvCashSession.deleteMany({ where: { userId: gvUserId } });
  if (gvUserId)
    await db.user.update({ where: { id: gvUserId }, data: { active: false } });
  await db.$disconnect();
}, 60000);

async function legacyTransfer() {
  const e = await ok("/gv/enrollments", gv, {
    operationId: randomUUID(),
    courseId,
    clientName: "QA US$ " + randomUUID().slice(0, 6),
    agreedPrice: 3000,
  });
  const paid = await ok(
    "/gv/payments",
    gv,
    withGvProof({
      operationId: randomUUID(),
      enrollmentId: e.id,
      date: "2026-10-26",
      concept: "separo",
      method: "transferencia",
      bank: "Popular Grupo Génesis ···9797",
      reference: "QA-" + randomUUID().slice(0, 8),
      amount: 100,
    }),
  );
  paymentIds.push(paid.id);
  await makeLegacy(paid.id);
  return paid.id as string;
}

const explained = (r: { status: number; body: any }) => {
  expect(r.status, JSON.stringify(r.body)).toBe(409);
  expect(r.body.code).toBe("CONSTRAINT_VIOLATION");
  expect(r.body.message).toContain(RULE);
};

describe("GV · pago antiguo en US$ por transferencia (restricción NOT VALID)", () => {
  it("verificarlo da 409 explicado, no 500", async () => {
    const id = await legacyTransfer();
    explained(
      await request(`/gv/payments/${id}/review`, manager, { verified: true }),
    );
  });

  it("rechazarlo da 409 explicado, no 500", async () => {
    const id = await legacyTransfer();
    explained(
      await request(`/gv/payments/${id}/review`, manager, {
        verified: false,
        reason: "No llegó",
      }),
    );
  });

  it("anularlo da 409 explicado, no 500", async () => {
    const id = await legacyTransfer();
    explained(
      await request(`/gv/payments/${id}/void`, gv, {
        reason: "Monto mal escrito",
        approverPin: "123456",
      }),
    );
  });

  it("y un pago nuevo en US$ por transferencia se rechaza al crearlo", async () => {
    const e = await ok("/gv/enrollments", gv, {
      operationId: randomUUID(),
      courseId,
      clientName: "QA US$ nuevo " + suffix,
      agreedPrice: 3000,
    });
    const r = await request(
      "/gv/payments",
      gv,
      withGvProof({
        operationId: randomUUID(),
        enrollmentId: e.id,
        date: "2026-10-26",
        concept: "separo",
        method: "transferencia",
        bank: "Popular Grupo Génesis ···9797",
        reference: "QA-" + randomUUID().slice(0, 8),
        amount: 100,
        currency: "USD",
        rate: 58,
      }),
    );
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(r.status).toBeLessThan(500);
  });
});
