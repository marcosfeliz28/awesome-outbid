// Auditoría en vivo de inventario y plataforma (25-oct-2026), con la API
// simulada: tarjetas a 390 px, búsqueda como la caja, cupo de equipos sin
// bucle de registro y sesión de soporte con su aviso.
import type { BrowserContext, Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const SESSION = "nexora-soporte-token";
const category = { id: "c1", name: "Fajas", requiresLot: false, requiresExpiry: false, color: "#7C3AED", attributes: [] };
const variant = {
  id: "10000000-0000-4000-8000-000000000001", sku: "FAJ-0001-M", barcode: "7701234567890",
  attributes: { Talla: "M", Color: "Café" }, price: "2500", costAvg: "1200", stock: "8", lots: [], active: true,
};
const product = {
  id: "20000000-0000-4000-8000-000000000001", name: "Faja colombiana reductora con broches laterales",
  sku: "FAJ-0001", brand: "Ann Chery", categoryId: "c1", category, minStock: "5", maxStock: "80",
  imageUrl: null, active: true, unit: "unidad", soldByUnit: true, variants: [variant],
};
const admin = { id: "u1", name: "Admin QA", email: "admin@example.invalid", role: "admin", permissions: ["*"], branchId: "main" };
const support = { id: "s1", name: "Soporte Nexora", email: "soporte@nexora.invalid", role: "support", permissions: [], branchId: "main" };
// Token con forma de JWT: sólo se lee `exp` para la hora del aviso.
const jwt = (exp: number) =>
  "x." + Buffer.from(JSON.stringify({ exp })).toString("base64url") + ".y";

async function mockApp(
  context: BrowserContext,
  user: object,
  register: (calls: number) => { status: number; json: object },
  calls: string[],
) {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    calls.push(request.method() + " " + path);
    if (path === "/api/auth/me") return route.fulfill({ json: user });
    if (path === "/api/terminals/register") {
      const answer = register(calls.filter((c) => c === "POST /api/terminals/register").length);
      return route.fulfill({ status: answer.status, json: answer.json });
    }
    if (path === "/api/terminals")
      return route.fulfill({
        json: [{ id: "30000000-0000-4000-8000-000000000009", name: "Caja del mostrador", status: "approved", openCashes: [] }],
      });
    if (path === "/api/products") return route.fulfill({ json: { items: [product], total: 1 } });
    if (path === "/api/categories") return route.fulfill({ json: [category] });
    if (path === "/api/inventory/stock")
      return route.fulfill({
        json: [{ ...variant, product, warehouseStocks: [], totalStock: "8", homeStock: "0", sellableStock: "8", expiredStock: "0" }],
      });
    if (path === "/api/inventory/warehouses")
      return route.fulfill({ json: [{ id: "w1", name: "Tienda", kind: "store", sellable: true }] });
    if (path === "/api/settings") return route.fulfill({ json: { name: "Tienda QA", lowMargin: 15 } });
    if (path === "/api/events") return route.fulfill({ status: 503, body: "" });
    if (path.endsWith("/revoke")) return route.fulfill({ json: { ok: true } });
    if (request.method() === "GET") return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: "No disponible." } });
  });
}
async function open(page: Page, hash: string, token = "token-de-prueba") {
  await page.goto("/");
  await page.evaluate(([key, value]) => sessionStorage.setItem(key, value), [SESSION, token]);
  await page.goto("/#" + hash);
}
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Productos e Inventario son tarjetas con precio, existencia y «Ajustar», sin desplazamiento horizontal", async ({ page, context }) => {
    await mockApp(context, admin, () => ({ status: 201, json: { id: "t", status: "approved" } }), []);
    await open(page, "products");
    const card = page.locator(".table-cards tbody tr").first();
    await expect(card).toContainText("RD$");
    await expect(card).toContainText("8 unidades");
    expect(await noHorizontalScroll(page)).toBe(true);
    // Busca por código de barras y sin acentos, como la caja.
    const search = page.getByLabel("Buscar nombre, SKU o marca");
    await search.fill("7701234567890");
    await expect(card).toContainText("Faja colombiana");
    await search.fill("cafe");
    await expect(card).toContainText("Faja colombiana");
    await search.fill("negro");
    await expect(page.getByText("No encontramos productos")).toBeVisible();

    await open(page, "inventory");
    const adjust = page.getByRole("button", { name: "Ajustar" }).first();
    await expect(adjust).toBeVisible();
    const box = await adjust.boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(390);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});

test("con el cupo de equipos lleno se avisa una vez y no se reintenta el registro en bucle", async ({ page, context }) => {
  const calls: string[] = [];
  await mockApp(context, admin, () => ({ status: 409, json: { message: "El plan Autoservicio permite 1 equipos aprobados." } }), calls);
  await open(page, "products");
  await expect(page.getByText("El plan Autoservicio permite 1 equipos aprobados.").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("button", { name: "Ir a Configuración → Equipos" })).toBeVisible();
  await page.waitForTimeout(8000);
  // Antes: 1 s, 2 s, 4 s… (~21 en 2 minutos). Ahora, el arranque y nada más.
  expect(calls.filter((c) => c === "POST /api/terminals/register").length).toBeLessThanOrEqual(2);
});

