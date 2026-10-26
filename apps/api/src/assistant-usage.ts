import type { Actor } from "./common";
import { aiUsage, reserveAiQuestion } from "./platform-ai-packs";
import { currentTenantId } from "./tenant-context";

// La cuota del asistente es la de PC-24: plan + paquetes del mes, en la zona
// de la empresa, con el aviso «Llegaste a tu límite de este mes…» (429).
export async function usageForTenant(db: any, now = new Date()) {
  const usage = await aiUsage(db, currentTenantId(), now);
  return {
    ...usage,
    usadas: usage.used,
    limite: usage.limit,
    mes: usage.month,
  };
}

/** Reserva antes de pedir al modelo: dos consultas simultáneas no pasan la cuota. */
export const reserveAssistantQuery = (
  db: any,
  actor: Actor,
  now = new Date(),
) => reserveAiQuestion(db, actor, now);

export async function finishAssistantQuery(
  db: any,
  auditId: string,
  usage: { input: number; output: number },
  herramientas: string[],
  estado: "completa" | "fallida",
) {
  // Una respuesta fallida o incompleta no se cobra: la cuota solo cuenta
  // `assistant.ask`, así que la fila queda en la bitácora con otra acción.
  await db.auditLog.update({
    where: { id: auditId },
    data: {
      ...(estado === "fallida" ? { action: "assistant.ask.fallida" } : {}),
      after: {
        tokensIn: usage.input,
        tokensOut: usage.output,
        herramientas: [...new Set(herramientas)].slice(0, 10),
        estado,
      },
    },
  });
}
