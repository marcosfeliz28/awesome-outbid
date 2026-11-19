// Paso 0 del preDeploy del producto (deploy/render/producto-precheck.mjs):
// se corre el preDeploy REAL (node deploy/render/producto-predeploy.mjs) como el
// dueño sin superusuario de Render, sobre una base nueva, una base en el estado
// en vivo d3acef4f con datos y bases con cada problema del ensayo de
// migraciones (19-nov): debe abortar sin tocar nada cuando las migraciones
// fallarían y pasar cuando todo está bien.
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { database } from "./setup/product-pg-app";

const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
// Las 18 migraciones del candidato que no estaban en d3acef4f (en vivo).
const NEW = new Set([
  "202610260901_gv",
  "202610260902_gv_citas",
  "202610260903_gv_auditoria",
  "202610310002_gv_pago_completo",
  "202610310003_gv_destino_tarjeta",
  "202610310004_gv_pago_moneda",
  "202611010001_gv_pago_usd_solo_efectivo",
  "202611040001_gv_caja",
  "202611050001_gv_comprobantes",
  "202611060001_gv_gerente_rol",
  "202611070001_ai_usage",
  "202611090001_baja_cliente",
  "202611100001_corrige_costo_maquillaje",
  "202611100002_corrige_costo_prd001",
  "202611190001_branches",
  "202611190002_incentive_unique_tenant",
  "202611190101_pc23_payment_prev_plan",
  "202611200001_producto_igualar_tenant",
]);
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const id = (n: number) =>
  `53000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const password = randomBytes(12).toString("hex");

let pg: Awaited<ReturnType<typeof database>>;
let admin: any;
let work: string;
let liveSchema: string;
const created: string[] = [];
const clients: any[] = [];

type Result = { code: number; out: string; err: string };
function node(args: string[], url: string): Promise<Result> {
  return new Promise((done) =>
    execFile(
      process.execPath,
      args,
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: url, RENDER_DATABASE_URL: "" },
        timeout: 240_000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error: any, out, err) =>
        done({ code: error ? (error.code ?? 1) : 0, out, err }),
    ),
  );
}
const predeploy = (url: string) =>
  node(["deploy/render/producto-predeploy.mjs"], url);

// Base propiedad del migrador sin superusuario, como nexora-saas-db en Render.
async function fresh(name: string) {
  await admin.$executeRawUnsafe(
    `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`,
  );
  await admin.$executeRawUnsafe(
    `CREATE DATABASE "${name}" OWNER nexora_saas_migrator`,
  );
  created.push(name);
  const url = new URL(pg.url);
  url.username = "nexora_saas_migrator";
  url.password = password;
  url.pathname = "/" + name;
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  clients.push(db);
  const q = (sql: string, ...p: unknown[]) =>
    db.$queryRawUnsafe(sql, ...p) as Promise<any[]>;
  return { url: url.toString(), q };
}

// Estado en vivo (d3acef4f): bootstrap + sus 81 migraciones + datos de dos
// empresas, una sucursal heredada con espacios y cierres de incentivos.
async function live(name: string) {
  const base = await fresh(name);
  for (const args of [
    [
      "db",
      "execute",
      "--url",
      base.url,
      "--file",
      "scripts/producto-bootstrap.sql",
    ],
    ["migrate", "deploy", "--schema", liveSchema],
  ]) {
    const r = await node([prismaCli, ...args], base.url);
    expect(r.code, r.out + r.err).toBe(0);
  }
  const { q } = base;
  await q(
    `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1::uuid,'pre-b','Colmado Doña Inés',now())`,
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
      `INSERT INTO "Settings" (id,"tenantId",data,"updatedAt") VALUES ('main',$1::uuid,'{"name":"Peña & Hijos «S.R.L.»"}'::jsonb,now())`,
      tenant,
    );
    await q(
      `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'Persona',$3,'x','x',$4::uuid,'main',now())`,
      id(10 + n),
      tenant,
      `pre${n}@example.invalid`,
      id(n),
    );
    // Con el único global de d3acef4f (H1) cada empresa cierra en una
    // sucursal o mes distinto; ninguno es repetido por empresa.
    await q(
      `INSERT INTO "IncentivePeriodClose" (id,"tenantId","branchId",period,"closedBy") VALUES ($1::uuid,$2::uuid,$3,'2026-10',$4::uuid)`,
      id(20 + n),
      tenant,
      n === 1 ? "main" : "sucursal-norte",
      id(10 + n),
    );
  }
  await q(
    `INSERT INTO "Terminal" (id,"tenantId",name,"branchId") VALUES ($1::uuid,$2::uuid,'Caja heredada',' Sucursal Sur ')`,
    id(30),
    B,
  );
  return base;
}

const migrations = async (q: any) =>
  (
    await q(
      `SELECT migration_name AS name, finished_at IS NOT NULL AS done, rolled_back_at IS NOT NULL AS rolled FROM _prisma_migrations ORDER BY migration_name`,
    )
  ).map((r: any) => `${r.name}:${r.done}:${r.rolled}`);

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "nexora-precheck-"));
  pg = await database("nexora_precheck_admin");
  admin = new PrismaClient({ datasources: { db: { url: pg.url } } });
  await admin.$executeRawUnsafe(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_saas_migrator') THEN
      CREATE ROLE nexora_saas_migrator LOGIN CREATEROLE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nexora_tenant_runtime') THEN
      CREATE ROLE nexora_tenant_runtime NOLOGIN;
    END IF;
  END $$`);
  await admin.$executeRawUnsafe(
    `ALTER ROLE nexora_saas_migrator LOGIN CREATEROLE NOSUPERUSER PASSWORD '${password}'`,
  );
  // En un clúster compartido el rol puede venir de otra prueba: el migrador
  // necesita poder otorgarlo, como cuando lo crea él mismo en Render.
  await admin.$executeRawUnsafe(
    `GRANT nexora_tenant_runtime TO nexora_saas_migrator WITH ADMIN OPTION`,
  );
  // Copia de las migraciones tal como estaban en d3acef4f.
  const dir = join(work, "live");
  await mkdir(join(dir, "migrations"), { recursive: true });
  await cp(join(prismaDir, "schema.prisma"), join(dir, "schema.prisma"));
  for (const name of await readdir(join(prismaDir, "migrations")))
    if (!NEW.has(name))
      await cp(
        join(prismaDir, "migrations", name),
        join(dir, "migrations", name),
        {
          recursive: true,
        },
      );
  liveSchema = join(dir, "schema.prisma");
}, 240_000);

