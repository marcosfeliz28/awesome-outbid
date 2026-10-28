// P1 · Recorrido de Clary en GV Makeup Studio. Los datos son ficticios y
// únicos por corrida; nunca depende de clientas ni pagos de la tienda real.
import type { APIRequestContext, Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { test, expect, ownerHeaders } from "./apoyo";

const DEMO_PASSWORD = "FitStore-Demo-2026!";
const TEMP_PASSWORD = "E2E-Gv-Temporal-2026!";
const ACTIVE_PASSWORD = "E2E-Gv-Nueva-2026!";

type Fixture = {
  email: string;
  course: string;
  clients: string[];
  appointment: string;
  lead: string;
  approvedReference: string;
  rejectedReference: string;
};

async function body(
  response: Awaited<ReturnType<APIRequestContext["get"]>>,
  label: string,
) {
  const text = await response.text();
  expect(response.ok(), `${label}: ${response.status()} ${text}`).toBe(true);
  return text ? JSON.parse(text) : null;
}

async function apiPost(
  request: APIRequestContext,
  path: string,
  headers: Record<string, string>,
  data: unknown,
) {
  return body(
    await request.post("/api" + path, { headers, data }),
    `POST ${path}`,
  );
}

async function seedGvFlow(
  request: APIRequestContext,
  viewport: string,
): Promise<Fixture> {
  const owner = await ownerHeaders(request);
  const suffix = `${viewport}-${randomUUID().slice(0, 8)}`;
  const roles = await body(
    await request.get("/api/roles", { headers: owner }),
    "roles",
  );
  const gvRole = roles.find((role: any) => role.name === "gv");
  expect(gvRole, "rol gv").toBeTruthy();

  const email = `e2e-gv-${suffix}@example.test`;
  await apiPost(request, "/users", owner, {
    name: "Clary E2E " + suffix,
    email,
    password: TEMP_PASSWORD,
    pin: "583920",
    roleId: gvRole.id,
  });
  const changed = await apiPost(
    request,
    "/auth/change-password",
    {},
    {
      login: email,
      currentPassword: TEMP_PASSWORD,
      newPassword: ACTIVE_PASSWORD,
      confirmPassword: ACTIVE_PASSWORD,
    },
  );
  const gv = { Authorization: "Bearer " + changed.accessToken };

  const courseName = "Curso E2E " + suffix;
  const course = await apiPost(request, "/gv/courses", gv, {
    name: courseName,
    type: "automaquillaje",
    date: "2026-12-15",
    price: 3000,
    capacity: 8,
  });
  const clients = ["Ana", "Beatriz", "Carla"].map(
    (name) => `${name} E2E ${suffix}`,
  );
  const enrollments = [];
  for (const [index, clientName] of clients.entries()) {
    enrollments.push(
      await apiPost(request, "/gv/enrollments", gv, {
        operationId: randomUUID(),
        courseId: course.id,
        clientName,
        phone: `80955501${index}0`,
        agreedPrice: 3000,
      }),
    );
  }

  const approvedReference = "APR-" + suffix;
  const rejectedReference = "REJ-" + suffix;
  for (const payment of [
    { amount: 1000, concept: "separo", reference: approvedReference },
    { amount: 500, concept: "restante", reference: rejectedReference },
  ])
    await apiPost(request, "/gv/payments", gv, {
      operationId: randomUUID(),
      enrollmentId: enrollments[0].id,
      date: "2026-10-26",
      method: "transferencia",
      bank: "Popular Grupo Génesis ···9797",
      ...payment,
    });

  const appointment = "Cita E2E " + suffix;
  await apiPost(request, "/gv/appointments", gv, {
    operationId: randomUUID(),
    date: "2026-12-20T10:00:00-04:00",
    clientName: appointment,
    service: "social",
    artists: ["Génesis"],
    afterHours: false,
    total: 2500,
    tip: 0,
    status: "agendada",
  });
  const lead = "Interesada E2E " + suffix;
  await apiPost(request, "/gv/leads", gv, {
    operationId: randomUUID(),
    name: lead,
    phone: "8295550199",
    interest: courseName,
    action: "Llamar mañana",
    status: "por_contactar",
  });
  return {
    email,
    course: courseName,
    clients,
    appointment,
    lead,
    approvedReference,
    rejectedReference,
  };
}

async function login(page: Page, user: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(user);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.locator(".account")).toBeVisible();
}

async function logout(page: Page) {
  await page.locator(".account").click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toBeVisible();
}

async function openNavigation(page: Page, mobile: boolean) {
  if (mobile) await page.getByRole("button", { name: "Abrir menú" }).click();
  return page.locator("aside.sidebar");
}

async function goToGv(page: Page, mobile: boolean) {
  const sidebar = await openNavigation(page, mobile);
  await sidebar.getByRole("button", { name: "GV Makeup Studio" }).click();
  await expect(
    page.getByRole("heading", { name: "Cursos y cobros" }),
  ).toBeVisible();
}

