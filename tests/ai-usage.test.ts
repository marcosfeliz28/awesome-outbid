import { describe, expect, it, vi } from "vitest";
import { costUsd, recordAiUsage, summarize } from "../apps/api/src/ai-usage";
import { AI_PRICES_USD_PER_MTOK } from "../apps/api/src/ai-prices";

const actor = { id: "u1", branchId: "main" };

describe("medidor de IA", () => {
  it("sin precios cargados el costo es null, no inventado", () => {
    expect(
      costUsd("claude-opus-5-5", { input_tokens: 10, output_tokens: 5 }, 0),
    ).toBeNull();
    expect(costUsd("modelo-desconocido", { input_tokens: 10 }, 0)).toBeNull();
  });

  it("con precios calcula por millón de tokens", () => {
    AI_PRICES_USD_PER_MTOK["t"] = { input: 2, output: 10, cache: 1 };
    expect(costUsd("t", { input_tokens: 1e6, output_tokens: 5e5 }, 1e6)).toBe(
      8,
    );
    delete AI_PRICES_USD_PER_MTOK["t"];
  });

  it("guarda la fila con tokens de caché", async () => {
    const create = vi.fn();
    await recordAiUsage(
      { aiUsage: { create } },
      actor,
      "factura",
      "m",
      { input_tokens: 3, output_tokens: 4, cache_read_input_tokens: 2 },
      true,
    );
    expect(create.mock.calls[0][0].data).toMatchObject({
      userId: "u1",
      feature: "factura",
      inputTokens: 3,
      outputTokens: 4,
      cacheTokens: 2,
      costUsd: null,
      ok: true,
    });
  });

  it("un fallo al guardar nunca lanza", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      recordAiUsage(
        {
          aiUsage: {
            create: async () => {
              throw new Error("db caída");
            },
          },
        },
        actor,
        "factura",
        "m",
        null,
        false,
      ),
    ).resolves.toBeUndefined();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("suma por clave y deja costo null si ninguna fila trae costo", () => {
    const r = (feature: string, cost: any) => ({
      createdAt: new Date(),
      userId: "u",
      feature,
      inputTokens: 1,
      outputTokens: 2,
      costUsd: cost,
    });
    const s = summarize(
      [r("factura", null), r("factura", "0.5"), r("ventas", null)],
      (x) => x.feature,
    );
    expect(s).toEqual([
      {
        key: "factura",
        calls: 2,
        inputTokens: 2,
        outputTokens: 4,
        costUsd: 0.5,
      },
      {
        key: "ventas",
        calls: 1,
        inputTokens: 1,
        outputTokens: 2,
        costUsd: null,
      },
    ]);
  });
});
