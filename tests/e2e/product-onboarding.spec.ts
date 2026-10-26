import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import type { Page } from "@playwright/test";
import { test, expect } from "./apoyo";

const root = resolve(process.cwd());
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const tsxCli = apiRequire.resolve("tsx/cli");
const viteCli = join(realpathSync(join(root, "apps/web/node_modules/vite")), "bin/vite.js");
const ExcelJS = apiRequire("exceljs");
const run = promisify(execFile);

async function freePorts(count: number) {
  const servers = Array.from({ length: count }, () => createTcpServer());
  try {
    await Promise.all(servers.map(server => new Promise<void>(done => server.listen(0, "127.0.0.1", done))));
    return servers.map(server => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Sin puerto local");
      return address.port;
    });
  } finally {
    await Promise.all(servers.map(server => new Promise<void>(done => server.close(() => done()))));
  }
}

async function healthy(url: string, label: string, child?: ReturnType<typeof spawn>, diagnostic?: () => string) {
  const until = Date.now() + 60000;
  while (Date.now() < until) {
    if (await fetch(url).then(r => r.ok).catch(() => false)) return;
    if (child?.exitCode !== null) break;
    await new Promise(done => setTimeout(done, 200));
  }
  throw new Error(`${label} no arrancó en la base y los puertos desechables. ${diagnostic?.() ?? ""}`);
}