async function exerciseGv(
  page: Page,
  request: APIRequestContext,
  mobile: boolean,
) {
  const fixture = await seedGvFlow(request, mobile ? "390" : "1366");
  await login(page, fixture.email, ACTIVE_PASSWORD);
  await expect(
    page.getByRole("heading", { name: "Cursos y cobros" }),
  ).toBeVisible();

  // El rol GV queda aislado del negocio de Macgen, también en el menú móvil.
  const sidebar = await openNavigation(page, mobile);
  for (const forbidden of ["Caja", "Configuración", "Reportes", "Productos"])
    await expect(
      sidebar.getByRole("button", { name: forbidden, exact: true }),
    ).toHaveCount(0);
  const gvNavigation = sidebar.getByRole("button", {
    name: "GV Makeup Studio",
  });
  await expect(gvNavigation).toBeVisible();
  // El botón activo también cierra el cajón móvil; el fondo queda detrás del
  // propio menú y por eso no se usa como blanco del clic.
  if (mobile) await gvNavigation.click();

  const courseCard = page.getByRole("button", {
    name: new RegExp(fixture.course),
  });
  await expect(courseCard).toContainText("3 / 8 inscritas");
  await courseCard.click();
  for (const client of fixture.clients)
    await expect(
      page.getByRole("row", { name: new RegExp(client) }),
    ).toBeVisible();

  // Clary marca asistencia y entrega del set desde la pantalla real.
  const secondRow = page.getByRole("row", {
    name: new RegExp(fixture.clients[1]),
  });
  await secondRow.getByRole("button", { name: "Editar" }).click();
  const enrollmentDialog = page.getByRole("dialog", {
    name: "Editar inscripción",
  });
  await enrollmentDialog
    .locator('select:has(option[value="true"])')
    .selectOption("true");
  await enrollmentDialog.getByLabel("Compró el set de brochas").check();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/gv/enrollments/") &&
        response.request().method() === "PATCH",
    ),
    enrollmentDialog.getByRole("button", { name: "Guardar" }).click(),
  ]);
  await expect(secondRow).toContainText("Sí");

  await page.getByRole("tab", { name: "Citas" }).click();
  await expect(
    page.getByText(fixture.appointment, { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Interesadas" }).click();
  await expect(page.getByText(fixture.lead, { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Por verificar" }).click();
  const approved = page
    .locator(".gv-payment")
    .filter({ hasText: fixture.approvedReference });
  const rejected = page
    .locator(".gv-payment")
    .filter({ hasText: fixture.rejectedReference });
  await expect(approved).toContainText("RD$ 1,000.00");
  await expect(rejected).toContainText("RD$ 500.00");
  await expect(approved.getByRole("button", { name: "Verificar" })).toHaveCount(
    0,
  );
  await expect(rejected.getByRole("button", { name: "Rechazar" })).toHaveCount(
    0,
  );

  // Gerencia revisa las transferencias; GV sólo puede registrarlas y verlas.
  await logout(page);
  await login(page, "gerente@fitstore.demo", DEMO_PASSWORD);
  await goToGv(page, mobile);
  await page.getByRole("tab", { name: "Por verificar" }).click();
  const managerApproved = page
    .locator(".gv-payment")
    .filter({ hasText: fixture.approvedReference });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/gv/payments/") &&
        response.url().endsWith("/review"),
    ),
    managerApproved.getByRole("button", { name: "Verificar" }).click(),
  ]);
  await expect(managerApproved).toHaveCount(0);
  const managerRejected = page
    .locator(".gv-payment")
    .filter({ hasText: fixture.rejectedReference });
  page.once("dialog", (dialog) => dialog.accept("Referencia no recibida E2E"));
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/gv/payments/") &&
        response.url().endsWith("/review"),
    ),
    managerRejected.getByRole("button", { name: "Rechazar" }).click(),
  ]);
  await expect(managerRejected).toHaveCount(0);

  // Al volver, Clary ve el estado real y el pendiente: 3000 - 1000 = 2000.
  await logout(page);
  await login(page, fixture.email, ACTIVE_PASSWORD);
  await page.getByRole("button", { name: new RegExp(fixture.course) }).click();
  const firstRow = page.getByRole("row", {
    name: new RegExp(fixture.clients[0]),
  });
  await expect(firstRow).toContainText("RD$ 1,000.00");
  await expect(firstRow).toContainText("RD$ 2,000.00");
  await firstRow.getByRole("button", { name: "Editar" }).click();
  const paymentHistory = page.getByRole("dialog", {
    name: "Editar inscripción",
  });
  const approvedHistory = paymentHistory
    .locator(".gv-payment")
    .filter({ hasText: fixture.approvedReference });
  const rejectedHistory = paymentHistory
    .locator(".gv-payment")
    .filter({ hasText: fixture.rejectedReference });
  await expect(approvedHistory).toContainText("Separo");
  await expect(approvedHistory).toContainText("Verificado");
  await expect(rejectedHistory).toContainText("Restante");
  await expect(rejectedHistory).toContainText("Rechazado");
}

test("P1: Clary completa el flujo GV a 1366 px", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1366, height: 900 });
  await exerciseGv(page, request, false);
});

test("P1: Clary completa el flujo GV a 390 px", async ({ page, request }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await exerciseGv(page, request, true);
});
