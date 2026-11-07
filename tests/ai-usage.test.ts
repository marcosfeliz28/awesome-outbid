import { describe, expect, it, vi } from "vitest";
import { costUsd, recordAiUsage, summarize } from "../apps/api/src/ai-usage";
import { AI_PRICES_USD_PER_MTOK } from "../apps/api/src/ai-prices";

const actor = { id: "u1", branchId: "main" };

describe("medidor de IA", () => {
  it("usa los precios oficiales vigentes de Anthropic", () => {
    expect(AI_PRICES_USD_PER_MTOK).toMatchObject({
      "claude-opus-5-5": {
        input: 4,
        output: 20,
        cacheRead: 0.2,
        cacheWrite5m: 5,
        cacheWrite1h: 8,
      },
      "claude-sonnet-5-5": {
        input: 2,
        output: 10,
        cacheRead: 0.1,
        cacheWrite5m: 2.5,
        cacheWrite1h: 4,
      },
      "claude-haiku-5-5": {
        input: 0.1,
        output: 0.5,
        cacheRead: 0.01,
        cacheWrite5m: 0.125,
        cacheWrite1h: 0.2,
        longContext: {
          aboveInputTokens: 100_000,
          input: 0.5,
          output: 2.5,
          cacheRead: 0.05,
          cacheWrite5m: 0.625,
          cacheWrite1h: 1,
        },
      },
    });
  });

  it("calcula entrada, salida y cada categoría de caché por separado", () => {
    expect(
      costUsd("claude-sonnet-5-5", {
        input_tokens: 1_000_000,
        output_tokens: 500_000,
        cache_read_input_tokens: 1_000_000,
        cache_creation_input_tokens: 2_000_000,
        cache_creation: {
          ephemeral_5m_input_tokens: 1_000_000,
          ephemeral_1h_input_tokens: 1_000_000,
        },
      }),
    ).toBe(13.6);
  });

  it("aplica el tramo largo de Haiku solo sobre 100,000 tokens de prompt", () => {
    expect(
      costUsd("claude-haiku-5-5", {
        input_tokens: 100_000,
        output_tokens: 1_000,
      }),
    ).toBe(0.0105);
    expect(
      costUsd("claude-haiku-5-5", {
        input_tokens: 100_001,
        output_tokens: 1_000,
      }),
    ).toBe(0.052501);
    // Anthropic cuenta también lecturas y escrituras de caché en el largo del prompt.
    expect(
      costUsd("claude-haiku-5-5", {
        input_tokens: 90_000,
        output_tokens: 1_000,
        cache_read_input_tokens: 10_001,
      }),
    ).toBe(0.048);
  });

  it("no inventa el costo si falta el desglose de escritura de caché", () => {
    expect(
      costUsd("claude-opus-5-5", {
        input_tokens: 10,
        cache_creation_input_tokens: 5,
      }),
    ).toBeNull();
    expect(
      costUsd("modelo-desconocido", { input_tokens: 10 }),
    ).toBeNull();
    expect(
      costUsd("claude-opus-5-5", {
        cache_creation_input_tokens: 0,
        cache_creation: { ephemeral_5m_input_tokens: 1 },
      }),
    ).toBeNull();
  });

  it("permite probar una tabla temporal sin contaminar los modelos oficiales", () => {
    AI_PRICES_USD_PER_MTOK["t"] = {
      input: 2,
      output: 10,
      cacheRead: 1,
      cacheWrite5m: 2.5,
      cacheWrite1h: 4,
    };
    try {
      expect(
        costUsd("t", {
          input_tokens: 1e6,
          output_tokens: 5e5,
          cache_read_input_tokens: 1e6,
        }),
      ).toBe(8);
    } finally {
      delete AI_PRICES_USD_PER_MTOK["t"];
    }
  });

  it("guarda el costo calculado con el uso que devuelve el SDK", async () => {
    const create = vi.fn();
    await recordAiUsage(
      { aiUsage: { create } },
      actor,
      "factura",
      "claude-opus-5-5",
      {
        input_tokens: 1_000,
        output_tokens: 100,
        cache_read_input_tokens: 2_000,
        cache_creation_input_tokens: 3_000,
        cache_creation: {
          ephemeral_5m_input_tokens: 3_000,
          ephemeral_1h_input_tokens: 0,
        },
      },
      true,
    );
    expect(create.mock.calls[0][0].data).toMatchObject({
      cacheTokens: 5_000,
      costUsd: 0.0214,
    });
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
