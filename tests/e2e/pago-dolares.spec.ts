// Pago en dólares (dueña, 25-oct): en la caja, «Dólares (US$)» muestra la
// tasa y el equivalente en pesos; lo pendiente y el cambio siguen en pesos.
import { test, expect, selectNamedCustomer, fillOpeningFund } from "./apoyo";

const OWNER = { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" };
const RATE = 61.4158;

test("la cajera cobra US$ 40 + RD$ 100 de una venta de RD$ 2,500 y da RD$ 56.63 de cambio", async ({
  page,
  request,
}) => {
  const auth = await (
    await request.post("/api/auth/login", { data: OWNER })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const id = crypto.randomUUID();
  expect(
    (
      await request.post("/api/terminals/register", {
        headers,
        data: { id, name: "E2E dólares", secret: "e2e-dolares-" + id },
      })
    ).ok(),
  ).toBe(true);
  // El navegador es otro equipo: se cierra la caja que la dueña dejó abierta.
  const sessions = await (
    await request.get("/api/cash-sessions", { headers })
  ).json();
  for (const s of sessions.filter(
    (s: any) => s.userId === auth.user.id && !s.closedAt,
  ))
    await request.post("/api/cash-sessions/" + s.id + "/close", {
      headers,
      data: {
        countedCash: Math.max(0, s.expected.cash),
        countedCard: Math.max(0, s.expected.card),
        ...(s.expected.card > 0 ? { batchNumber: "QA-LOTE" } : {}),
        countedTransfer: Math.max(0, s.expected.transfer),
        countedUsd: Math.max(0, s.expected.usd ?? 0),
        differenceReason: "QA: cierre de limpieza de la prueba",
        notes: "Cierre antes de la prueba de dólares",
      },
    });
  const { logo: _logo, ...settings } = await (
    await request.get("/api/settings", { headers })
  ).json();
  void _logo;
  const put = (usdRate: unknown) =>
    request.put("/api/settings", { headers, data: { ...settings, usdRate } });
  expect((await put(RATE)).ok()).toBe(true);
  const sku = String(Math.floor(Math.random() * 9000000) + 1000000);
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const product = await (
    await request.post("/api/products", {
      headers,
      data: {
        name: "Faja E2E dólares " + sku,
        sku: "USD-" + sku,
        categoryId: categories.find((c: any) => c.name === "Fajas").id,
        variants: [{ sku, barcode: "USDB-" + sku, price: 2500, costAvg: 700 }],
      },
    })
  ).json();
  expect(
    (
      await request.post("/api/inventory/adjustments", {
        headers,
        data: {
          variantId: product.variants[0].id,
          qty: 2,
          reason: "E2E dólares",
        },
      })
    ).ok(),
  ).toBe(true);
  try {
    await page.goto("/");
    await page.getByLabel("Usuario").fill(OWNER.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(OWNER.password);
    await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
    await expect(
      page.getByRole("button", { name: "Entrar a mi tienda" }),
    ).toHaveCount(0);
    await page.evaluate(() => (location.hash = "cash"));
    const open = page.getByRole("button", { name: "Abrir caja", exact: true });
    const opened = page.getByText("Caja abierta", { exact: true });
    await expect(open.or(opened).first()).toBeVisible();
    if (await open.isVisible()) {
      await open.click();
      await fillOpeningFund(page, "500");
      await page.getByRole("button", { name: "Guardar", exact: true }).click();
    }
    await expect(opened).toBeVisible();
    await page.evaluate(() => (location.hash = "pos"));
    const search = page.getByLabel("Buscar productos");
    await expect(page.locator(".product-card").first()).toBeVisible();
    await search.fill(sku);
    await search.press("Enter");
    await expect(page.locator(".cart-item", { hasText: sku })).toBeVisible();
    await selectNamedCustomer(page);
    await page
      .getByRole("button", { name: /Cobrar/ })
      .first()
      .click();
    await page.getByRole("button", { name: "Dólares (US$)" }).click();
    await page.getByLabel("Monto en dólares (US$)").fill("40");
    await expect(page.locator(".usd-hint")).toContainText(
      "Tasa RD$ 61.4158 por US$ 1 · Equivale a RD$ 2,456.63",
    );
    await page.keyboard.press("Enter");
    await expect(page.locator(".payment-list")).toContainText("Dólares US$ 40");
    await expect(page.locator(".payment-balance")).toContainText("RD$ 43.37");
    await page.getByRole("button", { name: "Efectivo", exact: true }).click();
    await page.getByLabel("Monto del pago").fill("100");
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await expect(page.locator(".payment-balance")).toContainText("RD$ 56.63");
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(
      page.getByText("Venta registrada", { exact: true }),
    ).toBeVisible();
    await expect(page.locator(".thermal-print")).toContainText(
      "Dólares US$ 40.00",
    );
  } finally {
    await put(settings.usdRate ?? null);
    await request.patch("/api/products/" + product.id, {
      headers,
      data: { active: false },
    });
  }
});
