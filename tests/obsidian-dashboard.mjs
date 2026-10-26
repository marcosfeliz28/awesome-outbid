/* global document, innerWidth, window, Event */
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { URL } from "node:url";
import { writeFileSync } from "node:fs";
import process from "node:process";
// Solo navegador local y fixtures: no inicia sesión ni opera una empresa real.
const desktopWidth = Number(process.env.LUMINA_DESKTOP_WIDTH || 1440);
const desktopHeight = Number(process.env.LUMINA_DESKTOP_HEIGHT || 1100);
const mobileWidth = Number(process.env.LUMINA_MOBILE_WIDTH || 390);
const mobileHeight = Number(process.env.LUMINA_MOBILE_HEIGHT || 1000);
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: desktopWidth, height: desktopHeight },
  serviceWorkers: "block",
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
const asks = [];
const sourceQueries = [];
const writes = [];
let permissions = ["*"];
let summaryError = false;
let empty = false;
let askFailure = 0;
let role = "admin";
const day = new Date().toLocaleDateString("en-CA", {
  timeZone: "America/Santo_Domingo",
});
const base = process.env.LUMINA_TEST_URL || "http://127.0.0.1:4264";
const out = (process.env.LUMINA_OUT || "docs/capturas/obsidian-lumina-fase2") + "/";
await page.route("**/*", (route) =>
  new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue()
    : route.abort(),
);
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/**", async (route) => {
  const request = route.request(),
    url = new URL(request.url());
  let data = [],
    status = 200;
  if (request.method() !== "GET") writes.push(url.pathname);
  if (url.pathname.endsWith("/auth/refresh"))
    data = {
      accessToken: "local-visual-fixture",
      user: {
        id: "qa-dashboard",
        name: "Elena · prueba visual",
        branchId: "qa-branch",
        role,
        permissions,
        sessionTimeoutMinutes: 30,
      },
    };
  else if (url.pathname.endsWith("/settings"))
    data = {
      name: "Negocio de ejemplo",
      branchName: "Sucursal de prueba",
      allowOfflineSales: false,
      taxIncluded: true,
    };
  else if (url.pathname.endsWith("/dashboard/summary")) {
    sourceQueries.push(url.search);
    if (summaryError) {
      status = 500;
      data = { message: "Reporte temporalmente no disponible." };
    } else
      data = {
        revenue: empty ? 0 : 12500,
        grossProfit: empty ? 0 : 4100,
        margin: 32.8,
        invoices: empty ? 0 : 25,
        ticketAverage: empty ? 0 : 500,
        inventoryRetail: 85000,
        previousYearRevenue: 10000,
        yearOverYear: 25,
        expenses: 100,
        fees: 20,
        netProfit: 3980,
        inventoryCost: 42000,
        daily: empty ? [] : [{ day: day, total: 12500 }],
        peakHours: [],
        top: empty
          ? []
          : [
              {
                name: "Producto de ejemplo",
                category: "General",
                units: 25,
                revenue: 12500,
              },
            ],
        category: empty
          ? []
          : [{ name: "General", color: "#8B5CF6", total: 12500 }],
        alerts: empty
          ? []
          : [
              {
                id: "alert-low",
                type: "low_stock",
                severity: "low",
                status: "new",
                message: "Referencia de prueba: revisar existencias.",
              },
              {
                id: "alert-high",
                type: "expense_budget",
                severity: "high",
                status: "seen",
                message:
                  "Presupuesto mensual de prueba: revisar gastos del período.",
              },
            ],
      };
  } else if (url.pathname.endsWith("/dashboard/year")) data = { months: [] };
  else if (url.pathname.endsWith("/assistant/usage"))
    data = { usadas: 3, limite: 100, mes: day.slice(0, 7) };
  else if (url.pathname.endsWith("/assistant/ask")) {
    asks.push(request.postDataJSON());
    if (askFailure) {
      status = askFailure;
      data = {
        message:
          askFailure === 429
            ? "Cuota de consultas agotada."
            : "El asistente no está activado en esta empresa.",
      };
    } else
      data = {
        answer:
          "Lectura simulada para verificar la interfaz. Fuente: reportes disponibles del " +
          day +
          ". Revisa las fechas antes de decidir.",
        remaining: 96,
        proposal: {
          factura: "NO-EJECUTAR",
          motivo: "propuesta sintética que no debe ejecutar el resumen",
        },
      };
  } else if (url.pathname.endsWith("/support-access"))
    data = { enabled: false, expiresAt: null };
  else if (url.pathname.endsWith("/onboarding")) data = { available: false };
  else if (url.pathname.endsWith("/terminals/register"))
    data = { id: "visual-terminal", status: "approved" };
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(data),
  });
});
await page.goto(base + "/#dashboard");
await page.getByRole("heading", { name: "Tu día, en claro" }).waitFor();
await page.locator(".executive-metric").first().waitFor();
assert.equal(await page.locator(".executive-metric").count(), 4);
assert.equal(
  await page.getByLabel("Período del resumen").inputValue(),
  "today",
);
assert.ok(
  sourceQueries.some(
    (q) => q.includes("from=" + day) && q.includes("to=" + day),
  ),
);
assert.match(
  await page.locator(".executive-metric").first().innerText(),
  /12,500/,
);
assert.match(
  await page.locator(".daily-brief-facts").innerText(),
  /25 ventas completadas hoy/,
);
assert.match(
  await page.locator(".intelligent-alert-list li").first().innerText(),
  /Prioridad alta/,
);
assert.equal(asks.length, 0, "Cargar el tablero no consume IA");
await page.screenshot({
  path: out + `tablero-${desktopWidth}x${desktopHeight}.png`,
  fullPage: false,
});
const cardQuestion = page.getByRole("button", {
  name: "Pregúntale a Nexora: Ventas del período",
  exact: true,
});
await cardQuestion.click();
const question = page.getByLabel("Tu pregunta", { exact: true });
await question.waitFor();
assert.match(await question.inputValue(), new RegExp(day));
assert.equal(asks.length, 0, "Abrir tarjeta no envía pregunta");
const dialog = page.getByRole("dialog", {
  name: "Pregúntale a Nexora",
  exact: true,
});
const firstControl = dialog.getByRole("button", {
  name: "Cerrar asistente",
  exact: true,
});
await firstControl.focus();
await page.keyboard.press("Shift+Tab");
assert.equal(
  await dialog
    .getByRole("button", { name: "Enviar pregunta", exact: true })
    .evaluate((el) => el === document.activeElement),
  true,
);
await page.keyboard.press("Tab");
assert.equal(
  await firstControl.evaluate((el) => el === document.activeElement),
  true,
);
await question.fill("Borrador que se debe conservar");
await page.keyboard.press("Escape");
assert.equal(
  await cardQuestion.evaluate((el) => el === document.activeElement),
  true,
);
await page
  .getByRole("button", { name: "Pregúntale a Nexora: Alertas", exact: true })
  .click();
assert.equal(await question.inputValue(), "Borrador que se debe conservar");
await page.getByRole("button", { name: "Usar pregunta de la tarjeta" }).click();
assert.match(await question.inputValue(), /lista es limitada/);
assert.ok(
  !(await question.inputValue()).includes("Presupuesto mensual de prueba"),
);
await page.screenshot({
  path: out + `nexora-contextual-${desktopWidth}x${desktopHeight}.png`,
});
await page
  .getByRole("button", { name: "Enviar pregunta", exact: true })
  .click();
await page.locator(".assistant-assistant").waitFor();
assert.equal(asks.length, 1);
assert.ok(asks[0].messages.at(-1).content.length <= 500);
await page
  .getByRole("button", { name: "Nueva conversación", exact: true })
  .click();
assert.equal(await page.locator(".assistant-context").count(), 0);
assert.equal(await page.locator(".assistant-message").count(), 0);

await page.keyboard.press("Escape");
const generate = page.getByRole("button", {
  name: "Preparar resumen con IA",
  exact: true,
});
askFailure = 503;
await generate.click();
await page
  .getByRole("alert")
  .filter({ hasText: "Sin conexión con el servidor" })
  .waitFor();
assert.equal(await generate.isDisabled(), true);
await page.evaluate(() => window.dispatchEvent(new Event("online")));
assert.equal(asks.length, 2);
askFailure = 429;
await generate.click();
await page
  .getByRole("alert")
  .filter({ hasText: "Cuota de consultas agotada" })
  .waitFor();
assert.equal(asks.length, 3);
askFailure = 0;
await generate.click();
await page.locator(".daily-ai-answer").waitFor();
assert.equal(asks.length, 4);
assert.ok(asks.every((a) => a.messages.at(-1).content.length <= 500));
assert.ok(
  asks.every(
    (a) => !JSON.stringify(a).includes("Presupuesto mensual de prueba"),
  ),
);
assert.equal(
  await page.getByRole("button", { name: "Sí, enviar solicitud" }).count(),
  0,
  "El resumen no convierte propuestas en acciones",
);
assert.ok(!writes.some((p) => /\/approve|\/void-requests|\/sales$/.test(p)));
await page.screenshot({
  path: out + `resumen-ia-${desktopWidth}x${desktopHeight}.png`,
  fullPage: false,
});
await page.getByLabel("Período del resumen").selectOption("month");
await page.waitForFunction(() =>
  document.querySelector(".executive-period")?.textContent.includes("-01"),
);
assert.equal(asks.length, 4, "Cambiar el período no genera consultas");
assert.match(
  await page.locator(".daily-brief .eyebrow").innerText(),
  new RegExp(day.split("-").reverse().join("/")),
);
const widths = [];
for (const width of [1440, 901, 780, mobileWidth, 320]) {
  await page.setViewportSize({
    width,
    height: width === mobileWidth ? mobileHeight : 1000,
  });
  const scroll = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  assert.ok(scroll <= width, `Desbordamiento a ${width}: ${scroll}`);
  widths.push({ width, scroll });
  if (width === mobileWidth) {
    await page.screenshot({
      path: out + `tablero-${mobileWidth}x${mobileHeight}.png`,
      fullPage: false,
    });
    await page
      .getByRole("button", {
        name: "Pregúntale a Nexora: Ticket promedio",
        exact: true,
      })
      .click();
    await question.waitFor();
    await page.screenshot({
      path: out + `nexora-${mobileWidth}x${mobileHeight}.png`,
    });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await page.keyboard.press("Escape");
  }
}
await page.setViewportSize({ width: desktopWidth, height: desktopHeight });
// Fase 2 (A): sin alto contraste; la administración usa el selector claro/oscuro.
permissions = ["reports:read", "catalog:read"];
role = "manager";
await page.reload();
await page
  .getByRole("heading", { name: "Inventario actual a la venta", exact: true })
  .waitFor();
assert.equal(
  await page
    .getByRole("heading", { name: "Ganancia bruta", exact: true })
    .count(),
  0,
);
assert.ok(
  !(await page.locator(".daily-brief-facts").innerText()).includes(
    "Ganancia bruta",
  ),
);
assert.equal(
  await page
    .getByRole("button", { name: "Revisar alertas", exact: true })
    .count(),
  0,
);
summaryError = true;
await page.reload();
await page.getByRole("alert").first().waitFor();
assert.equal(
  await page.locator(".executive-metric").count(),
  0,
  "Error no se representa como ventas cero",
);
await page.screenshot({ path: out + "error-datos.png" });
summaryError = false;
empty = true;
permissions = ["*"];
role = "admin";
await page.reload();
await page.getByRole("heading", { name: "Tu día, en claro" }).waitFor();
await page
  .getByText("Todavía no hay ventas completadas hoy.", { exact: false })
  .waitFor();
await page
  .getByText("No hay alertas en la muestra recibida.", { exact: false })
  .waitFor();
assert.equal(asks.length, 4);
assert.deepEqual(errors, []);
writeFileSync(
  out + "verificacion.json",
  JSON.stringify(
    {
      mode: "Producto multiempresa local, fixtures; no evidencia de IA real",
      widths,
      askRequests: asks.length,
      errors,
      checks: [
        "cifras del reporte",
        "prioridad de alertas",
        "preguntas <=500",
        "sin consulta automática",
        "borrador preservado",
        "trampa de foco y retorno a tarjeta",
        "nueva conversación limpia contexto",
        "503 y 429",
        "propuesta no ejecutada",
        "permisos sin margen",
        "errores y vacío",
        "alto contraste",
        "móvil",
      ],
    },
    null,
    2,
  ) + "\n",
);
await browser.close();
process.stdout.write(
  "Fase 2: dashboard, contexto IA, permisos, errores y responsive: PASS\n",
);
