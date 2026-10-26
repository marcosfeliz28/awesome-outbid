import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

// NCF tradicional por venta (ncfMode «sequences»), Postgres real.
// NEXORA_TEST_PG_URL usa un servidor existente; si no, uno embebido.
const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
// pg llega como dependencia de embedded-postgres (no está en la raíz).
const { Client } = createRequire(
  createRequire(import.meta.url).resolve("embedded-postgres"),
)("pg");
const tenantA = "00000000-0000-0000-0000-000000000001";
const tenantB = "00000000-0000-0000-0000-000000000002";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("cada venta toma su NCF B01/B02 consecutivo, único, por empresa y sólo con el interruptor encendido", async () => {
  const external = process.env.NEXORA_TEST_PG_URL;
  const dataDir = external
    ? null
    : await mkdtemp(join(tmpdir(), "nexora-ncf-venta-"));
  const port = await freePort();
  const postgres = external
    ? null
    : new EmbeddedPostgres({
        databaseDir: dataDir!,
        user: "ncf_test",
        password: "ncf_test_only",
        port,
        persistent: false,
        authMethod: "scram-sha-256",
        initdbFlags: ["--encoding=UTF8", "--locale=C"],
        postgresFlags: [
          "-c",
          "listen_addresses=127.0.0.1",
          "-c",
          "timezone=UTC",
        ],
        onLog: () => undefined,
        onError: () => undefined,
      });
  const saved = Object.fromEntries(
    [
      "DATABASE_URL",
      "PRODUCT_TENANCY",
      "TELEGRAM_BOT_TOKEN",
      "RESEND_API_KEY",
      "NEXORA_RETENTION",
    ].map((name) => [name, process.env[name]]),
  );
  let sql: any;
  let app: any;
  let url: string;
  try {
    if (external) {
      const admin = new Client({ connectionString: external });
      await admin.connect();
      await admin.query(
        'DROP DATABASE IF EXISTS "nexora_ncf_venta" WITH (FORCE)',
      );
      await admin.query('CREATE DATABASE "nexora_ncf_venta"');
      await admin.end();
      const target = new URL(external);
      target.pathname = "/nexora_ncf_venta";
      url = target.toString();
    } else {
      await postgres!.initialise();
      await postgres!.start();
      await postgres!.createDatabase("ncf_qa");
      url = `postgresql://ncf_test:ncf_test_only@127.0.0.1:${port}/ncf_qa`;
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
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: url },
        timeout: 120_000,
      },
    );
    sql = new Client({ connectionString: url });
    await sql.connect();
    await sql.query(
      `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`,
      [tenantB],
    );
    // Plan con varias cajas abiertas para vender realmente en paralelo.
    await sql.query(`UPDATE "Tenant" SET plan='pro'`);
    type Seat = {
      tenantId: string;
      userId: string;
      sessionId: string;
      cash?: string;
    };
    const seats: Seat[] = [];
    const fixtures: Record<
      string,
      { variantId: string; withRnc: string; withoutRnc: string }
    > = {};
    for (const tenantId of [tenantA, tenantB]) {
      const roleId = randomUUID();
      await sql.query(
        `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
        [roleId, tenantId],
      );
      // Cuatro cajeras por empresa: ventas realmente simultáneas.
      for (let i = 0; i < 4; i++) {
        const userId = randomUUID(),
          terminalId = randomUUID(),
          sessionId = randomUUID();
        await sql.query(
          `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test','test',$4,now(),$5)`,
          [
            userId,
            `Caja ${i}`,
            `caja-${i}-${tenantId}@example.invalid`,
            roleId,
            tenantId,
          ],
        );
        await sql.query(
          `INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`,
          [terminalId, `Terminal ${i}`, tenantId],
        );
        await sql.query(
          `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
          [sessionId, userId, terminalId, tenantId],
        );
        seats.push({ tenantId, userId, sessionId });
      }
      const [categoryId, productId, variantId, withRnc, withoutRnc] = [
        0, 0, 0, 0, 0,
      ].map(() => randomUUID());
      await sql.query(
        `INSERT INTO "Customer" (id,name,"legalId","updatedAt","tenantId") VALUES ($1,'Empresa cliente','131-23456-7',now(),$2)`,
        [withRnc, tenantId],
      );
      await sql.query(
        `INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,'Consumidor',now(),$2)`,
        [withoutRnc, tenantId],
      );
      await sql.query(
        `INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'NCF QA',now(),$2)`,
        [categoryId, tenantId],
      );
      await sql.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Artículo',$2,$3,now(),$4)`,
        [productId, "P-" + tenantId.slice(-1), categoryId, tenantId],
      );
      await sql.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,$3,$4,10,20,1000,now(),$5)`,
        [
          variantId,
          productId,
          "V-" + tenantId.slice(-1),
          "B-" + tenantId.slice(-1),
          tenantId,
        ],
      );
      fixtures[tenantId] = { variantId, withRnc, withoutRnc };
    }
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const secret = "clave-local-aislada-solo-pruebas-ncf-venta";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    const auth = (s: Seat) =>
      "Bearer " +
      jwt.sign({
        sub: s.userId,
        sid: s.sessionId,
        type: "access",
        version: 0,
        tenantId: s.tenantId,
      });
    for (const s of seats) {
      const open = await http
        .post("/api/cash-sessions/open")
        .set("Authorization", auth(s))
        .send({ openingAmount: 0 });
      expect(open.status, JSON.stringify(open.body)).toBe(201);
      s.cash = open.body.id;
    }
    const [a, a2, a3, a4] = seats.filter((s) => s.tenantId === tenantA);
    const b = seats.find((s) => s.tenantId === tenantB)!;
    const body = (s: Seat, extra: Record<string, unknown> = {}) => ({
      offlineUuid: randomUUID(),
      customerId: fixtures[s.tenantId].withoutRnc,
      cashSessionId: s.cash,
      items: [{ variantId: fixtures[s.tenantId].variantId, qty: 1 }],
      payments: [{ method: "cash", amount: 20 }],
      ...extra,
    });
    const sell = (s: Seat, extra?: Record<string, unknown>) =>
      http
        .post("/api/sales")
        .set("Authorization", auth(s))
        .send(body(s, extra));
    const settings = (tenantId: string, data: object) =>
      sql.query(
        `INSERT INTO "Settings" ("tenantId",id,data,"updatedAt") VALUES ($1,'main',$2,now())
       ON CONFLICT ("tenantId",id) DO UPDATE SET data=EXCLUDED.data`,
        [tenantId, JSON.stringify(data)],
      );
    const ncfOf = async (id: string) =>
      (
        await sql.query(
          `SELECT ncf,"ncfType","fiscalStatus","recipientLegalId" FROM "Sale" WHERE id=$1`,
          [id],
        )
      ).rows[0];
    const next = async (id: string) =>
      (
        await sql.query(
          `SELECT "nextNumber"::text AS n FROM "NcfSequence" WHERE id=$1`,
          [id],
        )
      ).rows[0].n;
    const plusDays = (n: number) =>
      new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    const declare = async (s: Seat, payload: object) => {
      const r = await http
        .post("/api/ncf-sequences")
        .set("Authorization", auth(s))
        .send(payload);
      expect(r.status, JSON.stringify(r.body)).toBe(201);
      return r.body.id as string;
    };
    const b02 = await declare(a, {
      type: "B02",
      authorizationReference: "B02-A",
      firstNumber: "00000001",
      lastNumber: "00000100",
      nextNumber: "00000005",
      expiryApplies: false,
      expiresOn: null,
    });
    const b01 = await declare(a, {
      type: "B01",
      authorizationReference: "B01-A",
      firstNumber: "00000001",
      lastNumber: "00000003",
      nextNumber: "00000001",
      expiryApplies: true,
      expiresOn: plusDays(60),
    });

    // Interruptor apagado (por defecto): igual que antes, sin NCF ni consumo.
    const off = await sell(a);
    expect(off.status, JSON.stringify(off.body)).toBe(201);
    expect(await ncfOf(off.body.id)).toMatchObject({
      ncf: null,
      ncfType: null,
      fiscalStatus: "not_issued",
    });
    expect(await next(b02)).toBe("5");

    await settings(tenantA, {
      ncfMode: "sequences",
      allowOfflineSales: true,
      legalId: "131-00000-1",
    });
    // B02 por defecto, consecutivo desde el próximo declarado.
    const first = await sell(a);
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(await ncfOf(first.body.id)).toMatchObject({
      ncf: "B0200000005",
      ncfType: "B02",
      fiscalStatus: "issued",
    });
    expect(first.body.ncf).toBe("B0200000005");
    // NCF-07: la base rechaza «emitida» sin NCF y un NCF de otro tipo.
    await expect(
      sql.query(`UPDATE "Sale" SET "fiscalStatus"='issued' WHERE id=$1`, [
        off.body.id,
      ]),
    ).rejects.toThrow(/sale_issued_has_ncf/);
    await expect(
      sql.query(`UPDATE "Sale" SET ncf='B0100000099' WHERE id=$1`, [
        first.body.id,
      ]),
    ).rejects.toThrow(/sale_ncf_matches_type/);
    // Filas antiguas que violan: la migración avisa y omite, nunca aborta.
    const migration = await readFile(
      join(
        root,
        "apps/api/prisma/migrations/202610300001_ncf_coherencia/migration.sql",
      ),
      "utf8",
    );
    const hasCheck = async () =>
      (
        await sql.query(
          `SELECT 1 FROM pg_constraint WHERE conname='sale_issued_has_ncf'`,
        )
      ).rowCount;
    await sql.query(`ALTER TABLE "Sale" DROP CONSTRAINT sale_issued_has_ncf`);
    await sql.query(`UPDATE "Sale" SET "fiscalStatus"='issued' WHERE id=$1`, [
      off.body.id,
    ]);
    await sql.query(migration);
    expect(await hasCheck()).toBe(0);
    await sql.query(
      `UPDATE "Sale" SET "fiscalStatus"='not_issued' WHERE id=$1`,
      [off.body.id],
    );
    await sql.query(migration);
    expect(await hasCheck()).toBe(1);
    expect((await sell(a)).body.ncf).toBe("B0200000006");

    // B01: con el RNC guardado del cliente; sin RNC se rechaza.
    const fiscal = await sell(a, {
      ncfType: "B01",
      customerId: fixtures[tenantA].withRnc,
    });
    expect(fiscal.status, JSON.stringify(fiscal.body)).toBe(201);
    expect(await ncfOf(fiscal.body.id)).toMatchObject({
      ncf: "B0100000001",
      ncfType: "B01",
      recipientLegalId: "131234567",
    });
    const noRnc = await sell(a, { ncfType: "B01" });
    expect(noRnc.status).toBe(400);
    expect(noRnc.body.message).toContain("RNC o cédula");
    expect(await next(b01)).toBe("2");
    // NCF-02: 10 dígitos no es RNC (9) ni cédula (11): no consume NCF.
    const ten = await sell(a, {
      ncfType: "B01",
      recipientLegalId: "1234567890",
    });
    expect(ten.status).toBe(400);
    expect(await next(b01)).toBe("2");
    const cedula = await sell(a, {
      ncfType: "B01",
      recipientLegalId: "00100000001",
    });
    expect(cedula.status, JSON.stringify(cedula.body)).toBe(201);
    expect(cedula.body.ncf).toBe("B0100000002");
    expect((await sell(a, { ncfType: "E32" })).status).toBe(400);

    // Concurrencia: 12 ventas a la vez desde 4 cajas → 12 NCF únicos y seguidos.
    const parallel = await Promise.all(
      Array.from({ length: 12 }, (_, i) => sell([a, a2, a3, a4][i % 4])),
    );
    for (const r of parallel)
      expect(r.status, JSON.stringify(r.body)).toBe(201);
    const numbers = parallel
      .map((r) => Number(r.body.ncf.slice(3)))
      .sort((x, y) => x - y);
    expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => 7 + i));
    expect(await next(b02)).toBe("19");

    // NCF-01: una corrección administrativa espera el candado de la venta.
    const holder = new Client({ connectionString: url });
    await holder.connect();
    await holder.query("BEGIN");
    await holder.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      `ncf:${tenantA}:B02`,
    ]);
    let patched = false;
    const patch = http
      .patch(`/api/ncf-sequences/${b02}`)
      .set("Authorization", auth(a))
      .send({ nextNumber: "00000019" })
      .then((r) => ((patched = true), r));
    await new Promise((done) => setTimeout(done, 1500));
    expect(patched).toBe(false);
    await holder.query("COMMIT");
    await holder.end();
    expect((await patch).status).toBe(200);

    // La anulación conserva el NCF; el número nunca se reutiliza.
    const voided = await http
      .post(`/api/sales/${first.body.id}/void`)
      .set("Authorization", auth(a))
      .send({ reason: "Anulación de prueba NCF" });
    expect(voided.status, JSON.stringify(voided.body)).toBe(201);
    expect((await ncfOf(first.body.id)).ncf).toBe("B0200000005");
    expect((await sell(a)).body.ncf).toBe("B0200000019");

    // NCF-04/05: el libro fiscal conserva el anulado y el receptor del B01;
    // sólo administración.
    const book = await http
      .get("/api/reports/fiscal?limit=100")
      .set("Authorization", auth(a));
    expect(book.status, JSON.stringify(book.body)).toBe(200);
    expect(book.body.rows).toContainEqual(
      expect.objectContaining({ NCF: "B0200000005", Estado: "Anulado" }),
    );
    expect(book.body.rows).toContainEqual(
      expect.objectContaining({
        NCF: "B0100000001",
        Estado: "Emitido",
        RNC_cédula_receptor: "131234567",
      }),
    );
    const readerRole = randomUUID(),
      reader: Seat = {
        tenantId: tenantA,
        userId: randomUUID(),
        sessionId: randomUUID(),
      };
    const readerTerminal = randomUUID();
    await sql.query(
      `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Lectura',ARRAY['reports:read'],now(),$2)`,
      [readerRole, tenantA],
    );
    await sql.query(
      `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,'Lectora','lectora@example.invalid','test','test',$2,now(),$3)`,
      [reader.userId, readerRole, tenantA],
    );
    await sql.query(
      `INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,'Terminal L','main',now(),'test',$2)`,
      [readerTerminal, tenantA],
    );
    await sql.query(
      `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
      [reader.sessionId, reader.userId, readerTerminal, tenantA],
    );
    expect(
      (await http.get("/api/reports/fiscal").set("Authorization", auth(reader)))
        .status,
    ).toBe(403);

    // Venta offline: recibe el NCF en el servidor al sincronizar.
    const offline = body(a, { capturedAt: new Date().toISOString() });
    const synced = await http
      .post("/api/sales/sync")
      .set("Authorization", auth(a))
      .send({ sales: [offline] });
    expect(synced.body.results?.[0]?.status, JSON.stringify(synced.body)).toBe(
      "synced",
    );
    expect(
      (
        await sql.query(`SELECT ncf FROM "Sale" WHERE "offlineUuid"=$1`, [
          offline.offlineUuid,
        ])
      ).rows[0].ncf,
    ).toBe("B0200000020");

    // Rango vencido o agotado: no hay venta (con el interruptor encendido).
    await sql.query(`UPDATE "NcfSequence" SET "expiresOn"=$2 WHERE id=$1`, [
      b01,
      plusDays(-2),
    ]);
    const expired = await sell(a, {
      ncfType: "B01",
      customerId: fixtures[tenantA].withRnc,
    });
    expect(expired.status).toBe(400);
    expect(expired.body.message).toContain("No hay secuencia B01");
    await sql.query(`UPDATE "NcfSequence" SET "nextNumber"=101 WHERE id=$1`, [
      b02,
    ]);
    const exhausted = await sell(a);
    expect(exhausted.status).toBe(400);
    expect(exhausted.body.message).toContain("No hay secuencia B02");
    expect(await next(b02)).toBe("101");

    // Aislamiento: la empresa B nunca toma números de A.
    await settings(tenantB, { ncfMode: "sequences", legalId: "131000002" });
    await sql.query(`UPDATE "NcfSequence" SET "nextNumber"=50 WHERE id=$1`, [
      b02,
    ]);
    const bNone = await sell(b);
    expect(bNone.status).toBe(400);
    expect(await next(b02)).toBe("50");
    await declare(b, {
      type: "B02",
      authorizationReference: "B02-A",
      firstNumber: "00000001",
      lastNumber: "00000100",
      nextNumber: "00000001",
      expiryApplies: false,
      expiresOn: null,
    });
    expect((await sell(b)).body.ncf).toBe("B0200000001");
    expect((await sell(a)).body.ncf).toBe("B0200000050");
    // NCF-03: anonimizar al cliente no borra el receptor del B01 emitido.
    const anon = await http
      .post(`/api/customers/${fixtures[tenantA].withRnc}/anonymize`)
      .set("Authorization", auth(a))
      .send({ reason: "Solicitud verificada", requestRef: "NCF-03-PRUEBA" });
    expect(anon.status, JSON.stringify(anon.body)).toBe(201);
    expect((await ncfOf(fiscal.body.id)).recipientLegalId).toBe("131234567");
    const dupes = await sql.query(
      `SELECT "tenantId", ncf, count(*)::int AS n FROM "Sale" WHERE ncf IS NOT NULL GROUP BY 1,2 HAVING count(*)>1`,
    );
    expect(dupes.rows).toEqual([]);
  } finally {
    await app?.close().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await postgres?.stop().catch(() => undefined);
    if (dataDir)
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
  }
}, 240_000);
