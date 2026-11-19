// Sucursales (orden de la dueña, 19-nov) contra PostgreSQL real y la app Nest:
// crear con límite del plan, renombrar, desactivar, asignar personas, cambiar
// de sucursal, y aislamiento entre empresas (RLS) y entre sucursales.
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startProductApp, TENANT } from "./setup/product-pg-app";

const root = resolve(import.meta.dirname, "..");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const { JwtService } = apiRequire("@nestjs/jwt");
const NAME = "nexora_sucursales";
const B = "00000000-0000-0000-0000-000000000002";
const ADMIN_A = "30000000-0000-4000-8000-000000000002";
const id = (n: number) =>
  `51000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let app: Awaited<ReturnType<typeof startProductApp>>;
const jwt = new JwtService({
  secret: "clave-exclusiva-de-prueba-" + NAME.padEnd(32, "x"),
});
const bearer = (tenantId: string, userId: string, sid: string, version = 0) =>
  "Bearer " + jwt.sign({ sub: userId, sid, type: "access", version, tenantId });
const as = (
  token: string,
  method: "get" | "post" | "patch",
  path: string,
  body?: unknown,
) => {
  const http: any = app.http;
  const req = http[method]("/api" + path).set("Authorization", token);
  return body === undefined ? req : req.send(body);
};

beforeAll(async () => {
  app = await startProductApp(NAME);
  const { q } = app;
  await q(
    `INSERT INTO "Settings" (id,"tenantId",data,"updatedAt") VALUES ('main',$1::uuid,$2::jsonb,now())`,
    TENANT,
    JSON.stringify({
      name: "Tienda A",
      taxRate: 18,
      currency: "DOP",
      onboarding: { dismissed: false },
    }),
  );
  // Cajera de A en la principal, con un cliente que sólo la principal debe ver.
  await q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Cajera',ARRAY['sale:write','customers:write','catalog:read'],now())`,
    id(1),
    TENANT,
  );
  await q(
    `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","cashierNumber","updatedAt") VALUES ($1::uuid,$2::uuid,'Caja A','caja-a@example.invalid','x','x',$3::uuid,'main',7,now())`,
    id(2),
    TENANT,
    id(1),
  );
  await q(
    `INSERT INTO "AuthSession" (id,"tenantId","userId") VALUES ($1::uuid,$2::uuid,$3::uuid)`,
    id(3),
    TENANT,
    id(2),
  );
  await q(
    `INSERT INTO "Customer" (id,"tenantId",name,"branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'MAIN_ONLY_SECRET','main',now())`,
    id(4),
    TENANT,
  );
  // Sesión de la administradora A desde un navegador sin equipo registrado.
  await q(
    `INSERT INTO "AuthSession" (id,"tenantId","userId") VALUES ($1::uuid,$2::uuid,$3::uuid)`,
    id(5),
    TENANT,
    ADMIN_A,
  );
  // Empresa B con su administradora.
  await q(
    `INSERT INTO "Tenant" (id,slug,name,plan,"updatedAt") VALUES ($1::uuid,'sucursales-b','Empresa B','premium',now())`,
    B,
  );
  await q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Administración',ARRAY['*'],now())`,
    id(10),
    B,
  );
  await q(
    `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'Admin B','admin-b@example.invalid','x','x',$3::uuid,'main',now())`,
    id(11),
    B,
    id(10),
  );
  await q(
    `INSERT INTO "AuthSession" (id,"tenantId","userId") VALUES ($1::uuid,$2::uuid,$3::uuid)`,
    id(12),
    B,
    id(11),
  );
}, 180_000);

afterAll(async () => {
  await app?.stop();
});

