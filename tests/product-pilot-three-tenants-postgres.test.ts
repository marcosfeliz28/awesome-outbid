import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it, vi } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const ExcelJS = apiRequire("exceljs");
const pgRequire = createRequire(join(realpathSync(join(root, "node_modules/embedded-postgres")), "package.json"));
const run = promisify(execFile);

async function freePort() {
  const server = createServer();
  await new Promise<void>(done => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>(done => server.close(() => done()));
  return address.port;
}

const binaryParser = (response: NodeJS.ReadableStream, done: (error: Error | null, body?: Buffer) => void) => {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  response.on("end", () => done(null, Buffer.concat(chunks)));
  response.on("error", done);
};

/** Puerta de producto: tres negocios inventados usan la API real sobre PostgreSQL. */
it("tres empresas se registran y trabajan sin compartir catálogo, caja ni ventas; la suspensión conserva lectura", async () => {
  const dir = await mkdtemp(join(tmpdir(), "nexora-pilot-"));
  const pgPort = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dir, user: "pilot_test", password: "only_local_test", port: pgPort,
    persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const envKeys = ["DATABASE_URL", "PRODUCT_TENANCY", "RESEND_API_KEY", "NOTIFY_EMAIL_FROM", "APP_PUBLIC_URL", "RESEND_API_BASE", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "PRODUCT_PUBLIC_REGISTRATION", "PRODUCT_LEGAL_APPROVED", "PRODUCT_TERMS_VERSION", "PRODUCT_PRIVACY_VERSION"];
  const prior = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  let app: any;
  let sql: any;
  let mailHtml = "";
  let systemBin: string | undefined;
  const onboardingStartedAt = performance.now();
  try {
    // El PostgreSQL embebido de Windows no trae America/Santo_Domingo.
    // Levantamos un clúster desechable con la instalación local completa;
    // nunca conectamos con la base/puerto de una tienda.
    if (process.platform === "win32") {
      const base = join(process.env.ProgramFiles || "C:\\Program Files", "PostgreSQL");
      systemBin = existsSync(base) ? readdirSync(base)
        .map(version => join(base, version, "bin"))
        .find(path => existsSync(join(path, "initdb.exe")) && existsSync(join(path, "..", "share", "timezone", "America", "Santo_Domingo"))) : undefined;
      if (!systemBin) throw new Error("Esta prueba en Windows exige PostgreSQL local con tzdata, solo para iniciar un clúster descartable.");
      const passwordFile = join(dir, "password.txt");
      await writeFile(passwordFile, "only_local_test\n");
      await run(join(systemBin, "initdb.exe"), ["--pgdata", join(dir, "data"), "--auth=scram-sha-256", "--username=pilot_test", "--pwfile", passwordFile, "--encoding=UTF8", "--locale=C"], { timeout: 120000 });
      await run(join(systemBin, "pg_ctl.exe"), ["-D", join(dir, "data"), "-l", join(dir, "postgres.log"), "-o", `-p ${pgPort} -h 127.0.0.1 -c timezone=UTC`, "start"], { timeout: 120000 });
      await run(join(systemBin, "createdb.exe"), ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "pilot_test", "pilot_qa"], { env: { ...process.env, PGPASSWORD: "only_local_test" }, timeout: 120000 });
    } else {
      await pg.initialise(); await pg.start(); await pg.createDatabase("pilot_qa");
    }
    process.env.DATABASE_URL = `postgresql://pilot_test:only_local_test@127.0.0.1:${pgPort}/pilot_qa`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: process.env, timeout: 120000,
    });
    process.env.PRODUCT_TENANCY = "required";
    process.env.PRODUCT_PUBLIC_REGISTRATION = "enabled";
    process.env.PRODUCT_LEGAL_APPROVED = "confirmed";
    process.env.PRODUCT_TERMS_VERSION = "terms-test-1";
    process.env.PRODUCT_PRIVACY_VERSION = "privacy-test-1";
    process.env.RESEND_API_KEY = "local-test-only";
    process.env.NOTIFY_EMAIL_FROM = "Nexora <test@example.invalid>";
    process.env.APP_PUBLIC_URL = "https://example.invalid";
    process.env.RESEND_API_BASE = "https://mail.example.invalid";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options: RequestInit) => {
      mailHtml = JSON.parse(String(options.body)).html;
      return { ok: true };
    }));
    const { NestFactory } = apiRequire("@nestjs/core");
    app = await NestFactory.create(createAppModule("test-pilot-secret-at-least-32-characters"), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    sql = systemBin ? new (pgRequire("pg").Client)({ host: "127.0.0.1", port: pgPort, user: "pilot_test", password: "only_local_test", database: "pilot_qa" })
      : pg.getPgClient("pilot_qa", "127.0.0.1");
    await sql.connect();
    const http = supertest(app.getHttpServer());
    const owners: Array<{ slug: string; token: string; tenantId: string; productIds: string[]; variantIds: string[]; cashId: string; saleId: string }> = [];
    for (const [index, slug] of ["piloto-abarrotes", "piloto-ropa", "piloto-ferreteria"].entries()) {
      const email = `piloto-${index}@example.invalid`;
      const password = "ClavePiloto-2026!";
      const registration = await http.post("/api/auth/register").send({
        businessName: `Empresa ficticia ${index + 1}`, ownerName: `Dueña ficticia ${index + 1}`,
        email, password, managerPin: "869253", businessType: "retail", companyCode: slug,
        termsAccepted: true, privacyAccepted: true,
        termsVersion: "terms-test-1", privacyVersion: "privacy-test-1",
      });
      expect(registration.status, `${slug}: ${JSON.stringify(registration.body)}`).toBe(201);
      const emailToken = mailHtml.match(/#token=([a-f0-9]{64})/)?.[1];
      expect(emailToken, `${slug}: correo de verificación`).toHaveLength(64);
      expect((await http.post("/api/auth/login").set("x-tenant-id", slug).send({ login: email, password })).status).toBe(403);
      expect((await http.post("/api/auth/verify-email").send({ token: emailToken })).status).toBe(201);
      const login = await http.post("/api/auth/login").set("x-tenant-id", slug).send({ login: email, password });
      expect(login.status, `${slug}: ${JSON.stringify(login.body)}`).toBe(201);
      const token = `Bearer ${login.body.accessToken}`;
      const tenantId = login.body.user.tenantId as string;
      expect((await http.get("/api/onboarding").set("Authorization", token)).body.products).toBe(0);
      const profile = await http.post("/api/onboarding/profile").set("Authorization", token)
        .send({ name: `Empresa ficticia ${index + 1}`, legalId: "", modules: ["sales", "inventory"] });
      expect(profile.status, `${slug}: ${JSON.stringify(profile.body)}`).toBe(201);
      expect((await http.get("/api/onboarding").set("Authorization", token)).body.selectedModules)
        .toEqual(["sales", "inventory"]);
      const terminalId = randomUUID();
      const terminal = await http.post("/api/terminals/register").set("Authorization", token)
        .send({ id: terminalId, name: `Caja ficticia ${index + 1}`, secret: `local-pilot-secret-${terminalId}` });
      expect(terminal.status, `${slug}: ${JSON.stringify(terminal.body)}`).toBe(201);
      const category = await http.post("/api/categories").set("Authorization", token).send({ name: `Categoría ${index + 1}` });
      expect(category.status).toBe(201);
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Productos");
      sheet.addRow(["Nombre", "SKU", "ID categoría", "Código de barras", "Precio", "Costo"]);
      for (let item = 1; item <= 3; item++)
        sheet.addRow([`Artículo ${index + 1}-${item}`, `P${index + 1}-${item}`, category.body.id, `B${index + 1}-${item}`, 20, 10]);
      const imported = await http.post("/api/products/import").set("Authorization", token)
        .attach("file", Buffer.from(await book.xlsx.writeBuffer()), "catalogo.xlsx");
      expect(imported.status, `${slug}: ${JSON.stringify(imported.body)}`).toBe(201);
      expect(imported.body.imported).toBe(3);
      const listed = await http.get("/api/products").set("Authorization", token);
      expect(listed.status).toBe(200);
      expect(listed.body.items).toHaveLength(3);
      const productIds = listed.body.items.map((item: any) => item.id as string);
      const variantIds = listed.body.items.map((item: any) => item.variants[0].id as string);
      const stock = await http.post("/api/inventory/adjustments").set("Authorization", token)
        .send({ variantId: variantIds[0], qty: 3, reason: "Inventario inicial de piloto ficticio" });
      expect(stock.status, `${slug}: ${JSON.stringify(stock.body)}`).toBe(201);
      const customer = await http.post("/api/customers").set("Authorization", token)
        .send({ name: `Cliente ficticio ${index + 1}` });
      expect(customer.status).toBe(201);
      const cash = await http.post("/api/cash-sessions/open").set("Authorization", token).send({ openingAmount: 100 });
      expect(cash.status, `${slug}: ${JSON.stringify(cash.body)}`).toBe(201);
      const sale = await http.post("/api/sales").set("Authorization", token).send({
        offlineUuid: randomUUID(), customerId: customer.body.id, cashSessionId: cash.body.id,
        items: [{ variantId: variantIds[0], qty: 1 }], payments: [{ method: "cash", amount: 20 }],
      });
      expect(sale.status, `${slug}: ${JSON.stringify(sale.body)}`).toBe(201);
      expect(Number(sale.body.total)).toBe(20);
      const dayReport = await http.get("/api/reports/sales?format=xlsx").set("Authorization", token)
        .buffer(true).parse(binaryParser);
      expect(dayReport.status, `${slug}: informe de la jornada`).toBe(200);
      expect((dayReport.body as Buffer).subarray(0, 2).toString()).toBe("PK");
      const closed = await http.post(`/api/cash-sessions/${cash.body.id}/close`).set("Authorization", token)
        .send({ countedCash: 120, countedCard: 0, countedTransfer: 0, notes: "Cierre del día piloto" });
      expect(closed.status, `${slug}: ${JSON.stringify(closed.body)}`).toBe(201);
      expect((await http.get("/api/cash-sessions").set("Authorization", token)).body[0].closedAt).toBeTruthy();
      expect((await http.get("/api/onboarding").set("Authorization", token)).body.products).toBe(3);
      // Cronómetro del flujo real de API/PG: registro, correo, inicio, tres productos,
      // primera caja y primera venta. No mide la destreza humana en el navegador.
      expect(performance.now() - onboardingStartedAt).toBeLessThan(30 * 60 * 1000);
      owners.push({ slug, token, tenantId, productIds, variantIds, cashId: cash.body.id, saleId: sale.body.id });
    }
    expect(new Set(owners.map(owner => owner.tenantId)).size).toBe(3);
    // Los números de factura pueden repetirse entre empresas, pero ninguna
    // puede consultar el artículo, la caja o la venta ajena.
    expect((await sql.query(`SELECT number FROM "Sale" WHERE "tenantId"=$1`, [owners[0].tenantId])).rows)
      .toEqual((await sql.query(`SELECT number FROM "Sale" WHERE "tenantId"=$1`, [owners[1].tenantId])).rows);
    for (let index = 0; index < owners.length; index++) {
      const own = owners[index];
      const foreign = owners[(index + 1) % owners.length];
      const products = await http.get("/api/products").set("Authorization", own.token);
      expect(products.body.items).toHaveLength(3);
      expect(JSON.stringify(products.body)).not.toContain(`Artículo ${((index + 1) % owners.length) + 1}-1`);
      expect((await http.get(`/api/products/${foreign.productIds[0]}`).set("Authorization", own.token)).status).toBe(404);
      expect((await http.get("/api/sales").set("Authorization", own.token)).body).toHaveLength(1);
      expect((await http.get("/api/cash-sessions").set("Authorization", own.token)).body).toHaveLength(1);
      expect((await sql.query(`SELECT count(*)::int AS n FROM "Sale" WHERE "tenantId"=$1`, [own.tenantId])).rows[0].n).toBe(1);
    }
    const suspended = owners[0];
    await sql.query(`UPDATE "Tenant" SET "trialEndsAt"=now()-interval '8 days', "pastDueAt"=now()-interval '8 days', status='past_due' WHERE id=$1`, [suspended.tenantId]);
    expect((await http.get("/api/tenant/status").set("Authorization", suspended.token)).body.status).toBe("suspended");
    expect((await http.get("/api/products").set("Authorization", suspended.token)).status).toBe(200);
    expect((await http.get("/api/sales").set("Authorization", suspended.token)).status).toBe(200);
    const suspendedExport = await http.get("/api/reports/sales?format=xlsx")
      .set("Authorization", suspended.token).buffer(true).parse(binaryParser);
    expect(suspendedExport.status, "Una empresa suspendida conserva la exportación de sus datos").toBe(200);
    expect((suspendedExport.body as Buffer).subarray(0, 2).toString()).toBe("PK");
    expect((await http.post("/api/categories").set("Authorization", suspended.token).send({ name: "Prohibida" })).status).toBe(403);
    expect((await http.post("/api/sales").set("Authorization", suspended.token).send({})).status).toBe(403);
    expect((await http.post("/api/cash-sessions/open").set("Authorization", suspended.token).send({ openingAmount: 100 })).status).toBe(403);
    expect((await http.get("/api/tenant/status").set("Authorization", owners[1].token)).body.status).toBe("trial");
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    if (systemBin) await run(join(systemBin, "pg_ctl.exe"), ["-D", join(dir, "data"), "-m", "immediate", "stop"], { timeout: 30000 }).catch(() => undefined);
    else await pg.stop().catch(() => undefined);
    await rm(dir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 240000);
