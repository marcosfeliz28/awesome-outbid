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

const BANK = "Popular Grupo Génesis ···9797";
const enroll = (courseId: string, agreedPrice: number, name = "QA") =>
  ok("/gv/enrollments", gv, {
    operationId: randomUUID(),
    courseId,
    clientName: name + " " + suffix,
    agreedPrice,
  });
const payBody = (enrollmentId: string, extra: Record<string, unknown>) => ({
  operationId: randomUUID(),
  enrollmentId,
  date: "2026-10-26",
  concept: "separo",
  method: "efectivo",
  ...extra,
});
const transferBody = (enrollmentId: string, amount: number) =>
  payBody(enrollmentId, {
    amount,
    method: "transferencia",
    bank: BANK,
    reference: "QA-" + randomUUID().slice(0, 8),
  });

describe("GV · banco de lista y anular pago", () => {
  it("el banco sale de la lista; fuera de ella se rechaza; el rol gv anula con razón", async () => {
    const banks = await ok("/gv/banks", gv);
    expect(banks.genesis).toContain(BANK);
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    const e = await enroll(course.id, 3000, "Banco");
    const bad = {
      ...transferBody(e.id, 100),
      bank: "Banco inventado",
    };
    expect((await request("/gv/payments", gv, bad)).status).toBe(400);
    const paid = await ok("/gv/payments", gv, transferBody(e.id, 100));
    // Sin razón no se anula; con razón, sí, y deja de contar.
    expect(
      (await request("/gv/payments/" + paid.id + "/void", gv, {})).status,
    ).toBe(400);
    const voided = await ok("/gv/payments/" + paid.id + "/void", gv, {
      reason: "Monto mal escrito",
    });
    expect(voided.rejectedAt).toBeTruthy();
    const detail = await ok("/gv/courses/" + course.id, gv);
    const row = detail.enrollments.find((x: any) => x.id === e.id);
    expect(row.unverified).toBe("0.00");
  });
});

