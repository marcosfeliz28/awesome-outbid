// La migración de sucursales sobre una base que ya tiene empresas y datos:
// registra 'main' (y cualquier sucursal ya usada) sin cambiar ninguna fila,
// es idempotente y deja la RLS separando empresas.
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { afterAll, beforeAll, expect, it } from "vitest";
import { database } from "./setup/product-pg-app";

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const MIGRATION = "202611190001_branches";
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const id = (n: number) =>
  `52000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let pg: Awaited<ReturnType<typeof database>>;
let db: any;
let work: string;
const q = (sql: string, ...p: unknown[]) =>
  db.$queryRawUnsafe(sql, ...p) as Promise<any[]>;

async function migrate(before?: string) {
  const dir = join(work, before ?? "full");
  const migrations = join(dir, "migrations");
  await mkdir(migrations, { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(dir, "schema.prisma"));
  await cp(
    join(prismaDir, "migrations/migration_lock.toml"),
    join(migrations, "migration_lock.toml"),
  );
  for (const name of await readdir(join(prismaDir, "migrations")))
    if (name !== "migration_lock.toml" && (!before || name < before))
      await cp(join(prismaDir, "migrations", name), join(migrations, name), {
        recursive: true,
      });
  await run(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", join(dir, "schema.prisma")],
    {
      cwd: root,
      env: { ...process.env, DATABASE_URL: pg.url },
      timeout: 180_000,
    },
  );
}

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "nexora-sucursales-mig-"));
  pg = await database("nexora_sucursales_migracion");
  db = new PrismaClient({ datasources: { db: { url: pg.url } } });
  await migrate(MIGRATION);
  // Datos previos: dos empresas, ajustes, personas y una sucursal heredada.
  await q(
    `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1::uuid,'mig-b','Empresa B',now())`,
    B,
  );
  for (const [n, tenant] of [
    [1, A],
    [2, B],
  ] as const) {
    await q(
      `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'Administración',ARRAY['*'],now())`,
      id(n),
      tenant,
    );
    await q(
      `INSERT INTO "Settings" (id,"tenantId",data,"updatedAt") VALUES ('main',$1::uuid,'{"name":"Tienda"}'::jsonb,now())`,
      tenant,
    );
    await q(
      `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'Persona',$3,'x','x',$4::uuid,'main',now())`,
      id(10 + n),
      tenant,
      `p${n}@example.invalid`,
      id(n),
    );
  }
  await q(
    `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'Heredada','h@example.invalid','x','x',$3::uuid,'norte',now())`,
    id(20),
    A,
    id(1),
  );
}, 240_000);

afterAll(async () => {
  await db?.$disconnect().catch(() => undefined);
  await pg?.stop();
  if (work) await rm(work, { recursive: true, force: true });
});

it("registra las sucursales existentes, conserva 'main' y no cambia datos", async () => {
  const usersBefore = await q(
    `SELECT id,"branchId","updatedAt" FROM "User" ORDER BY id`,
  );
  await migrate();
  expect(
    await q(
      `SELECT "tenantId",id,name,active FROM "Branch" ORDER BY "tenantId",id`,
    ),
  ).toEqual([
    { tenantId: A, id: "main", name: "Principal", active: true },
    { tenantId: A, id: "norte", name: "norte", active: true },
    { tenantId: B, id: "main", name: "Principal", active: true },
  ]);
  expect(
    await q(`SELECT id,"branchId","updatedAt" FROM "User" ORDER BY id`),
  ).toEqual(usersBefore);

  // Idempotente: aplicarla otra vez no duplica ni falla.
  await run(process.execPath, [prismaCli, "db", "execute", "--url", pg.url, "--file",
    join(prismaDir, "migrations", MIGRATION, "migration.sql")], { cwd: root, timeout: 60_000 });
  expect(await q(`SELECT count(*)::int AS n FROM "Branch"`)).toEqual([
    { n: 3 },
  ]);

  // RLS: la empresa B sólo ve lo suyo, no puede crear filas de A, y unos
  // ajustes nuevos registran su sucursal con el rol de la empresa.
  const asTenant = async (tenant: string, fn: (tx: any) => Promise<unknown>) =>
    db.$transaction(async (tx: any) => {
      await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_tenant_runtime");
      await tx.$queryRawUnsafe(
        "SELECT set_config('app.tenant_id', $1, true)",
        tenant,
      );
      return fn(tx);
    });
  expect(
    await asTenant(B, (tx) =>
      tx.$queryRawUnsafe(`SELECT "tenantId",id FROM "Branch"`),
    ),
  ).toEqual([{ tenantId: B, id: "main" }]);
  await expect(
    asTenant(B, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "Branch" ("tenantId",id,name) VALUES ($1::uuid,'x','x')`,
        A,
      ),
    ),
  ).rejects.toThrow(/row-level security/);
  await asTenant(B, (tx) =>
    tx.$executeRawUnsafe(
      `INSERT INTO "Settings" (id,"tenantId",data,"updatedAt") VALUES ('s9',$1::uuid,'{}'::jsonb,now())`,
      B,
    ),
  );
  expect(await q(`SELECT "tenantId",id FROM "Branch" WHERE id='s9'`)).toEqual([
    { tenantId: B, id: "s9" },
  ]);
}, 240_000);
