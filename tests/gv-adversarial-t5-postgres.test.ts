// T5 (26-oct-2026): regresiones adversarias del módulo GV.
//
// Esta suite es intencionalmente independiente de vitest.config.ts. Arranca
// PostgreSQL y Nest en memoria de proceso mediante el arnés del producto. Se
// incorpora a la batería sólo después de mezclar las migraciones/controladores
// GV; hasta entonces las rutas /gv responden 404 y documentan que la mezcla 4
// todavía no contiene el módulo.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startProductApp, TENANT } from "./setup/product-pg-app";

type App = Awaited<ReturnType<typeof startProductApp>>;

let app: App;
let gvToken = "";
let tenantSlug = "";
const marker = randomUUID().slice(0, 8);

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const appointmentDate = () => `${day(30)}T15:30:00-04:00`;

const send = (
  method: "get" | "post" | "patch",
  path: string,
  body?: unknown,
  token = gvToken,
) => {
  const http: any = app.http;
  const request = http[method]("/api" + path).set("Authorization", token);
  return body === undefined ? request : request.send(body);
};

const expectStatus = (response: any, status: number) => {
  expect(response.status, JSON.stringify(response.body)).toBe(status);
  return response.body;
};

const courseBody = (extra: Record<string, unknown> = {}) => ({
  name: `T5 Curso ${marker}`,
  type: "automaquillaje",
  date: day(30),
  price: 100,
  capacity: 12,
  ...extra,
});

async function createCourse(extra: Record<string, unknown> = {}) {
  return expectStatus(
    await send("post", "/gv/courses", courseBody(extra)),
    201,
  );
}