describe("GV · cursos, inscripciones y pagos", () => {
  it("valida el curso; pagado cuenta sólo lo verificado y el pendiente es exacto", async () => {
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
    for (const amount of [0, -5])
      expect(
        (await request("/gv/payments", gv, payBody(first.id, { amount })))
          .status,
      ).toBe(400);
    // GV-07: transferencia sin banco o sin referencia.
    expect(
      (
        await request(
          "/gv/payments",
          gv,
          payBody(first.id, { amount: 1, method: "transferencia", bank: BANK }),
        )
      ).status,
    ).toBe(400);
    const cash = payBody(first.id, { amount: 1000.1 });
    const p1 = await ok("/gv/payments", gv, cash);
    expect((await ok("/gv/payments", gv, cash)).id).toBe(p1.id);
    expect(p1.verified).toBe(true);
    const transfer = await ok("/gv/payments", gv, transferBody(first.id, 0.2));
    expect(transfer.verified).toBe(false);
    const detail = await ok("/gv/courses/" + course.id, gv);
    const row = detail.enrollments.find((e: any) => e.id === first.id);
    // GV-08: la transferencia por verificar no cuenta como pagada.
    expect(row).toMatchObject({
      paid: "1000.10",
      unverified: "0.20",
      pending: "3500.00",
    });
    expect(row.createdByName).toBe("QA GV " + suffix);
    expect(row.payments[0].createdBy).toBeUndefined();
    const list = await ok("/gv/courses", gv);
    expect(list.find((c: any) => c.id === course.id)).toMatchObject({
      enrolled: 1,
      paid: "1000.10",
      pending: "3500.00",
      capacity: 32,
    });
    const pending = await ok("/gv/transfers/pending", gv);
    expect(pending.some((p: any) => p.id === transfer.id)).toBe(true);
    expect(pending.every((p: any) => p.method === "transferencia")).toBe(true);
  });

  it("GV-09: no acepta sobrepagos ni bajar el total por debajo de lo cobrado", async () => {
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    const e = await enroll(course.id, 1000, "QA Tope");
    await ok("/gv/payments", gv, transferBody(e.id, 600));
    // 600 por verificar + 400.01 superaría el total.
    const over = await request(
      "/gv/payments",
      gv,
      payBody(e.id, { amount: 400.01 }),
    );
    expect(over.status).toBe(400);
    expect(over.body.message).toMatch(/supera lo pendiente/);
    // Dos pagos a la vez por el saldo completo: sólo entra uno.
    const both = await Promise.all([
      request("/gv/payments", gv, payBody(e.id, { amount: 400 })),
      request("/gv/payments", gv, payBody(e.id, { amount: 400 })),
    ]);
    expect(both.map((r) => r.status).sort()).toEqual([201, 400]);
    expect(
      (
        await request(
          "/gv/enrollments/" + e.id,
          gv,
          { agreedPrice: 999.99 },
          "PATCH",
        )
      ).status,
    ).toBe(400);
    const row = (await ok("/gv/courses/" + course.id, gv)).enrollments[0];
    expect(row).toMatchObject({ paid: "400.00", unverified: "600.00" });
    expect(row.pending).toBe("600.00");
  });

  it("GV-05/06: sólo gerencia verifica, una vez, nunca su propio pago ni efectivo", async () => {
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    const e = await enroll(course.id, 18000, "QA Transferencia");
    const a = await ok("/gv/payments", gv, transferBody(e.id, 9000));
    const b = await ok("/gv/payments", gv, transferBody(e.id, 9000));
    for (const as of [seller, gv])
      expect(
        (await request(`/gv/payments/${a.id}/review`, as, { verified: true }))
          .status,
      ).toBe(403);
    const verified = await ok(`/gv/payments/${a.id}/review`, manager, {
      verified: true,
    });
    expect(verified.verified).toBe(true);
    // Repetir la verificación: igual; rechazarla después: no.
    expect(
      (await ok(`/gv/payments/${a.id}/review`, manager, { verified: true }))
        .verifiedAt,
    ).toBe(verified.verifiedAt);
    expect(
      (
        await request(`/gv/payments/${a.id}/review`, manager, {
          verified: false,
          reason: "QA cambio de idea",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(`/gv/payments/${b.id}/review`, manager, {
          verified: false,
        })
      ).status,
    ).toBe(400);
    // Verificar y rechazar a la vez: sólo una gana.
    const race = await Promise.all([
      request(`/gv/payments/${b.id}/review`, manager, { verified: true }),
      request(`/gv/payments/${b.id}/review`, admin, {
        verified: false,
        reason: "No llegó al banco",
      }),
    ]);
    expect(race.map((r) => r.status).sort()).toEqual([201, 400]);
    const final = await db.gvPayment.findUniqueOrThrow({ where: { id: b.id } });
    expect(final.verified && final.rejectedAt).toBeFalsy();
    // Repetir el rechazo: igual (idempotente), sin otra bitácora.
    const c = await ok(
      "/gv/payments",
      gv,
      transferBody((await enroll(course.id, 500, "QA Rechazo")).id, 50),
    );
    const reject = () =>
      ok(`/gv/payments/${c.id}/review`, manager, {
        verified: false,
        reason: "No llegó",
      });
    const r1 = await reject();
    expect((await reject()).rejectedAt).toBe(r1.rejectedAt);
    expect(
      await db.auditLog.count({
        where: { entityId: c.id, action: "gv_payment_reject" },
      }),
    ).toBe(1);
    // La gerencia no verifica una transferencia que registró ella misma.
    const own = await ok(
      "/gv/payments",
      manager,
      transferBody((await enroll(course.id, 500, "QA Propia")).id, 100),
    );
    expect(
      (
        await request(`/gv/payments/${own.id}/review`, manager, {
          verified: true,
        })
      ).status,
    ).toBe(403);
    // El efectivo no se revisa.
    const cash = await ok(
      "/gv/payments",
      gv,
      payBody((await enroll(course.id, 500, "QA Efectivo")).id, {
        amount: 100,
      }),
    );
    expect(
      (
        await request(`/gv/payments/${cash.id}/review`, admin, {
          verified: true,
        })
      ).status,
    ).toBe(400);
    expect(
      await db.auditLog.count({
        where: { entityId: a.id, action: "gv_payment_verify" },
      }),
    ).toBe(1);
  });

  it("GV-13: cancelada no acepta pagos; reembolsada registra monto y fecha", async () => {
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    const e = await enroll(course.id, 4500, "QA Reembolso");
    await ok("/gv/payments", gv, payBody(e.id, { amount: 2000 }));
    const late = await ok("/gv/payments", gv, transferBody(e.id, 100));
    const patch = (data: unknown) =>
      request("/gv/enrollments/" + e.id, gv, data, "PATCH");
    expect((await patch({ status: "reembolsada" })).status).toBe(400);
    expect(
      (
        await patch({
          status: "reembolsada",
          refundAmount: 2000.01,
          refundDate: "2026-10-26",
        })
      ).status,
    ).toBe(400);
    expect((await patch({ status: "cancelada" })).status).toBe(200);
    expect(
      (await request("/gv/payments", gv, payBody(e.id, { amount: 10 }))).status,
    ).toBe(400);
    const refunded = await patch({
      status: "reembolsada",
      refundAmount: 1500,
      refundDate: "2026-10-26",
    });
    expect(refunded.status).toBe(200);
    expect((await patch({ status: "activa" })).status).toBe(400);
    // Reembolsada: su transferencia pendiente ya no se verifica.
    expect(
      (
        await request(`/gv/payments/${late.id}/review`, manager, {
          verified: true,
        })
      ).status,
    ).toBe(400);
    const row = (await ok("/gv/courses/" + course.id, gv)).enrollments[0];
    expect(row).toMatchObject({
      paid: "2000.00",
      refunded: "1500.00",
      pending: "0.00",
      refundDate: "2026-10-26",
    });
    const r = await ok("/gv/reports?from=2026-10-26&to=2026-10-26", manager);
    expect(Number(r.income.refunds)).toBeGreaterThanOrEqual(1500);
    expect(Number(r.income.net)).toBeCloseTo(
      Number(r.income.total) - Number(r.income.refunds),
      2,
    );
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
            key: importKey + "-p1",
            date: "2026-10-01",
            amount: 5000,
            concept: "separo",
            method: "transferencia",
            bank: BANK,
            reference: "R1",
          },
          {
            key: importKey + "-p2",
            date: "2026-10-15",
            amount: 2500.5,
            concept: "segundo",
            method: "efectivo",
          },
        ],
      },
      {
        key: importKey + "-e2",
        courseKey: importKey + "-c1",
        clientName: "QA Otra " + suffix,
        agreedPrice: 18000,
        payments: [] as any[],
      },
    ],
  });

  it("dryRun cuenta y valida sin escribir; los errores no guardan nada", async () => {
    const dry = await ok("/gv/import?dryRun=1", admin, payload());
    expect(dry).toMatchObject({
      dryRun: true,
      courses: { create: 1, update: 0 },
      enrollments: { create: 2, update: 0 },
      payments: { create: 2, update: 0 },
      errors: [],
    });
    expect(
      await db.gvCourse.count({ where: { externalId: importKey + "-c1" } }),
    ).toBe(0);
    const broken = payload();
    broken.enrollments.push({
      ...broken.enrollments[1],
      key: importKey + "-e3",
      courseKey: "no-existe",
    });
    (broken.enrollments[0].payments[0] as any).amount = 0;
    delete (broken.enrollments[0].payments[1] as any).key;
    broken.enrollments[1].payments = [
      {
        key: importKey + "-px",
        date: "2026-10-01",
        amount: 18000.01,
        concept: "separo",
        method: "efectivo",
      },
    ];
    const report = await ok("/gv/import?dryRun=1", admin, broken);
    const text = report.errors.join(" ");
    expect(text).toMatch(/courseKey/);
    expect(text).toMatch(/amount/);
    expect(text).toMatch(/payments\.1\.key/);
    expect((await request("/gv/import", admin, broken)).status).toBe(400);
    expect(
      await db.gvCourse.count({ where: { externalId: importKey + "-c1" } }),
    ).toBe(0);
    // Sobrepago dentro del archivo (sin otros errores).
    const over = payload();
    over.enrollments[1].payments = broken.enrollments[1].payments;
    expect(
      (await ok("/gv/import?dryRun=1", admin, over)).errors.join(" "),
    ).toMatch(/superan el total/);
  });

  it("reimporta sin duplicar, sin mover pagos ni cambiar los ya verificados", async () => {
    const first = await ok("/gv/import", admin, payload());
    expect(first.courses).toEqual({ create: 1, update: 0 });
    // Bitácora por fila: 1 curso + 2 inscripciones + 2 pagos = 5 asientos.
    const importedIds = async () => {
      const c = await db.gvCourse.findMany({
        where: { externalId: { startsWith: importKey + "-c1" } },
      });
      const e = await db.gvEnrollment.findMany({
        where: { externalId: { in: [importKey + "-e1", importKey + "-e2"] } },
      });
      const p = await db.gvPayment.findMany({
        where: { externalId: { in: [importKey + "-p1", importKey + "-p2"] } },
      });
      return [...c, ...e, ...p].map((r: any) => r.id);
    };
    const audits = async (action: string) =>
      db.auditLog.count({
        where: { action, entityId: { in: await importedIds() } },
      });
    expect(await audits("gv_import_create")).toBe(5);
    const course = await db.gvCourse.findFirstOrThrow({
      where: { externalId: importKey + "-c1" },
    });
    const transfer = await db.gvPayment.findFirstOrThrow({
      where: { externalId: importKey + "-p1" },
    });
    expect(transfer.verified).toBe(false);
    await ok("/gv/payments/" + transfer.id + "/review", manager, {
      verified: true,
    });
    const changed = payload();
    changed.enrollments[0].note = "nota nueva";
    // Reordenar los pagos no cambia nada: la identidad es la clave.
    changed.enrollments[0].payments.reverse();
    const second = await ok("/gv/import", admin, changed);
    // Reimportar: curso e inscripciones con antes/después; los pagos ya
    // verificados no cambian y no dejan asiento.
    expect(await audits("gv_import_update")).toBe(3);
    const e1 = await db.gvEnrollment.findFirstOrThrow({
      where: { externalId: importKey + "-e1" },
    });
    const noteChange = await db.auditLog.findFirstOrThrow({
      where: { action: "gv_import_update", entityId: e1.id },
    });
    expect([
      (noteChange.before as any).note,
      (noteChange.after as any).note,
    ]).toEqual(["importada", "nota nueva"]);
    expect(second).toMatchObject({
      courses: { create: 0, update: 1 },
      enrollments: { create: 0, update: 2 },
      payments: { create: 0, update: 2 },
    });
    const rows = await db.gvEnrollment.findMany({
      where: { courseId: course.id, externalId: importKey + "-e1" },
      include: { payments: true },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("nota nueva");
    expect(rows[0].payments).toHaveLength(2);
    expect(rows[0].payments.every((p: any) => p.verified)).toBe(true);
    const detail = (await ok("/gv/courses/" + course.id, gv)).enrollments.find(
      (e: any) => e.clientName === "QA Importada " + suffix,
    );
    expect(detail).toMatchObject({ paid: "7500.50", pending: "10499.50" });
    // GV-12: el pago verificado no cambia de monto al reimportar.
    const bigger = payload();
    bigger.enrollments[0].payments[0].amount = 6000;
    const e12 = await ok("/gv/import?dryRun=1", admin, bigger);
    expect(e12.errors.join(" ")).toMatch(/ya fue verificado/);
    // GV-11: la misma clave de pago bajo otra clienta.
    const moved = payload();
    moved.enrollments[1].payments = [moved.enrollments[0].payments[1]];
    moved.enrollments[0].payments = [moved.enrollments[0].payments[0]];
    const e11 = await ok("/gv/import?dryRun=1", admin, moved);
    expect(e11.errors.join(" ")).toMatch(/ya es de otra clienta/);
    // Citas e interesadas las valida gv-citas.ts (gv-citas-api.test.ts).
    const invalid = await ok("/gv/import?dryRun=1", admin, {
      ...payload(),
      appointments: [{}],
      leads: [{}, {}],
    });
    expect(
      invalid.errors.some((e: string) => e.startsWith("appointments.0.")),
    ).toBe(true);
    expect(invalid.errors.some((e: string) => e.startsWith("leads.1."))).toBe(
      true,
    );
  });
});

