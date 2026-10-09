import { createServer } from "node:net";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";
import { AdminController } from "../apps/api/src/admin";
import { permissions } from "../packages/shared/src/index";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationsDir = join(root, "apps", "api", "prisma", "migrations");
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = requireApi("@prisma/client");

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

describe("G6 · anonimización contra PostgreSQL real", () => {
  it("conserva la contabilidad, elimina PII y bloquea repetir o revertir", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-customer-privacy-"));
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
    let sqlClient: any;
    let prisma: any;
    try {
      await database.initialise();
      await database.start();
      await database.createDatabase("nexora_customer_privacy");
      sqlClient = database.getPgClient("nexora_customer_privacy", "127.0.0.1");
      await sqlClient.connect();
      const migrationNames = (
        await readdir(migrationsDir, { withFileTypes: true })
      )
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
      for (const name of migrationNames) {
        const sql = await readFile(
          join(migrationsDir, name, "migration.sql"),
          "utf8",
        );
        await sqlClient.query(sql);
      }

      const url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/nexora_customer_privacy`;
      prisma = new PrismaClient({ datasources: { db: { url } } });
      await prisma.$connect();

      const customerId = randomUUID();
      const saleId = randomUUID();
      const phone = "809-555-0199";
      const email = "privacy-real@example.test";
      const legalId = "00199999999";
      const customerName = "Cliente Prueba Privacidad";
      await prisma.customer.create({
        data: {
          id: customerId,
          name: customerName,
          phone,
          email,
          legalId,
          notes: `Contactar a ${phone}`,
          branchId: "main",
          createdBy: "privacy-owner",
        },
      });
      await prisma.sale.create({
        data: {
          id: saleId,
          number: "NX-PRIVACY-1",
          offlineUuid: randomUUID(),
          customerId,
          sellerId: randomUUID(),
          subtotal: 875,
          discountTotal: 0,
          taxTotal: 0,
          total: 875,
          costTotal: 400,
          creditBalance: 0,
          ncf: "B0200000042",
          ncfType: "B02",
          recipientLegalId: legalId,
          notes: `${customerName} ${phone}`,
          branchId: "main",
          payments: {
            create: {
              method: "cash",
              amount: 875,
              tendered: 900,
              change: 25,
            },
          },
        },
      });
      await prisma.alert.create({
        data: {
          key: `receivable:${saleId}`,
          type: "receivable",
          severity: "high",
          entityId: saleId,
          message: `Crédito ${customerName} ${phone}`,
          branchId: "main",
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: "privacy-owner",
          action: "create",
          entity: "customer",
          entityId: customerId,
          before: { phone, email },
          after: { name: customerName, legalId },
          branchId: "main",
        },
      });

      const waitForCustomerLockWaiters = async (expected: number) => {
        const deadline = Date.now() + 10_000;
        while (Date.now() < deadline) {
          const result = await sqlClient.query(`
            SELECT count(*)::int AS waiting
            FROM pg_stat_activity
            WHERE datname = current_database()
              AND pid <> pg_backend_pid()
              AND wait_event_type = 'Lock'
          `);
          if (Number(result.rows[0]?.waiting ?? 0) >= expected) return;
          await new Promise((resolveWait) => setTimeout(resolveWait, 20));
        }
        throw new Error(
          `No aparecieron ${expected} operaciones de Customer esperando el bloqueo.`,
        );
      };
      const raceBehindCustomerUpdateLock = async (
        first: () => Promise<unknown>,
        second: () => Promise<unknown>,
      ) => {
        await sqlClient.query("BEGIN");
        let released = false;
        try {
          // SHARE deja pasar SELECT ... FOR UPDATE, pero detiene el UPDATE. Así
          // ambas peticiones alcanzan la barrera y reproducen la ventana que
          // antes permitía anonimizar y después reidentificar con PATCH.
          await sqlClient.query('LOCK TABLE "Customer" IN SHARE MODE');
          const firstOutcome = first().then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          );
          await waitForCustomerLockWaiters(1);
          const secondOutcome = second().then(
            (value) => ({ status: "fulfilled" as const, value }),
            (reason) => ({ status: "rejected" as const, reason }),
          );
          // El segundo queda esperando el bloqueo de fila de la primera
          // transacción. Prisma no expone ese waiter de forma uniforme entre
          // versiones, por lo que la barrera le da tiempo de alcanzar el lock.
          await new Promise((resolveWait) => setTimeout(resolveWait, 150));
          await sqlClient.query("COMMIT");
          released = true;
          return Promise.all([firstOutcome, secondOutcome]);
        } finally {
          if (!released)
            await sqlClient.query("ROLLBACK").catch(() => undefined);
        }
      };

      const actor = {
        id: "privacy-owner",
        name: "Dueña",
        email: "owner@example.test",
        role: "manager",
        permissions: permissions.manager,
        branchId: "main",
      } as any;
      const api = new AdminController(prisma);
      const doubleAnonymize = await raceBehindCustomerUpdateLock(
        () =>
          (api as any).anonymizeCustomer(
            customerId,
            { reason: "Solicitud verificada", requestRef: "PRIVACY-REAL-1" },
            actor,
          ),
        () =>
          (api as any).anonymizeCustomer(
            customerId,
            { reason: "Solicitud repetida", requestRef: "PRIVACY-REAL-2" },
            actor,
          ),
      );
      expect(doubleAnonymize.map(({ status }) => status).sort()).toEqual([
        "fulfilled",
        "rejected",
      ]);
      expect(
        doubleAnonymize.find(({ status }) => status === "rejected"),
      ).toMatchObject({ reason: { status: 409 } });

      const sale = await prisma.sale.findUniqueOrThrow({
        where: { id: saleId },
        include: { payments: true },
      });
      expect(sale).toMatchObject({
        number: "NX-PRIVACY-1",
        ncf: "B0200000042",
        recipientLegalId: null,
        notes: "",
      });
      expect(Number(sale.total)).toBe(875);
      expect(sale.payments).toHaveLength(1);
      expect(Number(sale.payments[0].amount)).toBe(875);

      const pii = [phone, email, legalId, customerName];
      const searchable = JSON.stringify({
        customer: await prisma.customer.findUnique({
          where: { id: customerId },
        }),
        sale,
        quotes: await prisma.quote.findMany({ where: { customerId } }),
        alerts: await prisma.alert.findMany({ where: { entityId: saleId } }),
        audit: await prisma.auditLog.findMany({
          where: { entity: "customer", entityId: customerId },
        }),
      });
      for (const value of pii) expect(searchable).not.toContain(value);

      const firstAudit = await prisma.auditLog.findMany({
        where: { action: "anonymize", entityId: customerId },
      });
      expect(firstAudit).toHaveLength(1);
      await expect(
        (api as any).anonymizeCustomer(
          customerId,
          { reason: "Repetida", requestRef: "PRIVACY-REAL-2" },
          actor,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await prisma.auditLog.findMany({
          where: { action: "anonymize", entityId: customerId },
        }),
      ).toEqual(firstAudit);
      await expect(
        (api as any).editCustomer(customerId, { name: customerName }, actor),
      ).rejects.toMatchObject({ status: 409 });

      const raceCustomerId = randomUUID();
      const racePii = {
        name: "Cliente Carrera Privacidad",
        phone: "809-555-0111",
        email: "race-privacy@example.test",
        legalId: "00111111111",
        notes: "PII que debe desaparecer",
      };
      await prisma.customer.create({
        data: {
          id: raceCustomerId,
          ...racePii,
          branchId: "main",
          createdBy: actor.id,
        },
      });
      const anonymizeVsPatch = await raceBehindCustomerUpdateLock(
        () =>
          (api as any).anonymizeCustomer(
            raceCustomerId,
            { reason: "Solicitud verificada", requestRef: "PRIVACY-RACE-1" },
            actor,
          ),
        () =>
          (api as any).editCustomer(
            raceCustomerId,
            {
              name: racePii.name,
              phone: racePii.phone,
              email: racePii.email,
              legalId: racePii.legalId,
              notes: racePii.notes,
            },
            actor,
          ),
      );
      expect(anonymizeVsPatch[0].status).toBe("fulfilled");
      expect(anonymizeVsPatch[1]).toMatchObject({
        status: "rejected",
        reason: { status: 409 },
      });
      const protectedCustomer = await prisma.customer.findUniqueOrThrow({
        where: { id: raceCustomerId },
      });
      expect(protectedCustomer).toMatchObject({
        phone: null,
        email: null,
        legalId: null,
        notes: "",
        active: false,
      });
      expect(protectedCustomer.name).toBe(
        `Cliente anonimizado ${raceCustomerId.slice(0, 8)}`,
      );
      expect(protectedCustomer.anonymizedAt).toBeInstanceOf(Date);
      expect(
        await prisma.auditLog.count({
          where: { action: "anonymize", entityId: raceCustomerId },
        }),
      ).toBe(1);
    } finally {
      if (prisma) await prisma.$disconnect().catch(() => undefined);
      if (sqlClient) await sqlClient.end().catch(() => undefined);
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 120_000);
});
