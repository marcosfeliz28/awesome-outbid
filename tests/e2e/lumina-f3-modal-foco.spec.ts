// Obsidian Lumina · fase 3: devolver el foco al cerrar un diálogo es opt-in (restoreFocus).
// Sin la propiedad Modal se comporta como antes del rediseño (la caja no cambia).
import { test, expect } from "./apoyo";

test("Modal sin restoreFocus no mueve el foco al cerrar; con restoreFocus lo devuelve a «Más»", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  // Espera el armazón de la app; si el login falla, lo dice claro.
  const armazon = page.locator(".app-shell");
  const fallo = page.locator(".login-page [role=alert]");
  await expect(armazon.or(fallo).first()).toBeVisible({ timeout: 20000 });
  if (await fallo.count())
    throw new Error(
      `Falló el inicio de sesión (¿bloqueo o contraseña cambiada?): ${await fallo.first().innerText()}`,
    );
  await page.evaluate(() => (location.hash = "products"));
  await expect(page.locator(".main-content h1").first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.locator(".main-content .loading")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator(".main-content .table-skeleton")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect
    .poll(() => page.locator(".main-content td").count(), { timeout: 15000 })
    .toBeGreaterThan(0);
  await page.evaluate(() => document.fonts.ready);

  // Sin la propiedad: «Nuevo producto» abre un Modal normal; al cerrar el foco NO vuelve al botón.
  const nuevo = page.getByRole("button", { name: "Nuevo producto" });
  await expect(nuevo).toBeVisible({ timeout: 15000 });
  await nuevo.focus();
  await page.keyboard.press("Enter");
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(nuevo).not.toBeFocused();
  expect(
    await page.evaluate(() => document.activeElement === document.body),
  ).toBe(true);

  // Con la propiedad (Importar inventario, abierto desde «Más»): vuelve a «Más».
  const mas = page.locator(
    ".main-content .heading-actions button.more-menu-trigger",
    { hasText: "Más" },
  );
  await expect(mas).toBeVisible({ timeout: 15000 });
  await mas.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Importar inventario" }).click();
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(mas).toBeFocused();
});
