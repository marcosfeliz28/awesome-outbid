import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { inflateSync } from "node:zlib";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";
import { pdfValue } from "../apps/api/src/reports";
import { businessDate } from "../packages/shared/src/index";

// Auditoría de reportes en vivo (25-oct): cada arreglo con su prueba sobre
// PostgreSQL real. NEXORA_TEST_PG_URL usa un servidor existente; si no, uno
// embebido. La base se borra al terminar.
const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const tenant = "00000000-0000-0000-0000-000000000001";
const DB = "nexora_reportes_arreglos";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}
// Texto real del PDF (cadenas hexadecimales de PDFKit, inflando los streams).
function pdfText(pdf: Buffer) {
  const raw = pdf.toString("latin1");
  const text: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)) {
    const dictionary = raw.slice(Math.max(0, match.index! - 250), match.index);
    let content = Buffer.from(match[1], "latin1");
    if (dictionary.includes("/FlateDecode")) {
      try {
        content = inflateSync(content);
      } catch {
        continue;
      }
    }
    for (const hex of content.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      text.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return text.join("");
}

const external = process.env.NEXORA_TEST_PG_URL;
let dataDir: string | null = null;
let postgres: any = null;
let sql: any;
let app: any;
let http: ReturnType<typeof supertest>;
let token = "";
let cashId = "";
const ids: Record<string, string> = {};
const saved = Object.fromEntries(
  [
    "DATABASE_URL",
    "PRODUCT_TENANCY",
    "TELEGRAM_BOT_TOKEN",
    "RESEND_API_KEY",
    "NEXORA_RETENTION",
  ].map((name) => [name, process.env[name]]),
);
const today = businessDate(new Date());
const daysAgo = (n: number) =>
  new Date(Date.parse(today + "T12:00:00Z") - n * 86_400_000)
    .toISOString()
    .slice(0, 10);
const get = async (path: string) => {
  const r = await http.get("/api" + path).set("Authorization", token);
  expect(r.status, path + " " + JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const post = async (path: string, body: object, status = 201) => {
  const r = await http
    .post("/api" + path)
    .set("Authorization", token)
    .send(body);
  expect(r.status, path + " " + JSON.stringify(r.body)).toBe(status);
  return r.body;
};
const sell = (payments: object[], extra: Record<string, unknown> = {}) =>
  post("/sales", {
    offlineUuid: randomUUID(),
    customerId: ids.customer,
    cashSessionId: cashId,
    items: [{ variantId: ids.variant, qty: 1 }],
    payments,
    ...extra,
  });
const settings = (data: object) =>
  sql.query(
    `INSERT INTO "Settings" ("tenantId",id,data,"updatedAt") VALUES ($1,'main',$2,now())
     ON CONFLICT ("tenantId",id) DO UPDATE SET data=EXCLUDED.data`,
    [tenant, JSON.stringify(data)],
  );
const range = `?from=${today}&to=${today}`;

beforeAll(async () => {
  const port = await freePort();
  let url: string;
  if (external) {
    const admin = new Client({ connectionString: external });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${DB}"`);
    await admin.end();
    const target = new URL(external);
    target.pathname = "/" + DB;
    url = target.toString();
  } else {
    dataDir = await mkdtemp(join(tmpdir(), "nexora-reportes-"));
    postgres = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "rep_test",
      password: "rep_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("rep_qa");
    url = `postgresql://rep_test:rep_test_only@127.0.0.1:${port}/rep_qa`;
  }
  await run(
    process.execPath,
    [
      prismaCli,
      "migrate",
      "deploy",
      "--schema",
      join(root, "apps/api/prisma/schema.prisma"),
    ],
    { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120_000 },
  );
  sql = new Client({ connectionString: url });
  await sql.connect();
  await sql.query(`UPDATE "Tenant" SET plan='pro'`);
  const [role, user, terminal, session, category, product] = [
    0, 0, 0, 0, 0, 0,
  ].map(() => randomUUID());
  ids.user = user;
  ids.customer = randomUUID();
  ids.variant = randomUUID();
  await sql.query(
    `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
    [role, tenant],
  );
  await sql.query(
    `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,'Ana Cajera','ana@example.invalid','test','test',$2,now(),$3)`,
    [user, role, tenant],
  );
  await sql.query(
    `INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,'Caja 1','main',now(),'test',$2)`,
    [terminal, tenant],
  );
  await sql.query(
    `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
    [session, user, terminal, tenant],
  );
  await sql.query(
    `INSERT INTO "Customer" (id,name,"legalId",phone,"updatedAt","tenantId") VALUES ($1,'Empresa Cliente SRL','131234567','8095550001',now(),$2)`,
    [ids.customer, tenant],
  );
  await sql.query(
    `INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'Suplementos',now(),$2)`,
    [category, tenant],
  );
  await sql.query(
    `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Proteína',$2,$3,now(),$4)`,
    [product, "P-REP", category, tenant],
  );
  await sql.query(
    `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,'V-REP','B-REP',50,100,1000,now(),$3)`,
    [ids.variant, product, tenant],
  );
  // Incentivo de RD$ 10 por unidad de la categoría.
  await sql.query(
    `INSERT INTO "IncentiveRate" (id,"categoryId",amount,"updatedAt","tenantId") VALUES ($1,$2,10,now(),$3)`,
    [randomUUID(), category, tenant],
  );
  await settings({ allowCreditSales: true });
  process.env.DATABASE_URL = url;
  process.env.PRODUCT_TENANCY = "required";
  process.env.NEXORA_RETENTION = "off";
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.RESEND_API_KEY;
  const secret = "clave-local-aislada-solo-pruebas-reportes";
  const { NestFactory } = apiRequire("@nestjs/core");
  const { JwtService } = apiRequire("@nestjs/jwt");
  app = await NestFactory.create(createAppModule(secret), { logger: false });
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();
  http = supertest(app.getHttpServer());
  token =
    "Bearer " +
    new JwtService({ secret }).sign({
      sub: user,
      sid: session,
      type: "access",
      version: 0,
      tenantId: tenant,
    });
  cashId = (await post("/cash-sessions/open", { openingAmount: 0 })).id;
}, 240_000);

afterAll(async () => {
  await app?.close().catch(() => undefined);
  await sql?.end().catch(() => undefined);
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  if (external) {
    const admin = new Client({ connectionString: external });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${DB}" WITH (FORCE)`);
    await admin.end();
  }
  await postgres?.stop().catch(() => undefined);
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}, 120_000);

describe("Reportes · arreglos de la auditoría en vivo (25-oct)", () => {
  it("4 · una transferencia sin verificar va aparte «por verificar», no como dinero recibido", async () => {
    const sale = await sell([
      { method: "transfer", amount: 100, bank: "BHD", reference: "PEND-1" },
    ]);
    ids.pendingSale = sale.id;
    ids.pendingPayment = sale.payments[0].id;
    const entradas = (await get("/reports/entradas-cuenta" + range)).rows;
    expect(entradas).toEqual([
      expect.objectContaining({
        Forma: "Transferencia por verificar",
        Monto: 100,
      }),
    ]);
    const income = await get(`/reports/income-by-day${range}`);
    expect(income.totals).toMatchObject({
      transfer: 0,
      pendingTransfer: 100,
      moneyIn: 0,
    });
    const formal = await get(`/reports/formal?period=day&date=${today}`);
    expect(formal.totals).toMatchObject({ moneyIn: 0, pendingTransfer: 100 });
    // La caja la espera: el arqueo del informe no la marca como diferencia.
    expect(formal.cashReconciliation.difference).toBe(0);
  });

  it("1 y 7 · la transferencia rechazada es cuenta por cobrar en todos lados y su incentivo se descuenta", async () => {
    const incentive = async () =>
      Number(
        (
          await sql.query(
            `SELECT COALESCE(SUM(amount),0) AS t FROM "IncentiveEntry" WHERE "saleId"=$1`,
            [ids.pendingSale],
          )
        ).rows[0].t,
      );
    expect(await incentive()).toBe(10);
    await post(`/payments/${ids.pendingPayment}/reject`, {
      reason: "No llegó al banco",
    });
    // 7: como una anulación, mientras no se cobre.
    expect(await incentive()).toBe(0);
    // 1: Cuentas por cobrar y antigüedad.
    const accounts = await get("/credit-accounts");
    expect(accounts.total).toBe(100);
    expect(accounts.rows).toEqual([
      expect.objectContaining({ balance: 100, openSales: 1 }),
    ]);
    const aging = (await get("/reports/creditos-por-antiguedad" + range)).rows;
    expect(aging.filter((r: any) => r.Factura !== "Resumen")).toEqual([
      expect.objectContaining({ Saldo: 100 }),
    ]);
    const debtors = (await get("/reports/clientes-con-mas-deuda" + range)).rows;
    expect(debtors).toEqual([expect.objectContaining({ Deuda: 100 })]);
    // Los dos desgloses «forma de pago por categoría» la cuentan como crédito.
    const breakdown = await get("/dashboard/breakdown" + range);
    expect(breakdown.payments).toEqual([
      { category: "Suplementos", method: "credit", amount: 100 },
    ]);
    const byCategory = (
      await get("/reports/ventas-categoria-forma-pago" + range)
    ).rows;
    expect(byCategory).toContainEqual(
      expect.objectContaining({
        Categoría: "Suplementos",
        "Forma de pago": "Crédito / contraentrega",
        Monto: 100,
      }),
    );
    // Cobrar la deuda devuelve el incentivo.
    await post(`/sales/${ids.pendingSale}/credit-collections`, {
      operationId: randomUUID(),
      cashSessionId: cashId,
      lines: [{ amount: 100, method: "cash" }],
    });
    expect(await incentive()).toBe(10);
  });

  it("3 · la venta a crédito guarda la fecha de vencimiento y «Vence» la muestra", async () => {
    const due = new Date(Date.now() + 20 * 86_400_000).toISOString();
    const sale = await sell([{ method: "cod", amount: 100 }], {
      receivableKind: "credit",
      creditDueDate: due,
    });
    ids.creditSale = sale.id;
    const row = (
      await sql.query(`SELECT "creditDueDate" FROM "Sale" WHERE id=$1`, [
        sale.id,
      ])
    ).rows[0];
    expect(row.creditDueDate).not.toBeNull();
    const aging = (await get("/reports/creditos-por-antiguedad" + range)).rows;
    expect(aging.find((r: any) => r.Factura === sale.number)?.Vence).toBe(
      businessDate(due),
    );
  });

  it("6 · el cuadre impreso muestra el crédito vendido y los recibos CxC cobrados", async () => {
    await post(`/sales/${ids.creditSale}/credit-collections`, {
      operationId: randomUUID(),
      cashSessionId: cashId,
      lines: [{ amount: 40, method: "cash" }],
    });
    const cuadre = await get(`/cash-sessions/${cashId}/cuadre`);
    const line = (key: string) =>
      cuadre.lines.find((l: any) => l.key === key)?.value;
    // Crédito vendido: la transferencia rechazada (100) y el crédito (100).
    expect(line("credit")).toBe(200);
    // Cobros: los 100 de la rechazada y 40 del crédito.
    expect(line("receipts")).toBe(140);
  });

  it("5 · venta diaria, forma de pago, cliente e informe formal son netos de devoluciones con su línea", async () => {
    const sale = await sell([{ method: "cash", amount: 100 }]);
    await post("/returns", {
      operationId: randomUUID(),
      saleId: sale.id,
      cashSessionId: cashId,
      reason: "Cliente devolvió",
      refundMethod: "cash",
      items: [{ saleItemId: sale.items[0].id, qty: 1, restock: true }],
    });
    // Vendido: 3 facturas de 100; devuelto: 100.
    const daily = await get(
      `/reports/venta-diaria-usuario?cashSessionId=${cashId}`,
    );
    expect(
      daily.rows.find((r: any) => r.Descripción === "DEVOLUCIONES"),
    ).toMatchObject({ Cant: -1, Precio: -100 });
    expect(daily.rows.at(-1)).toMatchObject({
      Descripción: "TOTAL",
      Cant: 2,
      Precio: 200,
    });
    const byMethod = await get(
      `/reports/venta-por-forma-pago?cashSessionId=${cashId}`,
    );
    expect(byMethod.byInvoice.amount).toBe(300);
    expect(byMethod.rows).toContainEqual(
      expect.objectContaining({ Descripción: "Devoluciones", T_Venta: -100 }),
    );
    expect(byMethod.total).toBe(200);
    const customers = (await get("/reports/customers" + range)).rows;
    expect(customers).toEqual([
      { Cliente: "Empresa Cliente SRL", Ventas: 200 },
    ]);
    const formal = await get(`/reports/formal?period=day&date=${today}`);
    expect(formal.users).toEqual([
      expect.objectContaining({
        name: "Ana Cajera",
        gross: 300,
        returns: 100,
        sold: 200,
      }),
    ]);
    expect(formal.totals.sold).toBe(200);
  });

  it("2 · antigüedad e inactivos cuentan los días hasta hoy, no hasta el «Hasta»", async () => {
    await sql.query(
      `UPDATE "Sale" SET "createdAt" = now() - interval '10 days' WHERE id=$1`,
      [ids.creditSale],
    );
    const aging = (
      await get(
        `/reports/creditos-por-antiguedad?from=${daysAgo(30)}&to=${daysAgo(5)}`,
      )
    ).rows;
    expect(aging.find((r: any) => r.Factura !== "Resumen")?.Días).toBe(10);
    // Un cliente que compró hace 70 días está inactivo hoy aunque el filtro
    // termine hace 65 días.
    await sql.query(
      `UPDATE "Sale" SET "createdAt" = now() - interval '70 days' WHERE "customerId"=$1`,
      [ids.customer],
    );
    const inactive = (
      await get(
        `/reports/clientes-inactivos?from=${daysAgo(90)}&to=${daysAgo(65)}`,
      )
    ).rows;
    expect(inactive).toEqual([
      expect.objectContaining({
        Cliente: "Empresa Cliente SRL",
        "Días sin comprar": 70,
      }),
    ]);
  });

  it("9 · NCF: RNC de la empresa obligatorio, RNC/cédula del B01 válido y recibo fiscal con el RNC completo", async () => {
    for (const type of ["B01", "B02"])
      await post("/ncf-sequences", {
        type,
        authorizationReference: type + "-R",
        firstNumber: "00000001",
        lastNumber: "00000100",
        nextNumber: "00000001",
        expiryApplies: type === "B01",
        expiresOn:
          type === "B01"
            ? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10)
            : null,
      });
    await settings({ allowCreditSales: true, ncfMode: "sequences" });
    const noCompanyRnc = await http
      .post("/api/sales")
      .set("Authorization", token)
      .send({
        offlineUuid: randomUUID(),
        customerId: ids.customer,
        cashSessionId: cashId,
        items: [{ variantId: ids.variant, qty: 1 }],
        payments: [{ method: "cash", amount: 100 }],
      });
    expect(noCompanyRnc.status).toBe(400);
    expect(noCompanyRnc.body.message).toContain("RNC de la empresa");
    await settings({
      allowCreditSales: true,
      ncfMode: "sequences",
      legalId: "101-00000-1",
      name: "Tienda Fiscal",
    });
    const badRnc = await http
      .post("/api/sales")
      .set("Authorization", token)
      .send({
        offlineUuid: randomUUID(),
        customerId: ids.customer,
        cashSessionId: cashId,
        items: [{ variantId: ids.variant, qty: 1 }],
        payments: [{ method: "cash", amount: 100 }],
        ncfType: "B01",
        recipientLegalId: "1234567890",
      });
    expect(badRnc.status).toBe(400);
    expect(badRnc.body.message).toContain("9 dígitos");
    const b01 = await sell([{ method: "cash", amount: 100 }], {
      ncfType: "B01",
    });
    expect(b01.ncf).toBe("B0100000001");
    const pdf = await http
      .get(`/api/sales/${b01.id}/receipt.pdf`)
      .set("Authorization", token)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    const text = pdfText(pdf.body as Buffer);
    expect(text).toContain("131234567");
    expect(text).toContain("101-00000-1");
    expect(text).not.toContain("sin valor fiscal");
    expect(text).toContain("Comprobante fiscal B01");
    // e-CF sigue pausado.
    const ecf = await http
      .post("/api/sales")
      .set("Authorization", token)
      .send({
        offlineUuid: randomUUID(),
        customerId: ids.customer,
        cashSessionId: cashId,
        items: [{ variantId: ids.variant, qty: 1 }],
        payments: [{ method: "cash", amount: 100 }],
        ncfType: "E31",
      });
    expect(ecf.status).toBe(400);
    await settings({ allowCreditSales: true });
  });

  it("10 · nombres en vez de códigos, formas de pago en español, fechas invertidas y tendencia sin período anterior", async () => {
    const cash = (await get("/reports/cash" + range)).rows;
    expect(cash[0].Usuario).toBe("Ana Cajera");
    const byPayment = (await get("/reports/by-payment" + range)).rows;
    expect(byPayment.map((r: any) => r.Método)).toContain("Efectivo");
    expect(byPayment.map((r: any) => r.Método)).not.toContain("cash");
    const events = (await get("/reports/returns-discounts" + range)).rows;
    const back = events.find((r: any) => r.Evento === "Devolución");
    expect(back?.Usuario).toBe("Ana Cajera");
    expect(back?.Referencia).not.toMatch(/^[0-9a-f]{8}-/);
    const inverted = await http
      .get(`/api/reports/margen-por-producto?from=${today}&to=${daysAgo(6)}`)
      .set("Authorization", token);
    expect(inverted.status).toBe(400);
    expect(inverted.body.message).toBe(
      "La fecha inicial es posterior a la final.",
    );
    // Sin ventas en el período anterior no hay porcentaje: null, no «0 %».
    const summary = await get("/dashboard/summary" + range);
    expect(summary.trend).toBeNull();
    // PDF: importes RD$ #,###.00; cantidades tal cual.
    expect(pdfValue("Monto", 1234.5)).toBe("RD$ 1,234.50");
    expect(pdfValue("Unidades", 3)).toBe("3");
    expect(pdfValue("Saldo", 7, "kardex")).toBe("7");
    expect(pdfValue("Devoluciones", 2, "devoluciones-producto")).toBe("2");
  });
});
