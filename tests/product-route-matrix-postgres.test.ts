import { createRequire } from "node:module";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import EmbeddedPostgres from "embedded-postgres";
import supertest from "supertest";
import { expect, it } from "vitest";
import { createAppModule } from "../apps/api/src/app";
import { ApiExceptionFilter } from "../apps/api/src/common";

const apiRequire = createRequire(resolve(import.meta.dirname, "../apps/api/package.json"));
const { MODULE_METADATA, METHOD_METADATA, PATH_METADATA } = apiRequire("@nestjs/common/constants");
const { RequestMethod } = apiRequire("@nestjs/common");
const run = promisify(execFile);
const root = resolve(import.meta.dirname, "..");
const prismaCli = apiRequire.resolve("prisma/build/index.js");

async function freePort() {
  const server = createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Sin puerto");
  await new Promise<void>((done) => server.close(() => done()));
  return address.port;
}

/**
 * Inventory of the controllers actually registered in the product module.
 * Deriving this from Nest metadata, rather than grepping decorators, is
 * important: an unregistered controller cannot be reached by HTTP, and a new
 * registered controller must show up in this inventory automatically.
 */
type RouteEntry = {
  key: string;
  public: boolean;
  permission: string | undefined;
  terminal: boolean;
};

function productRouteEntries(): RouteEntry[] {
  const previousMode = process.env.PRODUCT_TENANCY;
  process.env.PRODUCT_TENANCY = "required";
  let module: ReturnType<typeof createAppModule>;
  try {
    module = createAppModule("test-only-route-inventory-secret");
  } finally {
    if (previousMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = previousMode;
  }
  const controllers = Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, module) as Array<new (...args: never[]) => object>;
  if (!Array.isArray(controllers)) throw new Error("Nest no expuso sus controladores");
  const routes: RouteEntry[] = [];
  for (const controller of controllers) {
    const prefix = Reflect.getMetadata(PATH_METADATA, controller) as string | string[] | undefined;
    const prefixes = Array.isArray(prefix) ? prefix : [prefix ?? ""];
    for (const key of Object.getOwnPropertyNames(controller.prototype)) {
      if (key === "constructor") continue;
      const handler = (controller.prototype as Record<string, unknown>)[key];
      if (typeof handler !== "function") continue;
      const method = Reflect.getMetadata(METHOD_METADATA, handler) as number | undefined;
      if (method === undefined) continue;
      const path = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
      const paths = Array.isArray(path) ? path : [path ?? ""];
      for (const controllerPath of prefixes) for (const routePath of paths) {
        const segments = [controllerPath, routePath]
          .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
          .filter(Boolean);
        routes.push({
          key: `${RequestMethod[method]} /api/${segments.join("/")}`,
          public: Reflect.getMetadata("public", handler) === true,
          permission: Reflect.getMetadata("permission", handler) as string | undefined,
          terminal: Reflect.getMetadata("terminal", handler) === true,
        });
      }
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key));
}

export function productRoutes(): string[] {
  return productRouteEntries().map(({ key }) => key);
}

// These eight endpoints authenticate with the global guard but authorize
// individual resources inside their handler (their decorators are deliberately
// not @Permit). A ninth undecorated route must be reviewed before delivery.
const AUTHENTICATED_RESOURCE_ROUTES = new Set([
  "POST /api/terminals/register",
  "POST /api/terminals/:id/approve-with-pin",
  "POST /api/terminals/:id/rename",
  "GET /api/terminals/current",
  "POST /api/auth/password",
  "POST /api/auth/logout",
  "GET /api/auth/me",
  "POST /api/auth/pin",
]);