it("crea, renombra, desactiva y asigna sucursales con límite de plan y aislamiento", async () => {
  const admin = app.token;
  const browser = bearer(TENANT, ADMIN_A, id(5));
  const tokenB = bearer(B, id(11), id(12));

  const initial = await as(admin, "get", "/branches");
  expect(initial.status, JSON.stringify(initial.body)).toBe(200);
  expect(initial.body).toEqual([
    expect.objectContaining({
      id: "main",
      name: "Principal",
      active: true,
      current: true,
    }),
  ]);

  // Prueba gratis = Autoservicio: 1 sucursal.
  const overLimit = await as(admin, "post", "/branches", { name: "Santiago" });
  expect(overLimit.status).toBe(409);
  expect(overLimit.body.message).toContain("permite 1 sucursal");

  await app.q(`UPDATE "Tenant" SET plan='pro' WHERE id=$1::uuid`, TENANT);
  const created = await as(admin, "post", "/branches", { name: "Santiago" });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  expect(created.body).toEqual({ id: "s2", name: "Santiago", active: true });
  const [settings] = await app.q(
    `SELECT data FROM "Settings" WHERE "tenantId"=$1::uuid AND id='s2'`,
    TENANT,
  );
  expect(settings.data).toMatchObject({
    name: "Tienda A",
    taxRate: 18,
    currency: "DOP",
  });
  expect(settings.data.onboarding).toBeUndefined();
  const warehouses = await app.q(
    `SELECT name,kind,sellable FROM "Warehouse" WHERE "tenantId"=$1::uuid AND "branchId"='s2'`,
    TENANT,
  );
  expect(warehouses).toEqual([
    { name: "Tienda", kind: "store", sellable: true },
  ]);
  expect(
    await app.q(
      `SELECT count(*)::int AS n FROM "Customer" WHERE "branchId"='s2'`,
    ),
  ).toEqual([{ n: 0 }]);
  expect(
    await app.q(
      `SELECT count(*)::int AS n FROM "AuditLog" WHERE action='branch_create' AND "entityId"='s2'`,
    ),
  ).toEqual([{ n: 1 }]);

  const third = await as(admin, "post", "/branches", { name: "La Romana" });
  expect(third.status).toBe(409);
  expect(third.body.message).toContain("permite 2 sucursales");

  expect(
    (await as(admin, "patch", "/branches/s2", { name: "principal" })).status,
  ).toBe(409);
  const renamed = await as(admin, "patch", "/branches/s2", {
    name: "Santiago Centro",
  });
  expect(renamed.status, JSON.stringify(renamed.body)).toBe(200);
  expect(renamed.body.name).toBe("Santiago Centro");
  expect(
    (await as(admin, "patch", "/branches/main", { active: false })).status,
  ).toBe(409);

  // La cajera pasa a s2: se cierran sus sesiones y deja de ver la principal.
  const moved = await as(admin, "post", "/branches/s2/users", {
    userId: id(2),
  });
  expect(moved.status, JSON.stringify(moved.body)).toBe(201);
  const [cashier] = await app.q(
    `SELECT "branchId","authVersion" FROM "User" WHERE id=$1::uuid`,
    id(2),
  );
  expect(cashier).toEqual({ branchId: "s2", authVersion: 1 });
  expect(
    (await as(bearer(TENANT, id(2), id(3), 0), "get", "/customers")).status,
  ).toBe(401);
  const cashierToken = bearer(TENANT, id(2), id(3), 1);
  const customers = await as(cashierToken, "get", "/customers");
  expect(customers.status).toBe(200);
  expect(JSON.stringify(customers.body)).not.toContain("MAIN_ONLY_SECRET");
  // Una cajera no administra sucursales.
  expect((await as(cashierToken, "get", "/branches")).status).toBe(403);
  expect(
    (await as(cashierToken, "post", "/branches", { name: "Otra" })).status,
  ).toBe(403);
  expect(
    (await as(cashierToken, "patch", "/branches/main", { name: "Otra" }))
      .status,
  ).toBe(403);
  expect(
    (await as(cashierToken, "post", "/branches/main/users", { userId: id(2) }))
      .status,
  ).toBe(403);

  const listed = await as(admin, "get", "/branches");
  expect(listed.body.find((b: any) => b.id === "s2").users).toEqual([
    { id: id(2), name: "Caja A", role: "Cajera" },
  ]);

  // Con gente o caja abierta no se desactiva; la caja abierta tampoco se muda.
  expect(
    (await as(admin, "patch", "/branches/s2", { active: false })).status,
  ).toBe(409);
  await app.q(
    `INSERT INTO "CashSession" (id,"tenantId","userId","openingAmount","branchId") VALUES ($1::uuid,$2::uuid,$3,0,'s2')`,
    id(6),
    TENANT,
    id(2),
  );
  const busy = await as(admin, "post", "/branches/main/users", {
    userId: id(2),
  });
  expect(busy.status).toBe(409);
  expect(busy.body.message).toContain("caja abierta");
  await app.q(
    `UPDATE "CashSession" SET "closedAt"=now() WHERE id=$1::uuid`,
    id(6),
  );
  expect(
    (await as(admin, "post", "/branches/main/users", { userId: id(2) })).status,
  ).toBe(201);
  const off = await as(admin, "patch", "/branches/s2", { active: false });
  expect(off.status, JSON.stringify(off.body)).toBe(200);
  expect(off.body.active).toBe(false);
  expect(
    (await as(admin, "post", "/branches/s2/users", { userId: id(2) })).status,
  ).toBe(409);
  expect(
    (await as(admin, "patch", "/branches/s2", { active: true })).status,
  ).toBe(200);

  // Empresa B: no ve ni toca sucursales ni personas de A.
  const listB = await as(tokenB, "get", "/branches");
  expect(listB.status).toBe(200);
  expect(JSON.stringify(listB.body)).not.toContain("Santiago");
  expect(JSON.stringify(listB.body)).not.toContain("Caja A");
  expect(
    (await as(tokenB, "patch", "/branches/s2", { name: "Robada" })).status,
  ).toBe(404);
  expect(
    (await as(tokenB, "post", "/branches/s2/users", { userId: id(11) })).status,
  ).toBe(404);
  expect(
    (await as(tokenB, "post", "/branches/main/users", { userId: id(2) }))
      .status,
  ).toBe(404);
  const createdB = await as(tokenB, "post", "/branches", {
    name: "Sucursal B",
  });
  expect(createdB.status, JSON.stringify(createdB.body)).toBe(201);
  expect(createdB.body.id).toBe("s2");
  const rows = await app.q(
    `SELECT "tenantId", id, name FROM "Branch" WHERE id='s2' ORDER BY "tenantId"`,
  );
  expect(rows).toEqual([
    { tenantId: TENANT, id: "s2", name: "Santiago Centro" },
    { tenantId: B, id: "s2", name: "Sucursal B" },
  ]);
  expect(
    (await app.q(`SELECT "branchId" FROM "User" WHERE id=$1::uuid`, id(2)))[0]
      .branchId,
  ).toBe("main");

  // Selector: desde un equipo registrado no; desde el navegador sí, y la sesión opera la otra.
  expect(
    (await as(admin, "post", "/branches/s2/users", { userId: ADMIN_A })).status,
  ).toBe(409);
  const switched = await as(browser, "post", "/branches/s2/users", {
    userId: ADMIN_A,
  });
  expect(switched.status, JSON.stringify(switched.body)).toBe(201);
  const after = await as(browser, "get", "/branches");
  expect(after.status).toBe(200);
  expect(after.body.find((b: any) => b.current).id).toBe("s2");
  const customersS2 = await as(browser, "get", "/customers");
  expect(JSON.stringify(customersS2.body)).not.toContain("MAIN_ONLY_SECRET");
}, 120_000);
