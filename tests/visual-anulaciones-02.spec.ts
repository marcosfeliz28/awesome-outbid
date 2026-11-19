import { test, expect } from "@playwright/test";
for (const admin of [true, false])
  for (const width of [1440, 390]) {
    test(`selection, refresh and guards ${admin} ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const make = (id: string) => ({
        id,
        status: "pending",
        requestedAt: "2026-11-18T12:00:00Z",
        requester: { name: "Operador DEMO" },
        reason: `Motivo ${id}`,
        sale: {
          number: id,
          customer: "Cliente DEMO",
          hiddenUntilClose: !admin,
          total: 123,
          items: [],
          payments: [],
        },
      });
      let rows = [make("DEMO-1"), make("DEMO-2")];
      const writes: string[] = [];
      await page.route("**/*", async (route) => {
        const req = route.request(),
          url = new URL(req.url());
        if (!["127.0.0.1", "localhost"].includes(url.hostname))
          return route.abort();
        if (!url.pathname.startsWith("/api/")) return route.continue();
        let body: unknown = [];
        if (url.pathname === "/api/auth/refresh")
          body = {
            user: {
              id: "demo",
              name: "DEMO",
              role: admin ? "admin" : "cashier",
              branchId: "demo",
              permissions: admin ? ["*"] : ["sale:write"],
            },
            accessToken: "synthetic",
          };
        else if (url.pathname === "/api/terminals/register")
          body = { id: "demo", approved: true };
        else if (!["GET", "HEAD"].includes(req.method())) {
          writes.push(url.pathname);
          return route.fulfill({ status: 405, body: "No writes" });
        } else if (url.pathname === "/api/settings")
          body = { currency: "DOP", taxIncluded: true };
        else if (url.pathname === "/api/void-requests") body = rows;
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      });
      await page.goto("/#void-requests");
      const detail = page.locator("#void-request-detail");
      await expect(detail).toContainText("DEMO-1");
      await page.getByRole("button", { name: /Factura DEMO-2/ }).click();
      await expect(detail).toContainText("DEMO-2");
      await expect(
        page.getByRole("button", { name: /Factura DEMO-2/ }),
      ).toHaveAttribute("aria-pressed", "true");
      if (admin) {
        await detail
          .getByRole("button", { name: "Rechazar", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toContainText("DEMO-2");
        await expect(
          page.getByRole("dialog").getByRole("textbox"),
        ).toHaveAttribute("required", "");
      } else {
        await expect(
          detail.getByRole("button", { name: "Aprobar y anular", exact: true }),
        ).toHaveCount(0);
        await expect(
          detail.getByRole("button", { name: "Cancelar solicitud" }),
        ).toBeVisible();
      }
      // Let the unchanged 15s poll replace the selected row; any stale dialog must close.
      rows = [make("DEMO-1")];
      await expect(detail).toContainText("DEMO-1", { timeout: 20000 });
      await expect(page.getByRole("dialog")).toHaveCount(0);
      if (admin) {
        await detail
          .getByRole("button", { name: "Aprobar y anular", exact: true })
          .click();
        await expect(page.getByRole("dialog")).toContainText(
          "Se anulará la venta",
        );
        await page
          .getByRole("dialog")
          .getByRole("button", { name: "Cancelar", exact: true })
          .click();
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width + 1);
      await page.screenshot({
        path: `test-results/anulaciones-${admin}-${width}.png`,
        fullPage: true,
      });
      rows = [];
      await expect(
        page.getByText("No hay solicitudes en este estado."),
      ).toBeVisible({ timeout: 20000 });
      expect(writes).toEqual([]);
    });
  }
