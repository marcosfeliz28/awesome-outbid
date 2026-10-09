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
    (name) => name <= historicalMigration,
  );
  for (const name of names)
    await cp(join(migrationsDir, name), join(targetMigrations, name), {
      recursive: true,
    });
  return join(target, "schema.prisma");
}

describe("B1-forward · upgrade real de identidad de lotes", () => {
  it("conserva el checksum histórico y reconcilia en una migración posterior", async () => {
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
      expect(historical.stdout).toContain(historicalMigration);

      client = database.getPgClient("nexora_lot_forward", "127.0.0.1");
      await client.connect();
      const categoryId = "10000000-0000-4000-8000-000000000001";
      const productId = "20000000-0000-4000-8000-000000000001";
      const variantId = "30000000-0000-4000-8000-000000000001";
      const keeperId = "40000000-0000-4000-8000-000000000001";
      const duplicateId = "40000000-0000-4000-8000-000000000002";
      const movementId = "50000000-0000-4000-8000-000000000001";
      const malformedItemId = "60000000-0000-4000-8000-000000000001";
      const arrayItemId = "60000000-0000-4000-8000-000000000002";
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
             (id,"variantId","lotNumber","lotNumberNormalized","expiryDate",qty,cost,"createdAt","updatedAt") VALUES
             ($1,$3,' frontera lote ','FRONTERA LOTE','2031-06-01 03:59:00',2,10,'2026-01-01',now()),
             ($2,$3,'FRONTERA   LOTE','frontera lote','2031-06-01 04:01:00',3,20,'2026-01-02',now())`,
        [keeperId, duplicateId, variantId],
      );
      await client.query(
        `INSERT INTO "InventoryMovement"
             (id,"variantId","lotId",type,qty,"unitCost","balanceAfter",reason,"userId")
           VALUES ($1,$2,$3,'adjustment',1,10,1,'B1 forward','qa')`,
        [movementId, variantId, duplicateId],
      );
      await client.query("SET session_replication_role = replica");
      await client.query(
        `INSERT INTO "SaleItem"
             (id,"saleId","variantId",qty,"unitPrice","unitCost",discount,tax,"lineTotal","stockAllocations") VALUES
             ($1,'70000000-0000-4000-8000-000000000001',$3,1,20,10,0,0,20,$4::jsonb),
             ($2,'70000000-0000-4000-8000-000000000002',$3,1,20,10,0,0,20,$5::jsonb)`,
        [
          malformedItemId,
          arrayItemId,
          variantId,
          JSON.stringify({ lotId: duplicateId }),
          JSON.stringify([{ lotId: duplicateId, qty: 1 }]),
        ],
      );
      await client.query("SET session_replication_role = origin");

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
             FROM "Lot" WHERE "variantId"=$1`,
          [variantId],
        )
      ).rows;
      expect(lots).toHaveLength(1);
      expect(lots[0]).toMatchObject({
        id: keeperId,
        lotNumberNormalized: "FRONTERA LOTE",
        expiryDateText: "2031-06-01 03:59:00",
      });
      expect(Number(lots[0].qty)).toBe(5);
      expect(Number(lots[0].cost)).toBe(16);

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
      const items = (
        await client.query(
          `SELECT id,"stockAllocations" FROM "SaleItem"
             WHERE id IN ($1,$2) ORDER BY id`,
          [malformedItemId, arrayItemId],
        )
      ).rows;
      expect(items[0].stockAllocations).toEqual({ lotId: duplicateId });
      expect(items[1].stockAllocations[0].lotId).toBe(keeperId);

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
});
