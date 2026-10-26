import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { database } from "./setup/product-pg-app";

// T3 (auditoría 26-oct): las migraciones nuevas del producto se aplican sobre
// una base con datos hostiles (ventas fiscales incoherentes, referencias de
// IA repetidas, «Consumidor final» repetido, restricciones homónimas en otras
// tablas) sin abortar, y dejan la garantía instalada para las filas nuevas.
const root = resolve(import.meta.dirname, "..");
const prismaDir = join(root, "apps/api/prisma");
const apiRequire = createRequire(join(root, "apps/api/package.json"));
const prismaCli = apiRequire.resolve("prisma/build/index.js");
const { PrismaClient } = apiRequire("@prisma/client");
const run = promisify(execFile);
const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";
const id = (n: number) =>
  `70000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

let pg: Awaited<ReturnType<typeof database>>;
let db: any;
let work: string;
const q = (sql: string, ...p: unknown[]) =>
  db.$queryRawUnsafe(sql, ...p) as Promise<any[]>;
const code = async (sql: string, ...p: unknown[]) => {
  try {
    await q(sql, ...p);
    return "ok";
  } catch (e: any) {
    return String(e.meta?.code ?? e.code) + " " + String(e.meta?.message ?? e.message);
  }
};
// Aplica las migraciones con nombre menor que `before` (todas si se omite).
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
    { cwd: root, env: { ...process.env, DATABASE_URL: pg.url }, timeout: 180_000 },
  );
}
const sale = (n: number, extra = "") =>
  q(
    `INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt"${extra ? ",\"fiscalStatus\"" : ""}) VALUES ($1::uuid,$2::uuid,$3,$1::uuid,$4::uuid,'completed',1,0,0,1,0,now()${extra ? ",'" + extra + "'" : ""})`,
    id(n),
    A,
    "T3-" + n,
    id(5),
  );

beforeAll(async () => {
  work = await mkdtemp(join(tmpdir(), "nexora-t3-"));
  pg = await database("nexora_t3_migraciones");
  db = new PrismaClient({ datasources: { db: { url: pg.url } } });
  // Antes de pago_dolares: tablas ajenas con restricciones del mismo nombre.
  await migrate("202610250301_pago_dolares");
  await q(
    `CREATE TABLE "Decoy" (x int, CONSTRAINT payment_currency_valid CHECK (x > 0), CONSTRAINT "PlatformPayment_void_reason" CHECK (x > 0), CONSTRAINT "PlatformPayment_voidsPaymentId_fkey" CHECK (x > 0), CONSTRAINT "CashierSurvey_tenantId_fkey" CHECK (x > 0))`,
  );
  // Justo antes del resto: datos hostiles de empresas anteriores.
  await migrate("202610280024_product_base_roles_customer");
  await q(
    `INSERT INTO "Tenant" (id,slug,name,"updatedAt") VALUES ($1::uuid,'empresa-b-t3','Empresa B',now())`,
    B,
  );
  await q(
    `INSERT INTO "Role" (id,"tenantId",name,permissions,"updatedAt") VALUES ($1::uuid,$2::uuid,'T3',ARRAY['sale:write'],now())`,
    id(4),
    A,
  );
  await q(
    `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'V','v@example.invalid','x','x',$3::uuid,'main',now())`,
    id(5),
    A,
    id(4),
  );
  await sale(1, "issued"); // emitida sin NCF: viola sale_issued_has_ncf
  for (const [n, ref, at] of [
    [1, "ABC 123", "2026-01-01"],
    [2, "abc123", "2026-01-02"],
  ] as const)
    await q(
      `INSERT INTO "AiPackCredit" (id,"tenantId",month,questions,"priceDop",reference,"createdAt") VALUES ($1::uuid,$2::uuid,'2026-01',100,500,$3,$4::timestamp)`,
      id(10 + n),
      A,
      ref,
      at,
    );
  for (const n of [1, 2])
    await q(
      `INSERT INTO "Customer" (id,"tenantId",name,"updatedAt","createdAt") VALUES ($1::uuid,$2::uuid,'Consumidor Final',now(),$3::timestamp)`,
      id(20 + n),
      A,
      `2026-01-0${n}`,
    );
  await migrate();
}, 300_000);
afterAll(async () => {
  await db?.$disconnect().catch(() => undefined);
  await pg?.stop();
  if (work) await rm(work, { recursive: true, force: true });
});

describe("migraciones nuevas sobre datos hostiles", () => {
  it("ncf_coherencia: ventas antiguas no bloquean, las nuevas quedan protegidas", async () => {
    const rules = await q(
      `SELECT conname, convalidated FROM pg_constraint WHERE conrelid='"Sale"'::regclass AND conname IN ('sale_fiscal_status_valid','sale_issued_has_ncf','sale_ncf_matches_type') ORDER BY 1`,
    );
    expect(rules.map((r) => r.conname)).toEqual([
      "sale_fiscal_status_valid",
      "sale_issued_has_ncf",
      "sale_ncf_matches_type",
    ]);
    expect(rules.every((r) => r.convalidated)).toBe(true);
    expect(await code(`UPDATE "Sale" SET status='voided' WHERE id=$1::uuid`, id(1))).toBe("ok");
    expect(await code(`INSERT INTO "Sale" (id,"tenantId",number,"offlineUuid","sellerId",status,subtotal,"discountTotal","taxTotal",total,"costTotal","updatedAt","fiscalStatus") VALUES ($1::uuid,$2::uuid,'T3-NUEVA',$1::uuid,$3::uuid,'completed',1,0,0,1,0,now(),'issued')`, id(2), A, id(5))).toMatch(/^23514|sale_issued_has_ncf/);
  });

  it("ia08: referencias repetidas antiguas no desactivan la unicidad", async () => {
    expect((await q(`SELECT count(*)::int AS n FROM "AiPackCredit"`))[0].n).toBe(2);
    const dup = await code(
      `INSERT INTO "AiPackCredit" (id,"tenantId",month,questions,"priceDop",reference) VALUES ($1::uuid,$2::uuid,'2026-02',100,500,'A b C1 23')`,
      id(13),
      A,
    );
    expect(dup).toMatch(/23505|AiPackCredit_reference_normalized_key/);
    expect(
      await code(
        `INSERT INTO "AiPackCredit" (id,"tenantId",month,questions,"priceDop",reference) VALUES ($1::uuid,$2::uuid,'2026-02',100,500,'OTRA-1')`,
        id(14),
        A,
      ),
    ).toBe("ok");
  });

  it("platform_payment_void: una anulación no puede apuntar al pago de otra empresa", async () => {
    const pay = (n: number, tenant: string, voids: string | null) =>
      code(
        `INSERT INTO "PlatformPayment" (id,"tenantId",amount,method,reference,months,operator,"paidFrom","paidUntil","voidsPaymentId","voidReason") VALUES ($1::uuid,$2::uuid,100,'cash',$3,1,'op',now(),now()+interval '30 days',$4::uuid,$5)`,
        id(n),
        tenant,
        "REF-" + n,
        voids,
        voids ? "Error de cobro" : null,
      );
    expect(await pay(30, B, null)).toBe("ok");
    expect(await pay(31, A, id(30))).toMatch(/23503|otra empresa/);
    expect(await pay(32, B, id(30))).toBe("ok");
  });

  it("cashier_survey: la persona debe existir y ser de la misma empresa", async () => {
    const [roleA] = await q(`SELECT id FROM "Role" WHERE "tenantId"=$1::uuid LIMIT 1`, A);
    const [roleB] = await q(`SELECT id FROM "Role" WHERE "tenantId"=$1::uuid LIMIT 1`, B);
    for (const [n, tenant, role] of [
      [40, A, roleA.id],
      [41, B, roleB.id],
    ] as const)
      await q(
        `INSERT INTO "User" (id,"tenantId",name,email,"passwordHash","pinHash","roleId","branchId","updatedAt") VALUES ($1::uuid,$2::uuid,'U','u' || $3 || '@example.invalid','x','x',$4::uuid,'main',now())`,
        id(n),
        tenant,
        String(n),
        role,
      );
    const survey = (n: number, tenant: string, user: string) =>
      code(
        `INSERT INTO "CashierSurvey" (id,"tenantId","userId",answers,"updatedAt") VALUES ($1::uuid,$2::uuid,$3::uuid,'{}'::jsonb,now())`,
        id(n),
        tenant,
        user,
      );
    expect(await survey(50, A, id(99))).toMatch(/23503/);
    expect(await survey(51, A, id(41))).toMatch(/23503|otra empresa/);
    expect(await survey(52, A, id(40))).toBe("ok");
  });

  it("Consumidor final: un solo activo nuevo por empresa, sin tocar los repetidos antiguos", async () => {
    expect(
      (await q(`SELECT count(*)::int AS n FROM "Customer" WHERE "tenantId"=$1::uuid AND lower(name)='consumidor final'`, A))[0].n,
    ).toBe(2);
    expect(
      await code(
        `INSERT INTO "Customer" (id,"tenantId",name,"updatedAt") VALUES ($1::uuid,$2::uuid,'consumidor FINAL',now())`,
        id(60),
        A,
      ),
    ).toMatch(/23505|Customer_consumidor_final_key/);
    // La empresa B recibió el suyo en la migración y tampoco admite otro.
    expect(
      (await q(`SELECT count(*)::int AS n FROM "Customer" WHERE "tenantId"=$1::uuid AND lower(name)='consumidor final'`, B))[0].n,
    ).toBe(1);
  });

  it("las restricciones se buscan en su tabla, no por nombre global", async () => {
    const usd = await code(
      `INSERT INTO "Payment" (id,"tenantId","saleId",method,amount,tendered,currency) SELECT $1::uuid,$2::uuid,id,'cash',1,1,'USD' FROM "Sale" LIMIT 1`,
      id(70),
      A,
    );
    expect(usd).toMatch(/23514|payment_currency_valid/);
    const own = await q(
      `SELECT conrelid::regclass::text AS t, conname FROM pg_constraint WHERE conrelid IN ('"Payment"'::regclass,'"PlatformPayment"'::regclass,'"CashierSurvey"'::regclass) AND conname IN ('payment_currency_valid','PlatformPayment_void_reason','PlatformPayment_voidsPaymentId_fkey','CashierSurvey_tenantId_fkey') ORDER BY 2`,
    );
    expect(own.map((r) => r.conname)).toEqual([
      "CashierSurvey_tenantId_fkey",
      "PlatformPayment_void_reason",
      "PlatformPayment_voidsPaymentId_fkey",
      "payment_currency_valid",
    ]);
  });
});
