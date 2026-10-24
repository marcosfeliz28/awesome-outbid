import { test, expect } from "@playwright/test";

test("N-13 · estado público explica disponibilidad y falla sin afirmar que todo funciona", async ({ page }) => {
  await page.route("**/api/health/ready", (route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"status":"ok"}' }));
  await page.goto("/estado.html");
  await expect(page.getByRole("heading", { name: "Estado del servicio" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("Disponible desde este dispositivo");
  await page.unrouteAll();
  await page.route("**/api/health/ready", (route) => route.fulfill({ status: 503, body: "" }));
  await page.getByRole("button", { name: "Comprobar de nuevo" }).click();
  await expect(page.getByRole("status")).toContainText("No se pudo confirmar");
});
