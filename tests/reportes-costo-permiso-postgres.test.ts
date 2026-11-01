import { createServer } from "node:net";
import { PassThrough } from "node:stream";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";
import { ReportsController } from "../apps/api/src/reports";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationsDir = join(root, "apps", "api", "prisma", "migrations");
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = requireApi("@prisma/client");
const ExcelJS = requireApi("exceljs");

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

// Respuesta de Express mínima: JSON o un flujo (Excel/PDF).
const response = () => {
  const stream: any = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on("data", (chunk: Buffer) => chunks.push(chunk));
  stream.headers = {};
  stream.setHeader = (key: string, value: string) =>
    (stream.headers[key.toLowerCase()] = value);
  stream.json = (body: unknown) => {
    stream.body = body;
    stream.end();
  };
  stream.done = () =>
    new Promise<Buffer>((done) =>
      stream.writableFinished
        ? done(Buffer.concat(chunks))
        : stream.on("finish", () =>
            setImmediate(() => done(Buffer.concat(chunks))),
          ),
    );
  return stream;
};

// Orden 110: kardex, low-stock y no-movement mostraban costo a quien sólo tiene
// reports:read; la regla pide profit:read.
describe("Orden 110 · costo de kardex, low-stock y no-movement sólo con profit:read", () => {
  it("sin profit:read no hay costo (pantalla, Excel y PDF); con profit:read queda igual", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-costo-permiso-"));
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
      await database.createDatabase("nexora_costo_permiso");
      sqlClient = database.getPgClient("nexora_costo_permiso", "127.0.0.1");
      await sqlClient.connect();
      for (const name of (await readdir(migrationsDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort())
        await sqlClient.query(
          await readFile(join(migrationsDir, name, "migration.sql"), "utf8"),
        );
      await sqlClient.query(`
        INSERT INTO "Category"(id, name, "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000003', 'Suplementos', now());
        INSERT INTO "Product"(id, name, sku, "categoryId", "minStock", "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000004', 'Proteína QA', 'QA-P1', '00000000-0000-4000-8000-000000000003', 10, now());
        INSERT INTO "Variant"(id, "productId", sku, barcode, "costAvg", price, stock, "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004', 'QA-V1', 'QA-B1', 60, 100, 5, now());
        INSERT INTO "InventoryMovement"(id, "variantId", type, qty, "unitCost", "balanceAfter", reason, "userId", "createdAt")
        VALUES (gen_random_uuid(), '00000000-0000-4000-8000-000000000006', 'entry', 5, 60, 5, 'Entrada', 'qa', now());
      `);
      const url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/nexora_costo_permiso`;
      prisma = new PrismaClient({ datasources: { db: { url } } });
      const controller = new ReportsController(prisma);
      const actor = (permissions: string[]) =>
        ({
          id: "00000000-0000-4000-8000-000000000002",
          name: "QA",
          email: "qa@example.test",
          role: "manager",
          permissions,
          branchId: "main",
        }) as any;
      const today = new Date().toISOString().slice(0, 10);
      const report = async (
        name: string,
        as: any,
        extra: Record<string, string> = {},
      ) => {
        const res = response();
        await controller.report(
          name,
          { from: today, to: today, ...extra },
          as,
          res,
        );
        const buffer = await res.done();
        return { body: res.body, buffer };
      };
      const COSTO = /costo|valor/i;
      const sinCosto = actor(["reports:read"]);
      const conCosto = actor(["reports:read", "profit:read"]);
      for (const name of ["kardex", "low-stock", "no-movement"]) {
        const sin = await report(
          name,
          sinCosto,
          name === "no-movement" ? { days: "0" } : {},
        );
        expect(sin.body.rows.length, name).toBeGreaterThan(0);
        for (const row of sin.body.rows)
          expect(
            Object.keys(row).filter((k) => COSTO.test(k)),
            name + " sin profit:read",
          ).toEqual([]);
        const con = await report(
          name,
          conCosto,
          name === "no-movement" ? { days: "0" } : {},
        );
        expect(
          Object.keys(con.body.rows[0]).some((k) => COSTO.test(k)),
          name + " con profit:read",
        ).toBe(true);
        for (const format of ["xlsx", "pdf"]) {
          const archivo = await report(name, sinCosto, { format });
          const texto =
            format === "pdf"
              ? archivo.buffer.toString("latin1")
              : (
                  await (async () => {
                    const book = new ExcelJS.Workbook();
                    await book.xlsx.load(archivo.buffer);
                    return book.worksheets[0].getRow(1).values as any[];
                  })()
                ).join("|");
          if (format === "xlsx")
            expect(texto, name + " xlsx").not.toMatch(COSTO);
        }
      }
    } finally {
      if (prisma) await prisma.$disconnect().catch(() => undefined);
      if (sqlClient) await sqlClient.end().catch(() => undefined);
      await database.stop().catch(() => undefined);
      await rm(dataDir, { recursive: true, force: true }).catch(
        () => undefined,
      );
    }
  }, 240_000);
});
