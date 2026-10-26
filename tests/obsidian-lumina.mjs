/* global document, getComputedStyle, innerWidth, location */
import { chromium } from "@playwright/test";
// Smoke visual aislado: API sintética, build de producción y sin datos reales.
// Ejecutar con Vite preview en 127.0.0.1:4262; no modifica tests/e2e.
import assert from "node:assert/strict";
import process from "node:process";
import { URL } from "node:url";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  serviceWorkers: "block",
});
let fixtureRole = "admin";
const page = await context.newPage();
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const url = route.request().url();
  let data = [];
  if (url.includes("/auth/refresh"))
    data = {
      accessToken: "local-visual-fixture",
      user: {
        id: "qa-u2",
        name: "Usuario de prueba",
        branchId: "main",
        permissions: ["*"],
        roleName: "Administrador",
        role: fixtureRole,
        sessionTimeoutMinutes: 30,
      },
    };
  else if (url.includes("/settings"))
    data = {
      name: "Tienda de prueba",
      taxIncluded: true,
      allowOfflineSales: false,
    };
  else if (url.includes("/dashboard/summary"))
    data = {
      revenue: 0,
      grossProfit: 0,
      inventoryRetail: 0,
      invoices: 0,
      ticketAverage: 0,
      daily: [],
      alerts: [],
      top: [],
      category: [],
      peakHours: [],
    };
  else if (url.includes("/terminals/register"))
    data = { id: "qa-terminal", status: "approved" };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await page.goto(
  (process.env.LUMINA_TEST_URL || "http://127.0.0.1:4264") + "/#dashboard",
);
await page.getByRole("heading", { name: /Hola,/ }).waitFor();
if (process.env.LUMINA_LEGACY === "1") {
  assert.equal(
    await page.locator("html").getAttribute("data-admin-appearance"),
    null,
  );
  await page.getByRole("button", { name: "Activar modo oscuro" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  await page.getByRole("button", { name: "Activar modo claro" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.deepEqual(errors, []);
  await browser.close();
  process.stdout.write(
    "Tienda independiente: apariencia original y selector claro/oscuro: PASS\n",
  );
  process.exit(0);
}
assert.equal(
  await page.locator("html").getAttribute("data-admin-appearance"),
  "obsidian",
);
if (process.env.LUMINA_PRODUCTION === "1") {
  assert.equal(
    await page
      .getByRole("button", { name: "Guía de estilos", exact: true })
      .count(),
    0,
  );
  await page.evaluate(() => {
    location.hash = "styles";
  });
  await page.waitForFunction(() => location.hash !== "#styles");
  assert.equal(
    await page
      .getByRole("heading", { name: "Obsidian Lumina", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  process.stdout.write(
    "Obsidian Lumina producción: guía oculta y ruta bloqueada: PASS\n",
  );
  process.exit(0);
}
const out = "docs/capturas/obsidian-lumina/";
const evidence = {
  widths: [],
  contrast: [],
  requests: "API sintética; red externa bloqueada",
  errors,
};
await page.screenshot({ path: out + "admin-desktop.png", fullPage: false });
await page
  .getByRole("button", { name: "Guía de estilos", exact: true })
  .click();
await page
  .getByRole("heading", { name: "Obsidian Lumina", exact: true })
  .waitFor();
await page.screenshot({
  path: out + "componentes-desktop.png",
  fullPage: true,
});
await page
  .getByLabel("Nombre de referencia")
  .fill("Sucursal de ejemplo modificada");
assert.match(
  await page
    .getByLabel("Código de referencia")
    .getAttribute("aria-describedby"),
  /error/,
);
assert.equal(
  await page.getByLabel("Código de referencia").getAttribute("aria-invalid"),
  "true",
);
const trigger = page.getByRole("button", { name: "Abrir ejemplo de diálogo" });
await trigger.click();
const modal = page.getByRole("dialog");
await modal.waitFor();
assert.equal(
  await modal.evaluate((el) => getComputedStyle(el).backgroundColor),
  "rgb(14, 19, 32)",
);
await page.screenshot({ path: out + "dialogo-desktop.png" });
await page.keyboard.press("Escape");
await page.waitForFunction(
  () => document.activeElement?.textContent === "Abrir ejemplo de diálogo",
);
assert.equal(
  await trigger.evaluate((el) => el === document.activeElement),
  true,
);
// Contraste WCAG de tokens reales, incluyendo botón primario.
for (const mode of ["obsidian", "contrast"]) {
  if (mode === "contrast")
    await page
      .getByRole("button", { name: "Alto contraste operativo" })
      .click();
  assert.equal(
    await page.locator("html").getAttribute("data-admin-appearance"),
    mode,
  );
  const ratios = await page.evaluate(() => {
    const css = getComputedStyle(document.documentElement);
    const lum = (hex) => {
      const expanded =
        hex.length === 4
          ? "#" + [...hex.slice(1)].map((v) => v + v).join("")
          : hex;
      const rgb = expanded
        .slice(1)
        .match(/../g)
        .map((x) => parseInt(x, 16) / 255)
        .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    return [
      ["--text", "--surface"],
      ["--muted", "--surface-soft"],
      ["--primary", "--primary-soft"],
      ["--danger-text", "#351c28"],
      ["#05251c", "--lumina-emerald"],
    ].map(([a, b]) => {
      const val = (x) =>
        x.startsWith("--") ? css.getPropertyValue(x).trim() : x;
      const l1 = lum(val(a)),
        l2 = lum(val(b));
      return {
        a,
        b,
        ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05),
      };
    });
  });
  ratios.forEach((r) => assert.ok(r.ratio >= 4.5, JSON.stringify(r)));
  evidence.contrast.push({ mode, ratios });
}
await page.screenshot({ path: out + "alto-contraste.png", fullPage: false });
await page.reload();
await page
  .getByRole("heading", { name: "Obsidian Lumina", exact: true })
  .waitFor();
assert.equal(
  await page.locator("html").getAttribute("data-admin-appearance"),
  "contrast",
);
await page.getByRole("button", { name: "Alto contraste operativo" }).click();
await page.emulateMedia({ reducedMotion: "reduce" });
assert.equal(
  await page
    .locator(".loading .spin")
    .evaluate((el) => getComputedStyle(el).animationName),
  "none",
);
await page.emulateMedia({ media: "print" });
assert.notEqual(
  await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
  ),
  "#05050a",
);
await page.emulateMedia({ media: "screen" });
for (const width of [1440, 901, 900, 781, 780, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  const sizes = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(sizes.scroll <= width, JSON.stringify(sizes));
  evidence.widths.push(sizes);
  if (width <= 780) {
    assert.equal(
      await page.locator(".sidebar").evaluate((el) => el.inert),
      true,
    );
    await page.getByRole("button", { name: "Abrir menú" }).click();
    assert.equal(
      await page
        .locator(".sidebar")
        .evaluate((el) => el.contains(document.activeElement)),
      true,
    );
    if (width === 390) await page.screenshot({ path: out + "menu-mobile.png" });
    await page.keyboard.press("Escape");
    assert.equal(
      await page
        .getByRole("button", { name: "Abrir menú" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    if (width === 390)
      await page.screenshot({
        path: out + "componentes-mobile.png",
        fullPage: true,
      });
  }
}
await page.setViewportSize({ width: 1440, height: 1000 });
await page.getByRole("button", { name: "Resumen", exact: true }).click();
await page
  .getByRole("button", { name: "Nueva venta", exact: true })
  .first()
  .click();
assert.equal(
  await page.locator("html").getAttribute("data-admin-appearance"),
  null,
);
await page.getByRole("button", { name: "Resumen", exact: true }).click();
assert.equal(
  await page.locator("html").getAttribute("data-admin-appearance"),
  "obsidian",
);
// Cambiar tema heredado no puede derrotar los tokens de administración.
await page.evaluate(() => {
  document.documentElement.dataset.theme = "dark";
});
assert.equal(
  await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
  ),
  "#05050a",
);
await page.setViewportSize({ width: 390, height: 844 });
if (await page.locator(".assistant-launcher").count()) {
  const launcher = await page.locator(".assistant-launcher").boundingBox();
  const bar = await page.locator(".goods-mobile-bar").boundingBox();
  assert.ok(
    launcher.y + launcher.height <= bar.y,
    "IA no debe tapar Mercancía",
  );
}
await page.screenshot({ path: out + "admin-mobile.png", fullPage: false });
for (const width of [320, 390, 780, 781, 900, 901, 1440]) {
  await page.setViewportSize({ width, height: 1000 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "dashboard overflow " + width,
  );
}
for (const role of ["seller", "manager"]) {
  fixtureRole = role;
  await page.reload();
  await page.getByRole("heading", { name: /Hola,/ }).waitFor();
  assert.equal(
    await page.locator("html").getAttribute("data-admin-appearance"),
    role === "manager" ? "obsidian" : null,
  );
}
await page.locator(".account").click();
await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
await page.locator(".app-shell").waitFor({ state: "detached" });
assert.equal(
  await page.locator("html").getAttribute("data-admin-appearance"),
  null,
);
assert.deepEqual(errors, []);
writeFileSync(
  out + "verificacion.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
process.stdout.write(
  "Obsidian Lumina: contraste AA, 7 anchos, foco/modal, menú móvil, persistencia, reduced-motion, impresión y POS: PASS\n",
);
await browser.close();
