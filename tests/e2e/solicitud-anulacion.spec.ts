// 3p: cajera solicita desde Ventas; administración revisa desde el inicio.
import { readFileSync } from "node:fs";
import type { Browser, Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const ownerLogin = {
  email: "admin@fitstore.demo",
  password: process.env.SEED_DEMO_PASSWORD!,
};
const temporary = "482917";
const password = "736204";
const testPin = String(Math.floor(100000 + Math.random() * 900000));

async function checkViewport(page: Page) {
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    expect(overflow, `desbordamiento a ${width}px`).toBeLessThanOrEqual(1);
    if (process.env.NEXORA_AXE_SCRIPT) {
      if (!(await page.evaluate(() => "axe" in window)))
        await page.addScriptTag({
          content: readFileSync(process.env.NEXORA_AXE_SCRIPT, "utf8"),
        });
      const violations = await page.evaluate(async () => {
        const result = await (window as any).axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        });
        return result.violations
          .filter((v: any) => ["serious", "critical"].includes(v.impact))
          .map((v: any) => ({
            id: v.id,
            nodes: v.nodes.map((node: any) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          }));
      });
      expect(violations, `axe a ${width}px`).toEqual([]);
    }
  }
}

async function login(page: Page, email: string, secret: string) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(secret);
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.locator(".main-content")).toBeVisible();
}

