/**
 * Revisión manual por la administración de Nexora, NO por una empresa cliente.
 * La URL de conexión usa un login operacional separado, miembro únicamente de
 * nexora_platform_billing; el rol RLS/GRANT restringe los cambios a facturación.
 * No ejecutar contra la tienda. Una interfaz de plataforma queda pendiente.
 */
import { PrismaClient } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { BILLING_PLANS } from "../src/billing-plans";
import { addMonths } from "../src/platform-billing";
import { tenantObjectStore } from "../src/tenant-object-store";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// PLA-04: la vigencia no se elige; sale del monto de la solicitud (mensualidades del plan).
type Review = { requestId: string; reviewer: string; decision: "approved" | "rejected"; reason: string; expectedProofSha256?: string };

export async function reviewProductBilling(db: PrismaClient, input: Review) {
  if (!uuid.test(input.requestId)) throw new Error("Identificador inválido.");
  if (!input.reviewer.trim() || input.reviewer.length > 100) throw new Error("Identifica al operador.");
  if (!input.reason.trim() || input.reason.length > 500) throw new Error("Escribe el motivo de la decisión.");
  return db.$transaction(async (tx) => {
    // El SET falla si el login no recibió pertenencia a este rol separado.
    await tx.$executeRawUnsafe("SET LOCAL ROLE nexora_platform_billing");
    const rows = await tx.$queryRaw<Array<{ id: string; tenantId: string; plan: string; provider: string; status: string; amount: string; proof: Uint8Array | null; proofObjectKey: string | null; reviewReason: string | null }>>`
      SELECT id, "tenantId", plan, provider, status, amount::text, proof, "proofObjectKey", "reviewReason"
      FROM "BillingRequest" WHERE id=${input.requestId}::uuid FOR UPDATE`;
    const row = rows[0];
    if (!row) throw new Error("Solicitud inexistente.");
    // Serializar la aprobación/downgrade con altas de usuarios y equipos.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`plan:${row.tenantId}`}))::text`;
    if (row.status === input.decision) {
      if (row.reviewReason === input.reason)
        return { id: row.id, status: row.status, alreadyReviewed: true };
      throw new Error("Esta solicitud ya fue revisada con otra decisión.");
    }
    if (row.status !== "pending_review") throw new Error("La solicitud no está pendiente de revisión.");
    if (row.provider === "bank_transfer" && !row.proof?.length && !row.proofObjectKey) throw new Error("Falta el comprobante.");
    const proofBytes = row.proofObjectKey ? await tenantObjectStore().get(row.tenantId, row.proofObjectKey) : row.proof;
    if (row.provider === "bank_transfer" && input.decision === "approved" &&
      createHash("sha256").update(proofBytes!).digest("hex") !== input.expectedProofSha256)
      throw new Error("La evidencia cambió o no fue revisada. Indica su SHA-256.");
    if (row.provider !== "bank_transfer" && row.provider !== "test") throw new Error("Proveedor desconocido.");
    let paidThroughAt: Date | null = null;
    if (input.decision === "approved") {
      const limits = BILLING_PLANS[row.plan as keyof typeof BILLING_PLANS];
      if (!limits) throw new Error("Plan desconocido.");
      const months = Number(row.amount) / limits.monthlyDop;
      if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error("El monto no corresponde a mensualidades del plan.");
      // Igual que el cobro manual: se extiende desde lo que quede pagado (o de prueba); si ya venció, desde hoy.
      const [tenant] = await tx.$queryRaw<Array<{ status: string; trialEndsAt: Date | null; paidThroughAt: Date | null }>>`
        SELECT status, "trialEndsAt", "paidThroughAt" FROM "Tenant" WHERE id=${row.tenantId}::uuid FOR UPDATE`;
      if (!tenant) throw new Error("Solicitud inexistente.");
      const from = Math.max(Date.now(), tenant.paidThroughAt?.getTime() ?? 0, tenant.status === "trial" ? tenant.trialEndsAt?.getTime() ?? 0 : 0);
      paidThroughAt = addMonths(new Date(from), months);
      const [usage] = await tx.$queryRaw<Array<{ users: bigint; terminals: bigint; openCashBoxes: bigint; branches: bigint }>>`
        SELECT
          (SELECT count(*) FROM "User" WHERE "tenantId"=${row.tenantId}::uuid AND active) AS users,
          (SELECT count(*) FROM "Terminal" WHERE "tenantId"=${row.tenantId}::uuid AND "approvedAt" IS NOT NULL AND "revokedAt" IS NULL) AS terminals,
          (SELECT count(*) FROM "CashSession" WHERE "tenantId"=${row.tenantId}::uuid AND "closedAt" IS NULL) AS "openCashBoxes",
          (SELECT count(DISTINCT branch) FROM (
            SELECT "branchId" AS branch FROM "User" WHERE "tenantId"=${row.tenantId}::uuid AND active
            UNION SELECT "branchId" AS branch FROM "Terminal" WHERE "tenantId"=${row.tenantId}::uuid AND "revokedAt" IS NULL
          ) occupied) AS branches`;
      if (Number(usage.users) > limits.users || Number(usage.terminals) > limits.boxes ||
        Number(usage.openCashBoxes) > limits.boxes || Number(usage.branches) > limits.branches)
        throw new Error("El plan solicitado es menor que los usuarios, equipos aprobados, cajas abiertas o sucursales activas. Libera cupos antes de aprobar.");
      // La activación y la decisión se confirman juntas, limpiando el ciclo anterior.
      await tx.$executeRaw`UPDATE "Tenant" SET status='active', plan=${row.plan}, "paidThroughAt"=${paidThroughAt},
        "pastDueAt"=NULL, "suspendedAt"=NULL, "updatedAt"=CURRENT_TIMESTAMP WHERE id=${row.tenantId}::uuid`;
    }
    await tx.$executeRaw`
      UPDATE "BillingRequest" SET status=${input.decision}, "reviewedAt"=CURRENT_TIMESTAMP,
        reviewer=${input.reviewer}, "reviewReason"=${input.reason}, "paidThroughAt"=${paidThroughAt},
        "updatedAt"=CURRENT_TIMESTAMP WHERE id=${row.id}::uuid`;
    await tx.$executeRaw`
      INSERT INTO "BillingDecision" (id, "requestId", "tenantId", decision, reviewer, reason)
      VALUES (${randomUUID()}::uuid, ${row.id}::uuid, ${row.tenantId}::uuid, ${input.decision}, ${input.reviewer}, ${input.reason})`;
    return { id: row.id, status: input.decision, alreadyReviewed: false, paidThroughAt };
  // La lectura de cupos debe ver lo confirmado después de esperar el candado.
  }, { isolationLevel: "ReadCommitted" });
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("review-product-billing.ts")) {
  // El tercer argumento (antes la fecha) se ignora: la vigencia la calcula el sistema.
  const [requestId, decision, , reason, expectedProofSha256] = process.argv.slice(2);
  const reviewer = process.env.NEXORA_BILLING_OPERATOR_ID?.trim();
  const url = process.env.PLATFORM_BILLING_DATABASE_URL;
  if (process.env.PRODUCT_TENANCY !== "required" || !url || !reviewer || !requestId || !["approved", "rejected"].includes(decision) || !reason)
    throw new Error("Faltan contexto de producto, URL operacional, operador o argumentos.");
  const db = new PrismaClient({ datasources: { db: { url } } });
  reviewProductBilling(db, { requestId, reviewer, decision: decision as Review["decision"], reason, expectedProofSha256 })
    .then((result) => { process.stdout.write(`${result.id}: ${result.status}${result.alreadyReviewed ? " (ya revisada)" : ""}${"paidThroughAt" in result && result.paidThroughAt ? ` hasta ${result.paidThroughAt.toISOString()}` : ""}\n`); })
    .finally(() => db.$disconnect());
}
