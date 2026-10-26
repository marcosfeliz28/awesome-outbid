// Obsidian Lumina · fase 3: devolver el foco al cerrar un diálogo es opt-in (restoreFocus).
// Sin la propiedad Modal se comporta como antes del rediseño (la caja no cambia).
import { test, expect } from "./apoyo";

test("Modal sin restoreFocus no mueve el foco al cerrar; con restoreFocus lo devuelve a «Más»", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page.getByLabel("Contraseña", { exact: true }).fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await page.evaluate(() => (location.hash = "products"));
  await expect(page.locator(".main-content .loading")).toHaveCount(0);

  // Sin la propiedad: «Nuevo producto» abre un Modal normal; al cerrar el foco NO vuelve al botón.
  const nuevo = page.getByRole("button", { name: "Nuevo producto" });
  await nuevo.focus();
  await page.keyboard.press("Enter");
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(nuevo).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  // Con la propiedad (Importar inventario, abierto desde «Más»): vuelve a «Más».
  const mas = page.locator(".main-content .heading-actions button.more-menu-trigger", { hasText: "Más" });
  await mas.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Importar inventario" }).click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(mas).toBeFocused();
});
