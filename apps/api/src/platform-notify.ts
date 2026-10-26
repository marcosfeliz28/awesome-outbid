import { randomUUID } from "node:crypto";
import { formatMoney } from "@fitstore/shared";

// Avisos al operador de la plataforma (no a las empresas): correo a
// PLATFORM_OWNER_EMAIL y Telegram a PLATFORM_TELEGRAM_CHAT_ID (con
// TELEGRAM_BOT_TOKEN). Solo nombre, código, plan, estado y, en un pago, su
// monto: ningún dato del negocio de la empresa. Una vez por evento: la fila de
// TenantLifecycleNotice (único por empresa, tipo y fecha clave) hace de candado.
// Nunca lanza: la acción principal sigue aunque falte o falle el canal.
export type OperatorEvent =
  | "op_activated"
  | "op_due_7"
  | "op_past_due"
  | "op_suspended"
  | "op_ai_limit"
  | "op_payment";

const TITLE: Record<OperatorEvent, string> = {
  op_activated: "Nueva empresa activa",
  op_due_7: "Empresa por vencer (7 días o menos)",
  op_past_due: "Empresa vencida (en gracia)",
  op_suspended: "Empresa suspendida",
  op_ai_limit: "Empresa llegó a su límite de IA del mes",
  op_payment: "Pago de plataforma registrado",
};

type RawDb = {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

/**
 * `db` puede ser la base raíz o la de la empresa (RLS): con RLS, una empresa
 * no ve ni inserta avisos de otra, así que no puede dispararlos por ella.
 */
export async function notifyOperator(
  db: RawDb,
  input: {
    tenantId: string;
    event: OperatorEvent;
    key: Date;
    detail?: string;
    amount?: number;
  },
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  try {
    const [tenant] = (await db.$queryRaw`
      SELECT name, slug, plan, status FROM "Tenant" WHERE id = ${input.tenantId}::uuid`) as {
      name: string;
      slug: string;
      plan: string;
      status: string;
    }[];
    if (!tenant) return false;
    // status 'operator': sendPendingNotices (avisos a la empresa) nunca la toma.
    // PLA-06: sentAt solo se llena tras una entrega. Si no salió, el mismo
    // evento puede reclamarse de nuevo pasados 10 minutos (sin duplicar a la vez).
    // shortcut: reintenta solo cuando el evento se vuelve a disparar; un trabajador de reintentos si hiciera falta.
    const claimed = (await db.$queryRaw`
      INSERT INTO "TenantLifecycleNotice" AS n (id, "tenantId", kind, "dueAt", status, attempts, "nextAttemptAt", "sentAt")
      VALUES (${randomUUID()}::uuid, ${input.tenantId}::uuid, ${input.event}, ${input.key}, 'operator', 1, now() + interval '10 minutes', NULL)
      ON CONFLICT ("tenantId", kind, "dueAt") DO UPDATE SET attempts = n.attempts + 1, "nextAttemptAt" = now() + interval '10 minutes'
        WHERE n.status = 'operator' AND n."sentAt" IS NULL AND n."nextAttemptAt" <= now()
      RETURNING id`) as { id: string }[];
    if (claimed.length !== 1) return false;
    // Import diferido: common → tenant-lifecycle → aquí → notifications → common sería un ciclo.
    const {
      emailSettings,
      escapeHtml,
      sendEmail,
      sendTelegram,
      telegramSettings,
    } = await import("./notifications");
    const lines = [
      TITLE[input.event],
      `Empresa: ${tenant.name} (${tenant.slug})`,
      `Plan: ${tenant.plan} · Estado: ${tenant.status}`,
      ...(input.amount !== undefined
        ? [`Monto: ${formatMoney(input.amount)}`]
        : []),
      ...(input.detail ? [input.detail] : []),
    ];
    const idempotencyKey = `nexora/operator/${input.tenantId}/${input.event}/${input.key.toISOString()}`;
    const mail = emailSettings({
      ...env,
      NOTIFY_EMAIL_TO: env.PLATFORM_OWNER_EMAIL ?? "",
    });
    const telegram = telegramSettings({
      ...env,
      TELEGRAM_CHAT_ID: env.PLATFORM_TELEGRAM_CHAT_ID ?? "",
    });
    const results = await Promise.all([
      mail.enabled
        ? sendEmail(
            mail,
            `Nexora · ${TITLE[input.event]}`,
            lines.map(escapeHtml).join("\n"),
            idempotencyKey,
          )
        : null,
      telegram.enabled
        ? sendTelegram(telegram, lines.map(escapeHtml).join("\n"))
        : null,
    ]);
    for (const result of results)
      if (result && !result.ok)
        console.warn(
          `[plataforma] aviso al operador no salió: ${result.error}`,
        );
    if (!results.some((result) => result?.ok)) return false;
    await db.$queryRaw`UPDATE "TenantLifecycleNotice" SET "sentAt" = now() WHERE id = ${claimed[0].id}::uuid RETURNING id`;
    return true;
  } catch (error: any) {
    console.warn(
      "[plataforma] aviso al operador: " +
        String(error?.message ?? error).slice(0, 200),
    );
    return false;
  }
}
