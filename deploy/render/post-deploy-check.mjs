#!/usr/bin/env node
// Comprobación posterior al despliegue.
//
// 1. HTTP: consulta /api/health de la web pública y, si se indica, de la API,
//    y falla si no responde 200 con `status: "ok"`. /api/health comprueba la
//    base de datos (503 si no responde) pero, al ser público, ya no detalla
//    el estado (S-06); se acepta también la respuesta anterior con
//    `database: "ok"` para verificar un despliegue previo.
// 2. Base de datos (auditoría 04 N2 y 06 D-M9, SOLO LECTURA): Prisma no
//    muestra los NOTICE de las migraciones, así que un índice, una
//    restricción o el disparador que una migración omitió por un bloqueo, un
//    permiso o datos repetidos pasa inadvertido. Si hay acceso a la base
//    (RENDER_DATABASE_URL o DATABASE_URL, p. ej. en el shell de la API de
//    Render, o --db) se comprueba que:
//      - ningún índice esté inválido (pg_index.indisvalid);
//      - existan y sean válidos los índices que las migraciones crean sin
//        abortar (enlaces, K2 Variant_sku_ci_key y Variant_barcode_ci_key,
//        únicos de incentivos y de idempotencia);
//      - existan las 29 restricciones de 202610210002 y ninguna siga NOT VALID
//        (convalidated): una NOT VALID con filas viejas violadoras devuelve
//        409 al modificar esa fila;
//      - exista el disparador auth_attempt_touch (y la columna updatedAt);
//      - plan_cache_mode sea force_custom_plan (sólo aviso).
//    Los fallos terminan con código 1; los avisos se imprimen bien visibles
//    (y como anotación ::warning:: en GitHub Actions) sin fallar.
//
// Uso: node deploy/render/post-deploy-check.mjs <URL_WEB> [URL_API] [--db]
//      node deploy/render/post-deploy-check.mjs --db-only
//   o con NEXORA_WEB_URL / NEXORA_API_URL. La API es un servicio privado en
//   Render: sólo es alcanzable desde la red privada (p. ej. un shell del web).
//   Sin URL de base de datos en el entorno, la parte 2 se omite con un aviso
//   (--db la exige). No imprime cuerpos ni la URL de la base.
// Salida: 0 si todo está bien, 1 si algún destino o comprobación falla.

import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// Objetos que las migraciones crean sin abortar el despliegue (DO … EXCEPTION
// WHEN OTHERS + RAISE NOTICE). tests/cloud-deploy.test.ts comprueba que cada
// nombre exista en alguna migración y la prueba en PostgreSQL real, que una
// base recién migrada no produce ningún fallo.
export const EXPECTED_INDEXES = [
  // 202610170001_variant_code_unique (D-M9): se omiten con SKU o códigos de
  // barras repetidos sin distinguir mayúsculas ni espacios.
  "Variant_sku_ci_key",
  "Variant_barcode_ci_key",
  // 202610190001_incentives: únicos que sólo se crean si los datos lo permiten.
  "IncentiveRate_branchId_categoryId_key",
  "IncentiveEntry_saleItemId_kind_refId_key",
  "IncentivePeriodClose_branchId_period_key",
  "IncentiveSettlement_branchId_period_userId_key",
  // 202610200001_perf_indexes_links
  "Payment_saleId_idx",
  "Payment_cashSessionId_idx",
  "SaleItem_saleId_idx",
  "Sale_cashSessionId_idx",
  "SaleReturn_saleId_idx",
  "SaleReturn_cashSessionId_idx",
  "CashMovement_sessionId_idx",
  "Variant_productId_idx",
  // 202610210001_datos_indices
  "Sale_customerId_idx",
  "AuditLog_entityId_entity_idx",
  "PurchaseItem_orderId_idx",
  // 202610210004_dinero_idempotencia
  "CashMovement_operationId_key",
  "SupplierPayment_operationId_key",
  "Expense_operationId_key",
];
export const EXPECTED_CONSTRAINTS = [
  "CashMovement_sessionId_fkey",
  "CreditNote_customerId_fkey",
  "CreditNote_returnId_fkey",
  "GoodsReceipt_attachmentId_fkey",
  "KitComponent_componentVariantId_fkey",
  "KitComponent_kitVariantId_fkey",
  "Payment_cashSessionId_fkey",
  "Payment_creditNoteId_fkey",
  "PurchaseItem_variantId_fkey",
  "SaleReturn_cashSessionId_fkey",
  "Sale_cashSessionId_fkey",
  "Sale_customerId_fkey",
  "cash_movement_amount_nonnegative",
  "cash_movement_type_valid",
  "cash_session_closed_after_opened",
  "cash_session_opening_nonnegative",
  "credit_note_amount_nonnegative",
  "expense_amount_nonnegative",
  "incentive_entry_period_valid",
  "incentive_period_close_period_valid",
  "incentive_settlement_period_valid",
  "kit_component_qty_positive",
  "payment_amounts_nonnegative",
  "purchase_item_quantities_valid",
  "sale_amounts_nonnegative",
  "sale_return_amounts_nonnegative",
  "sale_return_refund_method_valid",
  "sale_status_valid",
  "supplier_payment_amount_nonnegative",
];
export const EXPECTED_TRIGGER = "auth_attempt_touch";
export const EXPECTED_PLAN_CACHE_MODE = "force_custom_plan";

