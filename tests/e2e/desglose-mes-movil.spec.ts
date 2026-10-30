// Desglose del mes desde el panel anual, a 390 px: tocar «Ver detalle del mes» debe abrir
// el desglose del mes y no mandar a Mercancía. La causa era que la comprobación de la
// página no quitaba el «?from=&to=» del hash, así que cualquier ruta con parámetros
// volvía a la primera pantalla del menú (Mercancía).
import { test, expect } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };

test.use({ viewport: { width: 390, height: 844 } });

test("«Ver detalle del mes» abre el desglose del mes y no cambia a Mercancía", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(OWNER.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  const panel = page.locator(".year-pie");
  await expect(panel).toBeVisible();
  await panel.scrollIntoViewIfNeeded();
  await page.locator(".recharts-pie-sector").first().click({ force: true });
  const detalle = page.getByRole("button", { name: "Ver detalle del mes" });
  await expect(detalle).toBeVisible();
  await detalle.click();
  await expect
    .poll(() => page.evaluate(() => location.hash))
    .toMatch(/^#month-report\?from=/);
  await expect(page.locator(".year-pie")).toHaveCount(0);
});