// GETs with no path parameters and a valid empty query. Every entry must
// return a successful response under tenant B, never a validation error.
const READ_LIST_CASES = [
  "/api/alert-rules", "/api/alerts", "/api/audit-log", "/api/auth/me",
  "/api/brands", "/api/cash-sessions", "/api/cash-sessions/opening-suggestion",
  "/api/categories", "/api/cod/pending", "/api/courier/payouts",
  "/api/courier/pending", "/api/credit-accounts", "/api/credit-notes",
  "/api/customers", "/api/dashboard/breakdown", "/api/dashboard/summary",
  "/api/dashboard/year", "/api/expense-categories", "/api/expenses",
  "/api/goods-receipts", "/api/incentives", "/api/incentives/me",
  "/api/incentives/rates", "/api/inventory/counts",
  "/api/inventory/location-report", "/api/inventory/movements",
  "/api/inventory/stock", "/api/inventory/transfers",
  "/api/inventory/warehouses", "/api/merchandise/operations",
  "/api/merchandise/options", "/api/notifications/status",
  "/api/payments/pending-transfers", "/api/products", "/api/promotions",
  "/api/promotions/clearance-candidates", "/api/purchase-orders",
  "/api/quotes", "/api/reportes", "/api/roles", "/api/sales",
  "/api/settings", "/api/staff", "/api/suppliers", "/api/terminals",
  "/api/terminals/current", "/api/users", "/api/void-requests",
] as const;

it("enumera todas las rutas reales del módulo producto y excluye respaldos globales", () => {
  const routes = productRoutes();
  expect(new Set(routes).size).toBe(routes.length);
  expect(routes.length).toBeGreaterThan(150);
  expect(routes).toContain("GET /api/reports/:name");
  expect(routes).toContain("GET /api/incentives/export.xlsx");
  expect(routes).toContain("GET /api/sales/:id/receipt.pdf");
  expect(routes).toContain("GET /api/events");
  expect(routes).toContain("POST /api/inventory-import/apply");
  expect(routes).not.toContain("POST /api/backups/run");
  expect(routes).not.toContain("GET /api/backups/status");
});

it("exige política declarada o excepción justificada en cada ruta de producto", () => {
  const entries = productRouteEntries();
  const undecorated = entries.filter((entry) => !entry.public && !entry.permission && !entry.terminal)
    .map((entry) => entry.key);
  expect(undecorated).toEqual([...AUTHENTICATED_RESOURCE_ROUTES].sort((a, b) => a.localeCompare(b)));
  for (const path of READ_LIST_CASES)
    expect(entries.some((entry) => entry.key === `GET ${path}`), path).toBe(true);
});

