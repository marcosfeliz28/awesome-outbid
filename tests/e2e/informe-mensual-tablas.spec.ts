import { expect, test } from "@playwright/test";
const line = {
  name: "Proteína aislada de suero premium — sabor chocolate oscuro de edición limitada",
  sku: "DEMO-01",
  units: 42,
  revenue: 123456.78,
  profit: 30000,
  margin: 24,
};
for (const profile of [
  { width: 390, lang: "es", profit: true },
  { width: 1440, lang: "en", profit: false },
] as const) {
  test(
    "Informe mensual: columnas legibles a " +
      profile.width +
      "px (" +
      profile.lang +
      ")",
    async ({ page }) => {
      await page.setViewportSize({ width: profile.width, height: 900 });
      await page.addInitScript((lang) => {
        localStorage.setItem("norexos-overview-language", lang);
      }, profile.lang);
      await page.route("**/api/**", async (route) => {
        const { pathname } = new URL(route.request().url());
        if (pathname === "/api/auth/refresh")
          return route.fulfill({
            json: {
              accessToken: "demo-synthetic-token",
              user: {
                id: "synthetic",
                name: "Prueba",
                role: "gerente",
                email: "prueba@example.test",
                branchId: "demo",
                permissions: [
                  "reports:read",
                  ...(profile.profit ? ["profit:read"] : []),
                ],
              },
            },
          });
        if (pathname === "/api/dashboard/breakdown")
          return route.fulfill({
            json: {
              revenue: line.revenue,
              averagePerDay: line.revenue,
              averageTicket: line.revenue,
              invoices: 1,
              days: 1,
              units: line.units,
              categories: [{ ...line, name: "Suplementos" }],
              payments: [
                {
                  category: "Suplementos",
                  method: "cash",
                  amount: line.revenue,
                },
              ],
              topByCategory: [
                { category: "Suplementos", byUnits: [line], byAmount: [line] },
              ],
              top: [line],
            },
          });
        return route.fulfill({ status: 404, json: {} });
      });
      await page.goto("/#month-report?from=2026-10-01&to=2026-10-31");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: profile.lang === "es" ? "Informe mensual" : "Monthly report",
        }),
      ).toBeVisible();
      const top = page.locator(".month-top-panel");
      const product = top.getByText(line.name, { exact: true });
      await expect(product).toBeVisible();
      const sizes = await product.evaluate((el) => {
        const row = el.closest("tr")!;
        const cells = row.querySelectorAll("td");
        return {
          rank: cells[0].getBoundingClientRect().width,
          productScroll: el.scrollWidth,
          productClient: el.clientWidth,
          productHeight: el.clientHeight,
          productLineHeight: Number.parseFloat(getComputedStyle(el).lineHeight),
          productPadding:
            Number.parseFloat(getComputedStyle(el).paddingTop) +
            Number.parseFloat(getComputedStyle(el).paddingBottom),
          productWhitespace: getComputedStyle(el).whiteSpace,
          unitsWhitespace: getComputedStyle(cells[2]).whiteSpace,
          amountWhitespace: getComputedStyle(cells[3]).whiteSpace,
          pageScroll: document.documentElement.scrollWidth,
          pageClient: document.documentElement.clientWidth,
        };
      });
      if (profile.width === 1440) expect(sizes.rank).toBeLessThan(64);
      if (profile.width === 390) {
        expect(sizes.productScroll).toBeLessThanOrEqual(sizes.productClient);
        expect(sizes.productHeight - sizes.productPadding).toBeGreaterThan(
          sizes.productLineHeight,
        );
      }
      expect(sizes.productWhitespace).toBe("normal");
      expect(sizes.unitsWhitespace).toBe("nowrap");
      expect(sizes.amountWhitespace).toBe("nowrap");
      expect(sizes.pageScroll).toBeLessThanOrEqual(sizes.pageClient);
      await expect(
        top.getByRole("columnheader", {
          name:
            profile.lang === "es" ? "Ganancia con ITBIS" : "Profit incl. ITBIS",
        }),
      ).toHaveCount(profile.profit ? 1 : 0);
    },
  );
}
