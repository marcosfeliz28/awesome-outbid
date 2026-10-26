// Módulo GV (docs/coordinacion/MODULO-GV.md): rol «gv» aislado, cursos,
// inscripciones, pagos con pendiente exacto, verificación de transferencias e
// importación idempotente. Contra la API real.
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
  manager = "",
  seller = "",
  gv = "",
  gvUserId = "";
const courseIds: string[] = [];
const importKey = "qa-" + suffix;

beforeAll(async () => {
  admin = await login("admin@fitstore.demo", DEMO);
  manager = await login("gerente@fitstore.demo", DEMO);
  seller = await login("vendedor@fitstore.demo", DEMO);
  const roles = await ok("/roles", admin);
  const gvRole = roles.find((r: any) => r.name === "gv");
  expect(gvRole.permissions.sort()).toEqual([
    "gv:read",
    "gv:reports",
    "gv:write",
  ]);
  const email = `qa-gv-${suffix}@example.test`;
  const user = await ok("/users", admin, {
    name: "QA GV " + suffix,
    email,
    password: "FitStore-QA-2026!",
    pin: "583920",
    roleId: gvRole.id,
  });
  gvUserId = user.id;
  gv = await login(email, "FitStore-QA-2026!", "FitStore-QA-Nueva-2026!");
}, 120000);

afterAll(async () => {
  const courses = await db.gvCourse.findMany({
    where: {
      OR: [
        { id: { in: courseIds } },
        { externalId: { startsWith: importKey } },
      ],
    },
    select: { id: true },
  });
  const ids = courses.map((c: any) => c.id);
  await db.gvPayment.deleteMany({
    where: { enrollment: { courseId: { in: ids } } },
  });
  await db.gvEnrollment.deleteMany({ where: { courseId: { in: ids } } });
  await db.gvCourse.deleteMany({ where: { id: { in: ids } } });
  if (gvUserId)
    await db.user.update({ where: { id: gvUserId }, data: { active: false } });
  await db.$disconnect();
}, 60000);

const newCourse = (as: string, extra: Record<string, unknown> = {}) =>
  request("/gv/courses", as, {
    name: "QA Automaquillaje " + suffix,
    type: "automaquillaje",
    date: "2026-11-08",
    price: 4500,
    capacity: 32,
    ...extra,
  });

describe("GV · permisos del rol", () => {
  it("la empleada de GV no entra a Macgen ni a administración", async () => {
    for (const path of [
      "/products",
      "/settings",
      "/users",
      "/roles",
      "/dashboard/summary",
      "/reports/sales",
      "/sales",
      "/customers",
      "/cash-sessions/opening-suggestion",
      "/inventory/stock",
      "/inventory/movements",
      "/payments/pending-transfers",
      "/audit-log",
    ])
      expect([path, (await request(path, gv)).status]).toEqual([path, 403]);
    expect((await request("/gv/import?dryRun=1", gv, {})).status).toBe(403);
    // Su propio perfil sí.
    expect((await request("/auth/me", gv)).status).toBe(200);
  });
  it("la vendedora de Macgen no entra a GV; gerencia y administración sí", async () => {
    expect((await request("/gv/courses", seller)).status).toBe(403);
    expect((await newCourse(seller)).status).toBe(403);
    expect((await request("/gv/courses", manager)).status).toBe(200);
    expect((await request("/gv/courses", admin)).status).toBe(200);
    expect((await request("/gv/import?dryRun=1", manager, {})).status).toBe(
      403,
    );
  });
});

