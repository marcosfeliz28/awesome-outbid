import { randomUUID } from "node:crypto";
import { AI_PRICES_USD_PER_MTOK } from "./ai-prices";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { businessDate } from "@fitstore/shared";
import { bad, type Actor, CurrentUser, Database, Permit } from "./common";

export type AiUsageInput = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number | null;
    ephemeral_1h_input_tokens?: number | null;
  } | null;
};

// Costo en US$ o null si falta el modelo o el desglose de una escritura de caché.
// Anthropic cobra distinto por lectura, escritura de 5 min y escritura de 1 h;
// sumar las tres categorías con una sola tarifa subestimaría o inflaría el costo.
export function costUsd(model: string, u: AiUsageInput): number | null {
  const p = AI_PRICES_USD_PER_MTOK[model];
  if (!p) return null;

  const input = u.input_tokens ?? 0;
  const output = u.output_tokens ?? 0;
  const cacheRead = u.cache_read_input_tokens ?? 0;
  const cacheCreation = u.cache_creation_input_tokens ?? 0;
  const cacheWrite5m = u.cache_creation?.ephemeral_5m_input_tokens ?? 0;
  const cacheWrite1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;

  // Las respuestas antiguas pueden traer solo el total de escritura. Sin saber
  // la duración no hay una tarifa correcta, así que conservamos costo null.
  if (cacheWrite5m + cacheWrite1h !== cacheCreation)
    return null;

  const promptTokens = input + cacheRead + cacheCreation;
  const price =
    p.longContext && promptTokens > p.longContext.aboveInputTokens
      ? p.longContext
      : p;
  const total =
    (input * price.input +
      output * price.output +
      cacheRead * price.cacheRead +
      cacheWrite5m * price.cacheWrite5m +
      cacheWrite1h * price.cacheWrite1h) /
    1e6;
  return Math.round(total * 1e6) / 1e6;
}

// Guarda una fila de uso. NUNCA lanza: un fallo aquí no puede romper la función de IA.
export async function recordAiUsage(
  db: any,
  actor: Pick<Actor, "id" | "branchId">,
  feature: string,
  model: string,
  usage: AiUsageInput | null | undefined,
  ok: boolean,
): Promise<void> {
  try {
    const u = usage ?? {};
    const cache =
      (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
    await db.aiUsage.create({
      data: {
        id: randomUUID(),
        userId: actor.id,
        branchId: actor.branchId,
        feature,
        model,
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheTokens: cache || null,
        costUsd: usage ? costUsd(model, u) : null,
        ok,
      },
    });
  } catch (error) {
    console.error("[ai-usage] no se pudo guardar el uso de IA", error);
  }
}

type Row = {
  createdAt: Date;
  userId: string | null;
  feature: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: any;
};
// Suma por clave. costUsd null si ninguna fila trae costo (precios sin cargar).
export function summarize(rows: Row[], key: (r: Row) => string) {
  const out = new Map<
    string,
    {
      key: string;
      calls: number;
      inputTokens: number;
      outputTokens: number;
      costUsd: number | null;
    }
  >();
  for (const r of rows) {
    const k = key(r);
    const t = out.get(k) ?? {
      key: k,
      calls: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
    };
    t.calls++;
    t.inputTokens += r.inputTokens;
    t.outputTokens += r.outputTokens;
    if (r.costUsd != null) t.costUsd = (t.costUsd ?? 0) + Number(r.costUsd);
    out.set(k, t);
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
// Solo lectura, solo administración. Fechas AAAA-MM-DD (día de Santo Domingo, UTC-4).
@Controller("ai")
export class AiUsageController {
  constructor(@Inject(Database) private readonly db: Database) {}

  @Get("usage")
  @Permit("*")
  async usage(
    @CurrentUser() actor: Actor,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const today = businessDate(new Date());
    const f = from || today.slice(0, 8) + "01";
    const t = to || today;
    if (!DAY.test(f) || !DAY.test(t) || f > t)
      bad("Fechas no válidas (AAAA-MM-DD).");
    const rows = await this.db.aiUsage.findMany({
      where: {
        branchId: actor.branchId,
        createdAt: {
          gte: new Date(f + "T00:00:00-04:00"),
          lt: new Date(new Date(t + "T00:00:00-04:00").getTime() + 864e5),
        },
      },
      take: 20000,
    });
    const users = new Map(
      (
        await this.db.user.findMany({
          where: {
            id: {
              in: [
                ...new Set(
                  rows.map((r) => r.userId).filter(Boolean) as string[],
                ),
              ],
            },
          },
          select: { id: true, name: true },
        })
      ).map((u) => [u.id, u.name]),
    );
    return {
      from: f,
      to: t,
      total: summarize(rows, () => "total")[0] ?? null,
      byFeature: summarize(rows, (r) => r.feature),
      byUser: summarize(
        rows,
        (r) => users.get(r.userId ?? "") ?? "(sin usuario)",
      ),
      byDay: summarize(rows, (r) => businessDate(r.createdAt)),
    };
  }
}
