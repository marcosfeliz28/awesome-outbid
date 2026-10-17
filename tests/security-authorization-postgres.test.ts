import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import { CatalogController } from "../apps/api/src/catalog";
import { InventoryController } from "../apps/api/src/inventory";
import { IncentivesController } from "../apps/api/src/incentives";
import { AdminController } from "../apps/api/src/admin";
import { storeReport } from "../apps/api/src/reports";

const requireApi = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
);
const { PrismaClient } = requireApi("@prisma/client");
const ExcelJS = requireApi("exceljs");
const run = promisify(execFile);
const ownBranch = "qa-authz-" + randomUUID(),
  otherBranch = "qa-other-" + randomUUID();
const actor: any = {
  id: randomUUID(),
  name: "QA autorización",
  email: "qa@example.invalid",
  role: "admin",
  permissions: ["*"],
  branchId: ownBranch,
};
let database: any,
  db: any,
  dir: string,
  catalog: CatalogController,
  inventory: InventoryController,
  incentives: IncentivesController,
  admin: AdminController;
let ownCategory: any,
  foreignCategory: any,
  ownSupplier: any,
  foreignSupplier: any,
  ownProduct: any,
  foreignProduct: any;

const port = () =>
  new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() =>
        typeof address === "object" && address
          ? resolve(address.port)
          : reject(new Error("Sin puerto")),
      );
    });
  });
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "nexora-authz-"));
  const p = await port();
  const password = randomUUID();
  database = new EmbeddedPostgres({
    databaseDir: dir,
    user: "nexora_qa",
    password,
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
  await database.createDatabase("nexora_authz");
  const url = `postgresql://nexora_qa:${password}@127.0.0.1:${p}/nexora_authz`;
  await run(
    process.execPath,
    [
      requireApi.resolve("prisma/build/index.js"),
      "migrate",
      "deploy",
      "--schema",
      "apps/api/prisma/schema.prisma",
    ],
    {
      env: { ...process.env, DATABASE_URL: url },
      timeout: 120000,
    },
  );
  db = new PrismaClient({ datasources: { db: { url } } });
  catalog = new CatalogController(db);
  inventory = new InventoryController(db);
  incentives = new IncentivesController(db);
  admin = new AdminController(db);
  ownCategory = await db.category.create({
    data: { name: "Propia " + randomUUID(), branchId: ownBranch },
  });
  foreignCategory = await db.category.create({
    data: { name: "Privada " + randomUUID(), branchId: otherBranch },
  });
  ownSupplier = await db.supplier.create({
    data: { name: "Propio", branchId: ownBranch },
  });
  foreignSupplier = await db.supplier.create({
    data: { name: "Privado", branchId: otherBranch },
  });
  const product = (branchId: string, categoryId: string) =>
    db.product.create({
      data: {
        name: "Producto QA",
        sku: randomUUID(),
        categoryId,
        branchId,
        variants: {
          create: {
            sku: randomUUID(),
            barcode: randomUUID(),
            price: 10,
            costAvg: 2,
            branchId,
          },
        },
      },
      include: { variants: true },
    });
  ownProduct = await product(ownBranch, ownCategory.id);
  foreignProduct = await product(otherBranch, foreignCategory.id);
}, 180000);
afterAll(async () => {
  await db?.$disconnect();
  await database?.stop();
  if (dir) await rm(dir, { recursive: true, force: true });
}, 60000);

