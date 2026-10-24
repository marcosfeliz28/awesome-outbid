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

// Every non-public endpoint now declares its policy explicitly. A newly
// undecorated route must be reviewed before delivery rather than being silently
// accepted as merely authenticated.
const AUTHENTICATED_RESOURCE_ROUTES = new Set<string>();

// GETs with no path parameters and a valid empty query. Every entry must
// return a successful response under tenant B, never a validation error.
const READ_LIST_CASES = [
  "/api/alert-rules", "/api/alerts", "/api/audit-log", "/api/auth/me",
  "/api/brands", "/api/billing/plans", "/api/billing/providers", "/api/billing/requests", "/api/cash-sessions", "/api/cash-sessions/opening-suggestion",
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
  "/api/terminals/current", "/api/tenant/status", "/api/users", "/api/void-requests",
] as const;

// A checked-in manifest of exercised HTTP routes. Each entry corresponds to a
// valid-body PostgreSQL request in product-route-{matrix,export,admin,
// admin-extra,auth-void,money,money-extra,money-final,money-last,
// inventory,inventory-extra,inventory-final,misc,registration}-postgres.test.ts.
// Adding a Nest route without a concrete case fails this gate; do not generate
// this set from productRoutes() at runtime, which would hide missing coverage.
const TESTED_PRODUCT_ROUTES = new Set(`
GET /api/alert-rules
GET /api/alerts
GET /api/audit-log
GET /api/auth/me
GET /api/billing/plans
GET /api/billing/providers
GET /api/billing/requests
GET /api/billing/requests/:id/proof
GET /api/brands
GET /api/cash-sessions
GET /api/cash-sessions/:id/cuadre
GET /api/cash-sessions/:id/reports/:name
GET /api/cash-sessions/opening-suggestion
GET /api/catalog-template.xlsx
GET /api/categories
GET /api/cod/pending
GET /api/courier/payouts
GET /api/courier/pending
GET /api/credit-accounts
GET /api/credit-accounts/:id
GET /api/credit-accounts/:id/statement.pdf
GET /api/credit-notes
GET /api/customers
GET /api/dashboard/breakdown
GET /api/dashboard/summary
GET /api/dashboard/year
GET /api/events
GET /api/expense-categories
GET /api/expenses
GET /api/goods-receipts
GET /api/goods-receipts/:id
GET /api/goods-receipts/export
GET /api/incentives
GET /api/incentives/export.xlsx
GET /api/incentives/me
GET /api/incentives/rates
GET /api/incentives/receipt.pdf
GET /api/inventory/counts
GET /api/inventory/location-report
GET /api/inventory/movements
GET /api/inventory/stock
GET /api/inventory/transfers
GET /api/inventory/warehouses
GET /api/merchandise/attachments/:id
GET /api/merchandise/operations
GET /api/merchandise/options
GET /api/merchandise/profiles/:id
GET /api/notifications/status
GET /api/onboarding
GET /api/payments/:id/proof
GET /api/payments/pending-transfers
GET /api/products
GET /api/products/:id
GET /api/promotions
GET /api/promotions/clearance-candidates
GET /api/purchase-orders
GET /api/quotes
GET /api/reportes
GET /api/reports/:name
GET /api/reports/formal
GET /api/reports/income-by-day
GET /api/returns/:id/credit-note.pdf
GET /api/roles
GET /api/sales
GET /api/sales/:id/receipt.pdf
GET /api/settings
GET /api/staff
GET /api/suppliers
GET /api/terminals
GET /api/terminals/current
GET /api/tenant/status
GET /api/tenant/export
GET /api/users
GET /api/void-requests
PATCH /api/alerts/:id
PATCH /api/customers/:id
PATCH /api/expense-categories/:id
PATCH /api/goods-receipts/:id/document
PATCH /api/inventory/warehouses/:id
PATCH /api/products/:id
PATCH /api/promotions/:id
PATCH /api/purchase-orders/:id/document
PATCH /api/sales/:id/courier
PATCH /api/terminals/:id/register
PATCH /api/users/:id
PATCH /api/variants/:id
POST /api/alerts/evaluate
POST /api/onboarding
POST /api/onboarding/profile
POST /api/auth/change-password
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/password
POST /api/auth/pin
POST /api/auth/refresh
POST /api/auth/register
POST /api/auth/resend-verification
POST /api/auth/verify-email
POST /api/brands
POST /api/billing/requests
POST /api/billing/requests/:id/proof
POST /api/cash-sessions/:id/close
POST /api/cash-sessions/:id/descuadre
POST /api/cash-sessions/:id/movements
POST /api/cash-sessions/:id/transfer
POST /api/cash-sessions/open
POST /api/categories
POST /api/courier/payouts
POST /api/credit-accounts/:id/collections
POST /api/customers
POST /api/customers/:id/anonymize
POST /api/expense-categories
POST /api/expenses
POST /api/expenses/:id/void
POST /api/incentives/close
POST /api/inventory-import/apply
POST /api/inventory-import/casa/apply
POST /api/inventory-import/casa/preview
POST /api/inventory-import/preview
POST /api/inventory/adjustments
POST /api/inventory/counts
POST /api/inventory/counts/:id/apply
POST /api/inventory/transfers
POST /api/kits
POST /api/merchandise/import
POST /api/merchandise/operations
POST /api/notifications/telegram/test
POST /api/payments/:id/correct-transfer
POST /api/payments/:id/proof
POST /api/payments/:id/reject
POST /api/payments/:id/verify
POST /api/products
POST /api/products/:id/variants
POST /api/products/import
POST /api/promotions
POST /api/purchase-orders
POST /api/purchase-orders/:id/receive
POST /api/quotes
POST /api/quotes/:id/convert
POST /api/returns
POST /api/sales
POST /api/sales/:id/cod-collections
POST /api/sales/:id/credit-collections
POST /api/sales/:id/installments
POST /api/sales/:id/mark-wholesale
POST /api/sales/:id/payments/:paymentId/correct-method
POST /api/sales/:id/seller
POST /api/sales/:id/void
POST /api/sales/:id/void-requests
POST /api/sales/offline-resolution
POST /api/sales/offline-review/discard
POST /api/sales/sync
POST /api/settings/logo
POST /api/supplier-payments
POST /api/suppliers
POST /api/terminals/:id/approve
POST /api/terminals/:id/approve-with-pin
POST /api/terminals/:id/rename
POST /api/terminals/:id/revoke
POST /api/terminals/register
POST /api/users
POST /api/users/:id/reset-password
POST /api/void-requests/:id/approve
POST /api/void-requests/:id/cancel
POST /api/void-requests/:id/reject
PUT /api/alert-rules
PUT /api/incentives/rates
PUT /api/roles/:id
PUT /api/settings
`.trim().split("\n"));

// Health endpoints deliberately operate without a tenant to support service
// probes before login. They have no customer, money, stock or settings output.
const PUBLIC_HEALTH_EXCEPTIONS = new Set([
  "GET /api/health",
  "GET /api/health/live",
  "GET /api/health/ready",
]);

it("enumera todas las rutas reales del módulo producto y excluye respaldos globales", () => {
  const routes = productRoutes();
  expect(new Set(routes).size).toBe(routes.length);
  expect([...PUBLIC_HEALTH_EXCEPTIONS].sort()).toEqual(
    routes.filter((key) => key.startsWith("GET /api/health")).sort(),
  );
  const required = routes.filter((key) => !PUBLIC_HEALTH_EXCEPTIONS.has(key));
  // Both directions matter: a newly registered route must have a case, and a
  // deleted/renamed route must not leave a stale "covered" manifest entry.
  expect([...TESTED_PRODUCT_ROUTES].sort()).toEqual(required.sort());
  expect(required).toHaveLength(169);
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

it("aisla rutas reales de catálogo, búsqueda y los 43 reportes con PostgreSQL", async () => {
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
      expect(reports.body).toHaveLength(43);
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