describe("GV · auditoría de Claude PC", () => {
  it("dryRun mal escrito o repetido es 400 y no escribe", async () => {
    const body = {
      courses: [
        {
          key: importKey + "-dry",
          name: "QA dry " + suffix,
          type: "otro",
          date: "2026-11-30",
          price: 1,
          capacity: 1,
        },
      ],
    };
    for (const q of ["TRUE", "yes", "2", "", "1&dryRun=1"])
      expect([
        q,
        (await request("/gv/import?dryRun=" + q, admin, body)).status,
      ]).toEqual([q, 400]);
    expect(
      await db.gvCourse.count({ where: { externalId: importKey + "-dry" } }),
    ).toBe(0);
  });

  it("la importación acepta más de 100 kb; el resto de la API no", async () => {
    const note = "x".repeat(900);
    const big = {
      courses: [
        {
          key: importKey + "-big",
          name: "QA big " + suffix,
          type: "otro",
          date: "2026-11-30",
          price: 100,
          capacity: 500,
        },
      ],
      enrollments: Array.from({ length: 150 }, (_, i) => ({
        key: `${importKey}-big-${i}`,
        courseKey: importKey + "-big",
        clientName: "QA " + i,
        agreedPrice: 100,
        note,
      })),
    };
    expect(JSON.stringify(big).length).toBeGreaterThan(110000);
    const r = await ok("/gv/import?dryRun=1", admin, big);
    expect(r.enrollments.create).toBe(150);
    // Fuera de /gv/import sigue el límite global de 100 kb.
    expect(
      (await request("/gv/courses", admin, big)).status,
    ).toBeGreaterThanOrEqual(400);
  });

  it("reimportar no baja el total de lo cobrado ni reabre una reembolsada", async () => {
    const base = {
      courses: [
        {
          key: importKey + "-re",
          name: "QA re " + suffix,
          type: "otro",
          date: "2026-11-30",
          price: 1000,
          capacity: 5,
        },
      ],
      enrollments: [
        {
          key: importKey + "-re-1",
          courseKey: importKey + "-re",
          clientName: "QA re 1",
          agreedPrice: 1000,
          payments: [] as any[],
        },
      ],
    };
    await ok("/gv/import", admin, base);
    const e = await db.gvEnrollment.findFirstOrThrow({
      where: { externalId: importKey + "-re-1" },
    });
    // Un pago hecho en el sistema cuenta para el tope de la reimportación.
    await ok("/gv/payments", gv, payBody(e.id, { amount: 800 }));
    const lower = structuredClone(base);
    lower.enrollments[0].agreedPrice = 700;
    expect(
      (await ok("/gv/import?dryRun=1", admin, lower)).errors.join(" "),
    ).toMatch(/superan el total/);
    const more = structuredClone(base);
    more.enrollments[0].payments = [
      {
        key: importKey + "-re-p",
        date: "2026-10-26",
        amount: 300,
        concept: "restante",
        method: "efectivo",
      },
    ];
    expect(
      (await ok("/gv/import?dryRun=1", admin, more)).errors.join(" "),
    ).toMatch(/superan el total/);
    expect((await request("/gv/import", admin, lower)).status).toBe(400);
    expect(
      (
        await db.gvEnrollment.findUniqueOrThrow({ where: { id: e.id } })
      ).agreedPrice.toFixed(2),
    ).toBe("1000.00");
    await ok(
      "/gv/enrollments/" + e.id,
      gv,
      { status: "reembolsada", refundAmount: 800, refundDate: "2026-10-26" },
      "PATCH",
    );
    const reopen = structuredClone(base);
    expect(
      (await ok("/gv/import?dryRun=1", admin, reopen)).errors.join(" "),
    ).toMatch(/no se reabre/);
  });

  it("importes exactos; /staff y /audit-log no mezclan GV", async () => {
    const course = (await newCourse(gv)).body;
    courseIds.push(course.id);
    const e = await enroll(course.id, 100, "QA exacto");
    expect(
      (await request("/gv/payments", gv, payBody(e.id, { amount: 0.1 + 0.2 })))
        .status,
    ).toBe(400);
    const staff = await ok("/staff", admin);
    expect(staff.some((u: any) => u.id === gvUserId)).toBe(false);
    const log = await ok("/audit-log", admin);
    expect(log.some((a: any) => String(a.action).startsWith("gv_"))).toBe(
      false,
    );
  });
});

