// Baja definitiva de una empresa (tenant:purge) con dos empresas en PostgreSQL
// real: A se borra entera menos lo fiscal; B queda idéntica. También B6: la API
// en producción sin PRODUCT_TENANCY no arranca sobre una base multiempresa.
import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter, Database } from "../apps/api/src/common";
import { exportModels, exportTenant } from "../apps/api/src/tenant-export";
import { tenantScope } from "../apps/api/src/tenant-context";
import { tenantObjectStore } from "../apps/api/src/tenant-object-store";
import { purgeTenant } from "../apps/api/src/tenant-purge";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);
const id = (n: number) =>
  `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const A = "20000000-0000-4000-8000-00000000000a";
const B = "20000000-0000-4000-8000-00000000000b";

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

it("tenant:purge borra sólo la empresa A (suspendida ≥30 días y exportada), conserva lo fiscal y deja B intacta", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-purge-"));
  const port = await freePort();
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "purge_qa",
    password: "purge_qa_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  const names = [
    "DATABASE_URL",
    "PRODUCT_TENANCY",
    "NODE_ENV",
    "PRODUCT_OBJECT_STORE_DIR",
    "NEXORA_RETENTION",
    "TELEGRAM_BOT_TOKEN",
    "RESEND_API_KEY",
  ];
  const saved = Object.fromEntries(names.map((n) => [n, process.env[n]]));
  let sql: any;
  let app: any;
  let db: any;
  let owner: any;
  try {
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("purge_qa");
    const url = `postgresql://purge_qa:purge_qa_only@127.0.0.1:${port}/purge_qa`;
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
    process.env.DATABASE_URL = url;
    sql = pg.getPgClient("purge_qa", "127.0.0.1");
    await sql.connect();

    // B6: producción sin PRODUCT_TENANCY. Sólo la Demo (tienda): arranca.
    delete process.env.PRODUCT_TENANCY;
    process.env.NODE_ENV = "production";
    const tienda = new Database();
    await expect(tienda.onModuleInit()).resolves.toBeUndefined();
    await tienda.$disconnect();

    await sql.query(
      `INSERT INTO "Tenant" (id,slug,name,plan,"updatedAt") VALUES ($1,'empresa-a','Empresa A','pro',now()),($2,'empresa-b','Empresa B','pro',now())`,
      [A, B],
    );
    // B6: con otras empresas en la base es el producto sin su variable: no arranca.
    const perdida = new Database();
    await expect(perdida.onModuleInit()).rejects.toThrow(/PRODUCT_TENANCY/);
    await perdida.$disconnect();
    process.env.NODE_ENV = "test";

    const rows = [A, B].map((tenantId, i) => ({
      tenantId,
      roleId: id(10 + i),
      userId: id(20 + i),
      terminalId: id(30 + i),
      sessionId: id(40 + i),
      categoryId: id(50 + i),
      productId: id(60 + i),
      variantId: id(70 + i),
      customerId: id(80 + i),
    }));
    for (const [i, r] of rows.entries()) {
      await sql.query(
        `INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`,
        [r.roleId, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","updatedAt","tenantId") VALUES ($1,$2,$3,'test','test',$4,now(),$5)`,
        [
          r.userId,
          `Admin ${i}`,
          `purge-${i}@example.invalid`,
          r.roleId,
          r.tenantId,
        ],
      );
      await sql.query(
        `INSERT INTO "Terminal" (id,name,"branchId","approvedAt","secretHash","tenantId") VALUES ($1,$2,'main',now(),'test',$3)`,
        [r.terminalId, `Caja ${i}`, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "AuthSession" (id,"userId","terminalId","tenantId") VALUES ($1,$2,$3,$4)`,
        [r.sessionId, r.userId, r.terminalId, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "Customer" (id,name,"updatedAt","tenantId") VALUES ($1,'Cliente',now(),$2)`,
        [r.customerId, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,'General',now(),$2)`,
        [r.categoryId, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Artículo','SKU-1',$2,now(),$3)`,
        [r.productId, r.categoryId, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt","tenantId") VALUES ($1,$2,'SKU-1','BAR-1',10,20,20,now(),$3)`,
        [r.variantId, r.productId, r.tenantId],
      );
      await sql.query(
        `INSERT INTO "PlatformPayment" (id,"tenantId",amount,method,reference,months,operator,"paidFrom","paidUntil") VALUES ($1,$2,1500,'transfer',$3,1,'operador',now(),now()+interval '1 month')`,
        [id(90 + i), r.tenantId, `REF-${i}`],
      );
    }

    process.env.PRODUCT_TENANCY = "required";
    process.env.NEXORA_RETENTION = "off";
    process.env.PRODUCT_OBJECT_STORE_DIR = join(dataDir, "objects");
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.RESEND_API_KEY;
    const store = tenantObjectStore();
    const objectKey = (i: number) =>
      `billing/20000000-0000-4000-8000-0000000001${i}0`;
    for (const [i, r] of rows.entries()) {
      await store.put(
        r.tenantId,
        objectKey(i),
        Buffer.from(`comprobante ${i}`),
        "image/png",
      );
      await sql.query(
        `INSERT INTO "BillingRequest" (id,"tenantId",plan,provider,amount,"proofObjectKey","proofMime","updatedAt") VALUES (gen_random_uuid(),$1,'basic','bank_transfer',100,$2,'image/png',now())`,
        [r.tenantId, objectKey(i)],
      );
    }
    // Movimiento real de negocio por HTTP en las dos empresas (caja, venta, bitácora…).
    const secret = "clave-local-purge-solo-pruebas";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    app = await NestFactory.create(createAppModule(secret), { logger: false });
    app.setGlobalPrefix("api");
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const http = supertest(app.getHttpServer());
    const jwt = new JwtService({ secret });
    for (const [i, r] of rows.entries()) {
      const auth =
        "Bearer " +
        jwt.sign({
          sub: r.userId,
          sid: r.sessionId,
          type: "access",
          version: 0,
          tenantId: r.tenantId,
        });
      const open = await http
        .post("/api/cash-sessions/open")
        .set("Authorization", auth)
        .send({ openingAmount: 50 });
      expect(open.status, JSON.stringify(open.body)).toBe(201);
      const sale = await http
        .post("/api/sales")
        .set("Authorization", auth)
        .send({
          offlineUuid: id(100 + i),
          customerId: r.customerId,
          cashSessionId: open.body.id,
          items: [{ variantId: r.variantId, qty: 1 }],
          payments: [{ method: "cash", amount: 20 }],
        });
      expect(sale.status, JSON.stringify(sale.body)).toBe(201);
    }
    await app.close();
    app = undefined;

    const tables = exportModels()
      .map((m) => m.table)
      .filter((t) => t !== "Tenant");
    const snapshot = async (tenantId: string) => {
      const out: Record<string, string> = {};
      for (const t of tables)
        out[t] = JSON.stringify(
          (
            await sql.query(
              `SELECT * FROM "${t}" WHERE "tenantId"=$1 ORDER BY 1`,
              [tenantId],
            )
          ).rows,
        );
      out.Tenant = JSON.stringify(
        (await sql.query(`SELECT * FROM "Tenant" WHERE id=$1`, [tenantId]))
          .rows,
      );
      return out;
    };
    const beforeB = await snapshot(B);
    expect(
      Number(
        (
          await sql.query(`SELECT count(*) FROM "Sale" WHERE "tenantId"=$1`, [
            A,
          ])
        ).rows[0].count,
      ),
    ).toBe(1);

    db = new Database();
    await db.$connect();
    // El operador conecta como dueño de la base (sin RLS), como el script.
    const { PrismaClient } = apiRequire("@prisma/client");
    owner = new PrismaClient({ datasources: { db: { url } } });
    const now = new Date();
    // Activa: no se purga.
    await expect(purgeTenant({ db: owner, slug: "empresa-a" })).rejects.toThrow(
      /no está suspendida/,
    );
    await sql.query(
      `UPDATE "Tenant" SET status='suspended',"suspendedAt"=now()-interval '10 days' WHERE id=$1`,
      [A],
    );
    await expect(purgeTenant({ db: owner, slug: "empresa-a" })).rejects.toThrow(
      /10 días suspendida; se exigen 30/,
    );
    await sql.query(
      `UPDATE "Tenant" SET "suspendedAt"=now()-interval '31 days' WHERE id=$1`,
      [A],
    );

    // dry-run por defecto: cuenta y no borra.
    const dry = await purgeTenant({ db: owner, slug: "empresa-a" });
    expect(dry.executed).toBe(false);
    expect(dry.counts.Sale).toBe(1);
    expect(dry.counts.User).toBe(1);
    expect(dry.kept).toMatchObject({ Tenant: 1, PlatformPayment: 1 });
    expect(dry.objects).toEqual([objectKey(0)]);
    expect(
      Number(
        (
          await sql.query(`SELECT count(*) FROM "Sale" WHERE "tenantId"=$1`, [
            A,
          ])
        ).rows[0].count,
      ),
    ).toBe(1);

    // Sin confirmación o sin exportación verificada: no borra.
    await expect(
      purgeTenant({ db: owner, slug: "empresa-a", execute: true }),
    ).rejects.toThrow(/--confirmar/);
    await expect(
      purgeTenant({ db: owner,
        slug: "empresa-a",
        execute: true,
        confirm: "empresa-a",
      }),
    ).rejects.toThrow(/--exportacion/);
    const exportFile = join(dataDir, "empresa-a.json");
    await writeFile(
      exportFile,
      JSON.stringify(
        await tenantScope.run({ tenantId: A }, () => exportTenant(db, A)),
      ),
    );
    // Exportación desactualizada (una fila más en la base): no borra.
    await sql.query(
      `INSERT INTO "Brand" (id,"tenantId",name) VALUES (gen_random_uuid(),$1,'Marca tardía')`,
      [A],
    );
    await expect(
      purgeTenant({ db: owner,
        slug: "empresa-a",
        execute: true,
        confirm: "empresa-a",
        exportPath: exportFile,
      }),
    ).rejects.toThrow(
      /Exportación no verificada: Brand: 0 en la exportación, 1 en la base/,
    );
    // Exportación de otra empresa: no borra.
    const exportB = join(dataDir, "empresa-b.json");
    await writeFile(
      exportB,
      JSON.stringify(
        await tenantScope.run({ tenantId: B }, () => exportTenant(db, B)),
      ),
    );
    await expect(
      purgeTenant({ db: owner,
        slug: "empresa-a",
        execute: true,
        confirm: "empresa-a",
        exportPath: exportB,
      }),
    ).rejects.toThrow(/otra empresa/);
    await writeFile(
      exportFile,
      JSON.stringify(
        await tenantScope.run({ tenantId: A }, () => exportTenant(db, A)),
      ),
    );

    const done = await purgeTenant({ db: owner,
      slug: "empresa-a",
      execute: true,
      confirm: "empresa-a",
      exportPath: exportFile,
      now,
    });
    expect(done.executed).toBe(true);
    expect(done.objectsFailed).toEqual([]);
    const afterA = await snapshot(A);
    for (const t of tables) {
      const n = JSON.parse(afterA[t]).length;
      if (t === "PlatformPayment" || t === "AiPackCredit") continue;
      expect(n, t).toBe(0);
    }
    expect(JSON.parse(afterA.PlatformPayment)).toHaveLength(1);
    expect(JSON.parse(afterA.Tenant)).toHaveLength(1);
    await expect(store.get(A, objectKey(0))).rejects.toThrow();
    // B: idéntica fila por fila y su archivo sigue.
    expect(await snapshot(B)).toEqual(beforeB);
    expect((await store.get(B, objectKey(1))).toString()).toBe("comprobante 1");
    // Repetir es inofensivo: no queda nada que borrar.
    const again = await purgeTenant({ db: owner, slug: "empresa-a" });
    expect(Object.values(again.counts).every((n) => n === 0)).toBe(true);
  } finally {
    await app?.close().catch(() => undefined);
    await db?.$disconnect().catch(() => undefined);
    await owner?.$disconnect().catch(() => undefined);
    await sql?.end().catch(() => undefined);
    for (const [n, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[n];
      else process.env[n] = v;
    }
    await pg.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true }).catch(() => undefined);
  }
}, 240_000);