const list = (names) => names.join(", ");

// Puro y sin red: decide qué falla y qué sólo avisa a partir de lo leído.
//   facts = { invalidIndexes: string[], indexes: {nombre: indisvalid},
//             constraints: {nombre: convalidated}, notValid: string[],
//             trigger: boolean, authAttemptUpdatedAt: boolean,
//             planCacheMode: string }
export function evaluateDatabaseFacts(facts) {
  const failures = [];
  const warnings = [];
  if (facts.invalidIndexes.length)
    failures.push(
      `índices inválidos (indisvalid = false; DROP INDEX y volver a crearlos): ${list(facts.invalidIndexes)}`,
    );
  const missingIndexes = EXPECTED_INDEXES.filter(
    (name) => !(name in facts.indexes),
  );
  if (missingIndexes.length)
    failures.push(
      `faltan índices que una migración omitió: ${list(missingIndexes)} (ver AuditLog k2_code_index_skipped y docs/MIGRACIONES_SEGURAS.md; los de código repetido exigen corregir los datos y volver a ejecutar la migración)`,
    );
  const missingConstraints = EXPECTED_CONSTRAINTS.filter(
    (name) => !(name in facts.constraints),
  );
  if (missingConstraints.length)
    failures.push(
      `faltan restricciones que una migración omitió: ${list(missingConstraints)}`,
    );
  if (facts.notValid.length)
    failures.push(
      `restricciones sin validar (convalidated = false; ver AuditLog constraint_not_validated; modificar filas antiguas que las violan devuelve 409): ${list(facts.notValid)}`,
    );
  if (!facts.trigger)
    failures.push(
      `falta el disparador ${EXPECTED_TRIGGER} en "AuthAttempt" (los contadores de intentos no se purgarían bien)`,
    );
  if (!facts.authAttemptUpdatedAt)
    failures.push('falta la columna "AuthAttempt"."updatedAt"');
  if (facts.planCacheMode !== EXPECTED_PLAN_CACHE_MODE)
    warnings.push(
      `plan_cache_mode = ${facts.planCacheMode}, se esperaba ${EXPECTED_PLAN_CACHE_MODE} (ALTER ROLE/DATABASE … SET plan_cache_mode; ver docs/DEPLOY-RENDER.md)`,
    );
  return { failures, warnings };
}

// Sólo SELECT: `query(sql)` devuelve las filas como objetos.
export async function readDatabaseFacts(query) {
  const schema = "current_schema()";
  const invalid = await query(
    `SELECT c.relname AS name FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT i.indisvalid AND n.nspname = ${schema} ORDER BY 1`,
  );
  const indexes = await query(
    `SELECT c.relname AS name, i.indisvalid AS valid FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = ${schema} AND c.relname = ANY($1::text[])`,
    [EXPECTED_INDEXES],
  );
  const constraints = await query(
    `SELECT conname AS name, convalidated AS valid FROM pg_constraint
      WHERE connamespace = ${schema}::regnamespace AND conname = ANY($1::text[])`,
    [EXPECTED_CONSTRAINTS],
  );
  const notValid = await query(
    `SELECT conname AS name FROM pg_constraint
      WHERE connamespace = ${schema}::regnamespace AND NOT convalidated ORDER BY 1`,
  );
  const trigger = await query(
    `SELECT 1 AS ok FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE t.tgname = $1 AND c.relname = 'AuthAttempt' AND n.nspname = ${schema}
        AND NOT t.tgisinternal AND t.tgenabled <> 'D'`,
    [EXPECTED_TRIGGER],
  );
  const column = await query(
    `SELECT 1 AS ok FROM information_schema.columns
      WHERE table_schema = ${schema} AND table_name = 'AuthAttempt'
        AND column_name = 'updatedAt'`,
  );
  const plan = await query(
    `SELECT current_setting('plan_cache_mode') AS value`,
  );
  return {
    invalidIndexes: invalid.map((r) => r.name),
    // Un índice inválido cuenta como presente pero ya figura en invalidIndexes.
    indexes: Object.fromEntries(indexes.map((r) => [r.name, r.valid])),
    constraints: Object.fromEntries(constraints.map((r) => [r.name, r.valid])),
    notValid: notValid.map((r) => r.name),
    trigger: trigger.length > 0,
    authAttemptUpdatedAt: column.length > 0,
    planCacheMode: String(plan[0]?.value ?? ""),
  };
}

