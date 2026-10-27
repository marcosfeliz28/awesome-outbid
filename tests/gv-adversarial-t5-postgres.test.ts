// T5 (26-oct-2026): regresiones adversarias del módulo GV contra la API real
// y una base PostgreSQL descartable. No se agrega a vitest.config.ts aquí.
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
const marker = randomUUID().slice(0, 8);
const ip = "198.18.26." + ((Date.now() % 250) + 1);
let admin = "";
let gv = "";
let gvUserId = "";
let tenantSlug = "";

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const appointmentDate = () => `${day(30)}T15:30:00-04:00`;

async function request(
  path: string,
  token: string,
  body?: unknown,
  method?: "GET" | "POST" | "PATCH",
) {
  const response = await fetch(base + path, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      "X-Forwarded-For": ip,
      ...(tenantSlug ? { "X-Tenant-Id": tenantSlug } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let parsed: any = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Respuesta de texto: se conserva para que el fallo sea visible.
  }
  return { status: response.status, body: parsed };
}

const expectStatus = (response: any, status: number) => {
  expect(response.status, JSON.stringify(response.body)).toBe(status);
  return response.body;
};

async function login(email: string, password: string) {
  const response = await request("/auth/login", "", { email, password });
  return expectStatus(response, 201).accessToken as string;
}

const courseBody = (extra: Record<string, unknown> = {}) => ({
  name: `T5 Curso ${marker}`,
  type: "automaquillaje",
  date: day(30),
  price: 100,
  capacity: 12,
  ...extra,
});

async function createCourse(extra: Record<string, unknown> = {}) {
  return expectStatus(await request("/gv/courses", gv, courseBody(extra)), 201);
}

async function createEnrollment(
  courseId: string,
  extra: Record<string, unknown> = {},
) {
  return expectStatus(
    await request("/gv/enrollments", gv, {
      operationId: randomUUID(),
      courseId,
      clientName: `T5 Clienta ${marker}`,
      agreedPrice: 100,
      ...extra,
    }),
    201,
  );
}

const paymentBody = (
  enrollmentId: string,
  extra: Record<string, unknown> = {},
) => ({
  operationId: randomUUID(),
  enrollmentId,
  date: day(0),
  amount: 25,
  concept: "separo",
  method: "efectivo",
  ...extra,
});

const appointmentBody = (extra: Record<string, unknown> = {}) => ({
  operationId: randomUUID(),
  date: appointmentDate(),
  clientName: `T5 Cita ${marker}`,
  service: "glam",
  artists: ["Génesis"],
  afterHours: false,
  total: 100,
  tip: 0,
  ...extra,
});

beforeAll(async () => {
  // En producto se envía el código de empresa; en la rama GV anterior no hay
  // tabla Tenant. La consulta es sólo para compatibilidad entre ambas ramas.
  tenantSlug = await db
    .$queryRawUnsafe(`SELECT slug FROM "Tenant" ORDER BY "createdAt" LIMIT 1`)
    .then((rows: any[]) => rows[0]?.slug ?? "")
    .catch(() => "");
  admin = await login("admin@fitstore.demo", DEMO);
  const roles = expectStatus(await request("/roles", admin), 200);
  const gvRole = roles.find((role: any) => role.name === "gv");
  expect(gvRole, "La rama debe incluir el rol gv").toBeTruthy();
  expect(gvRole.permissions.sort()).toEqual([
    "gv:read",
    "gv:reports",
    "gv:write",
  ]);

  const email = `t5-gv-${marker}@example.invalid`;
  const password = "Nexora-T5-GV-2026!";
  const created = expectStatus(
    await request("/users", admin, {
      name: `T5 GV ${marker}`,
      email,
      password,
      pin: "583920",
      roleId: gvRole.id,
    }),
    201,
  );
  gvUserId = created.id;

  // La cuenta de prueba no debe obligar a cambiar la contraseña. En producto
  // también necesita el correo marcado como confirmado.
  const columns: { column_name: string }[] = await db.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_name='User'`,
  );
  const names = new Set(columns.map((row) => row.column_name));
  await db.$executeRawUnsafe(
    `UPDATE "User" SET "mustChangePassword"=false,"passwordExpiresAt"=NULL${names.has("emailVerifiedAt") ? ',"emailVerifiedAt"=now()' : ""} WHERE id=$1::uuid`,
    gvUserId,
  );
  gv = await login(email, password);
}, 120_000);

afterAll(async () => {
  if (gvUserId)
    await request("/users/" + gvUserId, admin, { active: false }, "PATCH");
  await db.$disconnect();
}, 60_000);

describe("T5 · dinero e idempotencia de pagos GV", () => {
  it("rechaza sobrepagos y nunca muestra un pendiente negativo", async () => {
    const course = await createCourse({ name: `T5 Sobrepago ${marker}` });
    const enrollment = await createEnrollment(course.id);
    expectStatus(
      await request(
        "/gv/payments",
        gv,
        paymentBody(enrollment.id, { amount: 100 }),
      ),
      201,
    );
    expectStatus(
      await request(
        "/gv/payments",
        gv,
        paymentBody(enrollment.id, { amount: 0.01 }),
      ),
      400,
    );
    const detail = expectStatus(
      await request(`/gv/courses/${course.id}`, gv),
      200,
    );
    const row = detail.enrollments.find(
      (item: any) => item.id === enrollment.id,
    );
    expect(row).toMatchObject({ paid: "100.00", pending: "0.00" });
  });

  it("dos clics simultáneos con operationId idéntico crean un solo pago", async () => {
    const course = await createCourse({ name: `T5 Doble clic ${marker}` });
    const enrollment = await createEnrollment(course.id);
    const body = paymentBody(enrollment.id, {
      operationId: randomUUID(),
      amount: 25,
    });
    const [first, second] = await Promise.all([
      request("/gv/payments", gv, body),
      request("/gv/payments", gv, body),
    ]);
    expect(
      [first.status, second.status].sort(),
      JSON.stringify([first.body, second.body]),
    ).toEqual([201, 201]);
    expect(first.body.id).toBe(second.body.id);

    const detail = expectStatus(
      await request(`/gv/courses/${course.id}`, gv),
      200,
    );
    const row = detail.enrollments.find(
      (item: any) => item.id === enrollment.id,
    );
    expect(
      row.payments.filter(
        (payment: any) => payment.operationId === body.operationId,
      ),
    ).toHaveLength(1);
  });

  it("quien registra una transferencia no puede auto-verificarla", async () => {
    const course = await createCourse({ name: `T5 Verificación ${marker}` });
    const enrollment = await createEnrollment(course.id);
    const transfer = expectStatus(
      await request(
        "/gv/payments",
        gv,
        paymentBody(enrollment.id, {
          amount: 40,
          method: "transferencia",
          bank: "Popular",
          reference: `T5-${marker}`,
        }),
      ),
      201,
    );
    expect(transfer.verified).toBe(false);
    expectStatus(
      await request(`/gv/payments/${transfer.id}/review`, gv, {
        verified: true,
      }),
      403,
    );

    let detail = expectStatus(
      await request(`/gv/courses/${course.id}`, gv),
      200,
    );
    let row = detail.enrollments.find((item: any) => item.id === enrollment.id);
    expect(row).toMatchObject({
      paid: "0.00",
      unverified: "40.00",
      pending: "100.00",
    });

    expectStatus(
      await request(`/gv/payments/${transfer.id}/review`, admin, {
        verified: true,
      }),
      201,
    );
    detail = expectStatus(await request(`/gv/courses/${course.id}`, gv), 200);
    row = detail.enrollments.find((item: any) => item.id === enrollment.id);
    expect(row).toMatchObject({
      paid: "40.00",
      unverified: "0.00",
      pending: "60.00",
    });
  });
});

describe("T5 · importación GV", () => {
  const keys = {
    course: `t5-${marker}-course`,
    enrollment: `t5-${marker}-enrollment`,
    payment: `t5-${marker}-payment`,
  };
  const payload = () => ({
    courses: [
      {
        key: keys.course,
        ...courseBody({ name: `T5 Importación ${marker}` }),
      },
    ],
    enrollments: [
      {
        key: keys.enrollment,
        courseKey: keys.course,
        clientName: `T5 Importada ${marker}`,
        agreedPrice: 100,
        payments: [
          {
            key: keys.payment,
            date: day(0),
            amount: 25,
            concept: "separo",
            method: "efectivo",
          },
        ],
      },
    ],
  });

  it("repetir exactamente la importación no duplica cursos, inscripciones ni pagos", async () => {
    const first = expectStatus(
      await request("/gv/import", admin, payload()),
      201,
    );
    expect(first).toMatchObject({
      courses: { create: 1, update: 0 },
      enrollments: { create: 1, update: 0 },
      payments: { create: 1, update: 0 },
    });
    const second = expectStatus(
      await request("/gv/import", admin, payload()),
      201,
    );
    expect(second).toMatchObject({
      courses: { create: 0, update: 1 },
      enrollments: { create: 0, update: 1 },
      payments: { create: 0, update: 1 },
    });

    const courses = expectStatus(await request("/gv/courses", gv), 200);
    const matching = courses.filter(
      (item: any) => item.name === `T5 Importación ${marker}`,
    );
    expect(matching).toHaveLength(1);
    const detail = expectStatus(
      await request(`/gv/courses/${matching[0].id}`, gv),
      200,
    );
    expect(detail.enrollments).toHaveLength(1);
    expect(detail.enrollments[0].payments).toHaveLength(1);
  });

  it("una clave de pago no puede reutilizarse para moverlo a otra inscripción", async () => {
    expectStatus(await request("/gv/import", admin, payload()), 201);
    const attempt = {
      enrollments: [
        {
          key: `t5-${marker}-other-enrollment`,
          courseKey: keys.course,
          clientName: `T5 Otra clienta ${marker}`,
          agreedPrice: 100,
          payments: [
            {
              key: keys.payment,
              date: day(0),
              amount: 25,
              concept: "separo",
              method: "efectivo",
            },
          ],
        },
      ],
    };
    expectStatus(await request("/gv/import", admin, attempt), 400);
  });

  it("rechaza pagos importados sin una clave estable", async () => {
    const withoutPaymentKey = payload();
    delete (withoutPaymentKey.enrollments[0].payments[0] as any).key;
    withoutPaymentKey.courses[0].key += "-sin-clave";
    withoutPaymentKey.enrollments[0].key += "-sin-clave";
    withoutPaymentKey.enrollments[0].courseKey =
      withoutPaymentKey.courses[0].key;
    expectStatus(await request("/gv/import", admin, withoutPaymentKey), 400);
  });
});

describe("T5 · permisos y estados cerrados", () => {
  it("el rol gv no puede leer costos, configuración, usuarios ni datos Macgen", async () => {
    for (const path of [
      "/products",
      "/settings",
      "/users",
      "/roles",
      "/dashboard/summary",
      "/reports/sales",
      "/sales",
      "/customers",
      "/inventory/stock",
      "/payments/pending-transfers",
      "/audit-log",
    ]) {
      const response = await request(path, gv);
      expect([path, response.status], JSON.stringify(response.body)).toEqual([
        path,
        403,
      ]);
    }
  });

  it.each(["cancelada", "reembolsada"])(
    "una inscripción %s no acepta pagos nuevos",
    async (status) => {
      const course = await createCourse({
        name: `T5 Cerrada ${status} ${marker}`,
      });
      const enrollment = await createEnrollment(course.id);
      const closing: Record<string, unknown> = { status };
      if (status === "reembolsada") {
        expectStatus(
          await request(
            "/gv/payments",
            gv,
            paymentBody(enrollment.id, { amount: 10 }),
          ),
          201,
        );
        closing.refundAmount = 10;
        closing.refundDate = day(0);
      }
      expectStatus(
        await request(`/gv/enrollments/${enrollment.id}`, gv, closing, "PATCH"),
        200,
      );
      expectStatus(
        await request(
          "/gv/payments",
          gv,
          paymentBody(enrollment.id, { amount: 10 }),
        ),
        400,
      );
    },
  );

  it.each(["cancelada", "reembolsada"])(
    "una cita %s no acepta pagos nuevos",
    async (status) => {
      const appointment = expectStatus(
        await request("/gv/appointments", gv, appointmentBody()),
        201,
      );
      const closing: Record<string, unknown> = { status };
      if (status === "reembolsada") {
        expectStatus(
          await request(`/gv/appointments/${appointment.id}/payments`, gv, {
            operationId: randomUUID(),
            date: day(0),
            amount: 10,
            concept: "separo",
            method: "efectivo",
          }),
          201,
        );
        closing.refundAmount = 10;
        closing.refundDate = day(0);
      }
      expectStatus(
        await request(
          `/gv/appointments/${appointment.id}`,
          gv,
          closing,
          "PATCH",
        ),
        200,
      );
      expectStatus(
        await request(`/gv/appointments/${appointment.id}/payments`, gv, {
          operationId: randomUUID(),
          date: day(0),
          amount: 10,
          concept: "separo",
          method: "efectivo",
        }),
        400,
      );
    },
  );
});

describe("T5 · fechas y precisión monetaria", () => {
  it("rechaza fechas imposibles en cursos, pagos y citas", async () => {
    expectStatus(
      await request("/gv/courses", gv, courseBody({ date: "2026-02-30" })),
      400,
    );
    const course = await createCourse({ name: `T5 Fecha pago ${marker}` });
    const enrollment = await createEnrollment(course.id);
    expectStatus(
      await request(
        "/gv/payments",
        gv,
        paymentBody(enrollment.id, { date: "2026-02-30" }),
      ),
      400,
    );
    expectStatus(
      await request(
        "/gv/appointments",
        gv,
        appointmentBody({ date: "2026-02-30T15:30:00-04:00" }),
      ),
      400,
    );
  });

  it("rechaza montos con tres decimales en todos los puntos de entrada", async () => {
    expectStatus(
      await request("/gv/courses", gv, courseBody({ price: 100.001 })),
      400,
    );
    const course = await createCourse({ name: `T5 Decimales ${marker}` });
    expectStatus(
      await request("/gv/enrollments", gv, {
        operationId: randomUUID(),
        courseId: course.id,
        clientName: `T5 Tres decimales ${marker}`,
        agreedPrice: 100.001,
      }),
      400,
    );
    const enrollment = await createEnrollment(course.id);
    expectStatus(
      await request(
        "/gv/payments",
        gv,
        paymentBody(enrollment.id, { amount: 10.001 }),
      ),
      400,
    );
    expectStatus(
      await request(
        "/gv/appointments",
        gv,
        appointmentBody({ total: 100.001 }),
      ),
      400,
    );
    expectStatus(
      await request("/gv/appointments", gv, appointmentBody({ tip: 1.001 })),
      400,
    );
  });
});
