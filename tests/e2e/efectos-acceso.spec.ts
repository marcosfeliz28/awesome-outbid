import { test, expect } from "./apoyo";

for (const width of [390, 1366]) {
  for (const preference of ["normal", "apagado"] as const) {
    test(`acceso ${width}px: efectos ${preference} respetan la preferencia`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
      await page.addInitScript((mode) => localStorage.setItem("norexos:efectos", mode), preference);
      await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { message: "Prueba aislada" } }));
      await page.goto("/");
      const title = page.locator(".login-art h1");
      await expect(title).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-effects", preference);
      const animation = await title.evaluate((node) => getComputedStyle(node).animationName);
      expect(animation).toBe(preference === "apagado" ? "none" : "fx-title-reveal");
      await expect(page.getByRole("button", { name: /entrar/i }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`efectos-acceso-${width}-${preference}.png`) });
    });
  }
}

test("acceso respeta el movimiento reducido del sistema", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("norexos:efectos", "maximo"));
  await page.route("**/api/**", (route) => route.fulfill({ status: 401, json: { message: "Prueba aislada" } }));
  await page.goto("/");
  const title = page.locator(".login-art h1");
  await expect(title).toBeVisible();
  expect(await title.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
});
