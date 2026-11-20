// Humo de navegador del producto en vivo: una empresa ficticia (invitación del
// operador, fixture de tests/product-live) entra con su código de empresa,
// abre caja, vende y cierra en la PWA real contra la API en modo producto.
import { expect, test } from "@playwright/test";
import {
  ADMIN_PASSWORD,
  createCompany,
  ok,
  type Company,
} from "../product-live/fixture";

let company: Company;
const run = Date.now().toString(36);
const productName = `Artículo web ${run}`;

test.beforeAll(async () => {
  company = await createCompany(`ci-web-${run}`);
  const admin = company.admin;
  await ok("POST", "/onboarding", { token: admin, body: { dismissed: true } });
  const category = await ok("POST", "/categories", {
    token: admin,
    body: { name: `Categoría web ${run}` },
  });
  const tag = `W${run}`.toUpperCase();
  const product = await ok("POST", "/products", {
    token: admin,
    body: {
      name: productName,
      sku: `SKU-${tag}`,
      categoryId: category.id,
      taxRate: 0,
      variants: [
        { sku: `V-${tag}`, barcode: `B-${tag}`, price: 100, costAvg: 40 },
      ],
    },
  });
  await ok("POST", "/inventory/adjustments", {
    token: admin,
    body: {
      variantId: product.variants[0].id,
      qty: 5,
      reason: "Existencia ficticia de CI web",
    },
  });
});

test("la empresa entra con su código, vende y cierra caja en la PWA", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Código de empresa").fill(company.slug);
  await page.getByLabel("Usuario").fill(company.adminEmail);
  await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN_PASSWORD);
  const loginResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/auth/login") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar a mi empresa" }).click();
  const browserLogin = await loginResponse;
  expect(browserLogin.ok(), await browserLogin.text()).toBe(true);
  const auth = {
    Authorization: `Bearer ${(await browserLogin.json()).accessToken}`,
  };

  await page.goto("/#cash");
  await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
  await page.getByLabel("Efectivo inicial").fill("100");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await page.getByLabel("Buscar productos").fill(productName);
  await page.locator(".product-card", { hasText: productName }).click();
  await expect(page.locator(".cart-items")).toContainText(productName);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await expect(
    page.getByRole("dialog", { name: "Todo listo para cobrar" }),
  ).toBeVisible();
  await page.getByLabel("Monto del pago").fill("100");
  await page.getByRole("button", { name: "Agregar pago" }).click();
  await page.getByRole("button", { name: "Finalizar venta" }).click();
  await expect(
    page.getByText("Venta registrada", { exact: true }),
  ).toBeVisible();
  const sales = await (
    await page.request.get("/api/sales", { headers: auth })
  ).json();
  expect((sales.items ?? sales).map((s: any) => Number(s.total))).toEqual([
    100,
  ]);

  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await page.getByRole("button", { name: "Cerrar y arquear" }).first().click();
  const closeDialog = page.getByRole("dialog", {
    name: "Cuadre y cierre de caja",
  });
  await expect(closeDialog).toBeVisible();
  await closeDialog.getByLabel("Cantidad de 100", { exact: true }).fill("2");
  await closeDialog.getByLabel(/Tarjeta declarada/).fill("0");
  await closeDialog
    .getByRole("checkbox", { name: /Confirmo que conté efectivo/ })
    .check();
  await closeDialog
    .getByRole("button", { name: "Cerrar caja e imprimir cuadre" })
    .click();
  await expect(page.locator(".thermal-print")).toContainText("FIN DEL CUADRE");
  const sessions = await (
    await page.request.get("/api/cash-sessions", { headers: auth })
  ).json();
  expect(sessions).toHaveLength(1);
  expect(sessions[0].closedAt).toBeTruthy();
});
