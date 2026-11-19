import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

// Igualar producto (19-nov): las 8 rutas que trajo nexora-cloud, cada una con
// su caso A/B. La empresa B nunca lee ni cambia lo de la empresa A.
const root = resolve(import.meta.dirname, "..");
const prismaCli = createRequire(join(root, "apps/api/package.json")).resolve(
  "prisma/build/index.js",
);
const run = promisify(execFile);
const id = (n: number) =>
  `19000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const tenants = [
  "00000000-0000-0000-0000-000000000001",
  "00000000-0000-0000-0000-000000000002",
];
const PIN = "135790";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Sin puerto disponible");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("rutas nuevas del lote 19-nov: medidor IA, sin costo, guía, exportación, recálculo y correcciones de cobro son propias de la empresa", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-lote19-"));
  const port = await freePort();
  const postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "lote19_qa",
    password: "lote19_qa_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const saved = Object.fromEntries(
    [
      "DATABASE_URL",
      "PRODUCT_TENANCY",
      "TELEGRAM_BOT_TOKEN",
      "RESEND_API_KEY",
      "ANTHROPIC_API_KEY",
      "NEXORA_RETENTION",
    ].map((name) => [name, process.env[name]]),
  );
  let sql: any;
  let app: any;
  try {
    await postgres.initialise();
    await postgres.start();
    await postgres.createDatabase("lote19_qa");
    const url = `postgresql://lote19_qa:lote19_qa_only@127.0.0.1:${port}/lote19_qa`;
    await run(
      process.execPath,
      [
        prismaCli,
        "migrate",
        "deploy",
        "--schema",
        join(root, "apps/api/prisma/schema.prisma"),
      ],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: url },
        timeout: 120_000,
      },
    );
    sql = postgres.getPgClient("lote19_qa", "127.0.0.1");
    await sql.connect();
    await sql.query(
      `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-lote19-b','Empresa B',now())`,
      [tenants[1]],
    );
    const apiRequire = createRequire(join(root, "apps/api/package.json"));
    const { hash } = apiRequire("bcryptjs");
    const pinHash = await hash(PIN, 4);
    const cases = tenants.map((tenantId, i) => ({
      tenantId,
      tag: i === 0 ? "EMPRESAA" : "EMPRESAB",
      roleId: id(10 + i),
      userId: id(20 + i),
      terminalId: id(30 + i),
      sessionId: id(40 + i),
      categoryId: id(50 + i),
      productId: id(60 + i),
      freeVariantId: id(70 + i),
      costVariantId: id(80 + i),
      cashId: id(90 + i),
      saleId: id(100 + i),
      itemId: id(110 + i),
      transferId: id(120 + i),
      cashPaymentId: id(130 + i),
    }));
    for (const [i, c] of cases.entries()) {
      await sql.query(
        `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
        [c.roleId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test',$4,$5,now(),$6)`,
        [
          c.userId,
          `Admin ${c.tag}`,
          `lote19-${i}@example.invalid`,
          pinHash,
          c.roleId,
          c.tenantId,
        ],
      );
      await sql.query(
        `INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`,
        [c.terminalId, `Terminal ${i}`, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
        [c.sessionId, c.userId, c.terminalId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'General',now(),$2)`,
        [c.categoryId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,$2,$3,$4,now(),$5)`,
        [
          c.productId,
          `Producto ${c.tag}`,
          `P-${c.tag}`,
          c.categoryId,
          c.tenantId,
        ],
      );
      await sql.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,$3,$4,0,100,3,now(),$5)`,
        [
          c.freeVariantId,
          c.productId,
          `SINCOSTO-${c.tag}`,
          `B0-${c.tag}`,
          c.tenantId,
        ],
      );
      await sql.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,$3,$4,40,100,3,now(),$5)`,
        [
          c.costVariantId,
          c.productId,
          `CONCOSTO-${c.tag}`,
          `B1-${c.tag}`,
          c.tenantId,
        ],
      );
      await sql.query(
        `INSERT INTO "CashSession" (id,"registerId","userId","openingAmount","tenantId") VALUES ($1,$2,$3,0,$4)`,
        [c.cashId, c.terminalId, c.userId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "Sale" (id,number,"offlineUuid","sellerId","cashSessionId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","tenantId") VALUES ($1,$2,$3,$4,$5,100,0,0,100,0,now(),$6)`,
        [c.saleId, `FS-${c.tag}`, id(140 + i), c.userId, c.cashId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "SaleItem" (id,"saleId","variantId",qty,"unitPrice","unitCost",discount,tax,"lineTotal","tenantId") VALUES ($1,$2,$3,1,100,0,0,0,100,$4)`,
        [c.itemId, c.saleId, c.costVariantId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "Payment" (id,"saleId","cashSessionId",method,amount,tendered,"entryType",status,bank,reference,"tenantId") VALUES ($1,$2,$3,'transfer',50,50,'sale','ok','BHD',$4,$5)`,
        [c.transferId, c.saleId, c.cashId, `REF-${c.tag}`, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "Payment" (id,"saleId","cashSessionId",method,amount,tendered,"entryType",status,"tenantId") VALUES ($1,$2,$3,'cash',50,50,'sale','ok',$4)`,
        [c.cashPaymentId, c.saleId, c.cashId, c.tenantId],
      );
      await sql.query(
        `INSERT INTO "AiUsage" (id,"userId",feature,model,"inputTokens","outputTokens","tenantId") VALUES ($1,$2,$3,'claude-haiku-5-5',10,5,$4)`,
        [id(150 + i), c.userId, `uso-${c.tag}`, c.tenantId],
      );
    }
    // Una segunda caja de B, destino legítimo para mover un cobro dentro de B.
    const otherCashB = id(160);
    await sql.query(
      `INSERT INTO "CashSession" (id,"registerId","userId","openingAmount","closedAt","tenantId") VALUES ($1,'otra-caja',$2,0,now(),$3)`,
      [otherCashB, cases[1].userId, cases[1].tenantId],
    );

    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const secret = "clave-local-lote19-solo-pruebas-aislamiento";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const [a, b] = cases;
    const send = (request: any, row = b) =>
      request.set(
        "Authorization",
        "Bearer " +
          jwt.sign({
            sub: row.userId,
            sid: row.sessionId,
            type: "access",
            version: 0,
            tenantId: row.tenantId,
          }),
      );
    const denied = (response: any) =>
      expect([403, 404], JSON.stringify(response.body)).toContain(
        response.status,
      );
    const today = new Date().toISOString().slice(0, 10);

    // GET /api/ai/usage
    const usage = await send(
      http.get(`/api/ai/usage?from=${today.slice(0, 8)}01&to=${today}`),
    );
    expect(usage.status, JSON.stringify(usage.body)).toBe(200);
    expect(JSON.stringify(usage.body)).not.toContain(a.tag);

    // GET /api/inventory/without-cost
    const withoutCost = await send(http.get("/api/inventory/without-cost"));
    expect(withoutCost.status, JSON.stringify(withoutCost.body)).toBe(200);
    expect(withoutCost.body.items.map((r: any) => r.sku)).toEqual([
      `SINCOSTO-${b.tag}`,
    ]);

    // GET /api/reportes/:name/guia (texto fijo, sin datos de empresa)
    const guide = await send(
      http.get("/api/reportes/margen-por-producto/guia"),
    );
    expect(guide.status, JSON.stringify(guide.body)).toBe(200);
    expect(JSON.stringify(guide.body)).not.toContain(a.tag);

    // GET /api/reports/:name/export
    const exported = await send(
      http
        .get(
          `/api/reports/margen-por-producto/export?from=${today}&to=${today}&format=xlsx`,
        )
        .buffer(true)
        .parse((res: any, done: any) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => done(null, Buffer.concat(chunks)));
        }),
    );
    expect(exported.status).toBe(200);
    const ExcelJS = apiRequire("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(exported.body);
    const cells: string[] = [];
    book.eachSheet((sheet: any) =>
      sheet.eachRow((row: any) =>
        row.eachCell((cell: any) => cells.push(String(cell.value))),
      ),
    );
    expect(cells.join(" ")).toContain(b.tag);
    expect(cells.join(" ")).not.toContain(a.tag);

    // GET /api/reports/cost-recalc
    const recalc = await send(
      http.get(`/api/reports/cost-recalc?from=${today}&to=${today}`),
    );
    expect(recalc.status, JSON.stringify(recalc.body)).toBe(200);
    expect(JSON.stringify(recalc.body)).toContain(`FS-${b.tag}`);
    expect(JSON.stringify(recalc.body)).not.toContain(`FS-${a.tag}`);

    // POST /api/payments/:id/unverify
    const reason = { reason: "Prueba de aislamiento entre empresas" };
    denied(
      await send(
        http.post(`/api/payments/${a.transferId}/unverify`).send(reason),
      ),
    );
    expect(
      (
        await sql.query(`SELECT status FROM "Payment" WHERE id=$1`, [
          a.transferId,
        ])
      ).rows[0].status,
    ).toBe("ok");
    const ownUnverify = await send(
      http.post(`/api/payments/${b.transferId}/unverify`).send(reason),
    );
    expect([200, 201], JSON.stringify(ownUnverify.body)).toContain(
      ownUnverify.status,
    );
    expect(
      (
        await sql.query(`SELECT status FROM "Payment" WHERE id=$1`, [
          b.transferId,
        ])
      ).rows[0].status,
    ).toBe("pending_verification");

    // POST /api/payments/:id/move-cash-session
    denied(
      await send(
        http
          .post(`/api/payments/${a.cashPaymentId}/move-cash-session`)
          .send({ ...reason, cashSessionId: otherCashB }),
      ),
    );
    // Destino de otra empresa: tampoco se mueve un cobro propio a la caja de A.
    const toForeign = await send(
      http
        .post(`/api/payments/${b.cashPaymentId}/move-cash-session`)
        .send({ ...reason, cashSessionId: a.cashId }),
    );
    expect(
      toForeign.status,
      JSON.stringify(toForeign.body),
    ).toBeGreaterThanOrEqual(400);
    expect(
      (
        await sql.query(
          `SELECT "cashSessionId" FROM "Payment" WHERE id IN ($1,$2) ORDER BY "tenantId"`,
          [a.cashPaymentId, b.cashPaymentId],
        )
      ).rows.map((r: any) => r.cashSessionId),
    ).toEqual([a.cashId, b.cashId]);
    const ownMove = await send(
      http
        .post(`/api/payments/${b.cashPaymentId}/move-cash-session`)
        .send({ ...reason, cashSessionId: otherCashB }),
    );
    expect([200, 201], JSON.stringify(ownMove.body)).toContain(ownMove.status);
    expect(
      (
        await sql.query(`SELECT "cashSessionId" FROM "Payment" WHERE id=$1`, [
          b.cashPaymentId,
        ])
      ).rows[0].cashSessionId,
    ).toBe(otherCashB);

    // POST /api/sales/:id/items/:itemId/cost
    const cost = (operationId: string) => ({
      unitCost: 40,
      expectedUnitCost: 0,
      operationId,
      reason: "Costo real de la factura",
      managerPin: PIN,
    });
    // La venta de A no existe para B: la ruta responde 400 «Venta no encontrada».
    const foreignCost = await send(
      http
        .post(`/api/sales/${a.saleId}/items/${a.itemId}/cost`)
        .send(cost(id(170))),
    );
    expect([400, 403, 404]).toContain(foreignCost.status);
    expect(JSON.stringify(foreignCost.body)).not.toContain(a.tag);
    expect(
      Number(
        (
          await sql.query(`SELECT "unitCost" FROM "SaleItem" WHERE id=$1`, [
            a.itemId,
          ])
        ).rows[0].unitCost,
      ),
    ).toBe(0);
    const ownCost = await send(
      http
        .post(`/api/sales/${b.saleId}/items/${b.itemId}/cost`)
        .send(cost(id(171))),
    );
    expect(ownCost.status, JSON.stringify(ownCost.body)).toBe(200);
    expect(
      Number(
        (
          await sql.query(`SELECT "unitCost" FROM "SaleItem" WHERE id=$1`, [
            b.itemId,
          ])
        ).rows[0].unitCost,
      ),
    ).toBe(40);
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await postgres.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}, 180_000);
