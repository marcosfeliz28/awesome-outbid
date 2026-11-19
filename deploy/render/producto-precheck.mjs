// Paso 0 del preDeploy del producto (render.producto.yaml): chequeo previo de
// SOLO LECTURA antes del bootstrap y de `prisma migrate deploy`. Sustituye el
// precheck.cjs que el ensayo de migraciones (19-nov) pedía correr a mano.
// Corre en una transacción READ ONLY: no cambia nada. Sale con 1 (y Render no
// publica) si encuentra algo que haría fallar o dejar a medias las migraciones.
// Base nueva (sin tablas) o base ya al día: pasa.
// Uso (lo llama producto-predeploy.mjs a través de with-cloud-env.mjs):
//   node deploy/render/with-cloud-env.mjs node deploy/render/producto-precheck.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const root = new URL("../../", import.meta.url);
const migrations = new URL("apps/api/prisma/migrations/", root);
const { PrismaClient } = createRequire(new URL("apps/api/package.json", root))(
  "@prisma/client",
);

const BRANCHES = "202611190001_branches";
const INCENTIVES = "202611190002_incentive_unique_tenant";
// 202611100001/2 corrigen el costo de líneas de venta de la tienda por id fijo.
const COST_FIX = [
  "202611100001_corrige_costo_maquillaje",
  "202611100002_corrige_costo_prd001",
];
const INCENTIVE_KEYS = [
  ["IncentiveRate", ["branchId", "categoryId"]],
  ["IncentivePeriodClose", ["branchId", "period"]],
  ["IncentiveSettlement", ["branchId", "period", "userId"]],
];
const RESOLVE =
  "node deploy/render/with-cloud-env.mjs node apps/api/node_modules/prisma/build/index.js migrate resolve --rolled-back <nombre> --schema apps/api/prisma/schema.prisma";

