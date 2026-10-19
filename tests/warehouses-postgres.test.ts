import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { cp, mkdtemp, mkdir, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import { WarehousesController } from "../apps/api/src/warehouses";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const prismaDir = join(root, "apps/api/prisma");
const requireApi = createRequire(join(root, "apps/api/package.json"));
const PrismaClient = requireApi("@prisma/client").PrismaClient;
const prismaCli = requireApi.resolve("prisma/build/index.js");
const run = promisify(execFile);
const port = () =>
  new Promise<number>((done, fail) => {
    const server = createServer();
    server.once("error", fail);
    server.listen(0, "127.0.0.1", () => {
      const a = server.address();
      server.close(() =>
        typeof a === "object" && a ? done(a.port) : fail(new Error("No port")),
      );
    });
  });
let database: any,
  db: any,
  dataDir: string,
  projectDir: string,
  controller: WarehousesController;
let variantId: string, storeId: string, homeId: string;
let externalUrl: string | undefined;
const actor: any = {
  id: randomUUID(),
  name: "Prueba",
  email: "qa@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: "main",
};
const transfer = (qty: number, operationId = randomUUID()) => ({
  operationId,
  fromId: storeId,
  toId: homeId,
  reason: "Traspaso de prueba",
  lines: [{ variantId, qty }],
});
async function migrate(schema: string, url: string) {
  await run(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schema],
    { cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000 },
  );
}

beforeAll(async () => {
  projectDir = await mkdtemp(join(tmpdir(), "nexora-warehouse-schema-"));
  let url: string;
  externalUrl = process.env.NEXORA_TEST_PG_URL;
  if (externalUrl) {
    const admin = new PrismaClient({
      datasources: { db: { url: externalUrl } },
    });
    await admin.$executeRawUnsafe(
      'DROP DATABASE IF EXISTS "nexora_warehouse_test" WITH (FORCE)',
    );
    await admin.$executeRawUnsafe('CREATE DATABASE "nexora_warehouse_test"');
    await admin.$disconnect();
    const target = new URL(externalUrl);
    target.pathname = "/nexora_warehouse_test";
    url = target.toString();
  } else {
    dataDir = await mkdtemp(join(tmpdir(), "nexora-warehouse-db-"));
    const p = await port();
    database = new EmbeddedPostgres({
      databaseDir: dataDir,
      user: "nexora_test",
      password: "nexora_test_only",
      port: p,
      persistent: false,
      authMethod: "scram-sha-256",
      initdbFlags: ["--encoding=UTF8", "--locale=C"],
      postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
      onLog: () => undefined,
      onError: () => undefined,
    });
    await database.initialise();
    await database.start();
    await database.createDatabase("nexora_warehouse_test");
    url = `postgresql://nexora_test:nexora_test_only@127.0.0.1:${p}/nexora_warehouse_test`;
  }
  const oldDir = join(projectDir, "prisma");
  await mkdir(join(oldDir, "migrations"), { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(oldDir, "schema.prisma"));
  for (const name of await readdir(join(prismaDir, "migrations")))
    if (
      name === "migration_lock.toml" ||
      (name.startsWith("20") && name < "202610240401_warehouses")
    )
      await cp(
        join(prismaDir, "migrations", name),
        join(oldDir, "migrations", name),
        { recursive: true },
      );
  await migrate(join(oldDir, "schema.prisma"), url);
  db = new PrismaClient({ datasources: { db: { url } } });
  const category = await db.category.create({
    data: { name: "Prueba almacén " + randomUUID(), branchId: "main" },
  });
  const product = await db.product.create({
    data: {
      name: "Producto almacén",
      sku: randomUUID(),
      categoryId: category.id,
      branchId: "main",
    },
  });
  const variant = await db.variant.create({
    data: {
      productId: product.id,
      sku: randomUUID(),
      barcode: randomUUID(),
      price: 30,
      costAvg: 10,
      stock: 10,
      branchId: "main",
    },
  });
  variantId = variant.id;
  await db.$disconnect();
  await migrate(join(prismaDir, "schema.prisma"), url);
  db = new PrismaClient({ datasources: { db: { url } } });
  controller = new WarehousesController(db as any);
  const warehouses = await db.warehouse.findMany({
    where: { branchId: "main" },
  });
  storeId = warehouses.find((w: any) => w.kind === "store").id;
  homeId = warehouses.find((w: any) => w.kind === "home").id;
}, 180000);
afterAll(async () => {
  await db?.$disconnect();
  if (externalUrl) {
    const admin = new PrismaClient({
      datasources: { db: { url: externalUrl } },
    });
    await admin
      .$executeRawUnsafe(
        'DROP DATABASE IF EXISTS "nexora_warehouse_test" WITH (FORCE)',
      )
      .catch(() => undefined);
    await admin.$disconnect();
  }
  await database?.stop().catch(() => undefined);
  // On Windows, the postmaster may release its final directory handle just
  // after stop() resolves, especially while PostgreSQL suites run in parallel.
  if (dataDir)
    await rm(dataDir, {
      recursive: true,
      force: true,
      maxRetries: 12,
      retryDelay: 250,
    });
  if (projectDir) await rm(projectDir, { recursive: true, force: true });
}, 60000);

describe("3y · almacenes con PostgreSQL real", () => {
  it("migra 10 unidades históricas a Tienda y deja Casa en cero", async () => {
    const stocks = await db.variantStock.findMany({ where: { variantId } });
    expect(stocks).toHaveLength(1);
    expect(Number(stocks[0].qty)).toBe(10);
    expect(stocks[0].warehouseId).toBe(storeId);
  });
  it("traspasa atómicamente sin cambiar costo; repetir la misma clave no duplica", async () => {
    const request = transfer(4);
    const result = await controller.transfer(request, actor);
    expect(result.repeated).toBe(false);
    expect((await controller.transfer(request, actor)).repeated).toBe(true);
    const v = await db.variant.findUniqueOrThrow({ where: { id: variantId } });
    expect(Number(v.stock)).toBe(6);
    expect(Number(v.costAvg)).toBe(10);
    const home = await db.variantStock.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId, warehouseId: homeId } },
    });
    expect(Number(home.qty)).toBe(4);
    const movements = await db.inventoryMovement.findMany({
      where: { refId: result.id },
    });
    expect(movements).toHaveLength(2);
    expect(movements.map((m: any) => Number(m.qty)).sort()).toEqual([-4, 4]);
    await expect(
      controller.transfer({ ...request, reason: "Otro motivo" }, actor),
    ).rejects.toThrow();
    await expect(
      controller.transfer(request, { ...actor, id: randomUUID() }),
    ).rejects.toThrow();
  });
  it("impide vender la existencia de Casa y rechaza traspasos simultáneos que agotarían Tienda", async () => {
    const results = await Promise.allSettled([
      controller.transfer(transfer(5), actor),
      controller.transfer(transfer(5), actor),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const v = await db.variant.findUniqueOrThrow({ where: { id: variantId } });
    expect(Number(v.stock)).toBe(1);
    const home = await db.variantStock.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId, warehouseId: homeId } },
    });
    expect(Number(home.qty)).toBe(9);
  });
  it("rechaza sucursal ajena y conserva los saldos", async () => {
    await expect(
      controller.transfer(transfer(1), { ...actor, branchId: "otra" }),
    ).rejects.toThrow();
    expect(
      Number(
        (await db.variant.findUniqueOrThrow({ where: { id: variantId } }))
          .stock,
      ),
    ).toBe(1);
  });
});
