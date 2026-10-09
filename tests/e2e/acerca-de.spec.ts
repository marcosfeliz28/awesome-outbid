// G14 · «Acerca de» con versión, nota de documento no fiscal y licencias.
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}

test("G14: Acerca de muestra versión, «Documento no fiscal» y las licencias de terceros", async ({
  page,
  request,
}) => {
  await login(page);
  await page.getByRole("button", { name: "Acerca de", exact: true }).click();
  const about = page.getByRole("dialog", { name: "Acerca de Nexora POS" });
  await expect(about).toContainText(/Versión \d+\.\d+\.\d+/);
  await expect(about).toContainText("Documento no fiscal.");
  const link = about.getByRole("link", {
    name: "Licencias de terceros (texto completo)",
  });
  await expect(link).toHaveAttribute("href", "/licencias.txt");
  await about.getByText("Ver las licencias aquí").click();
  await expect(about.locator(".about-licenses")).toContainText(
    "SIL OPEN FONT LICENSE Version 1.1",
  );
  await expect(about.locator(".about-licenses")).toContainText("lucide-react");
  // El archivo se sirve como texto (no cae en la SPA).
  const file = await request.get("/licencias.txt");
  expect(file.ok()).toBe(true);
  expect(file.headers()["content-type"]).toContain("text/plain");
  expect(await file.text()).toContain("Plus Jakarta Sans");
});

test("G14: en celular se llega a Acerca de desde el menú sin romper la navegación", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Acerca de", exact: true }).click();
  const about = page.getByRole("dialog", { name: "Acerca de Nexora POS" });
  await expect(about).toBeVisible();
  await expect(page.locator("aside.sidebar")).toHaveAttribute("inert", "");
  await about.getByRole("button", { name: "Cerrar" }).click();
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page.getByRole("button", { name: "Productos", exact: true }).click();
  await expect(page.locator(".main-content h1").first()).toBeVisible();
});
