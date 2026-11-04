// Caja propia de GV (orden 4-nov): apertura, cierre con arqueo ciego, recibo por
// pago y bloqueo con la caja del día anterior abierta. Contra la API real.
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
const suffix = Date.now().toString(36);
const ip = "198.18.11." + ((Date.now() % 250) + 1);
const DEMO = process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!";

async function request(
  path: string,
  as: string,
  data?: unknown,
  method?: string,
) {
  const r = await fetch(base + path, {
    method: method ?? (data === undefined ? "GET" : "POST"),
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

let admin = "",
  gv = "",
  gvUserId = "";
const cashIds: string[] = [];
let courseId = "";
const opId = () => randomUUID();

beforeAll(async () => {
  admin = await login("admin@fitstore.demo", DEMO);
  const roles = await ok("/roles", admin);
  const gvRole = roles.find((r: any) => r.name === "gv");
  const email = `qa-gvcaja-${suffix}@example.test`;
  const user = await ok("/users", admin, {
    name: "QA GV Caja " + suffix,
    email,
    password: "FitStore-QA-2026!",
    pin: "583921",
    roleId: gvRole.id,
  });
  gvUserId = user.id;
  gv = await login(email, "FitStore-QA-2026!", "FitStore-QA-Nueva-2026!");
  // Sin cajas GV abiertas de otras corridas.
  await db.gvCashSession.updateMany({
    where: { closedAt: null },
    data: { closedAt: new Date() },
  });
  const c = await ok("/gv/courses", gv, {
    name: "QA Caja " + suffix,
    type: "automaquillaje",
    date: "2026-11-08",
    price: 4500,
    capacity: 32,
  });
  courseId = c.id;
}, 120000);

afterAll(async () => {
  await db.gvPayment.deleteMany({
    where: { enrollment: { courseId } },
  });
  await db.gvEnrollment.deleteMany({ where: { courseId } });
  await db.gvCourse.deleteMany({ where: { id: courseId } });
  await db.gvCashSession.deleteMany({ where: { userId: gvUserId } });
  if (gvUserId)
    await db.user.update({ where: { id: gvUserId }, data: { active: false } });
  await db.$disconnect();
}, 60000);

const enroll = (price = 4500) =>
  ok("/gv/enrollments", gv, {
    operationId: opId(),
    courseId,
    clientName: "Clienta " + suffix,
    agreedPrice: price,
  });
const pay = (enrollmentId: string, amount: number, method = "efectivo") =>
  request("/gv/payments", gv, {
    operationId: opId(),
    enrollmentId,
    date: "2026-11-04",
    amount,
    concept: "separo",
    method,
    ...(method === "tarjeta" ? { reference: "AP123" } : {}),
  });

describe("GV · caja propia", () => {
  it("abrir, cobrar con recibo, arqueo ciego y cerrar con diferencias", async () => {
    const open = await ok("/gv/cash/open", gv, { openingAmount: 1000 });
    cashIds.push(open.id);
    // Repetir «abrir» devuelve la misma caja.
    expect((await ok("/gv/cash/open", gv, { openingAmount: 1000 })).id).toBe(
      open.id,
    );
    const e = await enroll();
    const p1 = await pay(e.id, 500);
    const p2 = await pay(e.id, 300, "tarjeta");
    expect(p1.status).toBe(201);
    // Cada cobro genera su recibo GV-NNNNNNN, distinto, atado a la caja.
    expect(p1.body.receiptNumber).toMatch(/^GV-\d{7}$/);
    expect(p2.body.receiptNumber).not.toBe(p1.body.receiptNumber);
    expect(p1.body.cashSessionId).toBe(open.id);
    // Arqueo ciego: la vendedora no ve el esperado; la dueña sí.
    const seen = await ok("/gv/cash/current", gv);
    expect(seen.expected).toBeUndefined();
    expect(seen.payments).toBe(2);
    const full = await ok("/gv/cash/current", admin);
    expect(full.expected).toEqual({
      efectivo: "1500.00",
      tarjeta: "300.00",
      transferencia: "0.00",
    });
    // Declara 100 menos en efectivo.
    const closed = await ok("/gv/cash/close", gv, {
      countedCash: 1400,
      countedCard: 300,
      countedTransfer: 0,
    });
    expect(closed.differences).toEqual({
      cash: "-100.00",
      card: "0.00",
      transfer: "0.00",
      total: "-100.00",
    });
    expect(closed.receipts).toHaveLength(2);
    expect(await ok("/gv/cash/current", gv)).toBeFalsy(); // sin caja abierta
    expect(
      (
        await request("/gv/cash/close", gv, {
          countedCash: 0,
          countedCard: 0,
          countedTransfer: 0,
        })
      ).status,
    ).toBe(400);
  });

  it("no se cobra con la caja de un día anterior abierta", async () => {
    const open = await ok("/gv/cash/open", gv, { openingAmount: 0 });
    cashIds.push(open.id);
    await db.gvCashSession.update({
      where: { id: open.id },
      data: { openedAt: new Date(Date.now() - 36 * 3600 * 1000) },
    });
    const e = await enroll();
    const r = await pay(e.id, 100);
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain("día anterior");
    expect(
      (await request("/gv/cash/open", gv, { openingAmount: 0 })).status,
    ).toBe(400);
    await ok("/gv/cash/close", gv, {
      countedCash: 0,
      countedCard: 0,
      countedTransfer: 0,
    });
    expect((await pay(e.id, 100)).status).toBe(201);
  });

  it("la caja de GV no aparece en la caja de MacGen y exige permisos", async () => {
    const sessions = await ok("/cash-sessions", admin);
    expect(JSON.stringify(sessions)).not.toContain("gv_cash");
    expect(
      (await request("/gv/cash/open", "", { openingAmount: 1 })).status,
    ).toBe(401);
  });
});

describe("GV · cupos (pendiente de visto bueno de la dueña)", () => {
  it("no inscribe pasado el cupo y deja volver a cancelar y reinscribir", async () => {
    const c = await ok("/gv/courses", gv, {
      name: "QA Cupo " + suffix,
      type: "otro",
      date: "2026-11-09",
      price: 1000,
      capacity: 1,
    });
    const mk = (status?: string) =>
      request("/gv/enrollments", gv, {
        operationId: opId(),
        courseId: c.id,
        clientName: "Cupo " + suffix,
        agreedPrice: 1000,
        ...(status ? { status } : {}),
      });
    const first = await mk();
    expect(first.status).toBe(201);
    const second = await mk();
    expect(second.status).toBe(400);
    expect(JSON.stringify(second.body)).toContain("lleno");
    // Cancelar libera el lugar; reactivar con el curso lleno otra vez se frena.
    await ok(
      "/gv/enrollments/" + first.body.id,
      gv,
      { status: "cancelada" },
      "PATCH",
    );
    const third = await mk();
    expect(third.status).toBe(201);
    const back = await request(
      "/gv/enrollments/" + first.body.id,
      gv,
      { status: "activa" },
      "PATCH",
    );
    expect(back.status).toBe(400);
    await db.gvEnrollment.deleteMany({ where: { courseId: c.id } });
    await db.gvCourse.delete({ where: { id: c.id } });
  });
});

describe("GV · anular y devolver con aprobación de la dueña (pendiente de visto bueno)", () => {
  it("sin el PIN de la dueña no se anula ni se devuelve; con él, sí", async () => {
    const e = await enroll();
    const p = await pay(e.id, 200);
    const voidPath = "/gv/payments/" + p.body.id + "/void";
    expect(
      (await request(voidPath, gv, { reason: "Error de monto" })).status,
    ).toBe(403);
    // PIN de una gerente que no es la dueña: tampoco.
    expect(
      (
        await request(voidPath, gv, {
          reason: "Error de monto",
          approverPin: "234567",
        })
      ).status,
    ).toBe(403);
    const ok1 = await ok(voidPath, gv, {
      reason: "Error de monto",
      approverPin: "123456",
    });
    expect(ok1.rejectedAt).toBeTruthy();
    // La dueña anula sin PIN; devolver sin PIN también se frena a la vendedora.
    const p2 = await pay(e.id, 200);
    expect(
      (
        await ok("/gv/payments/" + p2.body.id + "/void", admin, {
          reason: "Duplicado",
        })
      ).rejectedAt,
    ).toBeTruthy();
    const p3 = await pay(e.id, 300);
    const refund = {
      status: "reembolsada",
      refundAmount: 300,
      refundDate: "2026-11-04",
    };
    expect(
      (await request("/gv/enrollments/" + e.id, gv, refund, "PATCH")).status,
    ).toBe(403);
    expect(
      (
        await request(
          "/gv/enrollments/" + e.id,
          gv,
          { ...refund, approverPin: "123456" },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(p3.status).toBe(201);
  });
});