test("el equipo nuevo pendiente por el cupo ofrece revocar otro desde el aviso", async ({ page, context }) => {
  const calls: string[] = [];
  // Pendiente mientras el cupo siga lleno; aprobado después de revocar otro.
  await mockApp(context, admin, () => calls.some((c) => c.endsWith("/revoke"))
    ? { status: 201, json: { id: "t", status: "approved" } }
    : { status: 201, json: { id: "t", status: "pending", planLimit: "El plan Autoservicio permite 1 equipos aprobados." } }, calls);
  await open(page, "products");
  const notice = page.locator(".plan-limit-notice");
  await expect(notice).toContainText("Caja del mostrador", { timeout: 15000 });
  await expect(page.getByText("Este equipo necesita aprobación")).toHaveCount(0);
  await notice.getByRole("button", { name: "Revocar" }).click();
  await expect(notice).toHaveCount(0);
  expect(calls).toContain("POST /api/terminals/30000000-0000-4000-8000-000000000009/revoke");
});

test("la sesión de soporte muestra «Modo soporte · solo lectura · vence HH:MM» y no registra el equipo", async ({ page, context }) => {
  const calls: string[] = [];
  await mockApp(context, support, () => ({ status: 403, json: { message: "No tienes permiso para realizar esta acción." } }), calls);
  // 14:30 en Santo Domingo (UTC−4) = 18:30 UTC.
  const exp = Date.UTC(2030, 0, 15, 18, 30) / 1000;
  await open(page, "products", jwt(exp));
  await expect(page.getByRole("status").filter({ hasText: "Modo soporte" })).toHaveText(
    "Modo soporte · solo lectura · vence 14:30",
  );
  await page.waitForTimeout(2000);
  expect(calls).not.toContain("POST /api/terminals/register");
  await expect(page.getByText("No tienes permiso para realizar esta acción.")).toHaveCount(0);
});

test("plataforma: «Anular pago» pide motivo y la invitación dice con qué correo entrar", async ({ page }) => {
  const TOKEN = "token-de-plataforma-solo-prueba-".padEnd(80, "0123456789abcdef");
  const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
  const tenant = { id: "1", slug: "tienda-maria", name: "Tienda María", plan: "basico", status: "active",
    trialEndsAt: null, paidUntil: day(40), createdAt: day(-60), businessType: "retail",
    admin: { name: "María", email: "maria@example.com", invitationPending: true, invitationExpiresAt: day(5) } };
  const payment = { id: "50000000-0000-4000-8000-000000000001", amount: "2000", method: "transfer", reference: "BHD-1",
    months: 1, paidUntil: day(40), createdAt: day(-2), voidsPaymentId: null, voidReason: null };
  const posts: { path: string; body: any }[] = [];
  await page.route("**/api/platform/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "POST") posts.push({ path, body: request.postDataJSON() });
    if (path === "/api/platform/summary")
      return route.fulfill({ json: { total: 1, alDia: 1, enPrueba: 0, porVencer: 0, atrasados: 0, suspendidos: 0,
        month: "2026-10", monthIncome: 2399, monthPayments: 2000, monthAiPacks: 399 } });
    if (path === "/api/platform/tenants") return route.fulfill({ json: [tenant] });
    if (path === "/api/platform/tenants/tienda-maria") return route.fulfill({ json: tenant });
    if (path.endsWith("/payments")) return route.fulfill({ json: [payment] });
    if (path.endsWith("/void")) return route.fulfill({ status: 201, json: { payment: {}, tenant: { paidUntil: day(10) } } });
    if (path.endsWith("/reinvite"))
      return route.fulfill({ json: { invitationUrl: "https://pos.example.invalid/aceptar-invitacion#token=abc" } });
    if (path.endsWith("/ai-usage")) return route.fulfill({ json: { month: "2026-10", used: 1, planQuota: 250, packs: 0, limit: 250 } });
    if (path === "/api/platform/support-grants") return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { message: "No disponible." } });
  });
  await page.goto("/plataforma");
  await page.evaluate((t) => sessionStorage.setItem("nexora-plataforma-token", t), TOKEN);
  await page.reload();
  await expect(page.getByLabel("Resumen")).toContainText("Paquetes IA RD$399.00");
  await page.getByRole("listitem").filter({ hasText: "tienda-maria" }).getByRole("button").first().click();
  await page.getByRole("button", { name: "Anular pago" }).click();
  await page.getByRole("button", { name: "Anular pago" }).last().click();
  await expect(page.getByText("Escribe el motivo (mínimo 3 letras).")).toBeVisible();
  await page.getByLabel("Motivo de la anulación").fill("Pago anotado dos veces");
  await page.getByRole("button", { name: "Anular pago" }).last().click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect.poll(() => posts.find((p) => p.path.endsWith("/void"))?.body).toEqual({ reason: "Pago anotado dos veces" });
  await page.getByRole("button", { name: "Reenviar invitación" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Entra con el correo maria@example.com")).toBeVisible();
  const whatsapp = await page.getByRole("link", { name: "Enviar por WhatsApp" }).getAttribute("href");
  expect(decodeURIComponent(whatsapp!)).toContain("el correo maria@example.com");
});
