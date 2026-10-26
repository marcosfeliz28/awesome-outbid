// Sección «Soporte» del detalle de un cliente en /plataforma: muestra el acceso
// activo y abre la app de la empresa en otra pestaña con el token de solo
// lectura en su sessionStorage (nunca el de plataforma). API simulada.
import type { BrowserContext } from "@playwright/test";
import { test, expect } from "./apoyo";

const TOKEN = "token-de-plataforma-solo-prueba-".padEnd(80, "0123456789abcdef");
const SUPPORT = "token-de-soporte-solo-lectura";
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const tenant = (slug: string, name: string) => ({
  id: slug,
  slug,
  name,
  plan: "basico",
  status: "active",
  trialEndsAt: null,
  paidUntil: day(40),
  createdAt: day(-60),
  businessType: "tienda",
  admin: { name: "María", email: "maria@example.com", invitationPending: false, invitationExpiresAt: null },
});

async function mockApi(context: BrowserContext, sessions: string[], me: string[]) {
  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/auth/me") {
      me.push(request.headers()["authorization"] ?? "");
      return route.fulfill({
        json: { id: "s", name: "Soporte Nexora", email: "soporte@nexora.invalid", role: "support", permissions: [] },
      });
    }
    if (!path.startsWith("/api/platform/"))
      return route.fulfill({ status: 404, json: { message: "No disponible." } });
    if (request.headers()["authorization"] !== `Platform ${TOKEN}`)
      return route.fulfill({ status: 401, json: { message: "No autorizado." } });
    if (path === "/api/platform/tenants")
      return route.fulfill({ json: [tenant("tienda-maria", "Tienda María"), tenant("salon-ana", "Salón Ana")] });
    if (path === "/api/platform/tenants/tienda-maria")
      return route.fulfill({ json: tenant("tienda-maria", "Tienda María") });
    if (path === "/api/platform/tenants/salon-ana")
      return route.fulfill({ json: tenant("salon-ana", "Salón Ana") });
    if (path === "/api/platform/summary")
      return route.fulfill({
        json: { total: 2, alDia: 2, enPrueba: 0, porVencer: 0, atrasados: 0, suspendidos: 0, month: "2026-10", monthIncome: 0 },
      });
    if (path.endsWith("/payments")) return route.fulfill({ json: [] });
    if (path.endsWith("/ai-usage"))
      return route.fulfill({ json: { month: "2026-10", used: 1, planQuota: 250, packs: 0, limit: 250, remaining: 249 } });
    if (path === "/api/platform/support-grants")
      return route.fulfill({ json: [{ slug: "tienda-maria", name: "Tienda María", expiresAt: day(1) }] });
    if (path === "/api/platform/tenants/tienda-maria/support-session" && request.method() === "POST") {
      sessions.push(path);
      return route.fulfill({ json: { accessToken: SUPPORT, tokenType: "Bearer", expiresIn: 900, readOnly: true } });
    }
    return route.fulfill({ status: 404, json: { message: "No disponible." } });
  });
}

test("«Soporte» abre la empresa en otra pestaña con el token de solo lectura en sessionStorage", async ({
  page,
  context,
}) => {
  const sessions: string[] = [];
  const me: string[] = [];
  await mockApi(context, sessions, me);
  await page.goto("/plataforma");
  await page.evaluate((t) => sessionStorage.setItem("nexora-plataforma-token", t), TOKEN);
  await page.reload();

  // Empresa sin acceso activo: sin botón.
  await page.getByRole("listitem").filter({ hasText: "salon-ana" }).getByRole("button").first().click();
  await expect(page.getByText("La empresa no ha activado el acceso de soporte.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir sesión de solo lectura" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Manual: 25 problemas/ })).toHaveAttribute(
    "href",
    "/soporte-operador/MANUAL_SOPORTE_DUENA.md",
  );
  await page.getByRole("button", { name: "← Mis clientes" }).click();

  await page.getByRole("listitem").filter({ hasText: "tienda-maria" }).getByRole("button").first().click();
  await expect(page.getByText(/Acceso de soporte activo hasta/)).toBeVisible();
  await page.getByLabel("Tu nombre (operadora)").fill("Ana Operadora");
  await page.getByLabel("Motivo (qué vas a revisar)").fill("Revisar existencias que no cuadran");
  const [tab] = await Promise.all([
    context.waitForEvent("page"),
    page.getByRole("button", { name: "Abrir sesión de solo lectura" }).click(),
  ]);
  await tab.waitForURL((url) => url.pathname === "/");
  await expect.poll(() => me.length).toBeGreaterThan(0);
  expect(sessions).toEqual(["/api/platform/tenants/tienda-maria/support-session"]);
  expect(me[0]).toBe(`Bearer ${SUPPORT}`);
  const stored = await tab.evaluate(() => ({ ...sessionStorage }));
  expect(stored["nexora-soporte-token"]).toBe(SUPPORT);
  expect(Object.values(stored)).not.toContain(TOKEN);
  expect(await tab.evaluate(() => Object.values({ ...localStorage }).join("\n"))).not.toContain(SUPPORT);
  // El panel sigue con su propio token.
  expect(await page.evaluate(() => sessionStorage.getItem("nexora-plataforma-token"))).toBe(TOKEN);
});
