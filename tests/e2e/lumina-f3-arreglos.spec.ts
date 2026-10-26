// Obsidian Lumina · fase 3 · arreglos de revisión: foco de «Más», ARIA de
// pestañas, cierre tras «Importar Excel», rango invertido en Reportes.
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

async function entrar(page: Page, hash: string) {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(
    page.getByRole("button", { name: "Entrar a mi tienda" }),
  ).toHaveCount(0);
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  await expect(page.locator(".main-content h1").first()).toBeVisible();
}
const masDe = (page: Page) =>
  page
    .locator(".main-content .heading-actions")
    .locator("button.more-menu-trigger", { hasText: "Más" }); // el diálogo oculta el resto a la accesibilidad

test("«Más»: al elegir una opción el foco vuelve a «Más» (también tras cerrar el diálogo)", async ({
  page,
}) => {
  await entrar(page, "products");
  const mas = masDe(page);
  await mas.focus();
  await page.keyboard.press("Enter");
  await expect(mas).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Importar inventario" }).click();
  await expect(mas).toHaveAttribute("aria-expanded", "false");
  const dialogo = page.getByRole("dialog");
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(mas).toBeFocused();
});

test("«Más»: una opción sin diálogo (PDF de Reportes) deja el foco en «Más»", async ({
  page,
}) => {
  await entrar(page, "reports");
  const mas = masDe(page);
  await mas.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "PDF" }).click();
  await expect(mas).toHaveAttribute("aria-expanded", "false");
  await expect(mas).toBeFocused();
});
