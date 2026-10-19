import { test, expect } from "./apoyo";

test("envío: 15,550 + 400 cuadra con 15,950 y se paga una sola vez", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const tag = Date.now().toString(36);
  const email = "admin@fitstore.demo";
  const password = process.env.SEED_DEMO_PASSWORD!;
  const login = await request.post("/api/auth/login", {
    data: { email, password },
  });
  expect(login.ok()).toBe(true);
  const session = await login.json();
  const headers = { Authorization: "Bearer " + session.accessToken };
  const api = async (path: string, data?: unknown) => {
    const response =
      data === undefined
        ? await request.get("/api" + path, { headers })
        : await request.post("/api" + path, { headers, data });
    const text = await response.text();
    expect(response.ok(), path + ": " + text).toBe(true);
    return JSON.parse(text);
  };
  const terminal = {
    id: crypto.randomUUID(),
    name: "E2E mensajero " + tag,
    secret: "qa-" + crypto.randomUUID(),
  };
  await api("/terminals/register", terminal);
  await page.addInitScript(
    ([branch, identity]) =>
      localStorage.setItem(
        "fitstore-equipment:" + branch,
        JSON.stringify(identity),
      ),
    [session.user.branchId, terminal] as const,
  );
  const categories = await api("/categories");
  const product = await api("/products", {
    name: "Producto envío " + tag,
    sku: "ENV-P-" + tag,
    categoryId: categories.find((row: any) => row.name === "Fajas").id,
    taxRate: 0,
    variants: [
      {
        sku: "ENV-V-" + tag,
        barcode: "ENV-B-" + tag,
        price: 15550,
        costAvg: 5000,
      },
    ],
  });
  await api("/inventory/adjustments", {
    variantId: product.variants[0].id,
    qty: 2,
    reason: "Prueba envío del mensajero",
  });
  const customer = await api("/customers", { name: "Cliente envío QA " + tag });
  // La caja y la venta son de una cajera propia de la prueba: la cuenta de la
  // administración puede tener otra caja abierta en otro equipo (otras pruebas).
  const roles = await api("/roles");
  const sellerEmail = `e2e-envio-${tag}@example.com`;
  await api("/users", {
    name: "E2E Envío " + tag,
    email: sellerEmail,
    password: "482917",
    pin: String(Math.floor(100000 + Math.random() * 900000)),
    roleId: roles.find((r: any) => r.name === "seller").id,
  });
  const changed = await (
    await request.post("/api/auth/change-password", {
      data: {
        login: sellerEmail,
        currentPassword: "482917",
        newPassword: "736204",
        confirmPassword: "736204",
      },
    })
  ).json();
  const asSeller = { Authorization: "Bearer " + changed.accessToken };
  const sellerApi = async (path: string, data: unknown) => {
    const response = await request.post("/api" + path, {
      headers: asSeller,
      data,
    });
    const text = await response.text();
    expect(response.ok(), path + ": " + text).toBe(true);
    return JSON.parse(text);
  };
  const sellerTerminal = {
    id: crypto.randomUUID(),
    name: "E2E envío caja " + tag,
    secret: "qa-" + crypto.randomUUID(),
  };
  await sellerApi("/terminals/register", sellerTerminal);
  await api("/terminals/" + sellerTerminal.id + "/approve", {});
  const cash = await sellerApi("/cash-sessions/open", {
    registerId: sellerTerminal.id,
    openingAmount: 1000,
  });
  const sold = await sellerApi("/sales", {
    offlineUuid: crypto.randomUUID(),
    customerId: customer.id,
    cashSessionId: cash.id,
    items: [{ variantId: product.variants[0].id, qty: 1 }],
    payments: [
      {
        method: "transfer",
        amount: 15550,
        bank: "BHD",
        reference: "QA-" + tag,
      },
    ],
    expectedTotal: 15550,
  });
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.locator(".main-content")).toBeVisible();
  await page.evaluate(() => {
    location.hash = "sales";
  });
  await page.getByLabel("Buscar número de venta").fill(sold.number);
  await page.getByRole("button", { name: "Ver " + sold.number }).click();
  const detail = page.getByRole("dialog");
  await detail.getByLabel("Envío (RD$)").fill("400");
  await detail.getByRole("button", { name: "Guardar envío" }).click();
  await expect(detail.getByLabel("Envío (RD$)")).toHaveValue("400");
  await detail.getByRole("button", { name: /cerrar/i }).click();
  await page.evaluate(() => {
    location.hash = "transfer-reconciliation";
  });
  const row = page
    .locator(".reconciliation-row")
    .filter({ hasText: sold.number });
  await expect(row).toContainText("15,950");
  await row.getByRole("checkbox").check();
  await page.getByLabel("Total del banco (RD$)").first().fill("15950");
  await expect(page.getByText("Cuadrado · RD$ 0.00")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  // UI-01: a 320 px también se verifica de verdad y se ve el resultado.
  await page
    .locator(".reconciliation-bank")
    .filter({ has: row })
    .getByRole("button", { name: "Verificar seleccionadas" })
    .click();
  await expect(
    page.locator(".reconciliation-ok").filter({ hasText: sold.number }),
  ).toHaveText(sold.number + ": Verificada");
  // Ya verificada, sale de la lista de pendientes del servidor.
  await expect(row).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.evaluate(() => {
    location.hash = "courier-payouts";
  });
  const pending = page
    .locator(".courier-pick")
    .filter({ hasText: sold.number });
  await expect(pending).toContainText("400");
  await pending.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Marcar como pagado" }).click();
  await expect(pending).toHaveCount(0);
  await expect(
    page.getByText("Pago registrado:", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
});
