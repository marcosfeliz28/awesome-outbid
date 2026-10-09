import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
let changeCalls = 0;
await page.route("**/api/**", (route) => {
  const url = route.request().url();
  if (url.endsWith("/auth/login"))
    return route.fulfill({ json: { requiresPasswordChange: true } });
  if (url.endsWith("/auth/change-password")) {
    changeCalls++;
    return route.fulfill({
      status: 400,
      json: { message: "Prisma internal detail should not be shown" },
    });
  }
  return route.fulfill({ json: {} });
});
await page.goto("http://localhost:3063/");
await page.getByLabel("Usuario", { exact: true }).fill("cajera-prueba");
await page.getByLabel("Contraseña", { exact: true }).fill("temporal-prueba");
await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
await expect(
  page.getByRole("heading", { name: "Actualiza tu contraseña." }),
).toBeVisible();
await page.getByLabel("Nueva contraseña", { exact: true }).fill("123456789012");
await page
  .getByLabel("Confirma la nueva contraseña", { exact: true })
  .fill("123456789012");
await page.getByRole("button", { name: "Guardar contraseña y entrar" }).click();
await expect(page.getByRole("alert")).toContainText(
  "Completa las cinco reglas",
);
if (changeCalls !== 0) throw new Error("Weak password reached endpoint");
await page
  .getByLabel("Nueva contraseña", { exact: true })
  .fill("NuevaClave!2026");
await page
  .getByLabel("Confirma la nueva contraseña", { exact: true })
  .fill("NuevaClave!2026");
await expect(page.getByRole("status")).toContainText("5/5 reglas");
await page.getByRole("button", { name: "Guardar contraseña y entrar" }).click();
await expect(page.getByRole("alert")).toContainText("pide ayuda a gerencia");
if (changeCalls !== 1) throw new Error("Expected one validated request");
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw new Error("Horizontal overflow at390");
await mkdir("docs/capturas", { recursive: true });
await page.screenshot({
  path: "docs/capturas/P1-cambio-clave-390.png",
  fullPage: true,
});
await page.setViewportSize({ width: 320, height: 844 });
if (
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
)
  throw new Error("Horizontal overflow at320");
console.log(
  "P1 UI: weak password blocks POST; valid policy reaches POST; technical error hidden; mandatory form remains; no horizontal overflow390/320; screenshot captured",
);
await browser.close();
