import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaDir = join(root, "apps", "api", "prisma");
const migrationsDir = join(prismaDir, "migrations");
const preIdentityMigration = "202610130002_discount_audit";
const historicalMigration = "202610140001_lot_identity";
const forwardMigration = "202610160002_lot_identity_reconciliation";
const apiRequire = createRequire(join(root, "apps", "api", "package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const run = promisify(execFile);

const freePort = () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("No se pudo reservar un puerto para PostgreSQL."));
        return;
      }
      server.close((error) =>
        error ? reject(error) : resolvePort(address.port),
      );
    });
  });

async function migrate(schema: string, databaseUrl: string) {
  return run(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schema],
    {
      cwd: root,
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        PRISMA_HIDE_UPDATE_MESSAGE: "1",
      },
      timeout: 120_000,
    },
  );
}

async function historicalPrismaCopy(parent: string) {
  const target = join(parent, "prisma-historical");
  const targetMigrations = join(target, "migrations");
  await mkdir(targetMigrations, { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(target, "schema.prisma"));
  await cp(
    join(migrationsDir, "migration_lock.toml"),
    join(targetMigrations, "migration_lock.toml"),
  );
  const names = (await readdir(migrationsDir)).filter(
    (name) => name <= preIdentityMigration,
  );
  for (const name of names)
    await cp(join(migrationsDir, name), join(targetMigrations, name), {
      recursive: true,
    });
  return join(target, "schema.prisma");
}

describe("T1 · upgrade real de identidad de lotes", () => {
  it("aplica todas las migraciones sobre duplicados conflictivos y sanea cada lotId", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-lot-forward-db-"));
    const projectDir = await mkdtemp(
      join(tmpdir(), "nexora-lot-forward-project-"),
    );
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    let client: any;
    try {
      await database.initialise();
      await database.start();
      await database.createDatabase("nexora_lot_forward");
      const databaseUrl =
        `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}` +
        "/nexora_lot_forward";
      const historicalSchema = await historicalPrismaCopy(projectDir);

      const historical = await migrate(historicalSchema, databaseUrl);
      expect(historical.stdout).toContain(preIdentityMigration);

      client = database.getPgClient("nexora_lot_forward", "127.0.0.1");
      await client.connect();
      const categoryId = "10000000-0000-4000-8000-000000000001";
      const productId = "20000000-0000-4000-8000-000000000001";
      const variantId = "30000000-0000-4000-8000-000000000001";
      const keeperId = "40000000-0000-4000-8000-000000000001";
      // Debe contener letras hexadecimales: un UUID compuesto sólo por
      // números no permite demostrar la diferencia entre mayúsculas y
      // minúsculas dentro del JSON histórico.
      const duplicateId = "4abcdef0-0000-4000-8000-000000000002";
      const unicodeKeeperId = "40000000-0000-4000-8000-000000000003";
      const unicodeDuplicateId = "40000000-0000-4000-8000-000000000004";
      const distinctUnicodeId = "40000000-0000-4000-8000-000000000005";
      const fullwidthUnicodeId = "40000000-0000-4000-8000-000000000006";
      const orphanLotId = "40000000-0000-4000-8000-000000000099";
      const movementId = "50000000-0000-4000-8000-000000000001";
      const orphanMovementId = "50000000-0000-4000-8000-000000000002";
      const malformedItemId = "60000000-0000-4000-8000-000000000001";
      const arrayItemId = "60000000-0000-4000-8000-000000000002";
      const orphanItemId = "60000000-0000-4000-8000-000000000003";
      await client.query(
        `INSERT INTO "Category" (id,name,"requiresLot","requiresExpiry","updatedAt")
           VALUES ($1,'B1 forward',true,true,now())`,
        [categoryId],
      );
      await client.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt")
           VALUES ($1,'Producto B1 forward','B1-F-P',$2,now())`,
        [productId, categoryId],
      );
      await client.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt")
           VALUES ($1,$2,'B1-F-V','B1-F-C',10,20,0,now())`,
        [variantId, productId],
      );
      // El índice histórico permite estas dos claves distintas. La nueva
      // normalización las hace converger. 03:59Z y 04:01Z pertenecen a días
      // diferentes en República Dominicana (23:59 y 00:01).
      await client.query(
        `INSERT INTO "Lot"
             (id,"variantId","lotNumber","expiryDate",qty,cost,"createdAt","updatedAt") VALUES
             ($1,$6,' frontera lote ','2031-06-01 03:59:00',2,10,'2026-01-01',now()),
             ($2,$6,'FRONTERA   LOTE','2031-06-01 04:01:00',3,20,'2026-01-02',now()),
             ($3,$6,'café',NULL,1,12,'2026-01-03',now()),
             ($4,$6,U&'cafe\\0301',NULL,2,18,'2026-01-04',now()),
             ($5,$6,'LOT-1',NULL,4,30,'2026-01-05',now()),
             ($7,$6,'ＬＯＴ－１',NULL,5,40,'2026-01-06',now())`,
        [
          keeperId,
          duplicateId,
          unicodeKeeperId,
          unicodeDuplicateId,
          distinctUnicodeId,
          variantId,
          fullwidthUnicodeId,
        ],
      );
      await client.query(
        `INSERT INTO "InventoryMovement"
             (id,"variantId","lotId",type,qty,"unitCost","balanceAfter",reason,"userId")
           VALUES ($1,$2,$3,'adjustment',1,10,1,'B1 forward','qa')`,
        [movementId, variantId, duplicateId],
      );
      await client.query("SET session_replication_role = replica");
      await client.query(
        `INSERT INTO "InventoryMovement"
             (id,"variantId","lotId",type,qty,"unitCost","balanceAfter",reason,"userId")
           VALUES ($1,$2,$3,'adjustment',1,10,1,'B1 orphan','qa')`,
        [orphanMovementId, variantId, orphanLotId],
      );
      await client.query("SET session_replication_role = origin");
      await client.query(
        `INSERT INTO "Sale"
             (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt") VALUES
             ('70000000-0000-4000-8000-000000000001','B1-1','71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001',20,0,0,20,10,now()),
             ('70000000-0000-4000-8000-000000000002','B1-2','71000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001',20,0,0,20,10,now()),
             ('70000000-0000-4000-8000-000000000003','B1-3','71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001',20,0,0,20,10,now())`,
      );
      await client.query(
        `INSERT INTO "SaleItem"
             (id,"saleId","variantId","lotId",qty,"unitPrice","unitCost",discount,tax,"lineTotal","stockAllocations") VALUES
             ($1,'70000000-0000-4000-8000-000000000001',$4,$5,1,20,10,0,0,20,$6::jsonb),
             ($2,'70000000-0000-4000-8000-000000000002',$4,$5,1,20,10,0,0,20,$7::jsonb),
             ($3,'70000000-0000-4000-8000-000000000003',$4,$8,1,20,10,0,0,20,'[]'::jsonb)`,
        [
          malformedItemId,
          arrayItemId,
          orphanItemId,
          variantId,
          duplicateId,
          JSON.stringify({ lotId: duplicateId }),
          JSON.stringify([{ lotId: duplicateId.toUpperCase(), qty: 1 }]),
          orphanLotId,
        ],
      );
      const deployed = await migrate(
        join(prismaDir, "schema.prisma"),
        databaseUrl,
      );
      expect(deployed.stdout).toContain(forwardMigration);
      expect(
        (await migrate(join(prismaDir, "schema.prisma"), databaseUrl)).stdout,
      ).toContain("No pending migrations");

      const lots = (
        await client.query(
          `SELECT id,"lotNumberNormalized",qty,cost,
                  to_char("expiryDate",'YYYY-MM-DD HH24:MI:SS') AS "expiryDateText"
             FROM "Lot" WHERE "variantId"=$1
             ORDER BY "lotNumberNormalized"`,
          [variantId],
        )
      ).rows;
      expect(lots).toHaveLength(4);
      const byId = new Map(lots.map((lot: any) => [lot.id, lot]));
      expect(byId.get(keeperId)).toMatchObject({
        id: keeperId,
        lotNumberNormalized: "FRONTERA LOTE",
        expiryDateText: "2031-06-01 03:59:00",
      });
      expect(Number(byId.get(keeperId).qty)).toBe(5);
      expect(Number(byId.get(keeperId).cost)).toBe(16);
      expect(byId.get(unicodeKeeperId)).toMatchObject({
        id: unicodeKeeperId,
        lotNumberNormalized: "CAFÉ",
      });
      expect(Number(byId.get(unicodeKeeperId).qty)).toBe(3);
      expect(Number(byId.get(unicodeKeeperId).cost)).toBe(16);
      expect(byId.get(distinctUnicodeId)).toMatchObject({
        id: distinctUnicodeId,
        lotNumberNormalized: "LOT-1",
      });
      expect(byId.get(fullwidthUnicodeId)).toMatchObject({
        id: fullwidthUnicodeId,
        lotNumberNormalized: "ＬＯＴ－１",
      });

      const conflict = (
        await client.query(`SELECT * FROM "LotIdentityConflict"`)
      ).rows;
      expect(conflict).toHaveLength(1);
      expect(conflict[0].keeperLotId).toBe(keeperId);
      expect(conflict[0].sourceLotIds).toEqual([keeperId, duplicateId]);
      expect(new Set(conflict[0].expiryDates)).toEqual(
        new Set(["2031-05-31", "2031-06-01"]),
      );

      expect(
        (
          await client.query(
            `SELECT "lotId" FROM "InventoryMovement" WHERE id=$1`,
            [movementId],
          )
        ).rows[0].lotId,
      ).toBe(keeperId);
      expect(
        (
          await client.query(
            `SELECT "lotId" FROM "InventoryMovement" WHERE id=$1`,
            [orphanMovementId],
          )
        ).rows[0].lotId,
      ).toBeNull();
      const items = (
        await client.query(
          `SELECT id,"lotId","stockAllocations" FROM "SaleItem"
             WHERE id IN ($1,$2,$3) ORDER BY id`,
          [malformedItemId, arrayItemId, orphanItemId],
        )
      ).rows;
      expect(items[0].stockAllocations).toEqual({ lotId: duplicateId });
      expect(items[0].lotId).toBe(keeperId);
      expect(items[1].stockAllocations[0].lotId).toBe(keeperId);
      expect(items[1].lotId).toBe(keeperId);
      expect(items[2].lotId).toBeNull();
      expect(
        Number(
          (
            await client.query(`
              SELECT count(*)::int AS invalid
              FROM "SaleItem" AS item
              CROSS JOIN LATERAL jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(item."stockAllocations") = 'array'
                    THEN item."stockAllocations"
                  ELSE '[]'::jsonb
                END
              ) AS allocation(value)
              LEFT JOIN "Lot" AS lot
                ON lower(allocation.value->>'lotId') = lot.id::text
              WHERE allocation.value ? 'lotId' AND lot.id IS NULL
            `)
          ).rows[0].invalid,
        ),
      ).toBe(0);
      expect(
        Number(
          (
            await client.query(`
              SELECT count(*)::int AS invalid
              FROM "SaleItem" AS item
              LEFT JOIN "Lot" AS lot ON lot.id = item."lotId"
              WHERE item."lotId" IS NOT NULL AND lot.id IS NULL
            `)
          ).rows[0].invalid,
        ),
      ).toBe(0);
      expect(
        Number(
          (
            await client.query(`
              SELECT count(*)::int AS invalid
              FROM "InventoryMovement" AS movement
              LEFT JOIN "Lot" AS lot ON lot.id = movement."lotId"
              WHERE movement."lotId" IS NOT NULL AND lot.id IS NULL
            `)
          ).rows[0].invalid,
        ),
      ).toBe(0);
      expect(
        (
          await client.query(`
            SELECT conname FROM pg_constraint
            WHERE conname IN ('InventoryMovement_lotId_fkey','SaleItem_lotId_fkey')
            ORDER BY conname
          `)
        ).rows.map((row: any) => row.conname),
      ).toEqual(["InventoryMovement_lotId_fkey", "SaleItem_lotId_fkey"]);

      const applied = await client.query(
        `SELECT migration_name,finished_at,rolled_back_at
           FROM "_prisma_migrations"
          WHERE migration_name IN ($1,$2) ORDER BY migration_name`,
        [historicalMigration, forwardMigration],
      );
      expect(applied.rows).toHaveLength(2);
      expect(applied.rows.every((row: any) => row.finished_at)).toBe(true);
      expect(
        applied.rows.every((row: any) => row.rolled_back_at === null),
      ).toBe(true);
    } finally {
      if (client) await client.end().catch(() => undefined);
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await rm(projectDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 180_000);

  it("reasigna JSON con UUID en mayúsculas durante 140001 sin conflictos", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-lot-history-db-"));
    const projectDir = await mkdtemp(
      join(tmpdir(), "nexora-lot-history-project-"),
    );
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    let client: any;
    try {
      await database.initialise();
      await database.start();
      await database.createDatabase("nexora_lot_history");
      const databaseUrl =
        `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}` +
        "/nexora_lot_history";
      const historicalSchema = await historicalPrismaCopy(projectDir);
      await migrate(historicalSchema, databaseUrl);

      client = database.getPgClient("nexora_lot_history", "127.0.0.1");
      await client.connect();
      const categoryId = "1a000000-0000-4000-8000-000000000001";
      const productId = "2a000000-0000-4000-8000-000000000001";
      const variantId = "3a000000-0000-4000-8000-000000000001";
      const keeperId = "4abcdef0-0000-4000-8000-000000000011";
      const duplicateId = "4abcdef0-0000-4000-8000-000000000012";
      const saleId = "7a000000-0000-4000-8000-000000000001";
      const itemId = "6a000000-0000-4000-8000-000000000001";
      await client.query(
        `INSERT INTO "Category" (id,name,"requiresLot","requiresExpiry","updatedAt")
           VALUES ($1,'T1b histórico',true,false,now())`,
        [categoryId],
      );
      await client.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt")
           VALUES ($1,'Producto T1b histórico','T1B-H-P',$2,now())`,
        [productId, categoryId],
      );
      await client.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt")
           VALUES ($1,$2,'T1B-H-V','T1B-H-C',10,20,0,now())`,
        [variantId, productId],
      );
      await client.query(
        `INSERT INTO "Lot"
             (id,"variantId","lotNumber","expiryDate",qty,cost,"createdAt","updatedAt") VALUES
             ($1,$3,' historial lote ',NULL,2,10,'2026-01-01',now()),
             ($2,$3,'HISTORIAL   LOTE',NULL,3,20,'2026-01-02',now())`,
        [keeperId, duplicateId, variantId],
      );
      await client.query(
        `INSERT INTO "Sale"
             (id,number,"offlineUuid","sellerId",subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt")
           VALUES ($1,'T1B-H-1','7a000000-0000-4000-8000-000000000002',
                   '7a000000-0000-4000-8000-000000000003',20,0,0,20,10,now())`,
        [saleId],
      );
      await client.query(
        `INSERT INTO "SaleItem"
             (id,"saleId","variantId","lotId",qty,"unitPrice","unitCost",discount,tax,"lineTotal","stockAllocations")
           VALUES ($1,$2,$3,$4,1,20,10,0,0,20,$5::jsonb)`,
        [
          itemId,
          saleId,
          variantId,
          duplicateId,
          JSON.stringify([{ lotId: duplicateId.toUpperCase(), qty: 1 }]),
        ],
      );

      await migrate(join(prismaDir, "schema.prisma"), databaseUrl);

      const rows = (
        await client.query(
          `SELECT item."lotId",item."stockAllocations"
             FROM "SaleItem" AS item WHERE item.id=$1`,
          [itemId],
        )
      ).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].lotId).toBe(keeperId);
      expect(rows[0].stockAllocations).toEqual([{ lotId: keeperId, qty: 1 }]);
      expect(
        Number(
          (
            await client.query(
              `
              SELECT count(*)::int AS invalid
              FROM "SaleItem" AS item
              CROSS JOIN LATERAL jsonb_array_elements(item."stockAllocations")
                AS allocation(value)
              LEFT JOIN "Lot" AS lot
                ON lower(allocation.value->>'lotId') = lot.id::text
              WHERE item.id=$1 AND allocation.value ? 'lotId'
                AND lot.id IS NULL
            `,
              [itemId],
            )
          ).rows[0].invalid,
        ),
      ).toBe(0);
    } finally {
      if (client) await client.end().catch(() => undefined);
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await rm(projectDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 180_000);

  it("falla temprano con diagnóstico explícito cuando falta la colación ICU", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-lot-no-icu-db-"));
    const projectDir = await mkdtemp(
      join(tmpdir(), "nexora-lot-no-icu-project-"),
    );
    const port = await freePort();
    const database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    let client: any;
    try {
      await database.initialise();
      await database.start();
      await database.createDatabase("nexora_lot_no_icu");
      const databaseUrl =
        `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}` +
        "/nexora_lot_no_icu";
      const historicalSchema = await historicalPrismaCopy(projectDir);
      await migrate(historicalSchema, databaseUrl);
      client = database.getPgClient("nexora_lot_no_icu", "127.0.0.1");
      await client.connect();
      expect(
        Number(
          (
            await client.query(
              `SELECT count(*)::int AS count FROM pg_collation
                WHERE collname='und-x-icu'`,
            )
          ).rows[0].count,
        ),
      ).toBe(1);
      await client.query(
        `ALTER COLLATION pg_catalog."und-x-icu"
           RENAME TO "und-x-icu-disabled"`,
      );

      let diagnostic = "";
      try {
        await migrate(join(prismaDir, "schema.prisma"), databaseUrl);
      } catch (error: any) {
        diagnostic = [error?.message, error?.stdout, error?.stderr]
          .filter(Boolean)
          .join("\n");
      }
      expect(diagnostic).toContain(
        "Falta la colación ICU und-x-icu: use un PostgreSQL con ICU.",
      );
    } finally {
      if (client) await client.end().catch(() => undefined);
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
      await rm(projectDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 180_000);
});
