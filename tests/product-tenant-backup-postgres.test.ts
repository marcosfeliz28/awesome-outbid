import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { expect, it } from "vitest";
import { createTenantBackup, restoreTenantBackup } from "../apps/api/src/tenant-backup";
import { tenantObjectStore } from "../apps/api/src/tenant-object-store";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const alpha = "20000000-0000-4000-8000-000000000001";
const beta = "20000000-0000-4000-8000-000000000002";
const passphrase = "5xS2qP9mR7vK4zN8cD1hL6uJ3wY0aT+2026";

async function freePort() {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>(resolve => server.close(() => resolve()));
  return address.port;
}

it("cifra sólo una empresa y la restaura completa en otra base desechable, sin contaminación", async () => {
  const directory = await mkdtemp(join(tmpdir(), "nexora-tenant-backup-"));
  const previous = { tenancy: process.env.PRODUCT_TENANCY, objects: process.env.PRODUCT_OBJECT_STORE_DIR };
  process.env.PRODUCT_TENANCY = "required";
  process.env.PRODUCT_OBJECT_STORE_DIR = join(directory, "source-objects");
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: join(directory, "pg"), user: "backup_test", password: "backup_test_only",
    port, persistent: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined, onError: () => undefined,
  });
  let source: any;
  let target: any;
  try {
    await db.initialise(); await db.start();
    for (const name of ["tenant_source_test", "tenant_restore_test"]) {
      await db.createDatabase(name);
      const url = `postgresql://backup_test:backup_test_only@127.0.0.1:${port}/${name}`;
      await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")],
        { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000 });
    }
    source = new PrismaClient({ datasources: { db: { url: `postgresql://backup_test:backup_test_only@127.0.0.1:${port}/tenant_source_test` } } });
    target = new PrismaClient({ datasources: { db: { url: `postgresql://backup_test:backup_test_only@127.0.0.1:${port}/tenant_restore_test` } } });
    await source.tenant.createMany({ data: [
      { id: alpha, slug: "alpha", name: "Empresa α", businessType: "retail" },
      { id: beta, slug: "beta", name: "Empresa β", businessType: "retail" },
    ] });
    const a = await source.category.create({ data: { tenantId: alpha, name: "A" } });
    await source.category.create({ data: { tenantId: beta, name: "B" } });
    const product = await source.product.create({ data: { tenantId: alpha, categoryId: a.id, name: "Producto á", sku: "SKU-A" } });
    await source.variant.create({ data: { tenantId: alpha, productId: product.id, sku: "VAR-A", barcode: "CODE-A", costAvg: "0.01", price: "99999999.99", stock: "1.125" } });
    const event = await source.realtimeEvent.create({ data: { tenantId: alpha, branchId: "main", type: "stock", data: { name: "antes" } } });
    await source.settings.create({ data: { tenantId: alpha, id: "main", data: { nested: ["á", { phone: "809" }] } } });
    const invoiceKey = "invoice/20000000-0000-4000-8000-000000000011";
    const billingKey = "billing/20000000-0000-4000-8000-000000000012";
    const invoiceBytes = Buffer.from("factura del proveedor original");
    const billingBytes = Buffer.from("comprobante del plan original");
    await tenantObjectStore().put(alpha, invoiceKey, invoiceBytes, "application/pdf");
    await tenantObjectStore().put(alpha, billingKey, billingBytes, "image/png");
    await source.invoiceAttachment.create({ data: {
      tenantId: alpha, branchId: "main", userId: "test-owner", mime: "application/pdf", objectKey: invoiceKey,
    } });
    await source.billingRequest.create({ data: {
      tenantId: alpha, plan: "basic", provider: "bank_transfer", amount: "100.00", proofObjectKey: billingKey, proofMime: "image/png",
    } });
    const path = join(directory, "alpha.nxtb");
    const counts = await createTenantBackup({ prisma: source, tenantId: alpha, target: path, passphrase });
    expect(counts.Tenant).toBe(1);
    expect(counts.Category).toBe(1);
    expect(counts.Product).toBe(1);
    expect(counts.Variant).toBe(1);
    expect(counts.InvoiceAttachment).toBe(1);
    expect(counts.BillingRequest).toBe(1);
    await tenantObjectStore().delete(alpha, invoiceKey);
    await expect(createTenantBackup({ prisma: source, tenantId: alpha, target: join(directory, "missing-object.nxtb"), passphrase }))
      .rejects.toThrow();
    await expect(readFile(join(directory, "missing-object.nxtb"))).rejects.toThrow();
    await tenantObjectStore().put(alpha, invoiceKey, invoiceBytes, "application/pdf");
    // Una migración que agregue una tabla sin clasificar debe romper el
    // respaldo, no producir silenciosamente un archivo incompleto.
    await source.$executeRawUnsafe(`CREATE TABLE "RogueTenantData" (id uuid PRIMARY KEY, "tenantId" uuid NOT NULL)`);
    await expect(createTenantBackup({ prisma: source, tenantId: alpha, target: join(directory, "invalid.nxtb"), passphrase }))
      .rejects.toThrow("inventario de tablas");
    await source.$executeRawUnsafe(`DROP TABLE "RogueTenantData"`);
    const bytes = await readFile(path);
    expect(bytes.subarray(0, 4).toString()).toBe("NXBK");
    expect(bytes.toString()).not.toContain("Empresa α");
    expect(bytes.toString()).not.toContain("Empresa β");
    expect(bytes.toString()).not.toContain("99999999.99");
    // Las migraciones siembran un tenant demo con almacenes iniciales. Esta
    // base descartable se vacía expresamente antes de restaurar; nunca se
    // aplica este paso en una base compartida.
    const tables = await target.$queryRawUnsafe<{ tablename: string }[]>(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'_prisma_migrations'`);
    await target.$executeRawUnsafe(`TRUNCATE ${tables.map(row => `"${row.tablename}"`).join(", ")} CASCADE`);
    process.env.PRODUCT_OBJECT_STORE_DIR = join(directory, "restored-objects");
    // Un rol sujeto a RLS puede ver una base ocupada como si estuviera vacía.
    // Restaurar requiere visibilidad física de todas las empresas.
    await target.tenant.create({ data: { id: beta, slug: "ocupada", name: "Empresa ocupada", businessType: "retail" } });
    await target.$executeRawUnsafe(`ALTER ROLE nexora_tenant_runtime LOGIN PASSWORD 'test-only-backup-rls-2026'`);
    const limited = new PrismaClient({ datasources: { db: { url: `postgresql://nexora_tenant_runtime:test-only-backup-rls-2026@127.0.0.1:${port}/tenant_restore_test?connection_limit=1` } } });
    try {
      const hidden = await limited.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*) AS count FROM "Tenant"`);
      expect(hidden[0]?.count).toBe(0n);
      await expect(restoreTenantBackup({ prisma: limited, source: path, passphrase, disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" }))
        .rejects.toThrow("visibilidad global");
    } finally { await limited.$disconnect(); }
    await target.$executeRawUnsafe(`TRUNCATE ${tables.map(row => `"${row.tablename}"`).join(", ")} CASCADE`);
    await expect(restoreTenantBackup({ prisma: target, source: path, passphrase: "incorrect-wrong-wrong-wrong-wrong-2026", disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" })).rejects.toThrow();
    expect(await target.tenant.count()).toBe(0);
    const restored = await restoreTenantBackup({ prisma: target, source: path, passphrase, disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" });
    expect(restored.counts).toEqual(counts);
    expect((await target.tenant.findMany()).map((row: any) => row.id)).toEqual([alpha]);
    expect((await target.variant.findFirst({ where: { tenantId: alpha } })).price.toString()).toBe("99999999.99");
    expect((await target.variant.findFirst({ where: { tenantId: alpha } })).stock.toString()).toBe("1.125");
    expect((await target.settings.findFirst({ where: { tenantId: alpha } })).data).toEqual({ nested: ["á", { phone: "809" }] });
    expect(await tenantObjectStore().get(alpha, invoiceKey)).toEqual(invoiceBytes);
    expect(await tenantObjectStore().get(alpha, billingKey)).toEqual(billingBytes);
    const nextEvent = await target.realtimeEvent.create({ data: { tenantId: alpha, branchId: "main", type: "stock", data: { name: "después" } } });
    expect(nextEvent.id).toBeGreaterThan(event.id);
    await expect(restoreTenantBackup({ prisma: target, source: path, passphrase, disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" })).rejects.toThrow("vacía");
    const tampered = join(directory, "tampered.nxtb");
    bytes[Math.floor(bytes.length / 2)] ^= 1;
    await writeFile(tampered, bytes);
    await target.$executeRawUnsafe(`TRUNCATE ${tables.map(row => `"${row.tablename}"`).join(", ")} CASCADE`);
    await expect(restoreTenantBackup({ prisma: target, source: path, passphrase, disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" }))
      .rejects.toThrow();
    expect(await tenantObjectStore().get(alpha, invoiceKey)).toEqual(invoiceBytes);
    expect(await target.tenant.count()).toBe(0);
    process.env.PRODUCT_OBJECT_STORE_DIR = join(directory, "tampered-objects");
    await expect(restoreTenantBackup({ prisma: target, source: tampered, passphrase, disposableConfirmation: "RESTORE_TO_DISPOSABLE_TEST_DATABASE" })).rejects.toThrow();
    expect(await target.tenant.count()).toBe(0);
  } finally {
    if (previous.tenancy === undefined) delete process.env.PRODUCT_TENANCY; else process.env.PRODUCT_TENANCY = previous.tenancy;
    if (previous.objects === undefined) delete process.env.PRODUCT_OBJECT_STORE_DIR; else process.env.PRODUCT_OBJECT_STORE_DIR = previous.objects;
    await source?.$disconnect(); await target?.$disconnect();
    await db.stop().catch(() => undefined);
    await rm(directory, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 240000);
