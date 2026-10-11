// W7 · Ventana de cobro («Vender a crédito (queda pendiente)») y pantalla
// «Créditos pendientes», a 1280×720, 390 y 320 px. Con NEXORA_AXE_SCRIPT=
// /ruta/axe.min.js corre axe-core (WCAG 2.1 A/AA) y exige 0 violaciones
// graves o críticas, como accesibilidad.spec.ts.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test, expect, selectNamedCustomer, fillOpeningFund } from "./apoyo";

const AXE_SCRIPT = process.env.NEXORA_AXE_SCRIPT;
const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 320, height: 640 },
];

async function axeViolations(page: Page) {
  if (!AXE_SCRIPT) return [];
  if (!(await page.evaluate(() => "axe" in window)))
    await page.addScriptTag({ content: readFileSync(AXE_SCRIPT, "utf8") });
  return page.evaluate(async () => {
    const result = await (window as any).axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
    });
    return result.violations
      .filter((v: any) => ["serious", "critical"].includes(v.impact))
      .map((v: any) => v.id + ": " + String(v.nodes[0]?.html).slice(0, 120));
  });
}
async function everyViewport(page: Page, where: string) {
  for (const size of VIEWPORTS) {
    await page.setViewportSize(size);
    await page.waitForTimeout(150);
    expect(await axeViolations(page), `${where} a ${size.width}px`).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(
      overflow,
      `${where}: sin scroll horizontal a ${size.width}px`,
    ).toBeLessThanOrEqual(1);
  }
  await page.setViewportSize(VIEWPORTS[0]);
}

async function adminHeaders(request: any) {
  const auth = await (
    await request.post("/api/auth/login", {
      data: { email: "admin@fitstore.demo", password: "FitStore-Demo-2026!" },
    })
  ).json();
  const headers = { Authorization: "Bearer " + auth.accessToken };
  const id = crypto.randomUUID();
  const registered = await request.post("/api/terminals/register", {
    headers,
    data: { id, name: "E2E crédito", secret: "e2e-credito-" + id },
  });
  expect(registered.ok()).toBe(true);
  return headers;
}
async function product(request: any, headers: any, code: string) {
  const categories = await (
    await request.get("/api/categories", { headers })
  ).json();
  const created = await (
    await request.post("/api/products", {
      headers,
      data: {
        name: "Faja E2E crédito " + code,
        sku: "W7C-" + code,
        categoryId: categories.find((c: any) => c.name === "Fajas").id,
        taxRate: 0,
        variants: [
          { sku: code, barcode: "W7B-" + code, price: 600, costAvg: 200 },
        ],
      },
    })
  ).json();
  expect(created.id, JSON.stringify(created)).toBeTruthy();
  const adj = await request.post("/api/inventory/adjustments", {
    headers,
    data: { variantId: created.variants[0].id, qty: 5, reason: "E2E crédito" },
  });
  expect(adj.ok(), await adj.text()).toBe(true);
  return created;
}
async function login(page: Page) {
  await page.goto("/");
  await page.getByLabel("Usuario").fill("admin@fitstore.demo");
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FitStore-Demo-2026!");
  await page.getByRole("button", { name: "Entrar a mi tienda" }).click();
  await expect(page.getByRole("heading", { name: /Hola,/ })).toBeVisible();
}
async function openCash(page: Page) {
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  await expect(page.locator(".main-content .loading")).toHaveCount(0);
  const open = page.getByRole("button", { name: "Abrir caja", exact: true });
  if (await open.isVisible()) {
    await open.click();
    await fillOpeningFund(page, "500");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
  }
  await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
}

