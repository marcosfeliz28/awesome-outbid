// GV · citas de maquillaje e interesadas (docs/coordinacion/MODULO-GV.md §3-§4):
// el rol gv las lleva, Macgen no entra, el pendiente es exacto y la
// importación no duplica. Contra la API real.
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
const ip = "198.18.12." + ((Date.now() % 250) + 1);
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
  seller = "",
  warehouse = "",
  gv = "",
  gvUserId = "";
const key = "qa-citas-" + suffix;
const ids: string[] = [];
const leadIds: string[] = [];

beforeAll(async () => {
  admin = await login("admin@fitstore.demo", DEMO);
  seller = await login("vendedor@fitstore.demo", DEMO);
  warehouse = await login("almacen@fitstore.demo", DEMO);
  const gvRole = (await ok("/roles", admin)).find((r: any) => r.name === "gv");
  const email = `qa-gv-citas-${suffix}@example.test`;
  gvUserId = (
    await ok("/users", admin, {
      name: "QA GV citas " + suffix,
      email,
      password: "FitStore-QA-2026!",
      pin: "583921",
      roleId: gvRole.id,
    })
  ).id;
  gv = await login(email, "FitStore-QA-2026!", "FitStore-QA-Nueva-2026!");
}, 120000);

afterAll(async () => {
  const appointments = await db.gvAppointment.findMany({
    where: { OR: [{ id: { in: ids } }, { externalId: { startsWith: key } }] },
    select: { id: true },
  });
  const aIds = appointments.map((a: any) => a.id);
  await db.gvPayment.deleteMany({ where: { appointmentId: { in: aIds } } });
  await db.gvAppointment.deleteMany({ where: { id: { in: aIds } } });
  await db.gvLead.deleteMany({
    where: {
      OR: [{ id: { in: leadIds } }, { externalId: { startsWith: key } }],
    },
  });
  if (gvUserId)
    await db.user.update({ where: { id: gvUserId }, data: { active: false } });
  await db.$disconnect();
}, 60000);

const cita = (extra: Record<string, unknown> = {}) => ({
  date: "2026-10-25T15:30:00-04:00",
  clientName: "QA Clienta " + suffix,
  phone: "809-555-0101",
  instagram: "@qa_clienta",
  service: "glam",
  artists: ["Génesis", "Maryori"],
  afterHours: true,
  total: 4500.35,
  tip: 500,
  ...extra,
});

describe("GV · citas: permisos", () => {
  it("la vendedora y otros roles de Macgen no entran", async () => {
    for (const token of [seller, warehouse]) {
      expect((await request("/gv/appointments", token)).status).toBe(403);
      expect((await request("/gv/leads", token)).status).toBe(403);
      expect((await request("/gv/appointments", token, cita())).status).toBe(
        403,
      );
      expect(
        (await request("/gv/leads", token, { name: "QA no" })).status,
      ).toBe(403);
    }
    expect(
      (await request("/gv/import?dryRun=1", gv, { appointments: [] })).status,
    ).toBe(403);
  });
});

describe("GV · citas", () => {
  it("crea, edita, cobra y calcula el pendiente con decimales exactos", async () => {
    const operationId = randomUUID();
    const created = await ok("/gv/appointments", gv, {
      ...cita(),
      operationId,
    });
    ids.push(created.id);
    expect(created).toMatchObject({
      service: "glam",
      artists: ["Génesis", "Maryori"],
      afterHours: true,
      total: "4500.35",
      tip: "500.00",
      status: "agendada",
      paid: "0.00",
      pending: "4500.35",
    });
    expect(new Date(created.date).toISOString()).toBe(
      "2026-10-25T19:30:00.000Z",
    );
    // Reenviar la misma operación no duplica.
    const again = await ok("/gv/appointments", gv, {
      ...cita(),
      operationId,
    });
    expect(again.id).toBe(created.id);
    expect(
      (await request("/gv/appointments", gv, cita({ service: "x" }))).status,
    ).toBe(400);
    expect(
      (await request("/gv/appointments", gv, cita({ artists: ["Otra"] })))
        .status,
    ).toBe(400);
    expect(
      (await request("/gv/appointments", gv, cita({ total: 1.005 }))).status,
    ).toBe(400);

    const pay = (amount: number, method: string, operationId = randomUUID()) =>
      ok(`/gv/appointments/${created.id}/payments`, gv, {
        operationId,
        date: "2026-10-20",
        amount,
        concept: "separo",
        method,
        bank: method === "transferencia" ? "Popular" : undefined,
        reference: method === "transferencia" ? "QA-" + suffix : undefined,
      });
    const payOp = randomUUID();
    await pay(1000.1, "efectivo", payOp);
    await pay(1000.1, "efectivo", payOp);
    const transfer = await pay(0.2, "transferencia");
    expect(transfer.verified).toBe(false);
    let detail = await ok("/gv/appointments/" + created.id, gv);
    expect(detail.payments).toHaveLength(2);
    // 4500.35 − 1000.10 − 0.20 = 3500.05 (en flotante saldría 3500.0499…).
    expect(detail).toMatchObject({
      paid: "1000.30",
      unverified: "0.20",
      pending: "3500.05",
    });
    // La transferencia rechazada deja de contar.
    await ok(`/gv/payments/${transfer.id}/review`, gv, {
      verified: false,
      reason: "QA: no llegó",
    });
    detail = await ok("/gv/appointments/" + created.id, gv);
    expect(detail).toMatchObject({ paid: "1000.10", pending: "3500.25" });

    const edited = await ok(
      "/gv/appointments/" + created.id,
      gv,
      { status: "realizada", note: "QA nota" },
      "PATCH",
    );
    expect(edited).toMatchObject({
      status: "realizada",
      note: "QA nota",
      service: "glam",
      artists: ["Génesis", "Maryori"],
      pending: "3500.25",
    });
    const list = await ok(
      "/gv/appointments?from=2026-10-25&to=2026-10-25&status=realizada",
      gv,
    );
    expect(list.some((a: any) => a.id === created.id)).toBe(true);
    expect(
      (await ok("/gv/appointments?from=2026-10-26", gv)).some(
        (a: any) => a.id === created.id,
      ),
    ).toBe(false);
    expect(
      await db.auditLog.count({
        where: { entity: "gv_appointment", entityId: created.id },
      }),
    ).toBe(2);
  });

  it("interesadas: crea sin duplicar y cambia el estado", async () => {
    const operationId = randomUUID();
    const lead = await ok("/gv/leads", gv, {
      operationId,
      name: "QA Interesada " + suffix,
      phone: "829-555-0102",
      interest: "Brazilian",
      action: "Escribir por WhatsApp",
    });
    leadIds.push(lead.id);
    expect(lead.status).toBe("por_contactar");
    expect(
      (await ok("/gv/leads", gv, { operationId, name: "QA Interesada" })).id,
    ).toBe(lead.id);
    const edited = await ok(
      "/gv/leads/" + lead.id,
      gv,
      { status: "contactada" },
      "PATCH",
    );
    expect(edited).toMatchObject({
      status: "contactada",
      interest: "Brazilian",
    });
    expect(
      (await request("/gv/leads/" + lead.id, gv, { status: "x" }, "PATCH"))
        .status,
    ).toBe(400);
    const list = await ok("/gv/leads?status=contactada", gv);
    expect(list.some((l: any) => l.id === lead.id)).toBe(true);
  });
});

