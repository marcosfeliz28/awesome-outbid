// Panel de la operadora (/plataforma): el token vive solo en sessionStorage y
// la lista de clientes cabe en un celular. La API se simula en el navegador.
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const TOKEN = "token-de-plataforma-solo-prueba-".padEnd(80, "0123456789abcdef");
const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString();
const tenants = [
  {
    id: "1",
    slug: "tienda-maria",
    name: "Tienda de María con un nombre muy largo para probar el celular",
    plan: "basico",
    status: "active",
    trialEndsAt: null,
    paidUntil: day(40),
    createdAt: day(-60),
  },
  {
    id: "2",
    slug: "salon-ana",
    name: "Salón Ana",
    plan: "pro",
    status: "trial",
    trialEndsAt: day(3),
    paidUntil: null,
    createdAt: day(-27),
  },
  {
    id: "3",
    slug: "gym-norte",
    name: "Gym Norte",
    plan: "autoservicio",
    status: "suspended",
    trialEndsAt: day(-20),
    paidUntil: null,
    createdAt: day(-50),
  },
];

async function mockApi(page: Page) {
  await page.route("**/api/platform/**", async (route) => {
    const request = route.request();
    if (request.headers()["authorization"] !== `Platform ${TOKEN}`)
      return route.fulfill({
        status: 401,
        json: { message: "No autorizado." },
      });
    const path = new URL(request.url()).pathname;
    if (path === "/api/platform/summary")
      return route.fulfill({
        json: {
          total: 3,
          alDia: 1,
          enPrueba: 0,
          porVencer: 1,
          atrasados: 0,
          suspendidos: 1,
          month: "2026-10",
          monthIncome: 4000,
        },
      });
    if (path === "/api/platform/tenants")
      return route.fulfill({ json: tenants });
    if (path.endsWith("/ai-usage"))
      return route.fulfill({
        json: {
          month: "2026-10",
          used: 12,
          planQuota: 250,
          packs: 0,
          limit: 250,
          remaining: 238,
        },
      });
    return route.fulfill({ status: 404, json: { message: "No disponible." } });
  });
}

async function fitsPhone(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow, "sin desplazamiento horizontal").toBeLessThanOrEqual(0);
  for (const button of await page.getByRole("button").all()) {
    const box = await button.boundingBox();
    expect(
      box!.height,
      (await button.textContent()) ?? "botón",
    ).toBeGreaterThanOrEqual(44);
  }
}

test("el token de plataforma queda en sessionStorage, nunca en localStorage, y «Salir» lo borra", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/plataforma");
  await expect(
    page.getByRole("heading", { name: "Panel de plataforma" }),
  ).toBeVisible();
  await expect(page.getByText("Norexos", { exact: true })).toBeVisible();

  await page
    .getByLabel("Token de plataforma")
    .fill("token-equivocado-".padEnd(70, "x"));
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toHaveText("No autorizado.");
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);

  await page.getByLabel("Token de plataforma").fill(TOKEN);
  await page.getByRole("button", { name: "Entrar" }).click();
  const list = page.getByRole("list", { name: "Mis clientes" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  const stored = await page.evaluate(() => ({
    session: Object.values({ ...sessionStorage }),
    local: Object.values({ ...localStorage }).join("\n"),
  }));
  expect(stored.session).toContain(TOKEN);
  expect(stored.local).not.toContain(TOKEN);

  // Sigue dentro al recargar la pestaña.
  await page.reload();
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await page.getByRole("button", { name: "Salir" }).click();
  await expect(page.getByLabel("Token de plataforma")).toBeVisible();
  expect(
    await page.evaluate(() => Object.values({ ...sessionStorage })),
  ).not.toContain(TOKEN);
});

for (const width of [390, 320]) {
  test(`la lista de clientes cabe a ${width} px, con estado en texto y botones de 44 px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await mockApi(page);
    await page.goto("/plataforma");
    await page.evaluate(
      (token) => sessionStorage.setItem("nexora-plataforma-token", token),
      TOKEN,
    );
    await page.reload();
    const list = page.getByRole("list", { name: "Mis clientes" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await expect(page.getByLabel("Resumen")).toContainText("Ingreso del mes");
    await expect(page.getByLabel("Resumen")).toContainText("RD$4,000.00");
    const maria = list
      .getByRole("listitem")
      .filter({ hasText: "tienda-maria" });
    await expect(maria).toContainText("Al día");
    await expect(maria).toContainText("IA este mes: 12 / 250");
    await expect(
      list.getByRole("listitem").filter({ hasText: "salon-ana" }),
    ).toContainText("Por vencer");
    await expect(
      list.getByRole("listitem").filter({ hasText: "gym-norte" }),
    ).toContainText("Suspendido");
    await fitsPhone(page);

    await page.getByLabel("Estado").selectOption("suspended");
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await page.getByLabel("Estado").selectOption("all");
    await page.getByLabel("Buscar").fill("salón");
    await expect(list.getByRole("listitem")).toHaveCount(1);
  });
}