describe("GV · cursos, inscripciones y pagos", () => {
  it("valida el curso y calcula pagado y pendiente con decimales exactos", async () => {
    expect((await newCourse(gv, { type: "boda" })).status).toBe(400);
    expect((await newCourse(gv, { price: 10.005 })).status).toBe(400);
    expect((await newCourse(gv, { date: "2026-02-30" })).status).toBe(400);
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    expect(course.date).toBe("2026-11-08");
    const operationId = randomUUID();
    const enrollment = {
      operationId,
      courseId: course.id,
      clientName: "QA Clienta " + suffix,
      phone: "8095550000",
      agreedPrice: 4500.1,
    };
    const first = await ok("/gv/enrollments", gv, enrollment);
    // Reintento con la misma clave: la misma inscripción, sin duplicar.
    const again = await ok("/gv/enrollments", gv, enrollment);
    expect(again.id).toBe(first.id);
    expect(first.status).toBe("activa");
    expect(first.createdBy).toBe(gvUserId);
    const pay = (extra: Record<string, unknown>) => ({
      operationId: randomUUID(),
      enrollmentId: first.id,
      date: "2026-10-26",
      concept: "separo",
      method: "efectivo",
      ...extra,
    });
    expect((await request("/gv/payments", gv, pay({ amount: 0 }))).status).toBe(
      400,
    );
    expect(
      (await request("/gv/payments", gv, pay({ amount: -5 }))).status,
    ).toBe(400);
    const cash = pay({ amount: 1000.1 });
    const p1 = await ok("/gv/payments", gv, cash);
    expect((await ok("/gv/payments", gv, cash)).id).toBe(p1.id);
    expect(p1.verified).toBe(true);
    const transfer = await ok(
      "/gv/payments",
      gv,
      pay({
        amount: 0.2,
        concept: "restante",
        method: "transferencia",
        bank: "Popular Grupo Génesis ···9797",
        reference: "QA-123",
      }),
    );
    expect(transfer.verified).toBe(false);
    const detail = await ok("/gv/courses/" + course.id, gv);
    const row = detail.enrollments.find((e: any) => e.id === first.id);
    // 1000.10 + 0.20 = 1000.30 exacto (en coma flotante sería 1000.3000000000001).
    expect(row.paid).toBe("1000.30");
    expect(row.unverified).toBe("0.20");
    expect(row.pending).toBe("3499.80");
    expect(row.createdByName).toBe("QA GV " + suffix);
    const list = await ok("/gv/courses", gv);
    const summary = list.find((c: any) => c.id === course.id);
    expect(summary).toMatchObject({
      enrolled: 1,
      paid: "1000.30",
      pending: "3499.80",
      capacity: 32,
    });
    const pending = await ok("/gv/transfers/pending", gv);
    expect(pending.some((p: any) => p.id === transfer.id)).toBe(true);
  });

  it("verifica o rechaza una transferencia y registra quién", async () => {
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    const e = await ok("/gv/enrollments", gv, {
      operationId: randomUUID(),
      courseId: course.id,
      clientName: "QA Transferencia " + suffix,
      agreedPrice: 18000,
    });
    const transfer = () =>
      ok("/gv/payments", gv, {
        operationId: randomUUID(),
        enrollmentId: e.id,
        date: "2026-10-26",
        amount: 9000,
        concept: "separo",
        method: "transferencia",
        bank: "Popular Grupo Génesis ···9797",
      });
    const a = await transfer();
    const b = await transfer();
    expect(
      (
        await request("/gv/payments/" + a.id + "/review", seller, {
          verified: true,
        })
      ).status,
    ).toBe(403);
    const verified = await ok("/gv/payments/" + a.id + "/review", manager, {
      verified: true,
    });
    expect(verified.verified).toBe(true);
    expect(verified.verifiedBy).toBeTruthy();
    expect(
      (
        await request("/gv/payments/" + b.id + "/review", gv, {
          verified: false,
        })
      ).status,
    ).toBe(400);
    const rejected = await ok("/gv/payments/" + b.id + "/review", gv, {
      verified: false,
      reason: "No llegó al banco",
    });
    expect(rejected.rejectedBy).toBe(gvUserId);
    const row = (await ok("/gv/courses/" + course.id, gv)).enrollments[0];
    expect(row).toMatchObject({
      paid: "9000.00",
      unverified: "0.00",
      pending: "9000.00",
    });
    expect(
      await db.auditLog.count({
        where: {
          entityId: { in: [a.id, b.id] },
          action: { startsWith: "gv_" },
        },
      }),
    ).toBe(4);
    // Editar la inscripción: estado y asistencia.
    const edited = await ok(
      "/gv/enrollments/" + e.id,
      gv,
      { status: "personalizado", attended: true, boughtBrushSet: true },
      "PATCH",
    );
    expect(edited).toMatchObject({
      status: "personalizado",
      attended: true,
      boughtBrushSet: true,
      clientName: "QA Transferencia " + suffix,
    });
  });
});