describe("GV · importación de citas e interesadas", () => {
  const payload = (note = "nota") => ({
    appointments: [
      {
        key: key + "-c1",
        ...cita({ total: 3000, tip: 0, note }),
        payments: [
          {
            date: "2026-10-01",
            amount: 1500.5,
            concept: "separo",
            method: "transferencia",
            bank: "BHD",
            verified: true,
          },
          {
            date: "2026-10-25",
            amount: 1000,
            concept: "restante",
            method: "efectivo",
          },
        ],
      },
      {
        key: key + "-boda",
        ...cita({
          service: "boda",
          total: 25000,
          weddingQuote: 25000,
          venue: "QA Salón",
          people: 6,
        }),
      },
    ],
    leads: [
      { key: key + "-l1", name: "QA L1", interest: "Automaquillaje" },
      { key: key + "-l2", name: "QA L2", status: "contactada", note },
    ],
  });

  it("dryRun cuenta y valida sin escribir", async () => {
    const dry = await ok("/gv/import?dryRun=1", admin, payload());
    expect(dry).toMatchObject({
      dryRun: true,
      appointments: { create: 2, update: 0 },
      appointmentPayments: { create: 2, update: 0 },
      leads: { create: 2, update: 0 },
      errors: [],
    });
    expect(
      await db.gvAppointment.count({
        where: { externalId: { startsWith: key } },
      }),
    ).toBe(0);
    const bad = await ok("/gv/import?dryRun=1", admin, {
      appointments: [payload().appointments[0], payload().appointments[0]],
      leads: [{ key: key + "-x", name: "" }],
    });
    expect(bad.errors.join("\n")).toMatch(
      /appointments\.1\.key: clave repetida/,
    );
    expect(bad.errors.join("\n")).toMatch(/leads\.0\.name/);
    expect(
      (
        await request("/gv/import", admin, {
          leads: [{ key: key + "-x", name: "" }],
        })
      ).status,
    ).toBe(400);
  });

  it("importa y al repetir actualiza sin duplicar", async () => {
    const first = await ok("/gv/import", admin, payload());
    expect(first.appointments).toEqual({ create: 2, update: 0 });
    const second = await ok("/gv/import", admin, payload("nota nueva"));
    expect(second).toMatchObject({
      appointments: { create: 0, update: 2 },
      appointmentPayments: { create: 0, update: 2 },
      leads: { create: 0, update: 2 },
    });
    const rows = await db.gvAppointment.findMany({
      where: { externalId: { startsWith: key } },
      include: { payments: true },
      orderBy: { externalId: "asc" },
    });
    expect(rows).toHaveLength(2);
    const [boda, c1] = rows;
    expect(boda).toMatchObject({
      service: "boda",
      venue: "QA Salón",
      people: 6,
    });
    expect(c1.note).toBe("nota nueva");
    expect(c1.payments).toHaveLength(2);
    const detail = await ok("/gv/appointments/" + c1.id, gv);
    expect(detail).toMatchObject({ paid: "2500.50", pending: "499.50" });
    expect(
      await db.gvLead.count({ where: { externalId: { startsWith: key } } }),
    ).toBe(2);
  });
});
