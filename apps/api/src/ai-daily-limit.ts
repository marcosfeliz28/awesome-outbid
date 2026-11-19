import { businessDate } from "@fitstore/shared";
import { audit, bad, type Actor } from "./common";

// Lecturas de facturas con IA por usuario y día (criterio de seguridad 8, 30-oct-2026).
export const AI_INVOICE_DAILY_LIMIT = 30;
export const AI_INVOICE_ACTION = "ai_invoice_read";

// Cuenta y registra la lectura ANTES de llamar al modelo, en una sola transacción
// con un bloqueo por usuario: dos peticiones a la vez no pasan del tope.
// El conteo usa el día de Santo Domingo (UTC-4, sin horario de verano).
export async function reserveAiInvoiceRead(
  db: any,
  actor: Actor,
  now: Date = new Date(),
): Promise<number> {
  const dayStart = new Date(businessDate(now) + "T00:00:00-04:00");
  return db.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"ai-invoice:" + actor.id}))::text AS locked`;
    const used = await tx.auditLog.count({
      where: {
        userId: actor.id,
        action: AI_INVOICE_ACTION,
        createdAt: { gte: dayStart },
      },
    });
    if (used >= AI_INVOICE_DAILY_LIMIT)
      bad(
        `Ya usaste las ${AI_INVOICE_DAILY_LIMIT} lecturas con IA de hoy. Usa Excel o CSV, o intenta mañana.`,
      );
    await audit(tx, actor, AI_INVOICE_ACTION, "invoice_extraction", actor.id);
    return used + 1;
  });
}
