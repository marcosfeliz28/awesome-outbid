import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { z } from "@fitstore/shared";
import { BILLING_PLANS, billingPlan } from "./billing-plans";
import { Public, parse, type Actor } from "./common";
import { authorizePlatform } from "./platform";
import { notifyOperator } from "./platform-notify";
import { RequestRateLimitService } from "./rate-limit";
import { RegistrationService } from "./registration";
import { currentTenantId } from "./tenant-context";

// PC-24: precios fijados por la dueña (pago manual, como la mensualidad).
export const AI_PACKS = { 100: 399, 300: 999 } as const;
export const AI_LIMIT_MESSAGE =
  "Llegaste a tu límite de este mes. Si necesitas más, pide un paquete extra: " +
  "100 preguntas por RD$399 o 300 por RD$999. El resto del sistema sigue funcionando igual.";

type RawDb = {
  $queryRaw: (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<unknown>;
};

/**
 * Uso del mes en la zona horaria de la empresa. Los paquetes solo cuentan en
 * el mes en que se acreditaron: el mes siguiente vuelve a la cuota del plan.
 * Las preguntas son las filas `assistant.ask` de la bitácora (N-02).
 */
export async function aiUsage(db: RawDb, tenantId: string, now = new Date()) {
  const rows = (await db.$queryRaw`
    WITH t AS (
      SELECT id, plan, "timeZone" AS tz,
        to_char(${now.toISOString()}::timestamptz AT TIME ZONE "timeZone", 'YYYY-MM') AS month,
        date_trunc('month', ${now.toISOString()}::timestamptz AT TIME ZONE "timeZone") AS local_start
      FROM "Tenant" WHERE id = ${tenantId}::uuid
    )
    SELECT t.plan, t.month,
      (SELECT coalesce(sum(p.questions), 0)::int FROM "AiPackCredit" p
        WHERE p."tenantId" = t.id AND p.month = t.month) AS packs,
      (SELECT count(*)::int FROM "AuditLog" a
        WHERE a."tenantId" = t.id AND a.action = 'assistant.ask'
          AND a."createdAt" >= (t.local_start AT TIME ZONE t.tz AT TIME ZONE 'UTC')
          AND a."createdAt" < ((t.local_start + interval '1 month') AT TIME ZONE t.tz AT TIME ZONE 'UTC')) AS used
    FROM t`) as { plan: string; month: string; packs: number; used: number }[];
  if (rows.length !== 1) throw new HttpException("Empresa no disponible.", 403);
  const { plan, month, packs, used } = rows[0];
  const planQuota = BILLING_PLANS[billingPlan(plan)].aiQueries;
  const limit = planQuota + packs;
  return {
    month,
    used,
    planQuota,
    packs,
    limit,
    remaining: Math.max(0, limit - used),
  };
}

/**
 * Reserva una pregunta antes de llamar al modelo. `db` es la base con RLS de
 * la empresa actual: solo ve sus propios paquetes. El candado por empresa
 * serializa preguntas simultáneas, así nunca pasan del límite.
 */
export async function reserveAiQuestion(
  db: any,
  actor: Actor,
  now = new Date(),
) {
  const tenantId = currentTenantId();
  const reserved = await db.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`assistant:${tenantId}`}))::text`;
    const usage = await aiUsage(tx, tenantId, now);
    if (usage.used >= usage.limit) return { limitedMonth: usage.month };
    const row = await tx.auditLog.create({
      data: {
        userId: actor.id,
        terminalId: actor.terminalId,
        ip: actor.ip,
        branchId: actor.branchId,
        action: "assistant.ask",
        entity: "assistant",
        entityId: randomUUID(),
        createdAt: now,
        after: { estado: "iniciada" },
      },
    });
    return {
      auditId: row.id as string,
      ...usage,
      used: usage.used + 1,
      remaining: usage.remaining - 1,
    };
  });
  if ("limitedMonth" in reserved) {
    // Fuera de la transacción y con la base RLS: solo la empresa actual, una vez al mes.
    await notifyOperator(db, {
      tenantId, event: "op_ai_limit", key: new Date(`${reserved.limitedMonth}-01T00:00:00Z`),
      detail: `Mes: ${reserved.limitedMonth}`,
    });
    throw new HttpException(AI_LIMIT_MESSAGE, 429);
  }
  return reserved;
}

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/);
const packInput = z
  .object({
    size: z.union([z.literal(100), z.literal(300)]),
    reference: z.string().trim().min(1).max(120),
  })
  .strict();

@Controller("platform")
export class PlatformAiPacksController {
  constructor(
    @Inject(RegistrationService)
    private readonly registration: RegistrationService,
    @Inject(RequestRateLimitService)
    private readonly limits: RequestRateLimitService,
  ) {}

  private async tenantId(value: string) {
    const rows = (await this.registration.db
      .$queryRaw`SELECT id FROM "Tenant" WHERE slug = ${parse(slug, value)}`) as {
      id: string;
    }[];
    if (rows.length !== 1)
      throw new HttpException("Empresa no encontrada.", 404);
    return rows[0].id;
  }

  @Public()
  @Post("tenants/:slug/ai-packs")
  async credit(
    @Param("slug") tenantSlug: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    authorizePlatform(req, this.limits);
    const input = parse(packInput, body);
    const tenantId = await this.tenantId(tenantSlug);
    try {
      // El mes lo fija la base con la zona de la empresa, no el reloj del operador.
      const [pack] = (await this.registration.db.$queryRaw`
        INSERT INTO "AiPackCredit" (id, "tenantId", month, questions, "priceDop", reference)
        SELECT ${randomUUID()}::uuid, id, to_char(now() AT TIME ZONE "timeZone", 'YYYY-MM'),
          ${input.size}, ${AI_PACKS[input.size]}, ${input.reference}
        FROM "Tenant" WHERE id = ${tenantId}::uuid
        RETURNING id, month, questions, "priceDop"::float AS "priceDop", reference, "createdAt"`) as any[];
      console.log(
        `[plataforma] paquete de IA de ${input.size} acreditado: ${tenantSlug} (${pack.month})`,
      );
      return { ...pack, usage: await aiUsage(this.registration.db, tenantId) };
    } catch (error: any) {
      if (error?.meta?.code === "23505")
        throw new HttpException(
          "Esa referencia de pago ya se acreditó.",
          409,
        );
      throw error;
    }
  }

  @Public()
  @Get("tenants/:slug/ai-usage")
  async usage(@Param("slug") tenantSlug: string, @Req() req: Request) {
    authorizePlatform(req, this.limits);
    return aiUsage(this.registration.db, await this.tenantId(tenantSlug));
  }
}
