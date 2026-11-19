// Baja definitiva de una empresa (A1 de operación): herramienta de operador,
// sin ruta HTTP (apps/api/scripts/tenant-purge.ts). Por defecto sólo cuenta.
// Exige empresa suspendida hace 30 días o más y una exportación JSON previa
// que coincida fila por fila con lo que se va a borrar. Borra en una sola
// transacción, hijos antes que padres, y después los archivos del bucket.
// Conserva lo fiscal e inmutable: PlatformPayment y AiPackCredit (y la fila
// Tenant, a la que apuntan).
import { readFile } from "node:fs/promises";
import { Prisma, type PrismaClient } from "@prisma/client";
import { DEMO_TENANT_ID } from "./tenant-context";
import {
  parsePaymentObjectReference,
  type TenantObjectStore,
} from "./tenant-object-store";

export const PURGE_MIN_SUSPENDED_DAYS = 30;
export const PURGE_KEEP = [
  "Tenant",
  "PlatformPayment",
  "AiPackCredit",
] as const;
const LEDGER = "TenantObjectDeletion";

export type PurgePlan = {
  tenantId: string;
  slug: string;
  suspendedAt: Date;
  /** Filas por tabla que se borran, en el orden de borrado. */
  counts: Record<string, number>;
  kept: Record<string, number>;
  objects: string[];
  /** Archivos referenciados por filas vivas: deben venir en la exportación. */
  liveObjects: string[];
};
export type PurgeResult = PurgePlan & {
  executed: boolean;
  objectsFailed: string[];
};

const q = (name: string) => `"${name.replaceAll('"', '""')}"`;

async function tenantTables(db: PrismaClient) {
  const models = Prisma.dmmf.datamodel.models
    .filter(
      (m) => m.name !== "Tenant" && m.fields.some((f) => f.name === "tenantId"),
    )
    .map((m) => m.dbName ?? m.name);
  const keep = new Set<string>(PURGE_KEEP);
  const remove = models.filter((t) => !keep.has(t));
  const fks = await db.$queryRawUnsafe<{ child: string; parent: string }[]>(
    `SELECT c.relname AS child, p.relname AS parent FROM pg_constraint k
       JOIN pg_class c ON c.oid = k.conrelid JOIN pg_class p ON p.oid = k.confrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE k.contype = 'f' AND n.nspname = current_schema()`,
  );
  const removeSet = new Set(remove);
  for (const fk of fks)
    if (
      keep.has(fk.child) &&
      fk.child !== fk.parent &&
      removeSet.has(fk.parent)
    )
      throw new Error(
        `${fk.child} (se conserva) apunta a ${fk.parent} (se borra).`,
      );
  // Orden: una tabla se borra cuando ya no queda ninguna hija suya por borrar.
  const order: string[] = [];
  const pending = new Set(remove.filter((t) => t !== LEDGER));
  while (pending.size) {
    const ready = [...pending].filter(
      (t) =>
        !fks.some(
          (fk) => fk.parent === t && fk.child !== t && pending.has(fk.child),
        ),
    );
    if (!ready.length)
      throw new Error(
        `Ciclo de claves foráneas entre ${[...pending].join(", ")}.`,
      );
    for (const t of ready.sort()) {
      order.push(t);
      pending.delete(t);
    }
  }
  return { order, kept: models.filter((t) => keep.has(t)) };
}