async function check(q) {
  const errors = [];
  const warnings = [];
  const info = [];
  const one = async (sql, ...p) => (await q(sql, ...p))[0];
  const table = async (name) =>
    (
      await one(
        `SELECT to_regclass(quote_ident(current_schema()) || '.' || quote_ident($1)) IS NOT NULL AS ok`,
        name,
      )
    ).ok;
  const column = async (name, col) =>
    (
      await one(
        `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
        name,
        col,
      )
    ).n > 0;

  const { n: tables } = await one(
    `SELECT count(*)::int AS n FROM pg_class c JOIN pg_namespace s ON s.oid = c.relnamespace WHERE s.nspname = current_schema() AND c.relkind IN ('r','p')`,
  );
  if (!(await table("_prisma_migrations"))) {
    if (tables === 0) {
      warnings.push(
        "Base nueva (sin tablas ni _prisma_migrations): se creará completa con las migraciones.",
      );
    } else {
      errors.push(
        `La base tiene ${tables} tabla(s) pero no _prisma_migrations: no es una base del producto o se creó a mano (Prisma fallaría con P3005). Qué hacer: comprobar que el servicio apunta a nexora-saas-db y no publicar hasta aclararlo.`,
      );
    }
    return { errors, warnings, info };
  }

  const failed = await q(
    `SELECT migration_name AS name FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL ORDER BY started_at`,
  );
  if (failed.length)
    errors.push(
      `Hay ${failed.length} migración(es) fallida(s) sin resolver (P3009): ${failed.map((r) => r.name).join(", ")}. Prisma no aplicará ninguna otra hasta resolverlas. Qué hacer (docs/MIGRACIONES_SEGURAS.md, «Si una migración falla en Render»), en el Shell de nexora-saas-api: leer el error en Events, comprobar que la migración no dejó nada a medias, correr «${RESOLVE}» y volver a desplegar.`,
    );

  const applied = new Set(
    (
      await q(
        `SELECT migration_name AS name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
      )
    ).map((r) => r.name),
  );
  const pending = existsSync(migrations)
    ? readdirSync(migrations).filter((n) => /^\d/.test(n) && !applied.has(n))
    : [];
  info.push(
    `Migraciones aplicadas: ${applied.size}; pendientes: ${pending.length}; última: ${[...applied].sort().at(-1) ?? "ninguna"}.`,
  );
  if (await table("Tenant"))
    info.push(
      `Empresas: ${(await one(`SELECT count(*)::int AS n FROM "Tenant"`)).n}.`,
    );

  // H2: 202611190001_branches copia cada branchId a "Branch".name, que admite
  // de 1 a 80 caracteres; uno más largo hace fallar la migración entera.
  if (!applied.has(BRANCHES)) {
    const sources = [];
    for (const [name, col] of [
      ["Settings", "id"],
      ["User", "branchId"],
      ["Terminal", "branchId"],
      ["Warehouse", "branchId"],
    ])
      if ((await table(name)) && (await column(name, col)))
        sources.push(
          `SELECT '${name}' AS t, "${col}" AS b FROM "${name}" WHERE char_length(btrim("${col}")) > 80`,
        );
    if (sources.length) {
      const long = await q(
        `SELECT t, char_length(b)::int AS len, left(b, 40) AS start FROM (${sources.join(" UNION ALL ")}) x ORDER BY t`,
      );
      if (long.length)
        errors.push(
          `Hay ${long.length} branchId de más de 80 caracteres (${long
            .slice(0, 5)
            .map((r) => `${r.t}: «${r.start}…» (${r.len})`)
            .join(
              "; ",
            )}). La migración ${BRANCHES} fallaría entera (Branch_name_check). Qué hacer: acortar esos branchId con la dueña (en la app o con su visto bueno) y volver a desplegar.`,
        );
    }
  }

  // H1/A1: los únicos de incentivos pasan a ser por empresa. Con grupos
  // repetidos la migración no crea el índice (solo avisa) y queda aplicada.
  for (const [name, cols] of INCENTIVE_KEYS) {
    if (!(await table(name)) || !(await column(name, "tenantId"))) continue;
    const index = `${name}_tenantId_${cols.join("_")}_key`;
    const { n: exists } = await one(
      `SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname = current_schema() AND indexname = $1`,
      index,
    );
    if (exists) continue;
    const list = ["tenantId", ...cols].map((c) => `"${c}"`).join(", ");
    const { n: dupes } = await one(
      `SELECT count(*)::int AS n FROM (SELECT 1 FROM "${name}" GROUP BY ${list} HAVING count(*) > 1) d`,
    );
    if (dupes)
      errors.push(
        `${name} tiene ${dupes} grupo(s) repetido(s) por (${list}): no se podría crear el índice único por empresa ${index} (${INCENTIVES}). Qué hacer: revisar con la dueña cuál fila sobra en cada grupo (SELECT ${list}, count(*) FROM "${name}" GROUP BY ${list} HAVING count(*) > 1), corregirlo y volver a desplegar.`,
      );
    else if (applied.has(INCENTIVES))
      warnings.push(
        `${INCENTIVES} está aplicada pero falta el índice ${index}: una segunda empresa podría recibir 409 al cerrar incentivos. Avisar a Norexos 1.`,
      );
  }

  // H4: esas migraciones solo deben tocar datos de la tienda; en el producto
  // no debe existir ninguna de sus líneas de venta.
  const costPending = COST_FIX.filter(
    (n) =>
      !applied.has(n) && existsSync(new URL(`${n}/migration.sql`, migrations)),
  );
  if (costPending.length && (await table("SaleItem"))) {
    const ids = [
      ...new Set(
        costPending.flatMap(
          (n) =>
            readFileSync(
              new URL(`${n}/migration.sql`, migrations),
              "utf8",
            ).match(
              /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
            ) ?? [],
        ),
      ),
    ];
    const { n } = await one(
      `SELECT count(*)::int AS n FROM "SaleItem" WHERE id::text = ANY($1::text[])`,
      ids,
    );
    if (n)
      errors.push(
        `${n} línea(s) de venta de esta base tienen los ids de la tienda que corrigen ${costPending.join(" y ")}: esas migraciones les cambiarían el costo. Qué hacer: no publicar y avisar a Norexos 1 y a la dueña.`,
      );
  }
  return { errors, warnings, info };
}

const db = new PrismaClient();
try {
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
      return check((sql, ...p) => tx.$queryRawUnsafe(sql, ...p));
    },
    { maxWait: 15_000, timeout: 60_000 },
  );
  for (const line of result.info) console.log(`Chequeo previo: ${line}`);
  for (const line of result.warnings)
    console.log(`Chequeo previo, AVISO: ${line}`);
  for (const line of result.errors)
    console.error(`Chequeo previo, NO SE PUBLICA: ${line}`);
  if (result.errors.length) {
    console.error(
      "Chequeo previo: despliegue detenido antes de tocar la base. No se cambió nada; la versión anterior sigue atendiendo.",
    );
    process.exitCode = 1;
  } else console.log("Chequeo previo: correcto (solo lectura, sin cambios).");
} catch (error) {
  // Nunca la URL de la base.
  const text = (error instanceof Error ? error.message : String(error))
    .replace(/\s+/g, " ")
    .replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***");
  console.error(
    `Chequeo previo, NO SE PUBLICA: no se pudo leer la base (${text.trim()}). Qué hacer: revisar que nexora-saas-db esté disponible y volver a desplegar; no se cambió nada.`,
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect().catch(() => undefined);
}
