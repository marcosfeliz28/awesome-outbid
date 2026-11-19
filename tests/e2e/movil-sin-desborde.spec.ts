// Celular (iPhone, 390 px): ninguna pantalla principal desborda en horizontal y
// las tablas se muestran como tarjetas dentro del ancho.
import { test, expect } from "./apoyo";

const PANTALLAS = [
  "dashboard",
  "pos",
  "sales",
  "products",
  "inventory",
  "purchases",
  "merchandise",
  "customers",
  "cash",
  "expenses",
  "promotions",
  "reports",
  "alerts",
  "incentives",
  "gv",
  "settings",
];

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test("móvil: sin desbordamiento horizontal en las pantallas principales", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.locator(".main-content h1").first()).toBeVisible();
  for (const id of PANTALLAS) {
    await page.evaluate((h) => (location.hash = h), id);
    await expect(page.locator(".main-content .loading")).toHaveCount(0);
    await page.waitForTimeout(500);
    const exceso = await page.evaluate(() => ({
      pagina: document.documentElement.scrollWidth - innerWidth,
      tablas: [...document.querySelectorAll(".table-cards")].filter(
        (e) => e.scrollWidth > e.clientWidth + 1,
      ).length,
    }));
    expect(exceso, "pantalla " + id).toEqual({ pagina: 0, tablas: 0 });
  }
});
