import { createServer } from "node:net";
import { PassThrough } from "node:stream";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { describe, expect, it } from "vitest";
import {
  EXPORT_LIMIT,
  ReportsController,
  storeReport,
} from "../apps/api/src/reports";

// PERF-informes: con ~300 ventas al día, el informe del mes que abre
// Reportes cargaba todas las ventas con sus líneas, productos y pagos (con el
// comprobante en base64) y agotaba los 256 MB de montón de la API en Render.
// Esta prueba siembra 3 000 ventas de un mes y exige que ninguna consulta de
// ningún informe traiga a memoria más de LIMIT objetos ni un comprobante.
const SALES = 3000;
const LIMIT = 5000;
const PROOF = 20000;

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const migrationsDir = join(root, "apps", "api", "prisma", "migrations");
const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient, Prisma } = requireApi("@prisma/client");
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

// Objetos que una consulta materializa (filas y relaciones anidadas) y el
// texto más largo que trae.
const measure = (value: unknown): { objects: number; longest: number } => {
  if (typeof value === "string") return { objects: 0, longest: value.length };
  if (!value || typeof value !== "object" || value instanceof Date)
    return { objects: 0, longest: 0 };
  if (Prisma.Decimal.isDecimal(value)) return { objects: 0, longest: 0 };
  const parts = (Array.isArray(value) ? value : Object.values(value)).map(
    measure,
  );
  return {
    objects:
      (Array.isArray(value) ? 0 : 1) +
      parts.reduce((total, part) => total + part.objects, 0),
    longest: Math.max(0, ...parts.map((part) => part.longest)),
  };
};

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