test("Crédito: ventana de cobro con el camino claro, venta sin pago y cobro mixto en Créditos pendientes", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const headers = await adminHeaders(request);
  const code = String(Math.floor(Math.random() * 9000000) + 1000000);
  const created = await product(request, headers, code);
  // La caja del dueño pudo quedar abierta en otro equipo de una corrida previa:
  // se cierra para abrir una nueva en este equipo.
  const me = await (await request.get("/api/auth/me", { headers })).json();
  for (const cash of await (
    await request.get("/api/cash-sessions", { headers })
  ).json())
    if (!cash.closedAt && cash.userId === (me.id ?? me.user?.id))
      await request.post("/api/cash-sessions/" + cash.id + "/close", {
        headers,
        data: {
          countedCash: 0,
          countedCard: 0,
          countedTransfer: 0,
          notes: "Cierre previo de la prueba de crédito",
        },
      });
  await login(page);
  await openCash(page);
  await page
    .getByRole("button", { name: "Punto de venta", exact: true })
    .click();
  await expect(page.locator(".product-card").first()).toBeVisible();
  const search = page.getByLabel("Buscar productos");
  await search.fill(code);
  await search.press("Enter");

  // Sin cliente, «Cobrar» pide primero elegirlo (la ventana de cobro no
  // se abre); con cliente, la ventana deja claro el camino.
  await page.getByRole("button", { name: /Cobrar/ }).click();
  await expect(
    page.getByText("Selecciona o crea el cliente antes de cobrar."),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await selectNamedCustomer(page);
  await page.getByRole("button", { name: /Cobrar/ }).click();
  const dialog = page.getByRole("dialog");
  // «Nota de crédito» explica que no sirve para vender sin pago.
  await expect(dialog.getByRole("status")).toContainText(
    "Todavía no hay pagos",
  );
  await dialog.getByRole("button", { name: "Nota de crédito" }).click();
  await expect(dialog.getByRole("note")).toContainText(
    "no sirve para vender sin pago",
  );
  await everyViewport(page, "ventana de cobro");

  // Crédito: confirmación y venta con CERO pago.
  await dialog
    .getByRole("button", { name: "Vender a crédito (queda pendiente)" })
    .click();
  const confirm = dialog.getByRole("group", { name: "Confirmar crédito" });
  await expect(confirm).toContainText("quedan pendientes");
  await expect(confirm).toContainText("RD$ 600.00");
  await everyViewport(page, "confirmación de crédito");
  await confirm.getByRole("button", { name: "Sí, vender a crédito" }).click();
  await expect(
    dialog.getByText("CRÉDITO · PENDIENTE DE PAGO").first(),
  ).toBeVisible();
  const sheet = page.locator(".thermal-print");
  await expect(sheet).toContainText("CRÉDITO · PENDIENTE DE PAGO");
  await expect(sheet).toContainText("Monto pendiente RD$ 600.00");
  await expect(sheet).not.toContainText("DOCUMENTO NO FISCAL");
  const number = (await page
    .locator(".sale-success p")
    .first()
    .textContent())!.trim();
  await page.getByRole("button", { name: "Nueva venta", exact: true }).click();

  // Créditos pendientes: cobro mixto 50 % transferencia + 50 % efectivo.
  await page.getByRole("button", { name: "Caja", exact: true }).click();
  const panel = page.getByRole("region", { name: "Créditos pendientes" });
  const row = panel.locator(".cod-row", { hasText: number });
  await expect(row).toContainText("Abierto");
  await expect(row).toContainText("RD$ 600.00");
  await expect(row).toContainText("hoy");
  await everyViewport(page, "créditos pendientes");
  await row.getByRole("button", { name: "Registrar cobro" }).click();
  const collect = page.getByRole("dialog", { name: /Registrar cobro/ });
  await collect.getByLabel("Forma de pago").first().selectOption("transfer");
  await collect.getByLabel("Monto entregado").first().fill("300");
  await collect.getByLabel("Banco").fill("Banco E2E");
  await collect.getByLabel("Referencia").fill("E2E-" + code);
  await collect
    .getByRole("button", { name: "Agregar otra forma de pago" })
    .click();
  await expect(collect.getByLabel("Monto entregado").nth(1)).toHaveValue("300");
  await expect(collect.getByRole("status")).toContainText(
    "Quedaría pendiente: RD$ 0.00",
  );
  await everyViewport(page, "cobro mixto");
  await collect.getByRole("button", { name: "Guardar cobro" }).click();
  await expect(collect).toHaveCount(0);
  await expect(row).toContainText("Parcial");
  await expect(row).toContainText("por verificar");
  await expect(row).toContainText("recibió");

  await request.patch("/api/products/" + created.id, {
    headers,
    data: { active: false },
  });
});
