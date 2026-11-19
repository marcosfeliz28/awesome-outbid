import { expect, test } from "@playwright/test";
import { assertOperationalMoney } from "../visual-helpers/operational-money";

test("Mensajeros a 390 px: facturas e importes anchos quedan legibles sin desbordar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const date = new Date(Date.UTC(2026, 10, 19, 13)).toISOString();
  const amount = "98765432.17";
  const invoice = "FS-0000000000248";
  const writes: string[] = [];
  await page.route("**/api/**", async (route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
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
            permissions: ["*"],
          },
        },
      });
    if (pathname.startsWith("/api/courier/") && method !== "GET")
      writes.push(method);
    if (pathname === "/api/courier/pending" && method === "GET")
      return route.fulfill({
        json: {
          total: amount,
          rows: [
            {
              id: "demo-1",
              invoice,
              courierFee: amount,
              courierName: "Mensajero de prueba",
              customer: "Cliente de la demostración",
              date,
            },
          ],
        },
      });
    if (pathname === "/api/courier/payouts" && method === "GET")
      return route.fulfill({
        json: [
          {
            operationId: "demo-op",
            date,
            paidBy: "Administración",
            note: null,
            total: amount,
            sales: [
              { invoice, courierName: "Mensajero de prueba", fee: amount },
            ],
          },
        ],
      });
    return route.fulfill({ status: 404, json: {} });
  });
  await page.goto("/#courier-payouts");
  await expect(
    page.getByRole("heading", { name: "Envíos del mensajero" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Historial de pagados" }),
  ).toBeVisible();
  const box = page.getByRole("checkbox", {
    name: "Seleccionar envío de " + invoice,
  });
  await expect(box).toBeVisible();
  await box.check();
  const heading = page.locator(
    ".courier-pick .reconciliation-details > strong",
  );
  const dimensions = await heading.evaluate((node) => {
    const amount = node.querySelector(".operational-aux-money")!;
    const style = getComputedStyle(node);
    const box = node.getBoundingClientRect(),
      value = amount.getBoundingClientRect();
    return {
      wrap: style.flexWrap,
      right: box.right,
      valueRight: value.right,
      pageWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
  expect(dimensions.wrap).toBe("wrap");
  expect(dimensions.valueRight).toBeLessThanOrEqual(dimensions.right + 1);
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.pageWidth);
  await assertOperationalMoney(page);
  expect(writes).toEqual([]);
});