afterAll(async () => {
  for (const db of clients) await db.$disconnect().catch(() => undefined);
  for (const name of created)
    await admin
      ?.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
      .catch(() => undefined);
  await admin?.$disconnect().catch(() => undefined);
  await pg?.stop();
  if (work) await rm(work, { recursive: true, force: true });
}, 120_000);

describe("chequeo previo del preDeploy del producto", () => {
  it("base nueva: avisa y pasa; repetido sobre la base al día pasa sin cambios", async () => {
    const { url, q } = await fresh("nexora_precheck_nueva");
    const first = await predeploy(url);
    expect(first.code, first.out + first.err).toBe(0);
    expect(first.out).toContain("AVISO: Base nueva");
    expect(first.out).toContain("Chequeo previo: correcto");
    expect(first.out).toContain(
      "All migrations have been successfully applied",
    );

    // Ya al día: el chequeo solo no cambia nada (transacción READ ONLY).
    const before = await migrations(q);
    const alone = await node(
      [
        "deploy/render/with-cloud-env.mjs",
        "deploy/render/producto-precheck.mjs",
      ],
      url,
    );
    expect(alone.code, alone.out + alone.err).toBe(0);
    expect(alone.out).toContain("pendientes: 0");
    expect(alone.out).not.toContain("AVISO");
    expect(await migrations(q)).toEqual(before);

    const again = await predeploy(url);
    expect(again.code, again.out + again.err).toBe(0);
    expect(again.out).toContain("No pending migrations to apply");
    expect(await migrations(q)).toEqual(before);
  }, 300_000);

  it("base en el estado en vivo d3acef4f con datos: pasa y migra las 18", async () => {
    const { url, q } = await live("nexora_precheck_vivo");
    const r = await predeploy(url);
    expect(r.code, r.out + r.err).toBe(0);
    expect(r.out).toContain("pendientes: 18");
    expect(r.out).toContain("Empresas: 2.");
    expect(r.out).toContain("Chequeo previo: correcto");
    expect(r.out).not.toContain("AVISO");
    expect(
      await q(`SELECT "tenantId","id" FROM "Branch" ORDER BY "tenantId","id"`),
    ).toEqual([
      { tenantId: A, id: "main" },
      { tenantId: B, id: " Sucursal Sur " },
      { tenantId: B, id: "main" },
    ]);
    expect(
      await q(
        `SELECT count(*)::int AS n FROM pg_indexes WHERE indexname = 'IncentivePeriodClose_tenantId_branchId_period_key'`,
      ),
    ).toEqual([{ n: 1 }]);
  }, 300_000);

  it("un branchId de 81 caracteres aborta antes de tocar la base", async () => {
    const { url, q } = await live("nexora_precheck_81");
    await q(
      `INSERT INTO "Terminal" (id,"tenantId",name,"branchId") VALUES ($1::uuid,$2::uuid,'Caja larga',$3)`,
      id(40),
      B,
      "s".repeat(81),
    );
    const before = await migrations(q);
    const r = await predeploy(url);
    expect(r.code).not.toBe(0);
    expect(r.err).toContain("branchId de más de 80 caracteres");
    expect(r.err).toContain("Terminal");
    expect(r.err).toContain("202611190001_branches");
    expect(r.err).toContain("No se cambió nada");
    expect(r.out).not.toContain("Applying migration");
    expect(await migrations(q)).toEqual(before);
    expect(
      await q(`SELECT to_regclass('"Branch"') IS NULL AS ausente`),
    ).toEqual([{ ausente: true }]);
  }, 300_000);

  it("una migración fallida sin resolver (P3009) aborta con el mensaje y el runbook", async () => {
    const { url, q } = await live("nexora_precheck_p3009");
    // Un despliegue sin chequeo (como antes) falla a mitad en branches…
    await q(
      `INSERT INTO "Terminal" (id,"tenantId",name,"branchId") VALUES ($1::uuid,$2::uuid,'Caja larga',$3)`,
      id(41),
      B,
      "s".repeat(81),
    );
    const broken = await node(
      [
        prismaCli,
        "migrate",
        "deploy",
        "--schema",
        "apps/api/prisma/schema.prisma",
      ],
      url,
    );
    expect(broken.code).not.toBe(0);
    // …y aunque se corrija la fila, queda la migración fallida pendiente.
    await q(
      `UPDATE "Terminal" SET "branchId" = 'corta' WHERE id = $1::uuid`,
      id(41),
    );
    const before = await migrations(q);
    const r = await predeploy(url);
    expect(r.code).not.toBe(0);
    expect(r.err).toContain(
      "fallida(s) sin resolver (P3009): 202611190001_branches",
    );
    expect(r.err).toContain("migrate resolve --rolled-back");
    expect(r.err).toContain("nexora-saas-api");
    expect(await migrations(q)).toEqual(before);

    // Runbook: resolver como revertida y volver a desplegar.
    const resolved = await node(
      [
        prismaCli,
        "migrate",
        "resolve",
        "--rolled-back",
        "202611190001_branches",
        "--schema",
        "apps/api/prisma/schema.prisma",
      ],
      url,
    );
    expect(resolved.code, resolved.out + resolved.err).toBe(0);
    const ok = await predeploy(url);
    expect(ok.code, ok.out + ok.err).toBe(0);
    expect(ok.out).toContain("All migrations have been successfully applied");
  }, 300_000);

  it("cierres de incentivo repetidos por empresa abortan", async () => {
    const { url, q } = await live("nexora_precheck_incentivos");
    // Solo es posible si falta el único global viejo (p. ej. creado a mano).
    await q(`DROP INDEX IF EXISTS "IncentivePeriodClose_branchId_period_key"`);
    await q(
      `INSERT INTO "IncentivePeriodClose" (id,"tenantId","branchId",period,"closedBy") VALUES ($1::uuid,$2::uuid,'main','2026-10',$3::uuid)`,
      id(50),
      A,
      id(11),
    );
    const before = await migrations(q);
    const r = await predeploy(url);
    expect(r.code).not.toBe(0);
    expect(r.err).toContain(
      "IncentivePeriodClose tiene 1 grupo(s) repetido(s)",
    );
    expect(r.err).toContain(
      "IncentivePeriodClose_tenantId_branchId_period_key",
    );
    expect(await migrations(q)).toEqual(before);
  }, 300_000);
});