describe("PERF-informes · informes del mes contra PostgreSQL real", () => {
  it("ningún informe carga el período completo ni comprobantes en base64", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "nexora-reports-memory-"));
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
      await database.createDatabase("nexora_reports_memory");
      sqlClient = database.getPgClient("nexora_reports_memory", "127.0.0.1");
      await sqlClient.connect();
      for (const name of (await readdir(migrationsDir, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort())
        await sqlClient.query(
          await readFile(join(migrationsDir, name, "migration.sql"), "utf8"),
        );

      // Un mes de ventas: 2 líneas, efectivo o transferencia con comprobante,
      // devoluciones, bitácora y kardex.
      await sqlClient.query(`
        INSERT INTO "Role"(id, name, permissions, "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000001', 'qa-informes', '{*}', now());
        INSERT INTO "User"(id, name, email, "passwordHash", "pinHash", "roleId", "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000002', 'Cajera QA', 'qa-informes@example.test', 'x', 'x',
           '00000000-0000-4000-8000-000000000001', now());
        INSERT INTO "Category"(id, name, "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000003', 'Suplementos', now());
        INSERT INTO "Product"(id, name, sku, "categoryId", "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000004', 'Proteína QA', 'QA-P1', '00000000-0000-4000-8000-000000000003', now()),
          ('00000000-0000-4000-8000-000000000005', 'Shaker QA', 'QA-P2', '00000000-0000-4000-8000-000000000003', now());
        INSERT INTO "Variant"(id, "productId", sku, barcode, "costAvg", price, stock, "updatedAt") VALUES
          ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000004', 'QA-V1', 'QA-B1', 60, 100, 50, now()),
          ('00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000005', 'QA-V2', 'QA-B2', 150, 250, 50, now());
        INSERT INTO "CashSession"(id, "userId", "openingAmount", "openedAt", "closedAt") VALUES
          ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002', 0,
           '2026-09-01 12:00', '2026-09-30 23:00');
        CREATE TEMP TABLE qa AS
          SELECT gen_random_uuid() id, n, timestamp '2026-09-01 14:00' + (n * interval '13 minutes') at_
          FROM generate_series(1, ${SALES}) n;
        INSERT INTO "Sale"(id, number, "offlineUuid", "sellerId", "cashSessionId", subtotal, "discountTotal",
          "taxTotal", total, "costTotal", "createdAt", "updatedAt")
        SELECT id, 'QA-' || n, gen_random_uuid(), '00000000-0000-4000-8000-000000000002',
          '00000000-0000-4000-8000-000000000008', 350, 0, 53.39, 350, 210, at_, at_ FROM qa;
        INSERT INTO "SaleItem"(id, "saleId", "variantId", qty, "unitPrice", "unitCost", discount, tax, "lineTotal")
        SELECT gen_random_uuid(), id, '00000000-0000-4000-8000-000000000006'::uuid, 1, 100, 60, 0, 15.25, 100 FROM qa
        UNION ALL
        SELECT gen_random_uuid(), id, '00000000-0000-4000-8000-000000000007'::uuid, 1, 250, 150, 0, 38.14, 250 FROM qa;
        INSERT INTO "Payment"(id, "saleId", "cashSessionId", method, amount, tendered, "createdAt", "proofUrl")
        SELECT gen_random_uuid(), id, '00000000-0000-4000-8000-000000000008',
          CASE WHEN n % 10 = 0 THEN 'transfer' ELSE 'cash' END, 350, 350, at_,
          CASE WHEN n % 10 = 0 THEN 'data:image/png;base64,' || repeat('A', ${PROOF}) END
        FROM qa;
        INSERT INTO "SaleReturn"(id, "saleId", number, reason, total, "taxTotal", "costTotal", "refundAmount",
          "refundMethod", "cashSessionId", "userId", items, "createdAt")
        SELECT gen_random_uuid(), qa.id, 'QA-D' || n, 'QA', 100, 15.25, 60, 100, 'cash',
          '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002',
          jsonb_build_array(jsonb_build_object('saleItemId', i.id, 'qty', 1, 'restock', true,
            'cost', 60, 'total', 100, 'tax', 15.25)),
          at_ + interval '1 hour'
        FROM qa JOIN "SaleItem" i ON i."saleId" = qa.id AND i."variantId" = '00000000-0000-4000-8000-000000000006'
        WHERE n % 100 = 0;
        UPDATE "SaleItem" SET "returnedQty" = 1
          WHERE id IN (SELECT (items->0->>'saleItemId')::uuid FROM "SaleReturn");
        INSERT INTO "AuditLog"(id, "userId", action, entity, "entityId", after, "createdAt")
        SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000002', 'return', 'sale', qa.id::text,
          jsonb_build_object('total', 100, 'costTotal', 60), at_ FROM qa;
        INSERT INTO "InventoryMovement"(id, "variantId", type, qty, "unitCost", "balanceAfter", reason, "userId", "createdAt")
        SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000006', 'sale', -1, 60, 10, 'Venta', 'qa', at_ FROM qa;
        ANALYZE;
      `);

      const url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${port}/nexora_reports_memory`;
      prisma = new PrismaClient({ datasources: { db: { url } } });
      const reads: { op: string; objects: number; longest: number }[] = [];
      const db = prisma.$extends({
        query: {
          async $allOperations({ model, operation, args, query }: any) {
            const result = await query(args);
            reads.push({
              op: (model ? model + "." : "") + operation,
              ...measure(result),
            });
            return result;
          },
        },
      });
      const controller = new ReportsController(db);
      const actor = {
        id: "00000000-0000-4000-8000-000000000002",
        name: "Admin QA",
        email: "qa@example.test",
        role: "admin",
        permissions: ["*"],
        branchId: "main",
      } as any;
      const month = { from: "2026-09-01", to: "2026-09-30" };
      const report = async (name: string, query: Record<string, string>) => {
        const res = response();
        await controller.report(name, { ...month, ...query }, actor, res);
        const buffer = await res.done();
        return { res, body: res.body, buffer };
      };
      const worst = (label: string) => {
        const top = reads.reduce(
          (max, read) => (read.objects > max.objects ? read : max),
          { op: "-", objects: 0, longest: 0 },
        );
        const longest = Math.max(0, ...reads.map((read) => read.longest));
        reads.length = 0;
        return { label, ...top, longest };
      };

      const results: ReturnType<typeof worst>[] = [];
      results.push(
        (await controller.dashboard(month, actor), worst("dashboard")),
      );
      const sales = await report("sales", {});
      results.push(worst("sales"));
      for (const name of [
        "monthly-consumption",
        "profit",
        "abc",
        "by-seller",
        "by-payment",
        "customers",
        "returns-discounts",
        "kardex",
        "income-statement",
      ]) {
        await report(name, {});
        results.push(worst(name));
      }
      const xlsx = await report("sales", { format: "xlsx" });
      results.push(worst("sales.xlsx"));
      const pdf = await report("kardex", { format: "pdf" });
      results.push(worst("kardex.pdf"));
      for (const name of ["venta-diaria-usuario", "venta-por-forma-pago"]) {
        await storeReport(db, actor, name, month);
        results.push(worst(name));
      }

      // Ninguna consulta trae el período completo ni un comprobante.
      expect(
        results.filter((r) => r.objects > LIMIT || r.longest >= PROOF),
      ).toEqual([]);

      // El listado llega por páginas con su total; los totales, completos.
      expect(sales.body.total).toBe(SALES);
      expect(sales.body.rows).toHaveLength(500);
      expect(sales.body.rows[0].Factura).toBe("QA-" + SALES);
      const bySeller = (await report("by-seller", {})).body.rows;
      expect(bySeller).toEqual([
        { Vendedor: "Cajera QA", Ventas: SALES * 350 - (SALES / 100) * 100 },
      ]);
      const profit = (await report("profit", {})).body.rows;
      expect(
        Object.fromEntries(profit.map((r: any) => [r.Producto, r.Unidades])),
      ).toEqual({ "Proteína QA": SALES - SALES / 100, "Shaker QA": SALES });

      // Excel por lotes con todas las filas; PDF en flujo.
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(xlsx.buffer);
      expect(book.worksheets[0].rowCount).toBe(SALES + 1);
      expect(book.worksheets[0].getRow(1).font?.bold).toBe(true);
      expect(pdf.buffer.subarray(0, 4).toString()).toBe("%PDF");

      // Más filas que el máximo exportable: aviso claro, sin descargar nada.
      const max = EXPORT_LIMIT.pdf;
      EXPORT_LIMIT.pdf = 1000;
      try {
        await expect(report("sales", { format: "pdf" })).rejects.toMatchObject({
          status: 400,
          response: expect.stringContaining("el máximo para exportar a PDF"),
        });
      } finally {
        EXPORT_LIMIT.pdf = max;
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