it("aisla rutas reales de catálogo, búsqueda y los 40 reportes con PostgreSQL", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "nexora-route-matrix-"));
  const port = await freePort();
  const db = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "route_test",
    password: "route_test_only",
    port,
    persistent: false,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: ["-c", "listen_addresses=127.0.0.1", "-c", "timezone=UTC"],
    onLog: () => undefined,
    onError: () => undefined,
  });
  let client: any;
  const oldUrl = process.env.DATABASE_URL;
  const oldMode = process.env.PRODUCT_TENANCY;
  try {
    await db.initialise();
    await db.start();
    await db.createDatabase("route_matrix_test");
    const url = `postgresql://route_test:route_test_only@127.0.0.1:${port}/route_matrix_test`;
    await run(process.execPath, [prismaCli, "migrate", "deploy", "--schema", join(root, "apps/api/prisma/schema.prisma")], {
      cwd: root, env: { ...process.env, DATABASE_URL: url }, timeout: 120000,
    });
    client = db.getPgClient("route_matrix_test", "127.0.0.1");
    await client.connect();
    const a = "00000000-0000-0000-0000-000000000001";
    const b = "00000000-0000-0000-0000-000000000002";
    const roleA = "40000000-0000-4000-8000-000000000001";
    const roleB = "40000000-0000-4000-8000-000000000002";
    const userA = "40000000-0000-4000-8000-000000000003";
    const userB = "40000000-0000-4000-8000-000000000004";
    const sessionA = "40000000-0000-4000-8000-000000000005";
    const sessionB = "40000000-0000-4000-8000-000000000006";
    const categoryA = "40000000-0000-4000-8000-000000000007";
    const categoryB = "40000000-0000-4000-8000-000000000008";
    const productA = "40000000-0000-4000-8000-000000000009";
    await client.query(`INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1,'empresa-b','Empresa B',now())`, [b]);
    for (const [tenant, role, user, session, category, label] of [
      [a, roleA, userA, sessionA, categoryA, "A_ONLY_SECRET"],
      [b, roleB, userB, sessionB, categoryB, "B_PUBLIC"],
    ]) {
      await client.query(`INSERT INTO "Role" (id,name,permissions,"updatedAt","tenantId") VALUES ($1,'Administración',ARRAY['*'],now(),$2)`, [role, tenant]);
      await client.query(`INSERT INTO "User" (id,name,email,"passwordHash","pinHash","roleId","branchId","updatedAt","tenantId") VALUES ($1,$2,$3,'test-only','test-only',$4,'main',now(),$5)`, [user, label, `${tenant}@example.invalid`, role, tenant]);
      await client.query(`INSERT INTO "AuthSession" (id,"userId","tenantId") VALUES ($1,$2,$3)`, [session, user, tenant]);
      await client.query(`INSERT INTO "Settings" (id,data,"tenantId","updatedAt") VALUES ('main',$1::jsonb,$2,now())`, [JSON.stringify({ name: `Ajustes ${label}` }), tenant]);
      await client.query(`INSERT INTO "Category" (id,name,"updatedAt","tenantId") VALUES ($1,$2,now(),$3)`, [category, `Categoría ${label}`, tenant]);
    }
    await client.query(`INSERT INTO "Product" (id,name,sku,"categoryId","updatedAt","tenantId") VALUES ($1,'Producto A_ONLY_SECRET','A-ONLY',$2,now(),$3)`, [productA, categoryA, a]);
    process.env.DATABASE_URL = url;
    process.env.PRODUCT_TENANCY = "required";
    const { NestFactory } = apiRequire("@nestjs/core");
    const { JwtService } = apiRequire("@nestjs/jwt");
    const secret = "route-matrix-only-not-for-real-use-2026";
    const app = await NestFactory.create(createAppModule(secret), { logger: false });
    try {
      app.setGlobalPrefix("api");
      // main.ts installs this filter; the HTTP fixture must match production.
      app.useGlobalFilters(new ApiExceptionFilter());
      await app.init();
      const http = supertest(app.getHttpServer());
      const jwt = new JwtService({ secret });
      const auth = (tenantId: string, userId: string, sid: string) =>
        "Bearer " + jwt.sign({ sub: userId, sid, type: "access", version: 0, tenantId });
      const tokenA = auth(a, userA, sessionA);
      const tokenB = auth(b, userB, sessionB);
      for (const path of READ_LIST_CASES) {
        const response = await http.get(path).set("Authorization", tokenB);
        expect(response.status, `${path}: ${JSON.stringify(response.body)}`).toBe(200);
        expect(JSON.stringify(response.body), path).not.toContain("A_ONLY_SECRET");
      }
      const foreign = await http.get(`/api/products/${productA}`).set("Authorization", tokenB);
      expect([403, 404], JSON.stringify(foreign.body)).toContain(foreign.status);
      expect(JSON.stringify(foreign.body)).not.toContain("A_ONLY_SECRET");
      const createdB = await http.post("/api/categories").set("Authorization", tokenB)
        .send({ name: "Sólo empresa B" });
      expect(createdB.status, JSON.stringify(createdB.body)).toBe(201);
      const categoriesA = await http.get("/api/categories").set("Authorization", tokenA);
      expect(categoriesA.status).toBe(200);
      expect(JSON.stringify(categoriesA.body)).not.toContain("Sólo empresa B");
      const reports = await http.get("/api/reportes").set("Authorization", tokenB);
      expect(reports.status).toBe(200);
      expect(reports.body).toHaveLength(40);
      for (const { name } of reports.body) {
        const response = await http.get(`/api/reports/${name}`).set("Authorization", tokenB);
        expect(response.status, `Reporte ${name}: ${JSON.stringify(response.body)}`).toBe(200);
        expect(JSON.stringify(response.body), `Reporte ${name}`).not.toContain("A_ONLY_SECRET");
      }
    } finally {
      await app.close();
    }
  } finally {
    if (oldMode === undefined) delete process.env.PRODUCT_TENANCY;
    else process.env.PRODUCT_TENANCY = oldMode;
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
    await client?.end().catch(() => undefined);
    await db.stop().catch(() => undefined);
    await rm(dataDir, { recursive: true, force: true, maxRetries: 12, retryDelay: 250 });
  }
}, 180000);
