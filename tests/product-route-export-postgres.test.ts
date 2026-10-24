import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

// PDFKit embeds text as hexadecimal strings in Flate-compressed content
// streams. Inspect the emitted binary, not a mock renderer or source literal.
function pdfText(pdf: Buffer): string {
  const raw = pdf.toString("latin1");
  const pieces: string[] = [];
  // Keep a possible 0x0D final byte in the compressed stream (PDFKit ends it with LF).
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)) {
    const dictionary = raw.slice(Math.max(0, match.index! - 250), match.index);
    let content = Buffer.from(match[1], "latin1");
    if (dictionary.includes("/FlateDecode")) {
      try { content = inflateSync(content); } catch { continue; }
    }
    for (const hex of content.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      pieces.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return pieces.join("");
}

const binaryParser = (response: NodeJS.ReadableStream, done: (error: Error | null, body?: Buffer) => void) => {
  const chunks: Buffer[] = [];
  response.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  response.on("end", () => done(null, Buffer.concat(chunks)));
  response.on("error", done);
};

const ids = {
  tenantA: "00000000-0000-0000-0000-000000000001",
  tenantB: "00000000-0000-0000-0000-000000000002",
  roleA: "50000000-0000-4000-8000-000000000001",
  roleB: "50000000-0000-4000-8000-000000000002",
  userA: "50000000-0000-4000-8000-000000000003",
  userB: "50000000-0000-4000-8000-000000000004",
  sessionA: "50000000-0000-4000-8000-000000000005",
  sessionB: "50000000-0000-4000-8000-000000000006",
  customerA: "50000000-0000-4000-8000-000000000007",
  customerB: "50000000-0000-4000-8000-000000000008",
  saleA: "50000000-0000-4000-8000-000000000009",
  saleB: "50000000-0000-4000-8000-000000000010",
  returnA: "50000000-0000-4000-8000-000000000011",
  returnB: "50000000-0000-4000-8000-000000000012",
  receiptA: "50000000-0000-4000-8000-000000000013",
  receiptB: "50000000-0000-4000-8000-000000000014",
  paymentA: "50000000-0000-4000-8000-000000000015",
  paymentB: "50000000-0000-4000-8000-000000000016",
  attachmentA: "50000000-0000-4000-8000-000000000017",
  attachmentB: "50000000-0000-4000-8000-000000000018",
  supplierA: "50000000-0000-4000-8000-000000000019",
  supplierB: "50000000-0000-4000-8000-000000000020",
  cashA: "50000000-0000-4000-8000-000000000021",
  cashB: "50000000-0000-4000-8000-000000000022",
};

it("aísla Excel, PDF y SSE de dos empresas con PostgreSQL real", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-export-tenant-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: dataDir, user: "export_test", password: "export_test_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  const oldUrl = process.env.DATABASE_URL;
  const oldMode = process.env.PRODUCT_TENANCY;
  let client: any;
  let app: any;
  try {
    await db.initialise();
    await db.start();
    await db.createDatabase("export_tenants_test");
    const url = `postgresql://export_test:export_test_only@127.0.0.1:${port}/export_tenants_test`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000,
    });
    client = db.getPgClient("export_tenants_test", "127.0.0.1");
    await client.connect();
    await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [ids.tenantB]);
    for (const [tenant, role, user, session, customer, sale, returned, receipt, payment, attachment, supplier, cash, suffix] of [
      [ids.tenantA, ids.roleA, ids.userA, ids.sessionA, ids.customerA, ids.saleA, ids.returnA, ids.receiptA, ids.paymentA, ids.attachmentA, ids.supplierA, ids.cashA, "A_ONLY_SECRET"],
      [ids.tenantB, ids.roleB, ids.userB, ids.sessionB, ids.customerB, ids.saleB, ids.returnB, ids.receiptB, ids.paymentB, ids.attachmentB, ids.supplierB, ids.cashB, "B_VISIBLE"],
    ]) {
      await client.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [role, tenant]);
      await client.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,$3,'test-only','test-only',$4,'main',now(),$5)`, [user, `Usuaria ${suffix}`, `${tenant}@example.invalid`, role, tenant]);
      await client.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [session, user, tenant]);
      await client.query(`INSERT INTO "Settings" (id,data,"updatedAt","tenantId") VALUES ('main',$1::jsonb,now(),$2)`, [JSON.stringify({ name: `Empresa ${suffix}`, branchName: "Sucursal", phone: "809-555-0100" }), tenant]);
      await client.query(`INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`, [customer, `Cliente ${suffix}`, tenant]);
      await client.query(`INSERT INTO "Sale" (id,number,"offlineUuid","customerId","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","tenantId") VALUES ($1,$2,$3,$4,$5,0,0,0,0,0,now(),$6)`, [sale, `FS-${suffix}`, `${sale.slice(0, 20)}${sale.slice(20)}`, customer, user, tenant]);
      await client.query(`INSERT INTO "SaleReturn" (id,"saleId",number,reason,total,"taxTotal","costTotal","refundMethod","userId",items,"tenantId") VALUES ($1,$2,$3,$4,0,0,0,'credit_note',$5,'[]'::jsonb,$6)`, [returned, sale, `DEV-${suffix}`, `Motivo ${suffix}`, user, tenant]);
      await client.query(`INSERT INTO "CreditNote" (id,"returnId","redemptionCode",amount,balance,"tenantId") VALUES (gen_random_uuid(),$1,$2,0,0,$3)`, [returned, `CRED-${suffix}`, tenant]);
      await client.query(`INSERT INTO "GoodsReceipt" (id,freight,"otherCosts",items,"supplierInvoice","userId","tenantId") VALUES ($1,0,0,'[]'::jsonb,$2,$3,$4)`, [receipt, `INV-${suffix}`, user, tenant]);
      await client.query(`INSERT INTO "IncentiveEntry" (id,kind,"refId","saleId","saleItemId","userId","categoryName",qty,"rateAtSale",amount,period,"originPeriod","tenantId") VALUES (gen_random_uuid(),'sale',gen_random_uuid(),$1,gen_random_uuid(),$2,'Categoría',1,10,10,to_char(now(),'YYYY-MM'),to_char(now(),'YYYY-MM'),$3)`, [sale, user, tenant]);
      await client.query(`INSERT INTO "CashSession" (id,"registerId","userId","openingAmount","openedAt","closedAt","countedCash","countedCard","countedTransfer","tenantId") VALUES ($1,$2,$3,0,now()-interval '1 minute',now(),0,0,0,$4)`, [cash, `Caja ${suffix}`, user, tenant]);
      await client.query(`INSERT INTO "Payment" (id,"saleId","cashSessionId","entryType",method,amount,tendered,"proofUrl","tenantId") VALUES ($1,$2,$3,'installment','transfer',0,0,$4,$5)`, [payment, sale, cash, `data:image/png;base64,${Buffer.from(suffix).toString("base64")}`, tenant]);
      await client.query(`INSERT INTO "InvoiceAttachment" (id,"branchId","userId",mime,data,"tenantId") VALUES ($1,'main',$2,'image/png',$3,$4)`, [attachment, user, Buffer.from(suffix), tenant]);
      await client.query(`INSERT INTO "SupplierImportProfile" (id,"supplierId","branchId",mapping,"tenantId") VALUES (gen_random_uuid(),$1,'main',$2::jsonb,$3)`, [supplier, JSON.stringify({ marker: suffix }), tenant]);
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "export-route-matrix-only-test-secret-2026";
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    if (!address || typeof address === "string") throw new Error("Sin puerto API");
    const jwt = new JwtService({ secret });
    const token = (tenantId: string, userId: string, sid: string) =>
      "Bearer " + jwt.sign({ sub: userId, sid, type: "access", version: 0, tenantId });
    const aToken = token(ids.tenantA, ids.userA, ids.sessionA);
    const bToken = token(ids.tenantB, ids.userB, ids.sessionB);
    const http = supertest(app.getHttpServer());

    const pdfCases = [
      [`/api/sales/${ids.saleB}/receipt.pdf`, `/api/sales/${ids.saleA}/receipt.pdf`, "B_VISIBLE"],
      [`/api/credit-accounts/${ids.customerB}/statement.pdf`, `/api/credit-accounts/${ids.customerA}/statement.pdf`, "B_VISIBLE"],
      [`/api/returns/${ids.returnB}/credit-note.pdf`, `/api/returns/${ids.returnA}/credit-note.pdf`, "B_VISIBLE"],
      [`/api/incentives/receipt.pdf?userId=${ids.userB}`, `/api/incentives/receipt.pdf?userId=${ids.userA}`, "B_VISIBLE"],
    ] as const;
    for (const [ownPath, foreignPath, ownMarker] of pdfCases) {
      const own = await http.get(ownPath).set("Authorization", bToken).buffer(true).parse(binaryParser);
      expect(own.status, `${ownPath}: ${JSON.stringify(own.body)}`).toBe(200);
      const bytes = Buffer.isBuffer(own.body) ? own.body : Buffer.from(own.text ?? "", "latin1");
      expect(bytes.subarray(0, 4).toString(), ownPath).toBe("%PDF");
      const text = pdfText(bytes);
      expect(text, ownPath).toContain(ownMarker);
      expect(text, ownPath).not.toContain("A_ONLY_SECRET");
      const aOwn = await http.get(foreignPath).set("Authorization", aToken).buffer(true).parse(binaryParser);
      expect(aOwn.status, `${foreignPath} como A: ${JSON.stringify(aOwn.body)}`).toBe(200);
      expect(pdfText(aOwn.body as Buffer), foreignPath).toContain("A_ONLY_SECRET");
      if (!foreignPath.includes("incentives/receipt.pdf")) {
        const foreign = await http.get(foreignPath).set("Authorization", bToken);
        expect([403, 404], `${foreignPath}: ${JSON.stringify(foreign.body)}`).toContain(foreign.status);
        expect(JSON.stringify(foreign.body)).not.toContain("A_ONLY_SECRET");
      }
    }

    const ExcelJS = apiRequire("exceljs");
    for (const path of ["/api/catalog-template.xlsx", "/api/goods-receipts/export", "/api/incentives/export.xlsx"]) {
      const response = await http.get(path).set("Authorization", bToken).buffer(true).parse(binaryParser);
      expect(response.status, `${path}: ${JSON.stringify(response.body)}`).toBe(200);
      const bytes = Buffer.isBuffer(response.body) ? response.body : Buffer.from(response.text ?? "", "latin1");
      expect(bytes.subarray(0, 2).toString("hex"), path).toBe("504b");
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(bytes);
      const cells: string[] = [];
      book.eachSheet((sheet: any) => sheet.eachRow((row: any) => row.eachCell((cell: any) => cells.push(String(cell.value ?? "")))));
      const content = cells.join("|");
      expect(content, path).not.toContain("A_ONLY_SECRET");
      if (path !== "/api/catalog-template.xlsx") expect(content, path).toContain("B_VISIBLE");
    }

    const formalPath = "/api/reports/formal?period=day&date=2026-10-19&format=pdf";
    const formal = await http.get(formalPath).set("Authorization", bToken).buffer(true).parse(binaryParser);
    expect(formal.status, `${formalPath}: ${JSON.stringify(formal.body)}`).toBe(200);
    expect((formal.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfText(formal.body as Buffer)).not.toContain("A_ONLY_SECRET");

    const reports = await http.get("/api/reportes").set("Authorization", bToken);
    expect(reports.status).toBe(200);
    const reportName = reports.body[0]?.name;
    expect(typeof reportName).toBe("string");
    const reportPdf = await http.get(`/api/reports/${reportName}?format=pdf`).set("Authorization", bToken).buffer(true).parse(binaryParser);
    expect(reportPdf.status, `Reporte ${reportName}: ${JSON.stringify(reportPdf.body)}`).toBe(200);
    expect((reportPdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfText(reportPdf.body as Buffer)).not.toContain("A_ONLY_SECRET");

    // Distinct detail/download routes use existing tenant-owned rows. Both
    // tenants' valid IDs are exercised: an absent foreign row alone would not
    // prove isolation.
    const jsonDetails = [
      [`/api/goods-receipts/${ids.receiptB}`, `/api/goods-receipts/${ids.receiptA}`, "B_VISIBLE"],
      [`/api/credit-accounts/${ids.customerB}`, `/api/credit-accounts/${ids.customerA}`, "B_VISIBLE"],
      [`/api/cash-sessions/${ids.cashB}/cuadre`, `/api/cash-sessions/${ids.cashA}/cuadre`, "B_VISIBLE"],
      [`/api/cash-sessions/${ids.cashB}/reports/venta-diaria-usuario`, `/api/cash-sessions/${ids.cashA}/reports/venta-diaria-usuario`, "B_VISIBLE"],
      [`/api/merchandise/profiles/${ids.supplierB}`, `/api/merchandise/profiles/${ids.supplierA}`, "B_VISIBLE"],
    ] as const;
    for (const [ownPath, foreignPath, marker] of jsonDetails) {
      const own = await http.get(ownPath).set("Authorization", bToken);
      expect(own.status, `${ownPath}: ${JSON.stringify(own.body)}`).toBe(200);
      expect(JSON.stringify(own.body), ownPath).toContain(marker);
      expect(JSON.stringify(own.body), ownPath).not.toContain("A_ONLY_SECRET");
      const foreign = await http.get(foreignPath).set("Authorization", bToken);
      if (foreignPath.includes("/merchandise/profiles/")) {
        expect(foreign.status).toBe(200);
        expect(foreign.body).toEqual({}); // Nest emits an empty 200 for null.
      } else {
        expect([403, 404], `${foreignPath}: ${JSON.stringify(foreign.body)}`).toContain(foreign.status);
      }
      expect(JSON.stringify(foreign.body)).not.toContain("A_ONLY_SECRET");
    }

    const binaryDetails = [
      [`/api/payments/${ids.paymentB}/proof`, `/api/payments/${ids.paymentA}/proof`],
      [`/api/merchandise/attachments/${ids.attachmentB}`, `/api/merchandise/attachments/${ids.attachmentA}`],
    ] as const;
    for (const [ownPath, foreignPath] of binaryDetails) {
      const own = await http.get(ownPath).set("Authorization", bToken).buffer(true).parse(binaryParser);
      expect(own.status, `${ownPath}: ${JSON.stringify(own.body)}`).toBe(200);
      expect((own.body as Buffer).toString(), ownPath).toBe("B_VISIBLE");
      const foreign = await http.get(foreignPath).set("Authorization", bToken);
      expect([403, 404], `${foreignPath}: ${JSON.stringify(foreign.body)}`).toContain(foreign.status);
      expect(JSON.stringify(foreign.body)).not.toContain("A_ONLY_SECRET");
    }

    const incomePdf = await http.get("/api/reports/income-by-day?from=2026-10-01&to=2026-10-19&format=pdf").set("Authorization", bToken).buffer(true).parse(binaryParser);
    expect(incomePdf.status, JSON.stringify(incomePdf.body)).toBe(200);
    expect((incomePdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    expect(pdfText(incomePdf.body as Buffer)).not.toContain("A_ONLY_SECRET");

    const salesSearchA = await http.get("/api/sales?q=A_ONLY_SECRET").set("Authorization", aToken);
    const salesSearchB = await http.get("/api/sales?q=A_ONLY_SECRET").set("Authorization", bToken);
    expect(salesSearchA.status).toBe(200);
    expect(JSON.stringify(salesSearchA.body)).toContain("A_ONLY_SECRET");
    expect(salesSearchB.status).toBe(200);
    expect(JSON.stringify(salesSearchB.body)).not.toContain("A_ONLY_SECRET");

    const controller = new AbortController();
    try {
      const stream = await fetch(`http://127.0.0.1:${address.port}/api/events`, {
        headers: { Authorization: bToken }, signal: controller.signal,
      });
      expect(stream.status).toBe(200);
      expect(stream.headers.get("content-type")).toContain("text/event-stream");
      const reader = stream.body?.getReader();
      if (!reader) throw new Error("Sin lector SSE");
      const decoder = new TextDecoder();
      let received = decoder.decode((await reader.read()).value);
      expect(received).toContain("event: ready");
      await client.query(`INSERT INTO "RealtimeEvent" ("tenantId","branchId",type,data) VALUES ($1,'main','sale',$2::jsonb),($3,'main','sale',$4::jsonb)`, [ids.tenantA, JSON.stringify({ marker: "A_ONLY_SECRET" }), ids.tenantB, JSON.stringify({ marker: "B_VISIBLE" })]);
      const deadline = Date.now() + 8000;
      while (!received.includes("B_VISIBLE") && Date.now() < deadline) {
        const next = await new Promise<ReadableStreamReadResult<Uint8Array>>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error("SSE sin evento de empresa B")), Math.max(1, deadline - Date.now()));
          void reader.read().then(
            (value) => { clearTimeout(timeout); resolve(value); },
            (error) => { clearTimeout(timeout); reject(error); },
          );
        });
        if (next.done) break;
        received += decoder.decode(next.value);
      }
      expect(received).toContain("B_VISIBLE");
      expect(received).not.toContain("A_ONLY_SECRET");
      await reader.cancel();
    } finally {
      controller.abort();
    }
  } finally {
    await app?.close().catch(() => undefined);
    if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = oldMode;
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    await client?.end().catch(() => undefined);
    await db.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);
