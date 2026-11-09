// Corre las 100 preguntas del asistente analista con el modelo REAL de Anthropic
// sobre los mismos datos fijos del arnés (tests/ia-analista/casos.ts). Opcional:
// cuesta tokens y no corre en CI.
//
//   ANTHROPIC_API_KEY=… apps/api/node_modules/.bin/tsx --tsconfig apps/api/tsconfig.json scripts/ia-analista-eval-real.mts [salida.json]
//
// Aquí el modelo elige las herramientas. Se reporta: (1) si las lecturas que pidió
// pasan la comprobación del caso y (2) la respuesta, para revisarla a mano.
// Modelo: ASSISTANT_MODEL (por defecto el del asistente).
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { CASOS, evaluar } from "../tests/ia-analista/casos";

const Anthropic = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("@anthropic-ai/sdk").default;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Falta ANTHROPIC_API_KEY.");
  process.exit(1);
}
const client = new Anthropic({ maxRetries: 2 });
const filas = await evaluar({
  create: (p: object, o?: object) => client.messages.create(p, o),
});
const pasan = filas.filter((f) => f.pasa).length;
const tokens = filas.reduce(
  (t, f) =>
    t +
    (f.corrida?.cierres[0]?.[1].inputTokens ?? 0) +
    (f.corrida?.cierres[0]?.[1].outputTokens ?? 0),
  0,
);
console.log(`Precisión con modelo real: ${pasan}/100 · tokens ${tokens}`);
const salida = filas.map((f) => ({
  id: f.id,
  pregunta: CASOS.find((c) => c.id === f.id)!.pregunta,
  pasa: f.pasa,
  motivo: f.motivo,
  herramientas: f.corrida?.results.map((u) => u.tool) ?? [],
  respuesta: f.corrida?.respuesta ?? "",
}));
for (const s of salida.filter((s) => !s.pasa))
  console.log(`  ${s.id}: ${s.motivo}`);
if (process.argv[2])
  writeFileSync(process.argv[2], JSON.stringify(salida, null, 2));
