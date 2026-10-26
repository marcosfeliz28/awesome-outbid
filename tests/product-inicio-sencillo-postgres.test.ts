// «Primeros pasos»: una empresa recién registrada guarda Configuración sin
// tocar nada, el aviso del asistente sobrevive al guardado y la primera
// cajera se crea con una contraseña temporal generada.
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it, vi } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const ENV = ["DATABASE_URL", "PRODUCT_TENANCY", "PRODUCT_PUBLIC_REGISTRATION", "PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL", "RESEND_API_BASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"];

async function port() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>(done => server.close(() => done()));
  return address.port;
}

it("empresa nueva: Configuración guarda sin tocar campos, el asistente queda marcado y la cajera recibe clave temporal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-inicio-"));
  const pgPort = await port();
  const db = new EmbeddedPostgres({
    databaseDir: directory, user: "inicio_test", password: "only_local_test",
    port: pgPort, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const previous = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
  let app: any;
  let html = "";
  try {
    await db.initialise(); await db.start(); await db.createDatabase("inicio_qa");
    process.env.DATABASE_URL = `postgresql://inicio_test:only_local_test@127.0.0.1:${pgPort}/inicio_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], { cwd: root, env: process.env, timeout: 120000 });
    Object.assign(process.env, {
      PRODUCT_TENANCY: "required", PRODUCT_PUBLIC_REGISTRATION: "enabled", PRODUCT_LEGAL_APPROVED: "confirmed",
      PRODUCT_TERMS_VERSION: "terms-test-1", PRODUCT_PRIVACY_VERSION: "privacy-test-1",
      RESEND_API_KEY: "local-test-only", NOTIFY_EMAIL_FROM: "Nexora <test@example.invalid>",
      APP_PUBLIC_URL: "https://example.invalid", RESEND_API_BASE: "https://mail.example.invalid",
    });
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
      html = JSON.parse(String(options.body)).html;
      return { ok: true };
    }));
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-secret-for-product-inicio-at-least-32-chars"), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const companyCode = "inicio-sencillo";
    const email = "duena@example.invalid";
    const password = "ClaveSegura-2026!";
    const created = await http.post("/api/auth/register").send({
      businessName: "Colmado Nuevo", ownerName: "Dueña", email, password, managerPin: "869253",
      businessType: "retail", companyCode, termsAccepted: true, privacyAccepted: true,
      termsVersion: "terms-test-1", privacyVersion: "privacy-test-1",
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const token = html.match(/#token=([a-f0-9]{64})/)?.[1];
    expect((await http.post("/api/auth/verify-email").send({ token })).status).toBe(201);
    const login = await http.post("/api/auth/login").set("x-tenant-id", companyCode).send({ login: email, password });
    expect(login.status, JSON.stringify(login.body)).toBe(201);
    const auth = `Bearer ${login.body.accessToken}`;

    // Guardar lo mismo que se leyó (Configuración sin tocar nada) funciona.
    const settings = await http.get("/api/settings").set("Authorization", auth);
    expect(settings.body).toMatchObject({ name: "Colmado Nuevo", idleDays: 60, expiryDays: 60, sessionTimeoutMinutes: 30, ncfMode: "disabled", taxIncluded: true });
    const untouched = await http.put("/api/settings").set("Authorization", auth).send(settings.body);
    expect(untouched.status, JSON.stringify(untouched.body)).toBe(200);

    // Venta al mostrador: sin cliente obligatorio y con «Consumidor final».
    expect(settings.body.requireCustomer).toBe(false);
    const customers = (await http.get("/api/customers").set("Authorization", auth)).body as { name: string }[];
    expect(customers.map(c => c.name)).toContain("Consumidor final");
    const { requireCustomer: _omitted, ...withoutCustomerKey } = settings.body;
    expect((await http.put("/api/settings").set("Authorization", auth).send(withoutCustomerKey)).status).toBe(200);
    expect((await http.get("/api/settings").set("Authorization", auth)).body.requireCustomer).toBe(false);
    expect((await http.put("/api/settings").set("Authorization", auth).send({ ...settings.body, requireCustomer: true })).status).toBe(200);
    expect((await http.get("/api/settings").set("Authorization", auth)).body.requireCustomer).toBe(true);

    // El asistente cambia el tipo de negocio y su marca sobrevive al guardado.
    const typed = await http.put("/api/settings").set("Authorization", auth).send({ ...settings.body, businessType: "beauty" });
    expect(typed.status, JSON.stringify(typed.body)).toBe(200);
    expect((await http.post("/api/onboarding").set("Authorization", auth).send({ dismissed: true })).body.dismissed).toBe(true);
    const reread = (await http.get("/api/settings").set("Authorization", auth)).body;
    expect((await http.put("/api/settings").set("Authorization", auth).send(reread)).status).toBe(200);
    expect((await http.get("/api/onboarding").set("Authorization", auth)).body).toMatchObject({ available: true, dismissed: true, businessType: "beauty" });

    // Primera cajera: rol ya sembrado y contraseña temporal generada una vez.
    const roles = (await http.get("/api/roles").set("Authorization", auth)).body as { id: string; name: string }[];
    const seller = roles.find(r => r.name === "seller");
    expect(seller).toBeTruthy();
    const cashier = await http.post("/api/users").set("Authorization", auth).send({ name: "Cajera Uno", username: "Cajera Uno", pin: "582914", roleId: seller!.id });
    expect(cashier.status, JSON.stringify(cashier.body)).toBe(201);
    expect(cashier.headers["cache-control"]).toBe("no-store");
    expect(cashier.body.temporaryPassword).toMatch(/^\d{6}$/);
    const cashierLogin = await http.post("/api/auth/login").set("x-tenant-id", companyCode).send({ login: "Cajera Uno", password: cashier.body.temporaryPassword });
    expect(cashierLogin.status, JSON.stringify(cashierLogin.body)).toBe(201);
    expect(cashierLogin.body.requiresPasswordChange).toBe(true);

    // Límite de equipos: el mensaje dice qué hacer.
    const device = (id: string) => ({ id, name: "Equipo", secret: "only-local-test-secret-123" });
    expect((await http.post("/api/terminals/register").set("Authorization", auth).send(device("00000000-0000-4000-8000-000000000201"))).status).toBe(201);
    const over = await http.post("/api/terminals/register").set("Authorization", auth).send(device("00000000-0000-4000-8000-000000000202"));
    // Sobre el cupo queda pendiente (sin 409) y el aviso dice qué hacer.
    expect(over.status, JSON.stringify(over.body)).toBe(201);
    expect(over.body.status).toBe("pending");
    expect(over.body.planLimit).toContain("Configuración → Equipos");
    // La sesión quedó en el equipo pendiente: vender desde ahí se rechaza y
    // se vuelve al equipo aprobado para seguir.
    expect((await http.post("/api/cash-sessions/open").set("Authorization", auth).send({ openingAmount: 0, registerId: "Equipo" })).body.code).toBe("TERMINAL_PENDING");
    expect((await http.post("/api/terminals/register").set("Authorization", auth).send(device("00000000-0000-4000-8000-000000000201"))).body.status).toBe("approved");
    // INI-01: a «Consumidor final» no se le vende a crédito ni contraentrega.
    const current = (await http.get("/api/settings").set("Authorization", auth)).body;
    expect((await http.put("/api/settings").set("Authorization", auth).send({ ...current, allowCreditSales: true, requireCustomer: false })).status).toBe(200);
    const category = (await http.post("/api/categories").set("Authorization", auth).send({ name: "Abarrotes" })).body;
    const product = await http.post("/api/products").set("Authorization", auth).send({
      name: "Agua", sku: "INI-01", categoryId: category.id, variants: [{ sku: "INI-01", barcode: "INI-01", price: 100, costAvg: 0 }],
    });
    expect(product.status, JSON.stringify(product.body)).toBe(201);
    const variantId = product.body.variants[0].id;
    expect((await http.post("/api/inventory/adjustments").set("Authorization", auth).send({ variantId, qty: 5, reason: "Prueba INI-01" })).status).toBe(201);
    const cash = await http.post("/api/cash-sessions/open").set("Authorization", auth).send({ openingAmount: 0, registerId: "Equipo" });
    expect(cash.status, JSON.stringify(cash.body)).toBe(201);
    const walkIn = (await http.get("/api/customers").set("Authorization", auth)).body.find((c: any) => c.name === "Consumidor final");
    const sale = (method: string, customerId: string) => http.post("/api/sales").set("Authorization", auth).send({
      offlineUuid: crypto.randomUUID(), customerId, cashSessionId: cash.body.id, items: [{ variantId, qty: 1 }],
      payments: [{ method, amount: 100 }], expectedTotal: 100,
      ...(method === "credit" ? { creditDueDate: new Date(Date.now() + 7 * 86400000).toISOString() } : {}),
    });
    for (const method of ["cod", "credit"]) {
      const refused = await sale(method, walkIn.id);
      expect(refused.status, JSON.stringify(refused.body)).toBe(400);
      expect(refused.body.message).toContain("«Consumidor final» no puede quedar debiendo");
    }
    const real = (await http.post("/api/customers").set("Authorization", auth).send({ name: "Rosa Pérez" })).body;
    const owed = await sale("cod", real.id);
    expect(owed.status, JSON.stringify(owed.body)).toBe(201);
  } finally {
    await app?.close().catch(() => undefined);
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await db.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);
