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

/** Los botones que cambian de panel marcan el activo con aria-pressed (no aria-current). */
async function soloUnoPresionado(page: Page, grupo: string) {
  const botones = page.locator(`${grupo} button[aria-pressed]`);
  expect(await botones.count()).toBeGreaterThan(1);
  await expect(page.locator(`${grupo} button[aria-pressed="true"]`)).toHaveCount(1);
  await expect(page.locator(`${grupo} button[aria-current]`)).toHaveCount(0);
  await expect(page.locator(`${grupo} button.active`)).toHaveCount(1);
}
test("pestañas: Configuración y Reportes exponen aria-pressed solo en la activa", async ({
  page,
}) => {
  await entrar(page, "settings");
  await soloUnoPresionado(page, ".cfg-tabs");
  await page.locator(".cfg-tabs button", { hasText: "Bitácora" }).click();
  await expect(
    page.locator(".cfg-tabs button", { hasText: "Bitácora" }),
  ).toHaveAttribute("aria-pressed", "true");
  await soloUnoPresionado(page, ".cfg-tabs");
  await page.evaluate(() => (location.hash = "reports"));
  await expect(page.locator(".report-menu button.active")).toHaveCount(1);
  await expect(page.locator(".report-menu button[aria-pressed=\"true\"]")).toHaveCount(1);
  await expect(page.locator(".report-menu button[aria-current]")).toHaveCount(0);
});
test("pestañas: el detalle de producto expone aria-pressed solo en la activa", async ({
  page,
}) => {
  await entrar(page, "products");
  await page.locator(".catalog-panel").getByRole("button", { name: /^Ver / }).first().click();
  await soloUnoPresionado(page, ".catalog-tabs");
  await page.locator(".catalog-tabs button", { hasText: "Variantes" }).click();
  await expect(
    page.locator(".catalog-tabs button", { hasText: "Variantes" }),
  ).toHaveAttribute("aria-pressed", "true");
  await soloUnoPresionado(page, ".catalog-tabs");
});

test("«Más»: se cierra al elegir el archivo de «Importar Excel» y al salir con Tab", async ({
  page,
}) => {
  await entrar(page, "products");
  const mas = masDe(page);
  await mas.click();
  await expect(mas).toHaveAttribute("aria-expanded", "true");
  await page.locator(".more-menu-panel input[type=file]").setInputFiles({
    name: "vacio.xlsx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("no es un excel"),
  });
  await expect(mas).toHaveAttribute("aria-expanded", "false");
  // Tab fuera del menú (el último control del panel -> el siguiente de la página).
  await mas.click();
  await expect(mas).toHaveAttribute("aria-expanded", "true");
  await page.locator(".more-menu-panel button, .more-menu-panel a").last().focus();
  await page.keyboard.press("Tab");
  await expect(mas).toHaveAttribute("aria-expanded", "false");
});
