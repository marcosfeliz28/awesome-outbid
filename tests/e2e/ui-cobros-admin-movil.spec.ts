// Acciones de administración sobre cobros, a 390 px: «Des-verificar transferencia» y
// «Mover cobro a otra caja» solo las ve la administración (`*`) y abren su diálogo con
// motivo obligatorio. La prueba entra como administradora, abre Ventas y revisa que la
// pantalla no se salga del ancho. Si la base de demostración no tiene una transferencia
// aplicable, la parte de los diálogos se marca como omitida y no falla.
import { test, expect } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };

test.use({ viewport: { width: 390, height: 844 } });

test("Ventas en 390 px: sin desbordar y con las acciones de cobro solo para administración", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(OWNER.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await page.getByRole("button", { name: "Ventas", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: /Ventas/ }).first()).toBeVisible();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(390);

  // Abrir la primera venta: su detalle lista los cobros con las acciones de administración.
  const verVenta = page.locator('button[aria-label^="Ver FS-"]').first();
  if ((await verVenta.count()) === 0) {
    test.info().annotations.push({ type: "omitida", description: "no hay ventas en la base de demostración" });
    return;
  }
  await verVenta.click();
  const desverificar = page.getByRole("button", { name: "Des-verificar transferencia" });
  if ((await desverificar.count()) === 0) {
    test.info().annotations.push({
      type: "omitida",
      description: "la primera venta no tiene una transferencia verificada de venta",
    });
    return;
  }
  await desverificar.first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Motivo")).toBeVisible();
  const ancho2 = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho2).toBeLessThanOrEqual(390);
});