test("Solicitud de anulación: cajera solicita y administración aprueba o rechaza", async ({
  browser,
  request,
}) => {
  test.setTimeout(120000);
  const tag = Date.now().toString(36);
  const auth = await (
    await request.post("/api/auth/login", { data: ownerLogin })
  ).json();
  const owner = { Authorization: "Bearer " + auth.accessToken };
  const api = async (path: string, data?: unknown, headers = owner) => {
    const response =
      data === undefined
        ? await request.get("/api" + path, { headers })
        : await request.post("/api" + path, { headers, data });
    const text = await response.text();
    expect(response.ok(), path + ": " + text).toBe(true);
    return JSON.parse(text);
  };
  const ownerTerminal = {
    id: crypto.randomUUID(),
    name: "E2E anulación admin " + tag,
    secret: "e2e-anula-admin-" + crypto.randomUUID(),
  };
  const sellerTerminal = {
    id: crypto.randomUUID(),
    name: "E2E anulación caja " + tag,
    secret: "e2e-anula-caja-" + crypto.randomUUID(),
  };
  let sellerId = "";
  const contexts: Awaited<ReturnType<Browser["newContext"]>>[] = [];
  try {
    await api("/terminals/register", ownerTerminal);
    const roles = await api("/roles");
    const categories = await api("/categories");
    const sellerEmail = `e2e-anula-${tag}@example.com`;
    const seller = await api("/users", {
      name: "E2E Anulación " + tag,
      email: sellerEmail,
      password: temporary,
      pin: testPin,
      roleId: roles.find((r: any) => r.name === "seller").id,
    });
    sellerId = seller.id;
    const changed = await (
      await request.post("/api/auth/change-password", {
        data: {
          login: sellerEmail,
          currentPassword: temporary,
          newPassword: password,
          confirmPassword: password,
        },
      })
    ).json();
    const asSeller = { Authorization: "Bearer " + changed.accessToken };
    await api("/terminals/register", sellerTerminal, asSeller);
    await api("/terminals/" + sellerTerminal.id + "/approve", {});
    const product = await api("/products", {
      name: "Faja E2E anulación " + tag,
      sku: "E2EA-" + tag,
      categoryId: categories.find((c: any) => c.name === "Fajas").id,
      taxRate: 0,
      variants: [
        {
          sku: "E2EAV-" + tag,
          barcode: "E2EAB-" + tag,
          price: 100,
          costAvg: 40,
        },
      ],
    });
    await api("/inventory/adjustments", {
      variantId: product.variants[0].id,
      qty: 5,
      reason: "Prueba de solicitud de anulación",
    });
    const customer = await api("/customers", {
      name: "Cliente E2E anulación " + tag,
    });
    const cash = await api(
      "/cash-sessions/open",
      { registerId: sellerTerminal.id, openingAmount: 500 },
      asSeller,
    );
    const makeSale = () =>
      api(
        "/sales",
        {
          offlineUuid: crypto.randomUUID(),
          customerId: customer.id,
          cashSessionId: cash.id,
          items: [{ variantId: product.variants[0].id, qty: 1 }],
          payments: [{ method: "cash", amount: 100 }],
          expectedTotal: 100,
        },
        asSeller,
      );
    const first = await makeSale();
    const second = await makeSale();

    const sellerContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    contexts.push(sellerContext);
    await sellerContext.addInitScript(
      ([branch, identity]) =>
        localStorage.setItem(
          "fitstore-equipment:" + branch,
          JSON.stringify(identity),
        ),
      [auth.user.branchId, sellerTerminal] as const,
    );
    const sellerPage = await sellerContext.newPage();
    await login(sellerPage, sellerEmail, password);
    await sellerPage.evaluate(() => {
      location.hash = "sales";
    });
    await expect(
      sellerPage.getByRole("heading", {
        name: "Cada venta tiene una historia",
      }),
    ).toBeVisible();
    await sellerPage.getByLabel("Buscar número de venta").fill(first.number);
    await sellerPage
      .getByRole("button", { name: "Solicitar anulación" })
      .click();
    const form = sellerPage.getByRole("dialog");
    await form.getByLabel("Tipo de motivo").selectOption("customer_request");
    await form
      .getByLabel("Explica el motivo")
      .fill("Cliente pidió corregir la factura.");
    await checkViewport(sellerPage);
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(sellerPage.getByText("Solicitud pendiente")).toBeVisible();

    const ownerContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    contexts.push(ownerContext);
    await ownerContext.addInitScript(
      ([branch, identity]) =>
        localStorage.setItem(
          "fitstore-equipment:" + branch,
          JSON.stringify(identity),
        ),
      [auth.user.branchId, ownerTerminal] as const,
    );
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, ownerLogin.email, ownerLogin.password);
    await expect(
      ownerPage.getByRole("region", {
        name: "Solicitudes de anulación pendientes",
      }),
    ).toContainText(/solicitudes? de anulación pendientes?/);
    await checkViewport(ownerPage);
    const firstRow = ownerPage
      .locator(".void-request-dashboard-row")
      .filter({ hasText: first.number });
    await firstRow.getByRole("button", { name: "Anular venta" }).click();
    await ownerPage
      .getByRole("button", { name: "Confirmar anulación" })
      .click();
    await expect(firstRow).toHaveCount(0);
    expect(
      (await api("/sales?q=" + first.number)).find(
        (s: any) => s.id === first.id,
      ).status,
    ).toBe("voided");

    await sellerPage.getByLabel("Buscar número de venta").fill(second.number);
    await sellerPage
      .getByRole("button", { name: "Solicitar anulación" })
      .click();
    const secondForm = sellerPage.getByRole("dialog");
    await secondForm.getByLabel("Tipo de motivo").selectOption("other");
    await secondForm
      .getByLabel("Explica el motivo")
      .fill("Revisar esta venta antes de decidir.");
    await secondForm.getByRole("button", { name: "Guardar" }).click();
    await ownerPage.evaluate(() => {
      location.hash = "void-requests";
    });
    await expect(
      ownerPage.getByRole("heading", { name: "Solicitudes de anulación" }),
    ).toBeVisible();
    await expect(
      ownerPage.getByText("Revisar esta venta antes de decidir."),
    ).toBeVisible();
    const secondCard = ownerPage
      .locator(".void-request-card")
      .filter({ hasText: second.number });
    await secondCard.getByRole("button", { name: "Rechazar" }).click();
    await ownerPage
      .getByLabel("Nota obligatoria para la solicitante")
      .fill("La venta corresponde y debe conservarse.");
    await ownerPage
      .getByRole("dialog")
      .getByRole("button", { name: "Guardar" })
      .click();
    await expect(secondCard).toHaveCount(0);
  } finally {
    for (const context of contexts) await context.close();
    if (sellerId)
      await request.patch("/api/users/" + sellerId, {
        headers: owner,
        data: { active: false },
      });
  }
});
