// Precios de la API en US$ por millón de tokens, con enrutamiento global.
// Fuente oficial consultada el 2026-11-07:
// https://platform.claude.com/docs/en/about-claude/pricing
export type TokenPrice = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
};

export type ModelPrice = TokenPrice & {
  longContext?: TokenPrice & { aboveInputTokens: number };
};

export const AI_PRICES_USD_PER_MTOK: Record<string, ModelPrice> = {
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
};