describe("GV · reportes", () => {
  it("ingresos verificados, pendientes y ocupación sólo con gv:reports", async () => {
    expect((await request("/gv/reports", seller)).status).toBe(403);
    expect(
      (await request("/gv/reports?from=2026-10-20&to=2026-10-01", gv)).status,
    ).toBe(400);
    const r = await ok("/gv/reports?from=2026-10-01&to=2026-10-15", gv);
    const bank = r.income.byBank.find((b: any) => b.key === BANK);
    expect(Number(bank.total)).toBeGreaterThanOrEqual(5000);
    expect(r.income.byMethod.map((m: any) => m.key)).toEqual(
      expect.arrayContaining(["efectivo", "transferencia"]),
    );
    const client = r.pendingByClient.find(
      (e: any) => e.clientName === "QA Importada " + suffix,
    );
    expect(client).toMatchObject({
      kind: "curso",
      paid: "7500.50",
      pending: "10499.50",
    });
    const course = r.courses.find(
      (c: any) => c.name === "QA Brazilian " + suffix,
    );
    expect(course).toMatchObject({ capacity: 12, enrolled: 2 });
    // GV-03: los nombres de Macgen (gerencia) no salen en GV.
    expect(JSON.stringify(r)).not.toContain("Andrea Gómez");
  });
});
