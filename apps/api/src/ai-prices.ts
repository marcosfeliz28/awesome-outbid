// Precios de la IA en US$ por millón de tokens, por modelo. ÚNICO lugar donde viven.
// Fecha de la tabla: 2026-11-07. Verificar en la página de precios de Anthropic antes de cobrar nada.
// TODO(dueña/Claude nube): cargar los precios reales; mientras sean null, el costo sale null (no se inventa).
export type ModelPrice = {
  input: number | null;
  output: number | null;
  cache: number | null;
};
export const AI_PRICES_USD_PER_MTOK: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: null, output: null, cache: null },
  "claude-sonnet-5-5": { input: null, output: null, cache: null },
  "claude-haiku-5-5": { input: null, output: null, cache: null },
};
