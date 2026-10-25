import { randomUUID } from "node:crypto";
import { HttpException } from "@nestjs/common";
import { audit, type Actor } from "./common";
import { BILLING_PLANS, billingPlan } from "./billing-plans";

// Los períodos comerciales del asistente se cierran en Santo Domingo (UTC-4).
export function assistantMonth(now: Date) {
  const month = new Date(now.getTime() - 4 * 3600_000).toISOString().slice(0, 7);
  const [year, index] = month.split("-").map(Number);
  return {
    month,
    start: new Date(Date.UTC(year, index - 1, 1, 4)),
    end: new Date(Date.UTC(year, index, 1, 4)),
  };
}

export function assistantPlanLimit(plan: string | null | undefined) {
  if (plan) return BILLING_PLANS[billingPlan(plan)].aiQueries;
  const fallback = Number(process.env.NEXORA_IA_CUOTA_MENSUAL);
  return Number.isSafeInteger(fallback) && fallback > 0 ? fallback : 30;
}

async function tenantLimit(db: any, actor: Actor) {
  // Tenant es una tabla de plataforma; RLS y el token fijan actor.tenantId.
  const rows = await db.$queryRaw`SELECT plan FROM "Tenant" WHERE id = ${actor.tenantId}::uuid` as { plan: string }[];
  if (rows.length !== 1) throw new HttpException("Empresa no disponible.", 403);
  return assistantPlanLimit(rows[0].plan);
}

const quotaWhere = (period: ReturnType<typeof assistantMonth>) => ({
  action: "assistant.ask",
  entity: "assistant",
  createdAt: { gte: period.start, lt: period.end },
});

export async function usageForTenant(db: any, actor: Actor, now = new Date()) {
  const period = assistantMonth(now);
  const [limite, usadas] = await Promise.all([
    tenantLimit(db, actor),
    db.auditLog.count({ where: quotaWhere(period) }),
  ]);
  return { usadas, limite, mes: period.month };
}

/** Reserva antes de pedir al modelo: dos consultas simultáneas no pasan la cuota. */
export async function reserveAssistantQuery(db: any, actor: Actor, now = new Date()) {
  const period = assistantMonth(now);
  return db.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`assistant:${actor.tenantId}`}))::text`;
    const limite = await tenantLimit(tx, actor);
    const usadas = await tx.auditLog.count({ where: quotaWhere(period) });
    if (usadas >= limite)
      throw new HttpException("Llegaste al límite de consultas de este mes.", 429);
    // Se cuenta incluso si el proveedor de IA falla: reserva duradera y
    // bitácora completa. Se documenta al cliente; los errores no reintentan
    // automáticamente una pregunta que podría haber consumido tokens.
    const row = await audit(tx, actor, "assistant.ask", "assistant", randomUUID(), undefined, {
      tokensIn: 0, tokensOut: 0, herramientas: [], estado: "iniciada",
    });
    return { auditId: row.id as string, remaining: limite - usadas - 1, limite, mes: period.month };
  });
}

export async function finishAssistantQuery(
  db: any,
  auditId: string,
  usage: { input: number; output: number },
  herramientas: string[],
  estado: "completa" | "fallida",
) {
  await db.auditLog.update({
    where: { id: auditId },
    data: { after: { tokensIn: usage.input, tokensOut: usage.output, herramientas: [...new Set(herramientas)].slice(0, 10), estado } },
  });
}
