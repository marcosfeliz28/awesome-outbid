import { createServer } from "node:net";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationsDir = join(root, "apps", "api", "prisma", "migrations");
const targetMigration = "202610140001_lot_identity";

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

const inTransaction = async (client: any, sql: string) => {
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
};

describe("B1 · migración real de identidad de lotes", () => {
  it("aplica después de las 21 migraciones previas y resuelve datos conflictivos sin abortar", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-lot-migration-"));
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
      await database.createDatabase("nexora_lot_migration");
      client = database.getPgClient("nexora_lot_migration", "127.0.0.1");
      await client.connect();

      const migrationNames = (await readdir(migrationsDir))
        .filter((name) => name < targetMigration)
        .sort();
      expect(migrationNames).toHaveLength(21);
      expect(migrationNames.at(-1)).toBe("202610130002_discount_audit");
      for (const name of migrationNames) {
        const sql = await readFile(
          join(migrationsDir, name, "migration.sql"),
          "utf8",
        );
        await inTransaction(client, sql);
      }

      const categoryId = "10000000-0000-4000-8000-000000000001";
      const productId = "20000000-0000-4000-8000-000000000001";
      const variantId = "30000000-0000-4000-8000-000000000001";
      const oldLotId = "40000000-0000-4000-8000-000000000001";
      const negativeLotId = "40000000-0000-4000-8000-000000000002";
      const unicodeLotId = "40000000-0000-4000-8000-000000000003";
      const movementId = "50000000-0000-4000-8000-000000000001";
      const malformedItemId = "60000000-0000-4000-8000-000000000001";
      const arrayItemId = "60000000-0000-4000-8000-000000000002";
      await client.query(
        `INSERT INTO "Category" (id,name,"requiresLot","requiresExpiry","updatedAt")
           VALUES ($1,'B1',true,true,now())`,
        [categoryId],
      );
      await client.query(
        `INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt")
           VALUES ($1,'Producto B1','B1-P',$2,now())`,
        [productId, categoryId],
      );
      await client.query(
        `INSERT INTO "Variant" (id,"productId",sku,barcode,"costAvg",price,stock,"updatedAt")
           VALUES ($1,$2,'B1-V','B1-C',10,20,0,now())`,
        [variantId, productId],
      );
      await client.query(
        `INSERT INTO "Lot" (id,"variantId","lotNumber","expiryDate",qty,cost,"createdAt","updatedAt") VALUES
             ($1,$4,U&'  lote\\00A0abc  ','2031-06-01T04:00:00Z',5,10,'2026-01-01',now()),
             ($2,$4,'LOTE ABC','2031-05-01T04:00:00Z',10,-100,'2026-01-02',now()),
             ($3,$4,U&'\\FF2C\\FF2F\\FF34\\FF25\\3000\\FF21\\FF22\\FF23',NULL,2,30,'2026-01-03',now());`,
        [oldLotId, negativeLotId, unicodeLotId, variantId],
      );
      await client.query(
        `INSERT INTO "InventoryMovement"
             (id,"variantId","lotId",type,qty,"unitCost","balanceAfter",reason,"userId")
           VALUES ($1,$2,$3,'adjustment',1,10,1,'B1','qa');`,
        [movementId, variantId, negativeLotId],
      );

      // Filas históricas malformadas: una debe quedar intacta y el array debe
      // cambiar al lote conservado. Se omiten FKs para aislar la forma JSON.
      await client.query("SET session_replication_role = replica");
      await client.query(
        `INSERT INTO "SaleItem"
             (id,"saleId","variantId",qty,"unitPrice","unitCost",discount,tax,"lineTotal","stockAllocations")
           VALUES
             ($1,'70000000-0000-4000-8000-000000000001',$3,1,20,10,0,0,20,$4::jsonb),
             ($2,'70000000-0000-4000-8000-000000000002',$3,1,20,10,0,0,20,$5::jsonb);`,
        [
          malformedItemId,
          arrayItemId,
          variantId,
          JSON.stringify({ lotId: negativeLotId }),
          JSON.stringify([{ lotId: negativeLotId, qty: 1 }]),
        ],
      );
      await client.query("SET session_replication_role = origin");

      const migrationSql = await readFile(
        join(migrationsDir, targetMigration, "migration.sql"),
        "utf8",
      );
      await inTransaction(client, migrationSql);

      const lots = (
        await client.query(
          `SELECT id,"lotNumberNormalized",qty,cost,"expiryDate",
                  to_char("expiryDate",'YYYY-MM-DD HH24:MI:SS') AS "expiryDateText"
             FROM "Lot" WHERE "variantId"=$1`,
          [variantId],
        )
      ).rows;
      expect(lots).toHaveLength(1);
      expect(lots[0].id).toBe(oldLotId);
      expect(lots[0].lotNumberNormalized).toBe("LOTE ABC");
      expect(Number(lots[0].qty)).toBe(17);
      expect(Number(lots[0].cost)).toBe(6.47);
      expect(lots[0].expiryDateText).toBe("2031-05-01 04:00:00");

      const conflict = (
        await client.query(
          `SELECT *,
                  to_char("chosenExpiryDate",'YYYY-MM-DD HH24:MI:SS') AS "chosenExpiryDateText"
           FROM "LotIdentityConflict"`,
        )
      ).rows;
      expect(conflict).toHaveLength(1);
      expect(conflict[0].keeperLotId).toBe(oldLotId);
      expect(conflict[0].sourceLotIds).toEqual([
        oldLotId,
        negativeLotId,
        unicodeLotId,
      ]);
      expect(new Set(conflict[0].expiryDates)).toEqual(
        new Set(["2031-05-01", "2031-06-01"]),
      );
      expect(conflict[0].chosenExpiryDateText).toBe("2031-05-01 04:00:00");

      const movement = await client.query(
        `SELECT "lotId" FROM "InventoryMovement" WHERE id=$1`,
        [movementId],
      );
      expect(movement.rows[0].lotId).toBe(oldLotId);
      const items = await client.query(
        `SELECT id,"stockAllocations" FROM "SaleItem"
           WHERE id IN ($1,$2) ORDER BY id`,
        [malformedItemId, arrayItemId],
      );
      expect(items.rows[0].stockAllocations).toEqual({
        lotId: negativeLotId,
      });
      expect(items.rows[1].stockAllocations[0].lotId).toBe(oldLotId);

      // Repetir no duplica el registro del conflicto ni falla por objetos ya
      // creados o índices existentes.
      await inTransaction(client, migrationSql);
      expect(
        Number(
          (await client.query(`SELECT count(*) FROM "LotIdentityConflict"`))
            .rows[0].count,
        ),
      ).toBe(1);
    } finally {
      if (client) await client.end().catch(() => undefined);
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 120_000);
});