// Abre la base con el mismo entorno que la API (RENDER_DATABASE_URL →
// DATABASE_URL con sslmode y UTC) usando el cliente de Prisma ya instalado.
async function openDatabase(source = process.env) {
  const { cloudEnvironment } = await import("./with-cloud-env.mjs");
  const env = cloudEnvironment(source);
  const { PrismaClient } = createRequire(
    new URL("../../apps/api/package.json", import.meta.url),
  )("@prisma/client");
  const db = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
  });
  return {
    query: (sql, params = []) => db.$queryRawUnsafe(sql, ...params),
    close: () => db.$disconnect(),
  };
}

export async function checkDatabase(source = process.env) {
  let connection;
  try {
    connection = await openDatabase(source);
    const facts = await readDatabaseFacts(connection.query);
    return evaluateDatabaseFacts(facts);
  } catch (error) {
    // Nunca la URL ni sus credenciales: sólo la clase del error.
    return {
      failures: [
        `no se pudo leer la base de datos (${error?.code ?? error?.name ?? "error"})`,
      ],
      warnings: [],
    };
  } finally {
    await connection?.close().catch(() => undefined);
  }
}

function isMain() {
  try {
    return (
      realpathSync(process.argv[1]) ===
      realpathSync(fileURLToPath(import.meta.url))
    );
  } catch {
    return import.meta.url === pathToFileURL(process.argv[1] ?? "").href;
  }
}

const timeoutMs = Number(process.env.NEXORA_CHECK_TIMEOUT_MS ?? 15000);
const attempts = Number(process.env.NEXORA_CHECK_ATTEMPTS ?? 6);
const delayMs = Number(process.env.NEXORA_CHECK_DELAY_MS ?? 10000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(name, base) {
  let url;
  try {
    url = new URL("/api/health", base);
  } catch {
    return `${name}: URL no válida`;
  }
  let reason = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.json().catch(() => null);
      if (
        response.ok &&
        (body?.database === "ok" ||
          (body?.status === "ok" && body?.database === undefined))
      )
        return null;
      reason = response.ok
        ? `status=${JSON.stringify(body?.status ?? null)}`
        : `HTTP ${response.status}`;
    } catch (error) {
      reason =
        error?.name === "TimeoutError" ? "tiempo agotado" : "sin respuesta";
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return `${name}: ${url.origin}/api/health falló (${reason})`;
}

const annotate = (level, text) => {
  // Anotación visible en el resumen de GitHub Actions, además del registro.
  if (process.env.GITHUB_ACTIONS)
    console.log(`::${level}::${text.replace(/\r?\n/g, " ")}`);
};

async function main() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((arg) => arg.startsWith("--")));
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const dbOnly = flags.has("--db-only");
  const targets = dbOnly
    ? []
    : [
        ["web", positional[0] ?? process.env.NEXORA_WEB_URL],
        ["api", positional[1] ?? process.env.NEXORA_API_URL],
      ].filter(([, url]) => url);
  const hasDatabase = Boolean(
    process.env.RENDER_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim(),
  );
  const wantsDatabase = dbOnly || flags.has("--db");

  if (!targets.length && !dbOnly) {
    console.error("Uso: post-deploy-check.mjs <URL_WEB> [URL_API] [--db]");
    console.error("     post-deploy-check.mjs --db-only");
    process.exit(2);
  }

  const failures = [];
  for (const [name, base] of targets) {
    const failure = await check(name, base);
    if (failure) failures.push(failure);
    else console.log(`${name}: ok (API y base de datos)`);
  }

  if (wantsDatabase || hasDatabase) {
    if (!hasDatabase)
      failures.push(
        "base de datos: falta RENDER_DATABASE_URL o DATABASE_URL para --db",
      );
    else {
      const { failures: dbFailures, warnings } = await checkDatabase();
      for (const warning of warnings) {
        console.warn(`AVISO base de datos: ${warning}`);
        annotate("warning", `post-deploy-check: ${warning}`);
      }
      for (const failure of dbFailures)
        failures.push(`base de datos: ${failure}`);
      if (!dbFailures.length)
        console.log(
          `base de datos: ok (${EXPECTED_INDEXES.length} índices, ${EXPECTED_CONSTRAINTS.length} restricciones validadas, disparador ${EXPECTED_TRIGGER}${warnings.length ? ", con avisos" : ""})`,
        );
    }
  } else {
    const note =
      "base de datos: comprobación de índices, restricciones y disparador OMITIDA (sin RENDER_DATABASE_URL/DATABASE_URL); ejecútala desde un shell del servicio API con --db-only";
    console.warn(`AVISO ${note}`);
    annotate("warning", `post-deploy-check: ${note}`);
  }

  if (failures.length) {
    for (const failure of failures) {
      console.error(failure);
      annotate("error", failure);
    }
    process.exit(1);
  }
}

if (isMain()) await main();