async function createEnrollment(
  courseId: string,
  extra: Record<string, unknown> = {},
) {
  return expectStatus(
    await send("post", "/gv/enrollments", {
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
  app = await startProductApp("gv_t5_adversarial");
  tenantSlug = (
    await app.q(`SELECT slug FROM "Tenant" WHERE id=$1::uuid`, TENANT)
  )[0].slug;

  let role = (
    await app.q(
      `SELECT id FROM "Role" WHERE "tenantId"=$1::uuid AND lower(name)='gv'`,
      TENANT,
    )
  )[0];
  if (!role) {
    role = { id: randomUUID() };
    await app.q(
      `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt")
       VALUES ($1::uuid,$2::uuid,'gv',ARRAY['gv:read','gv:write','gv:reports'],now())`,
      role.id,
      TENANT,
    );
  }

  const email = `t5-gv-${marker}@example.invalid`;
  const password = "Nexora-T5-GV-2026!";
  const created = await app.post("/users", {
    name: `T5 GV ${marker}`,
    email,
    password,
    pin: "583920",
    roleId: role.id,
  });
  expectStatus(created, 201);
  await app.q(
    `UPDATE "User"
     SET "mustChangePassword"=false,"passwordExpiresAt"=NULL,"emailVerifiedAt"=now()
     WHERE id=$1::uuid`,
    created.body.id,
  );
  const login = await app.http
    .post("/api/auth/login")
    .set("x-tenant-id", tenantSlug)
    .send({ email, password });
  expectStatus(login, 201);
  gvToken = "Bearer " + login.body.accessToken;
}, 180_000);

afterAll(async () => {
  await app?.stop();
}, 60_000);

describe("T5 · dinero e idempotencia de pagos GV", () => {
  it("rechaza sobrepagos y nunca muestra un pendiente negativo", async () => {
    const course = await createCourse({ name: `T5 Sobrepago ${marker}` });
    const enrollment = await createEnrollment(course.id);
    expectStatus(
      await send(
        "post",
        "/gv/payments",
        paymentBody(enrollment.id, { amount: 100 }),
      ),
      201,
    );
    expectStatus(
      await send(
        "post",
        "/gv/payments",
        paymentBody(enrollment.id, { amount: 0.01 }),
      ),
      400,
    );
    const detail = expectStatus(
      await send("get", `/gv/courses/${course.id}`),
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
      send("post", "/gv/payments", body),
      send("post", "/gv/payments", body),
    ]);
    expect(
      [first.status, second.status].sort(),
      JSON.stringify([first.body, second.body]),
    ).toEqual([201, 201]);
    expect(first.body.id).toBe(second.body.id);

    const detail = expectStatus(
      await send("get", `/gv/courses/${course.id}`),
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
    expect(row).toMatchObject({ paid: "25.00", pending: "75.00" });
  });

  it("quien registra una transferencia no puede auto-verificarla", async () => {
    const course = await createCourse({ name: `T5 Verificación ${marker}` });
    const enrollment = await createEnrollment(course.id);
    const transfer = expectStatus(
      await send(
        "post",
        "/gv/payments",
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
      await send("post", `/gv/payments/${transfer.id}/review`, {
        verified: true,
      }),
      403,
    );

    let detail = expectStatus(
      await send("get", `/gv/courses/${course.id}`),
      200,
    );
    let row = detail.enrollments.find((item: any) => item.id === enrollment.id);
    expect(row).toMatchObject({
      paid: "0.00",
      unverified: "40.00",
      pending: "100.00",
    });

    expectStatus(
      await send(
        "post",
        `/gv/payments/${transfer.id}/review`,
        { verified: true },
        app.token,
      ),
      201,
    );
    detail = expectStatus(await send("get", `/gv/courses/${course.id}`), 200);
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
      await send("post", "/gv/import", payload(), app.token),
      201,
    );
    expect(first).toMatchObject({
      courses: { create: 1, update: 0 },
      enrollments: { create: 1, update: 0 },
      payments: { create: 1, update: 0 },
    });
    const second = expectStatus(
      await send("post", "/gv/import", payload(), app.token),
      201,
    );
    expect(second).toMatchObject({
      courses: { create: 0, update: 1 },
      enrollments: { create: 0, update: 1 },
      payments: { create: 0, update: 1 },
    });

    const courses = expectStatus(await send("get", "/gv/courses"), 200);
    const matching = courses.filter(
      (item: any) => item.name === `T5 Importación ${marker}`,
    );
    expect(matching).toHaveLength(1);
    const detail = expectStatus(
      await send("get", `/gv/courses/${matching[0].id}`),
      200,
    );
    expect(detail.enrollments).toHaveLength(1);
    expect(detail.enrollments[0].payments).toHaveLength(1);
  });

  it("una clave de pago no puede reutilizarse para moverlo a otra inscripción", async () => {
    expectStatus(await send("post", "/gv/import", payload(), app.token), 201);
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
    expectStatus(await send("post", "/gv/import", attempt, app.token), 400);
  });

  it("rechaza pagos importados sin una clave estable", async () => {
    const withoutPaymentKey = payload();
    delete (withoutPaymentKey.enrollments[0].payments[0] as any).key;
    withoutPaymentKey.courses[0].key += "-sin-clave";
    withoutPaymentKey.enrollments[0].key += "-sin-clave";
    withoutPaymentKey.enrollments[0].courseKey =
      withoutPaymentKey.courses[0].key;
    expectStatus(
      await send("post", "/gv/import", withoutPaymentKey, app.token),
      400,
    );
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
      const response = await send("get", path);
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
      expectStatus(
        await send("patch", `/gv/enrollments/${enrollment.id}`, { status }),
        200,
      );
      expectStatus(
        await send(
          "post",
          "/gv/payments",
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
        await send("post", "/gv/appointments", appointmentBody()),
        201,
      );
      expectStatus(
        await send("patch", `/gv/appointments/${appointment.id}`, { status }),
        200,
      );
      expectStatus(
        await send("post", `/gv/appointments/${appointment.id}/payments`, {
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
      await send("post", "/gv/courses", courseBody({ date: "2026-02-30" })),
      400,
    );
    const course = await createCourse({ name: `T5 Fecha pago ${marker}` });
    const enrollment = await createEnrollment(course.id);
    expectStatus(
      await send(
        "post",
        "/gv/payments",
        paymentBody(enrollment.id, { date: "2026-02-30" }),
      ),
      400,
    );
    expectStatus(
      await send(
        "post",
        "/gv/appointments",
        appointmentBody({ date: "2026-02-30T15:30:00-04:00" }),
      ),
      400,
    );
  });

  it("rechaza montos con tres decimales en todos los puntos de entrada", async () => {
    expectStatus(
      await send("post", "/gv/courses", courseBody({ price: 100.001 })),
      400,
    );
    const course = await createCourse({ name: `T5 Decimales ${marker}` });
    expectStatus(
      await send("post", "/gv/enrollments", {
        operationId: randomUUID(),
        courseId: course.id,
        clientName: `T5 Tres decimales ${marker}`,
        agreedPrice: 100.001,
      }),
      400,
    );
    const enrollment = await createEnrollment(course.id);
    expectStatus(
      await send(
        "post",
        "/gv/payments",
        paymentBody(enrollment.id, { amount: 10.001 }),
      ),
      400,
    );
    expectStatus(
      await send(
        "post",
        "/gv/appointments",
        appointmentBody({ total: 100.001 }),
      ),
      400,
    );
    expectStatus(
      await send("post", "/gv/appointments", appointmentBody({ tip: 1.001 })),
      400,
    );
  });
});