describe("GV · importación", () => {
  const payload = () => ({
    courses: [
      {
        key: importKey + "-c1",
        name: "QA Brazilian " + suffix,
        type: "brazilian",
        date: "2026-11-22",
        price: 18000,
        capacity: 12,
      },
    ],
    enrollments: [
      {
        key: importKey + "-e1",
        courseKey: importKey + "-c1",
        clientName: "QA Importada " + suffix,
        phone: "8095551111",
        instagram: "@qa",
        agreedPrice: 18000,
        status: "activa",
        attended: null,
        boughtBrushSet: false,
        note: "importada",
        payments: [
          {
            date: "2026-10-01",
            amount: 5000,
            concept: "separo",
            method: "transferencia",
            bank: "Popular Grupo Génesis ···9797",
            reference: "R1",
          },
          {
            date: "2026-10-15",
            amount: 2500.5,
            concept: "segundo",
            method: "efectivo",
          },
        ],
      },
    ],
  });

  it("dryRun cuenta y valida sin escribir; los errores no guardan nada", async () => {
    const dry = await ok("/gv/import?dryRun=1", admin, payload());
    expect(dry).toMatchObject({
      dryRun: true,
      courses: { create: 1, update: 0 },
      enrollments: { create: 1, update: 0 },
      payments: { create: 2, update: 0 },
      errors: [],
    });
    expect(
      await db.gvCourse.count({ where: { externalId: importKey + "-c1" } }),
    ).toBe(0);
    const broken = payload();
    broken.enrollments.push({
      ...broken.enrollments[0],
      key: importKey + "-e2",
      courseKey: "no-existe",
    });
    (broken.enrollments[0].payments[0] as any).amount = 0;
    const report = await ok("/gv/import?dryRun=1", admin, broken);
    expect(report.errors.join(" ")).toMatch(/courseKey/);
    expect(report.errors.join(" ")).toMatch(/amount/);
    expect((await request("/gv/import", admin, broken)).status).toBe(400);
    expect(
      await db.gvCourse.count({ where: { externalId: importKey + "-c1" } }),
    ).toBe(0);
  });

  it("importa todo y al repetir actualiza sin duplicar ni pisar la verificación", async () => {
    const first = await ok("/gv/import", admin, payload());
    expect(first.courses).toEqual({ create: 1, update: 0 });
    const course = await db.gvCourse.findFirstOrThrow({
      where: { externalId: importKey + "-c1" },
    });
    const transfer = await db.gvPayment.findFirstOrThrow({
      where: { externalId: importKey + "-e1#1" },
    });
    expect(transfer.verified).toBe(false);
    await ok("/gv/payments/" + transfer.id + "/review", gv, { verified: true });
    const changed = payload();
    changed.enrollments[0].note = "nota nueva";
    const second = await ok("/gv/import", admin, changed);
    expect(second).toMatchObject({
      courses: { create: 0, update: 1 },
      enrollments: { create: 0, update: 1 },
      payments: { create: 0, update: 2 },
    });
    const rows = await db.gvEnrollment.findMany({
      where: { courseId: course.id },
      include: { payments: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("nota nueva");
    expect(rows[0].payments).toHaveLength(2);
    expect(rows[0].payments.every((p: any) => p.verified)).toBe(true);
    const detail = (await ok("/gv/courses/" + course.id, gv)).enrollments[0];
    expect(detail).toMatchObject({ paid: "7500.50", pending: "10499.50" });
    // Citas e interesadas: se aceptan e ignoran hasta que exista su módulo.
    const ignored = await ok("/gv/import?dryRun=1", admin, {
      ...payload(),
      appointments: [{}],
      leads: [{}, {}],
    });
    expect(ignored.ignored).toEqual({ appointments: 1, leads: 2 });
    expect(ignored.errors).toEqual([]);
  });
});