describe("3ag · recursos por sucursal y usuario sobre PostgreSQL real", () => {
  it("el encabezado del reporte no permite consultar otro usuario por ID de sucursal ajena", async () => {
    const role = await db.role.create({
      data: { name: randomUUID(), permissions: ["reports:read"] },
    });
    const user = (branchId: string) =>
      db.user.create({
        data: {
          name: "Privado QA " + randomUUID(),
          email: randomUUID() + "@example.invalid",
          roleId: role.id,
          passwordHash: randomUUID(),
          pinHash: randomUUID(),
          branchId,
        },
      });
    const own = await user(ownBranch),
      foreign = await user(otherBranch);
    const today = new Date().toISOString().slice(0, 10);
    const report = (userId: string) =>
      storeReport(db, actor, "venta-diaria-usuario", {
        userId,
        from: today,
        to: today,
      });
    expect((await report(foreign.id)).user).toBeNull();
    expect((await report(own.id)).user?.id).toBe(own.id);
  });
  it("las categorías sólo contienen categorías de la sucursal", async () => {
    expect(
      (await (catalog.categories as any)(actor)).map((r: any) => r.id),
    ).toEqual([ownCategory.id]);
  });
  it("la plantilla sólo contiene categorías de la sucursal", async () => {
    let bytes: Buffer | undefined;
    await (catalog.template as any)(
      {
        setHeader: () => undefined,
        end: (data: Buffer) => {
          bytes = data;
        },
      },
      actor,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const rows: string[] = [];
    workbook.getWorksheet("Categorías").eachRow((row: any, n: number) => {
      if (n > 1) rows.push(row.getCell(1).text);
    });
    expect(rows).toEqual([ownCategory.id]);
  });

  it("crear productos rechaza proveedores de otra sucursal sin escribir", async () => {
    const body = () => ({
      name: "Producto QA nuevo",
      sku: randomUUID(),
      categoryId: ownCategory.id,
      supplierId: foreignSupplier.id,
      variants: [
        { sku: randomUUID(), barcode: randomUUID(), price: 10, costAvg: 2 },
      ],
    });
    const before = await db.product.count();
    await expect(catalog.create(body(), actor)).rejects.toMatchObject({
      status: 400,
    });
    expect(await db.product.count()).toBe(before);
    const valid = await catalog.create(
      { ...body(), supplierId: ownSupplier.id },
      actor,
    );
    expect(valid.supplierId).toBe(ownSupplier.id);
  });
  it("editar productos rechaza proveedores de otra sucursal sin escribir", async () => {
    await expect(
      catalog.update(ownProduct.id, { supplierId: foreignSupplier.id }, actor),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: ownProduct.id } }))
        .supplierId,
    ).toBeNull();
    expect(
      (
        await catalog.update(
          ownProduct.id,
          { supplierId: ownSupplier.id },
          actor,
        )
      ).supplierId,
    ).toBe(ownSupplier.id);
  });

  it("las tarifas de incentivos no leen categorías de otra sucursal", async () => {
    expect((await incentives.rates(actor)).map((r) => r.categoryId)).toEqual([
      ownCategory.id,
    ]);
  });
  it("las tarifas de incentivos no aceptan categorías de otra sucursal", async () => {
    const before = await db.incentiveRate.count();
    await expect(
      incentives.saveRates(actor, {
        rates: [{ categoryId: foreignCategory.id, amount: 10 }],
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.incentiveRate.count()).toBe(before);
    expect(
      (
        await incentives.saveRates(actor, {
          rates: [{ categoryId: ownCategory.id, amount: 10 }],
        })
      )[0].amount,
    ).toBe(10);
  });

  it("las órdenes de compra rechazan variantes ajenas sin crear orden ni consumir contador", async () => {
    const before = await db.purchaseOrder.count();
    const counter = await db.counter.findUnique({ where: { key: "purchase" } });
    await expect(
      inventory.order(
        {
          supplierId: ownSupplier.id,
          items: [
            { variantId: foreignProduct.variants[0].id, qty: 1, unitCost: 2 },
          ],
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.purchaseOrder.count()).toBe(before);
    expect(await db.counter.findUnique({ where: { key: "purchase" } })).toEqual(
      counter,
    );
    expect(
      (
        await inventory.order(
          {
            supplierId: ownSupplier.id,
            items: [
              { variantId: ownProduct.variants[0].id, qty: 1, unitCost: 2 },
            ],
          },
          actor,
        )
      ).branchId,
    ).toBe(ownBranch);
  });

  it("las cotizaciones rechazan variantes ajenas y su recuperación sigue limitada al dueño", async () => {
    const before = await db.quote.count();
    await expect(
      admin.quote(
        { items: [{ variantId: foreignProduct.variants[0].id, qty: 1 }] },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db.quote.count()).toBe(before);
    const own = await admin.quote(
      { items: [{ variantId: ownProduct.variants[0].id, qty: 1 }] },
      actor,
    );
    await expect(
      admin.convert(own.id, { ...actor, id: randomUUID() }),
    ).rejects.toMatchObject({ code: "P2025" });
    await expect(
      admin.convert(own.id, { ...actor, branchId: otherBranch }),
    ).rejects.toMatchObject({ code: "P2025" });
    expect((await admin.convert(own.id, actor)).id).toBe(own.id);
  });

  it("el detalle por ID ajeno se rechaza aunque el rol tenga catalog:read", async () => {
    await expect(
      catalog.detail(foreignProduct.id, actor),
    ).rejects.toMatchObject({ code: "P2025" });
    expect((await catalog.detail(ownProduct.id, actor)).id).toBe(ownProduct.id);
  });
});