test.describe("PC-02: asistente de una empresa nueva", () => {
  test.describe.configure({ timeout: 240000 });
  const previous = Object.fromEntries(["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL", "RESEND_API_BASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "VITE_PRODUCT_TENANCY", "VITE_PRODUCT_PUBLIC_REGISTRATION", "VITE_PRODUCT_TERMS_URL", "VITE_PRODUCT_PRIVACY_URL", "VITE_PRODUCT_TERMS_VERSION", "VITE_PRODUCT_PRIVACY_VERSION", "FITSTORE_API_PROXY", "PORT", "NODE_ENV", "JWT_SECRET"].map(key => [key, process.env[key]]));
  let dir = "";
  let pg: EmbeddedPostgres;
  let systemBin: string | undefined;
  let pgPort = 0;
  let apiPort = 0;
  let webPort = 0;
  let mailPort = 0;
  let mailHtml = "";
  let mailServer: ReturnType<typeof createServer>;
  let apiProcess: ReturnType<typeof spawn>;
  let webProcess: ReturnType<typeof spawn>;
  let apiLog = "";
  let webLog = "";

  test.beforeAll(async () => {
    test.setTimeout(240000);
    dir = await mkdtemp(join(tmpdir(), "nexora-onboarding-browser-"));
    [pgPort, apiPort, webPort, mailPort] = await freePorts(4);
    pg = new EmbeddedPostgres({ databaseDir: dir, user: "onboarding_e2e", password: "only_local_test", port: pgPort,
      persistent: false, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"], onLog: () => undefined, onError: () => undefined });
    if (process.platform === "win32") {
      const base = join(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL");
      systemBin = existsSync(base) ? readdirSync(base).map(version => join(base, version, "bin"))
        .find(path => existsSync(join(path, "initdb.exe")) && existsSync(join(path, "..", "share", "timezone", "America", "Santo_Domingo"))) : undefined;
      if (!systemBin) throw new Error("La E2E Windows exige PostgreSQL local con tzdata para un clúster descartable.");
      const pwfile = join(dir, "password.txt");
      await writeFile(pwfile, "only_local_test\n");
      await run(join(systemBin, "initdb.exe"), ["--pgdata", join(dir, "data"), "--auth=scram-sha-256", "--username=onboarding_e2e", "--pwfile", pwfile, "--encoding=UTF8", "--locale=C"], { timeout: 120000 });
      await run(join(systemBin, "pg_ctl.exe"), ["-D", join(dir, "data"), "-l", join(dir, "postgres.log"), "-o", `-p ${pgPort} -h 127.0.0.1 -c timezone=UTC`, "start"], { timeout: 120000 });
      await run(join(systemBin, "createdb.exe"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "onboarding_e2e", "onboarding_qa"], { env: { ...process.env, PGPASSWORD: "only_local_test" }, timeout: 120000 });
    } else {
      await pg.initialise(); await pg.start(); await pg.createDatabase("onboarding_qa");
    }
    process.env.DATABASE_URL = `postgresql://onboarding_e2e:only_local_test@127.0.0.1:${pgPort}/onboarding_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], { cwd: root, env: process.env, timeout: 120000 });
    mailServer = createServer((req, res) => {
      let body = "";
      req.on("data", chunk => { body += String(chunk); });
      req.on("end", () => { mailHtml = JSON.parse(body).html; res.writeHead(200, { "Content-Type": "application/json" }); res.end("{}"); });
    });
    await new Promise<void>(done => mailServer.listen(mailPort, "127.0.0.1", done));
    Object.assign(process.env, {
      PRODUCT_TENANCY: "required", PRODUCT_PUBLIC_REGISTRATION: "enabled", VITE_PRODUCT_TENANCY: "required",
      PRODUCT_LEGAL_APPROVED: "confirmed", PRODUCT_TERMS_VERSION: "terms-test-1", PRODUCT_PRIVACY_VERSION: "privacy-test-1",
      VITE_PRODUCT_PUBLIC_REGISTRATION: "enabled",
      VITE_PRODUCT_TERMS_URL: "https://example.invalid/terms", VITE_PRODUCT_PRIVACY_URL: "https://example.invalid/privacy",
      VITE_PRODUCT_TERMS_VERSION: "terms-test-1", VITE_PRODUCT_PRIVACY_VERSION: "privacy-test-1",
      RESEND_API_KEY: "local-test-only", NOTIFY_EMAIL_FROM: "Nexora <test@example.invalid>",
      APP_PUBLIC_URL: `http://127.0.0.1:${webPort}`, RESEND_API_BASE: `http://127.0.0.1:${mailPort}`,
      FITSTORE_API_PROXY: `http://127.0.0.1:${apiPort}`, PORT: String(apiPort),
      NODE_ENV: "test",
      JWT_SECRET: "onboarding-e2e-only-local-secret-1234567890",
    });
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    apiProcess = spawn(process.execPath, [tsxCli, join(root, "apps/api/src/main.ts")], { cwd: join(root, "apps/api"), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    apiProcess.stdout?.on("data", chunk => { apiLog = (apiLog + String(chunk)).slice(-4000); });
    apiProcess.stderr?.on("data", chunk => { apiLog = (apiLog + String(chunk)).slice(-4000); });
    await healthy(`http://127.0.0.1:${apiPort}/api/health`, "API", apiProcess, () => apiLog.replaceAll(process.env.DATABASE_URL || "", "<base-local>"));
    webProcess = spawn(process.execPath, [viteCli, "--host", "127.0.0.1", "--port", String(webPort), "--strictPort"], { cwd: join(root, "apps/web"), env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    webProcess.stdout?.on("data", chunk => { webLog = (webLog + String(chunk)).slice(-4000); });
    webProcess.stderr?.on("data", chunk => { webLog = (webLog + String(chunk)).slice(-4000); });
    await healthy(`http://127.0.0.1:${webPort}/`, "Web", webProcess, () => webLog);
  });

  test.afterAll(async () => {
    webProcess?.kill(); apiProcess?.kill();
    if (mailServer?.listening) await new Promise<void>(done => mailServer.close(() => done()));
    if (systemBin) await run(join(systemBin, "pg_ctl.exe"), ["-D", join(dir, "data"), "-m", "immediate", "stop"], { timeout: 30000 }).catch(() => undefined);
    else await pg?.stop().catch(() => undefined);
    if (dir) await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  });

  // Alta por la pantalla pública, confirmación del correo y entrada.
  // INI-03: `clear` en false reutiliza el navegador de otra empresa, como en la vida real.
  async function registerAndLogin(page: Page, web: string, clear = true) {
    await page.goto(web);
    if (clear) await page.evaluate(() => localStorage.clear());
    const slug = `e2e-${randomUUID().slice(0, 8)}`;
    const email = `${slug}@example.invalid`;
    const password = "ClavePiloto-2026!";
    await page.goto(`${web}/registro`);
    await page.getByLabel("Nombre del negocio").fill("Tienda E2E");
    await page.getByLabel("Tu nombre").fill("Dueña E2E");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByLabel("PIN de gerente").fill("869253");
    await page.getByLabel("Tipo de negocio").selectOption("retail");
    await page.getByLabel("Código de empresa").fill(slug);
    await page.getByRole("checkbox", { name: /Acepto los términos de servicio/ }).check();
    await page.getByRole("checkbox", { name: /Acepto la política de privacidad/ }).check();
    await page.getByRole("button", { name: "Crear empresa" }).click();
    await expect(page.getByRole("status")).toBeVisible();
    const token = mailHtml.match(/#token=([a-f0-9]{64})/)?.[1];
    expect(token).toHaveLength(64);
    await page.goto(`${web}/confirmar-correo#token=${token}`);
    await page.getByRole("button", { name: "Confirmar correo" }).click();
    await expect(page.getByRole("status")).toContainText("confirmado");
    await page.goto(web);
    await page.getByLabel("Código de empresa").fill(slug);
    await page.getByLabel("Usuario").fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    const loginResponse = page.waitForResponse(response => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Entrar a mi empresa" }).click();
    const browserLogin = await loginResponse;
    expect(browserLogin.ok()).toBe(true);
    const auth = { Authorization: `Bearer ${(await browserLogin.json()).accessToken}` };
    return auth;
  }

  test("tres negocios ficticios completan registro, productos, caja, venta y cierre en PWA", async ({ page }) => {
    const begun = performance.now();
    const web = `http://127.0.0.1:${webPort}`;
    for (let business = 1; business <= 3; business++) {
    // Las tres empresas comparten navegador sin limpiarlo (INI-03).
    const auth = await registerAndLogin(page, web, business === 1);
    await expect(page.getByRole("heading", { name: "Primeros pasos" })).toBeVisible();
    // N-03: interfaz real con API/modelo falsos; no consume cuota ni clave.
    await page.route("**/api/assistant/usage", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ usadas: 12, limite: 30, mes: "2026-10" }) }));
    await page.route("**/api/assistant/ask", async route => {
      expect(["¿Cómo anulo una factura?", "Pide anular FS-0123"]).toContain(route.request().postDataJSON().messages.at(-1).content);
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ answer: "Abre la factura y solicita la anulación.", usage: { input: 10, output: 10 }, remaining: 17, proposal: { factura: "FS-0123", motivo: "Cobro duplicado confirmado" } }) });
    });
    let sentVoid = 0;
    await page.route("**/api/sales?q=FS-0123", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: "00000000-0000-4000-8000-000000000123", number: "FS-0123" }]) }));
    await page.route("**/api/sales/00000000-0000-4000-8000-000000000123/void-requests", route => {
      sentVoid++;
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "pending" }) });
    });
    await page.setViewportSize({ width: 320, height: 700 });
    await page.getByRole("button", { name: "Pregúntale a Nexora" }).click();
    await expect(page.getByRole("dialog", { name: "Pregúntale a Nexora" })).toBeVisible();
    await expect(page.getByLabel("Tu pregunta")).toBeFocused();
    const panelBounds = await page.getByRole("dialog", { name: "Pregúntale a Nexora" }).boundingBox();
    expect(panelBounds?.x).toBeGreaterThanOrEqual(0);
    expect((panelBounds?.x ?? 0) + (panelBounds?.width ?? 0)).toBeLessThanOrEqual(320);
    await expect(page.getByText("12 de 30 este mes")).toBeVisible();
    await page.getByRole("button", { name: "¿Cómo anulo una factura?" }).click();
    await expect(page.getByText("Abre la factura y solicita la anulación.")).toBeVisible();
    await expect(page.getByText("13 de 30 este mes")).toBeVisible();
    await expect(page.getByText(/¿Enviar solicitud de anulación de FS-0123/)).toBeVisible();
    expect(sentVoid).toBe(0);
    await page.getByRole("button", { name: "No, cancelar" }).click();
    expect(sentVoid).toBe(0);
    await page.getByLabel("Tu pregunta").fill("Pide anular FS-0123");
    await page.getByRole("button", { name: "Enviar pregunta" }).click();
    await page.getByRole("button", { name: "Sí, enviar solicitud" }).click();
    await expect(page.getByText("Solicitud de anulación de FS-0123 pendiente de revisión.")).toBeVisible();
    expect(sentVoid).toBe(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Pregúntale a Nexora" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pregúntale a Nexora" })).toBeFocused();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.unroute("**/api/assistant/usage");
    await page.unroute("**/api/assistant/ask");
    await page.unroute("**/api/sales?q=FS-0123");
    await page.unroute("**/api/sales/00000000-0000-4000-8000-000000000123/void-requests");
    await page.getByLabel("Nombre del negocio").fill("Mi Tienda Preparada");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await expect(page.getByText("Paso 2 de 2 · Tu primer producto")).toBeVisible();
    await page.getByRole("button", { name: "Saltar por ahora" }).click();
    await expect(page).toHaveURL(/#dashboard$/);
    // RNC y logo ya no están en el asistente: se completan después y salen en el ticket.
    const { logo: _logo, ...current } = await (await page.request.get(`${web}/api/settings`, { headers: auth })).json();
    expect((await page.request.put(`${web}/api/settings`, { headers: auth, data: { ...current, legalId: "101010101" } })).ok()).toBe(true);
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lNcAAAAASUVORK5CYII=", "base64");
    expect((await page.request.post(`${web}/api/settings/logo`, { headers: auth, multipart: { file: { name: "marca.png", mimeType: "image/png", buffer: png } } })).ok()).toBe(true);
    await page.reload();
    await page.evaluate(() => { window.print = () => undefined; });
    const checklist = page.getByRole("region", { name: "Completa tu tienda" });
    await checklist.getByText(/Completa tu tienda cuando tengas tiempo \(opcional\) · 2 pendientes/).click();
    await expect(checklist.getByText("✓ Sube tu logo y tu RNC para los tickets")).toBeVisible();
    await checklist.getByRole("button", { name: "Imprimir ticket de prueba" }).click();
    await expect(page.locator(".thermal-print.w80")).toContainText("Mi Tienda Preparada");
    await expect(page.locator(".thermal-print.w80")).toContainText("RNC: 101010101");
    await expect(page.locator(".thermal-print.w80 .tp-logo")).toHaveAttribute("src", /^data:image\/png;base64,/);
    await expect(page.locator(".thermal-print.w80")).toContainText("NO ES UNA VENTA · DOCUMENTO NO FISCAL");
    // El tipo «Tienda / colmado» trae sus categorías sin preguntar.
    const categories = (await (await page.request.get(`${web}/api/categories`, { headers: auth })).json()).filter((c: any) => c.name === "Abarrotes");
    expect(categories).toHaveLength(1);
    await page.goto(`${web}/#products`);
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Productos");
    sheet.addRow(["Nombre", "SKU", "ID categoría", "Código de barras", "Precio", "Costo"]);
    for (let i = 1; i <= 3; i++) sheet.addRow([`Artículo E2E ${business}-${i}`, `E2E-${business}-${i}`, categories[0].id, `BE2E-${business}-${i}`, 20, 10]);
    await page.getByRole("button", { name: "Más" }).click();
    await page.locator('input[type="file"][accept=".xlsx"]').setInputFiles({ name: "tres-productos.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await book.xlsx.writeBuffer()) });
    await expect(page.getByText("3 productos importados.")).toBeVisible();
    const importedProducts = await (await page.request.get(`${web}/api/products`, { headers: auth })).json();
    expect(importedProducts.items).toHaveLength(3);
    if (business > 1) expect(JSON.stringify(importedProducts)).not.toContain(`Artículo E2E ${business - 1}-1`);
    const variantId = importedProducts.items.find((product: any) => product.name === `Artículo E2E ${business}-1`)?.variants[0]?.id;
    expect(variantId).toBeTruthy();
    await page.goto(`${web}/#cash`);
    await page.getByRole("button", { name: "Abrir caja", exact: true }).click();
    await page.getByLabel("Efectivo inicial").fill("100");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Caja abierta", { exact: true })).toBeVisible();
    // La API de prueba usa la misma sesión del navegador y su única terminal;
    // no crea un segundo equipo que sobrepase la cuota Autoservicio.
    const stock = await page.request.post(`${web}/api/inventory/adjustments`, {
      headers: auth, data: { variantId, qty: 3, reason: "Existencia inicial de la empresa ficticia E2E" },
    });
    expect(stock.ok(), await stock.text()).toBe(true);
    const customer = await page.request.post(`${web}/api/customers`, {
      headers: auth, data: { name: "Cliente ficticio E2E" },
    });
    expect(customer.ok(), await customer.text()).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Punto de venta", exact: true }).click();
    if (business > 1) {
      await page.getByLabel("Buscar productos").fill(`Artículo E2E ${business - 1}-1`);
      // La búsqueda aproximada puede ofrecer artículos propios parecidos;
      // lo prohibido es que aparezca el artículo del negocio anterior.
      await expect(page.locator(".product-card", { hasText: `Artículo E2E ${business - 1}-1` })).toHaveCount(0);
    }
    await page.getByLabel("Buscar productos").fill(`Artículo E2E ${business}-1`);
    await page.locator(".product-card", { hasText: `Artículo E2E ${business}-1` }).click();
    await expect(page.locator(".cart-items")).toContainText(`Artículo E2E ${business}-1`);
    await page.locator(".customer-selector").click();
    await page.locator(".customer-list button", { hasText: "Cliente ficticio E2E" }).click();
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await expect(page.getByRole("dialog", { name: "Todo listo para cobrar" })).toBeVisible();
    await page.getByLabel("Monto del pago").fill("20");
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(page.getByText("Venta registrada", { exact: true })).toBeVisible();
    const sales = await (await page.request.get(`${web}/api/sales`, { headers: auth })).json();
    expect(sales).toHaveLength(1);
    expect(Number(sales[0].total)).toBe(20);
    await page.getByRole("button", { name: "Nueva venta", exact: true }).click();
    await page.getByRole("button", { name: "Caja", exact: true }).click();
    await page.getByRole("button", { name: "Cerrar y arquear" }).first().click();
    const closeDialog = page.getByRole("dialog", { name: "Cuadre y cierre de caja" });
    await expect(closeDialog).toBeVisible();
    await closeDialog.getByLabel("Cantidad de 100", { exact: true }).fill("1");
    await closeDialog.getByLabel("Cantidad de 20", { exact: true }).fill("1");
    await closeDialog.getByLabel(/Tarjeta declarada/).fill("0");
    await closeDialog.getByRole("checkbox", { name: /Confirmo que conté efectivo/ }).check();
    await closeDialog.getByRole("button", { name: "Cerrar caja e imprimir cuadre" }).click();
    await expect(page.locator(".thermal-print")).toContainText("FIN DEL CUADRE");
    const sessions = await (await page.request.get(`${web}/api/cash-sessions`, { headers: auth })).json();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].closedAt).toBeTruthy();
    const report = await page.request.get(`${web}/api/reports/sales?format=xlsx`, { headers: auth });
    expect(report.ok(), `Negocio ${business}: informe de jornada`).toBe(true);
    expect(Buffer.from(await report.body()).subarray(0, 2).toString()).toBe("PK");
    const printDialog = page.getByRole("dialog", { name: "Cuadre de Caja" });
    await expect(printDialog).toBeVisible();
    await printDialog.getByRole("button", { name: "Listo", exact: true }).click();
    await expect(printDialog).toBeHidden();
    if (business === 1) {
      await page.goto(`${web}/#settings`);
      await page.getByRole("button", { name: "Avanzado" }).click();
      const support = page.getByRole("region", { name: "Soporte de Nexora" });
      await expect(support).toContainText("Acceso apagado");
      await support.getByLabel("Duración del acceso").selectOption("24h");
      await support.getByLabel("Leí lo que soporte podrá ver y lo permito.").check();
      await support.getByRole("button", { name: "Permitir soporte de Nexora" }).click();
      await expect(support).toContainText("Contraseña, visible solo ahora");
      await expect(page.getByText(/Soporte de Nexora con acceso hasta/)).toBeVisible();
      await page.getByRole("button", { name: "Quitar acceso" }).first().click();
      await expect(support).toContainText("Acceso apagado");
      await expect(page.getByText(/Soporte de Nexora con acceso hasta/)).toHaveCount(0);
    }
    await page.locator("button.account").click();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page.getByLabel("Código de empresa")).toBeVisible();
    }
    expect(performance.now() - begun).toBeLessThan(30 * 60 * 1000);
  });
  test("Primeros pasos: una dueña nueva vende a 390 px en 2 pasos, sin RNC ni cajeras", async ({ page }) => {
    const web = `http://127.0.0.1:${webPort}`;
    await page.setViewportSize({ width: 390, height: 844 });
    const auth = await registerAndLogin(page, web);
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "sin desplazamiento horizontal").toBeLessThanOrEqual(0);
    const seen = new Set<string>();
    const at = async (n: number) => {
      await expect(page.getByText(new RegExp(`^Paso ${n} de 2`))).toBeVisible();
      seen.add(String(n));
      await fits();
    };
    await expect(page.getByRole("heading", { name: "Primeros pasos" })).toBeVisible();
    await at(1);
    await expect(page.getByLabel("Nombre del negocio")).toHaveValue("Tienda E2E");
    await expect(page.getByLabel("Tipo de negocio")).toHaveValue("retail");
    await expect(page.getByLabel("RNC")).toHaveCount(0);
    await expect(page.getByLabel(/cajera/i)).toHaveCount(0);
    await page.getByRole("button", { name: "RD$ 1,000" }).click();
    await expect(page.getByRole("button", { name: "RD$ 1,000" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByLabel(/efectivo abres tu caja/)).toHaveValue("1000");
    await page.getByRole("button", { name: "Siguiente" }).click();
    await at(2);
    // INI-08: el foco pasa al título del paso nuevo.
    await expect(page.getByRole("heading", { name: "Tu primer producto" })).toBeFocused();
    await page.getByLabel("Nombre del producto").fill("Agua 500 ml");
    await page.getByLabel("Precio RD$").fill("25");
    await page.getByLabel("¿Cuántos tienes?").fill("10");
    // INI-04: si la existencia falla después de crear el producto, el reintento no lo duplica.
    let failOnce = true;
    await page.route("**/api/inventory/adjustments", route => {
      if (!failOnce) return route.continue();
      failOnce = false;
      return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ message: "Servicio no disponible" }) });
    });
    await page.getByRole("button", { name: "Ir a cobrar mi primera venta →" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: "Ir a cobrar mi primera venta →" }).click();
    // En la caja, abierta y con los productos para vender.
    await expect(page.getByLabel("Buscar productos")).toBeVisible();
    await expect(page.getByRole("button", { name: /Abre tu caja para comenzar/ })).toHaveCount(0);
    await page.getByLabel("Buscar productos").fill("Agua 500");
    await page.locator(".product-card", { hasText: "Agua 500 ml" }).click();
    // Sin «Pedir cliente» la venta va a «Consumidor final» sin preguntar.
    await page.getByRole("button", { name: /Cobrar/ }).click();
    await expect(page.getByRole("dialog", { name: "Todo listo para cobrar" })).toBeVisible();
    await page.getByLabel("Monto del pago").fill("25");
    await page.getByRole("button", { name: "Agregar pago" }).click();
    await page.getByRole("button", { name: "Finalizar venta" }).click();
    await expect(page.getByText("Venta registrada", { exact: true })).toBeVisible();
    expect(seen.size).toBe(2);
    // La venta quedó a nombre de «Consumidor final» sin que nadie lo eligiera.
    const walkIn = (await (await page.request.get(`${web}/api/customers`, { headers: auth })).json())
      .find((c: any) => c.name === "Consumidor final");
    const sold = await (await page.request.get(`${web}/api/sales`, { headers: auth })).json();
    expect((sold.items ?? sold).map((s: any) => s.customerId)).toEqual([walkIn.id]);
    const settings = await (await page.request.get(`${web}/api/settings`, { headers: auth })).json();
    expect(settings).toMatchObject({ ncfMode: "disabled", legalId: "", taxIncluded: true, receiptWidth: "80" });
    expect((await (await page.request.get(`${web}/api/onboarding`, { headers: auth })).json()).dismissed).toBe(true);
    const sessions = await (await page.request.get(`${web}/api/cash-sessions`, { headers: auth })).json();
    expect(sessions.filter((s: any) => !s.closedAt).map((s: any) => Number(s.openingAmount))).toEqual([1000]);
    const products = await (await page.request.get(`${web}/api/products`, { headers: auth })).json();
    expect(products.items.map((p: any) => p.name)).toEqual(["Agua 500 ml"]);
    expect(Number(products.items[0].variants[0].stock)).toBe(9);

    // Lo opcional queda en una tarjeta del resumen que no bloquea.
    await page.goto(`${web}/#dashboard`);
    await expect(page.getByText("Completa tu tienda cuando tengas tiempo (opcional) · 3 pendientes")).toBeVisible();

    // En el celular «Pregúntale a Nexora» no tapa la barra de Mercancía.
    await page.goto(`${web}/#dashboard`);
    const bar = await page.locator(".goods-mobile-bar").boundingBox();
    const launcher = await page.getByRole("button", { name: "Pregúntale a Nexora" }).boundingBox();
    expect(launcher!.y + launcher!.height).toBeLessThanOrEqual(bar!.y);

    // Configuración arranca en «Básico»: sin RNC mientras el NCF esté apagado.
    await page.goto(`${web}/#settings`);
    await expect(page.getByRole("button", { name: "Básico" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Editar configuración" }).click();
    const form = page.getByRole("dialog", { name: "Configuración del negocio" });
    await expect(form.getByLabel("Nombre del negocio")).toBeVisible();
    await expect(form.getByLabel("Días sin rotación")).toHaveCount(0);
    await expect(form.getByLabel("RNC", { exact: true })).toHaveCount(0);
    // INI-02: «prepared» no emite NCF y la pantalla no lo promete.
    await expect(form.getByText(/Doy comprobante fiscal/)).toHaveCount(0);
    await form.getByLabel("Preparar solicitudes de NCF con RNC").check();
    await expect(form.getByText(/No emite NCF/)).toBeVisible();
    await expect(form.getByLabel("RNC", { exact: true })).toBeVisible();
    await form.getByLabel("Preparar solicitudes de NCF con RNC").uncheck();
    await form.getByLabel("Dirección").fill("Calle 1, Santo Domingo");
    await form.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page.getByText("Cambios guardados.")).toBeVisible();
    expect(await (await page.request.get(`${web}/api/settings`, { headers: auth })).json()).toMatchObject({ address: "Calle 1, Santo Domingo", ncfMode: "disabled", idleDays: 60 });
    await page.getByRole("button", { name: "Avanzado" }).click();
    await page.getByRole("button", { name: "Editar configuración" }).click();
    await expect(page.getByRole("dialog", { name: "Configuración del negocio" }).getByLabel("Días sin rotación")).toBeVisible();
  });
});