async function count(
  db: Pick<PrismaClient, "$queryRawUnsafe">,
  table: string,
  tenantId: string,
) {
  const rows = await db.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM ${q(table)} WHERE "tenantId" = $1::uuid`,
    tenantId,
  );
  return rows[0]?.n ?? 0;
}

/** Archivos del bucket de la empresa: los de filas vivas y, si se pide, los que
 * ya esperan borrado en TenantObjectDeletion. */
async function objectKeys(db: PrismaClient, tenantId: string, withLedger = true) {
  const keys = new Set<string>();
  const payments = await db.$queryRawUnsafe<{ v: string }[]>(
    `SELECT "proofUrl" AS v FROM "Payment" WHERE "tenantId"=$1::uuid AND "proofUrl" LIKE 'object:%'`,
    tenantId,
  );
  for (const row of payments) {
    const ref = parsePaymentObjectReference(row.v);
    if (ref) keys.add(ref.key);
  }
  for (const [table, column] of [
    ["InvoiceAttachment", "objectKey"],
    ["BillingRequest", "proofObjectKey"],
    ...(withLedger ? [[LEDGER, "objectKey"]] : []),
  ]) {
    const rows = await db.$queryRawUnsafe<{ v: string }[]>(
      `SELECT ${q(column)} AS v FROM ${q(table)} WHERE "tenantId"=$1::uuid AND ${q(column)} IS NOT NULL`,
      tenantId,
    );
    for (const row of rows) keys.add(row.v);
  }
  return [...keys].sort();
}

export async function planTenantPurge(
  db: PrismaClient,
  slug: string,
  now = new Date(),
): Promise<PurgePlan> {
  const tenant = (
    await db.$queryRawUnsafe<
      { id: string; status: string; suspendedAt: Date | null }[]
    >(
      `SELECT id::text AS id, status, "suspendedAt" FROM "Tenant" WHERE slug = $1`,
      slug,
    )
  )[0];
  if (!tenant) throw new Error(`No existe la empresa ${slug}.`);
  if (tenant.id === DEMO_TENANT_ID)
    throw new Error("La empresa Demo no se purga con esta herramienta.");
  if (tenant.status !== "suspended" || !tenant.suspendedAt)
    throw new Error(
      `La empresa ${slug} no está suspendida (estado ${tenant.status}).`,
    );
  const days = (now.getTime() - tenant.suspendedAt.getTime()) / 86_400_000;
  if (days < PURGE_MIN_SUSPENDED_DAYS)
    throw new Error(
      `La empresa ${slug} lleva ${Math.floor(days)} días suspendida; se exigen ${PURGE_MIN_SUSPENDED_DAYS}.`,
    );
  const { order, kept } = await tenantTables(db);
  const counts: Record<string, number> = {};
  for (const table of [...order, LEDGER])
    counts[table] = await count(db, table, tenant.id);
  const keptCounts: Record<string, number> = { Tenant: 1 };
  for (const table of kept)
    keptCounts[table] = await count(db, table, tenant.id);
  return {
    tenantId: tenant.id,
    slug,
    suspendedAt: tenant.suspendedAt,
    counts,
    kept: keptCounts,
    objects: await objectKeys(db, tenant.id),
    liveObjects: await objectKeys(db, tenant.id, false),
  };
}

/** La exportación (GET /api/tenant/export?format=json) debe ser de esta empresa,
 * tomada ya suspendida y con las mismas filas que hoy hay en cada tabla. */
export async function verifyPurgeExport(plan: PurgePlan, exportPath: string) {
  const data = JSON.parse(await readFile(exportPath, "utf8")) as {
    formatVersion?: number;
    generatedAt?: string;
    tenantId?: string;
    tables?: Record<string, unknown[]>;
    objects?: Record<string, unknown>;
    faltantes?: { key: string }[];
  };
  const problems: string[] = [];
  if (data.formatVersion !== 1 || data.tenantId !== plan.tenantId)
    problems.push("la exportación es de otra empresa o de otro formato");
  if (!data.generatedAt || new Date(data.generatedAt) < plan.suspendedAt)
    problems.push("la exportación es anterior a la suspensión");
  for (const [table, n] of Object.entries({ ...plan.counts, ...plan.kept })) {
    if (table === LEDGER) continue;
    const exported = data.tables?.[table]?.length;
    if (exported !== n)
      problems.push(
        `${table}: ${exported ?? "sin tabla"} en la exportación, ${n} en la base`,
      );
  }
  const listed = new Set([
    ...Object.keys(data.objects ?? {}),
    ...(data.faltantes ?? []).map((f) => f.key),
  ]);
  const live = plan.liveObjects.filter((key) => !listed.has(key));
  if (live.length)
    problems.push(`archivos sin exportar: ${live.length}`);
  if (problems.length)
    throw new Error(`Exportación no verificada: ${problems.join("; ")}.`);
}

export async function purgeTenant(input: {
  db: PrismaClient;
  slug: string;
  execute?: boolean;
  confirm?: string;
  exportPath?: string;
  store?: () => TenantObjectStore;
  now?: Date;
}): Promise<PurgeResult> {
  const now = input.now ?? new Date();
  const plan = await planTenantPurge(input.db, input.slug, now);
  if (!input.execute) return { ...plan, executed: false, objectsFailed: [] };
  if (input.confirm !== input.slug)
    throw new Error(
      "Falta --confirmar <slug> con el código exacto de la empresa.",
    );
  if (!input.exportPath)
    throw new Error("Falta --exportacion <archivo.json> de la empresa.");
  await verifyPurgeExport(plan, input.exportPath);
  const tables = Object.keys(plan.counts).filter((t) => t !== LEDGER);
  await input.db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '10s'");
      // Nada cambió entre el plan y el borrado: misma empresa, suspendida, mismas filas.
      const locked = await tx.$queryRawUnsafe<{ status: string }[]>(
        `SELECT status FROM "Tenant" WHERE id = $1::uuid FOR UPDATE`,
        plan.tenantId,
      );
      if (locked[0]?.status !== "suspended")
        throw new Error("La empresa cambió de estado; se cancela.");
      for (const table of tables) {
        const deleted = await tx.$executeRawUnsafe(
          `DELETE FROM ${q(table)} WHERE "tenantId" = $1::uuid`,
          plan.tenantId,
        );
        if (deleted !== plan.counts[table])
          throw new Error(
            `${table}: se iban a borrar ${plan.counts[table]} filas y se borraron ${deleted}; se revierte todo.`,
          );
      }
    },
    { timeout: 10 * 60_000, maxWait: 10_000 },
  );
  // Después del commit: si un archivo falla queda en TenantObjectDeletion para reintentar.
  const objectsFailed: string[] = [];
  const objects = await objectKeys(input.db, plan.tenantId);
  if (objects.length) {
    const store = (
      input.store ?? (await import("./tenant-object-store")).tenantObjectStore
    )();
    for (const key of objects) {
      try {
        await store.delete(plan.tenantId, key);
        await input.db.$executeRawUnsafe(
          `DELETE FROM ${q(LEDGER)} WHERE "tenantId" = $1::uuid AND "objectKey" = $2`,
          plan.tenantId,
          key,
        );
      } catch {
        objectsFailed.push(key);
      }
    }
  }
  return { ...plan, objects, executed: true, objectsFailed };
}
