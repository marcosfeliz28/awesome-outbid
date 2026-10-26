// Obsidian Lumina · fase 3 · arreglos de revisión: foco de «Más», ARIA de
// pestañas, cierre tras «Importar Excel», rango invertido en Reportes.
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

/** Contenido real esperado por pantalla (el esqueleto no cuenta). */
const DATOS: Record<string, string> = {
  products: ".main-content td",
  reports: ".main-content td",
  customers: ".main-content td",
  settings: ".main-content .cfg-tabs button",
};
async function fuentesListas(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}
/** Cambia de pantalla y espera datos reales (sin esqueleto) y fuentes. */
async function abrir(page: Page, hash: string, datos = true) {
  await page.evaluate((h) => (location.hash = h), hash);
  await expect(page.locator(".main-content h1").first()).toBeVisible({
    timeout: 15000,
  });
  if (!datos) return;
  await expect(page.locator(".main-content .loading")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect(page.locator(".main-content .table-skeleton")).toHaveCount(0, {
    timeout: 15000,
  });
  await expect
    .poll(() => page.locator(DATOS[hash]).count(), {
      message: `${hash}: sin datos reales tras la carga`,
      timeout: 15000,
    })
    .toBeGreaterThan(0);
  await fuentesListas(page);
}
async function entrar(page: Page, hash: string, datos = true) {
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
  await expect(armazon).toBeVisible();
  await abrir(page, hash, datos);
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
  await expect(
    page.locator(`${grupo} button[aria-pressed="true"]`),
  ).toHaveCount(1);
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
  await abrir(page, "reports");
  await expect(page.locator(".report-menu button.active")).toHaveCount(1, {
    timeout: 15000,
  });
  await expect(
    page.locator('.report-menu button[aria-pressed="true"]'),
  ).toHaveCount(1);
  await expect(page.locator(".report-menu button[aria-current]")).toHaveCount(
    0,
  );
});
test("pestañas: el detalle de producto expone aria-pressed solo en la activa", async ({
  page,
}) => {
  await entrar(page, "products");
  const ver = page
    .locator(".catalog-panel")
    .getByRole("button", { name: /^Ver / })
    .first();
  await expect(ver, "ningún producto con botón «Ver»").toBeVisible({
    timeout: 15000,
  });
  await ver.click();
  await expect(page.locator(".catalog-tabs")).toBeVisible({ timeout: 15000 });
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
  await page
    .locator(".more-menu-panel button, .more-menu-panel a")
    .last()
    .focus();
  await page.keyboard.press("Tab");
  await expect(mas).toHaveAttribute("aria-expanded", "false");
});

test("Productos: la cabecera lleva su gancho y mide 44 px", async ({
  page,
}) => {
  await entrar(page, "products");
  await fuentesListas(page);
  const alto = (sel: string) =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => e.getBoundingClientRect().height);
  await expect(
    page.locator(".main-content > .page-heading.catalog-heading"),
  ).toHaveCount(1);
  expect(
    await alto(".catalog-heading .more-menu-trigger"),
  ).toBeGreaterThanOrEqual(43); // 44 px con ±1 px de caja de layout
  await abrir(page, "customers");
  await expect(
    page.locator(".main-content h1", { hasText: "Clientes" }),
  ).toBeVisible();
  await expect(page.locator(".catalog-heading")).toHaveCount(0);
});

test("Reportes: Excel y PDF quedan deshabilitados con el rango de fechas invertido", async ({
  page,
}) => {
  await entrar(page, "reports");
  const excel = page
    .locator(".heading-actions")
    .getByRole("button", { name: "Excel" });
  const mas = masDe(page);
  await mas.click();
  const pdf = page.getByRole("button", { name: "PDF" });
  await expect(excel).toBeEnabled();
  await expect(pdf).toBeEnabled();
  await page
    .locator(".date-filters input[type=date]")
    .first()
    .fill("2030-01-02");
  await page
    .locator(".date-filters input[type=date]")
    .nth(1)
    .fill("2030-01-01");
  await expect(page.getByRole("alert")).toContainText("posterior a la final");
  await expect(excel).toBeDisabled();
  await mas.click(); // escribir en las fechas sacó el foco y cerró «Más»
  await expect(pdf).toBeDisabled();
});

test("Esqueleto de tabla: aria-busy y un solo role=status por pantalla", async ({
  page,
}) => {
  // La respuesta queda retenida hasta que se sueltan las comprobaciones (sin esperas fijas).
  let soltar!: () => void;
  const compuerta = new Promise<void>((r) => (soltar = r));
  await page.route("**/api/products*", async (route) => {
    await compuerta;
    await route.continue().catch(() => {});
  });
  try {
    await entrar(page, "products", false);
    const esqueleto = page.locator(".main-content .table-skeleton");
    await expect(esqueleto).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".main-content [role=status]")).toHaveCount(1);
  } finally {
    soltar();
  }
  await expect(page.locator(".main-content .table-skeleton")).toHaveCount(0, {
    timeout: 15000,
  });
});
