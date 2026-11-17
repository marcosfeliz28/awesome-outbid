/** Prueba visual aislada con datos ficticios. NO valida API ni permisos del servidor. */
import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const evidence = "test-results/higgsfield-visual/capturas";
const user = {
  id: "visual-demo",
  name: "Marcos Demo",
  email: "demo@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: "visual-branch",
  sessionTimeoutMinutes: 30,
};
const summary = {
  revenue: 124850,
  profit: 42100,
  margin: 33.72,
  invoices: 62,
  ticketAverage: 2013.71,
  trend: 8.4,
  inventoryRetail: 420000,
  inventoryCost: 220000,
  expenses: 12400,
  fees: 835,
  inventoryLoss: 0,
  netProfit: 28865,
  previousYearRevenue: 102200,
  yearOverYear: 22.16,
  peakHours: [],
  alerts: [],
  daily: [1800, 5000, 3600, 6000, 7900, 11000, 8300].map((total, i) => ({
    day: `2026-11-${10 + i}`,
    total,
  })),
  top: [
    {
      name: "Producto de demostración A",
      category: "Suplementos",
      units: 12,
      revenue: 36000,
    },
    {
      name: "Producto de demostración B",
      category: "Suplementos",
      units: 8,
      revenue: 24000,
    },
  ],
  category: [{ name: "Suplementos", total: 124850, color: "#22c59b" }],
};
async function setup(
  page: Page,
  theme: string,
  accent: string,
  language = "es",
) {
  await page.addInitScript(
    ({ theme, language, accent }) => {
      localStorage.setItem("fitstore-theme", theme);
      localStorage.setItem("noxeros-overview-language", language);
      localStorage.setItem("noxeros-visual-accent", accent);
    },
    { theme, language, accent },
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    if (url.pathname === "/api/auth/refresh")
      body = { user, accessToken: "visual-test-only" };
    else if (url.pathname === "/api/dashboard/summary") body = summary;
    else if (url.pathname === "/api/dashboard/year")
      body = {
        months: [{ month: 11, revenue: 124850, profit: 42100, margin: 33.72 }],
        year: 2026,
      };
    else if (url.pathname === "/api/cash-sessions")
      body = [
        { id: "demo-till", status: "open", openedAt: new Date().toISOString() },
      ];
    else if (/alerts|void-requests|events|branches/.test(url.pathname))
      body = [];
    else if (/settings/.test(url.pathname))
      body = { name: "Tienda de demostración", currency: "DOP" };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.goto("/#dashboard");
  await expect(page.locator(".fusion-inicio-integrado")).toBeVisible();
  await expect(page.locator(".kpi-grid .kpi-card")).toHaveCount(4);
  // Set the accent through the actual control, not an invented preference key.
  const accentButton = page.getByRole("button", {
    name:
      accent === "blue"
        ? /Azul|Blue|Zafiro|Sapphire/
        : /Verde|Green|Esmeralda|Emerald/,
    exact: true,
  });
  if (await accentButton.count()) await accentButton.click();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
}
for (const width of [1440, 390])
  for (const theme of ["light", "dark"])
    for (const accent of ["green", "blue"]) {
      test(`demostración ${width} ${theme} ${accent}: sin recortes y captura`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1000 });
        await setup(page, theme, accent);
        const overflow = await page.evaluate(() => ({
          content: document.documentElement.scrollWidth,
          viewport: innerWidth,
        }));
        expect(overflow.content).toBeLessThanOrEqual(overflow.viewport + 1);
        const reportLink = page.getByRole("button", {
          name: "Explorar mis reportes",
          exact: true,
        });
        await reportLink.scrollIntoViewIfNeeded();
        await expect(reportLink).toBeVisible();
        const clipped = await reportLink.evaluate((el) => {
          const r = el.getBoundingClientRect();
          let p = el.parentElement;
          while (p) {
            const s = getComputedStyle(p);
            if (["hidden", "clip"].includes(s.overflowY)) {
              const b = p.getBoundingClientRect();
              if (r.top < b.top - 1 || r.bottom > b.bottom + 1) return true;
            }
            p = p.parentElement;
          }
          return false;
        });
        expect(clipped).toBe(false);
        await page.evaluate(() => scrollTo(0, 0));
        await mkdir(evidence, { recursive: true });
        await page.screenshot({
          path: `${evidence}/inicio-${width}-${theme}-${accent}.png`,
          fullPage: true,
        });
      });
    }
test("teclado, inglés y movimiento reducido", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page, "dark", "blue", "en");
  const card = page.locator(".kpi-grid .kpi-card").first();
  await card.focus();
  await expect(card).toBeFocused();
  const styles = await card.evaluate((el) => ({
    transform: getComputedStyle(el).transform,
    duration: getComputedStyle(el).transitionDuration,
  }));
  expect(styles.transform).toBe("none");
  expect(styles.duration.split(",").every((v) => parseFloat(v) === 0)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "Explore my reports", exact: true }),
  ).toBeVisible();
});

test("accesos rápidos reales: teclado, navegación y volver sin cambios de datos", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await setup(page, "dark", "green");
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && !["GET", "HEAD"].includes(r.method()))
      calls.push(new URL(r.url()).pathname);
  });
  const shortcut = page
    .locator(".fi-quick-access")
    .getByRole("button", { name: "Reportes", exact: true });
  await expect(shortcut).toBeVisible();
  await shortcut.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#reports$/);
  await page.goBack();
  await expect(page.locator(".fi-quick-access")).toBeVisible();
  expect(calls).toEqual([]);
});

test("Negro es distinto de Oscuro y los controles de tema se traducen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await setup(page, "dark", "blue", "en");
  const theme = page.getByRole("group", {
    name: "Overview theme",
    exact: true,
  });
  await theme.getByRole("button", { name: "Dark", exact: true }).click();
  const shell = page.locator(".app-shell");
  const dark = await shell.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--fh-deep"),
  );
  await theme.getByRole("button", { name: "Black", exact: true }).click();
  await expect(
    theme.getByRole("button", { name: "Black", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  const black = await shell.evaluate((el) =>
    getComputedStyle(el).getPropertyValue("--fh-deep"),
  );
  expect(black).not.toBe(dark);
  await theme.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    theme.getByRole("button", { name: "Black", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
});
