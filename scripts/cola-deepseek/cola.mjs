// Cola de bloques para DeepSeek por API. Solo escribe en docs/, con tope de gasto.
// Uso: DEEPSEEK_API_KEY=... node scripts/cola-deepseek/cola.mjs [--dry-run] [--max-bloques=N] [--max-tokens=N]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, normalize } from "node:path";

export const SALIDA_PERMITIDA = "docs/";

export function validarSalida(ruta) {
  const n = normalize(ruta).replaceAll("\\", "/");
  if (!n.startsWith(SALIDA_PERMITIDA) || n.includes("..")) {
    throw new Error(`Salida no permitida: ${ruta} (solo ${SALIDA_PERMITIDA})`);
  }
  return n;
}

export function planear(bloques, { maxBloques, maxTokens }) {
  const plan = [];
  let gastado = 0;
  for (const b of bloques.slice(0, maxBloques)) {
    if (gastado + b.max_tokens > maxTokens) break;
    gastado += b.max_tokens;
    plan.push({ ...b, salida: validarSalida(b.salida) });
  }
  return { plan, tokensMaximos: gastado };
}

export async function ejecutar(plan, { apiKey, baseUrl, modelo, fetchFn = fetch, escribir = writeFileSync }) {
  const resultados = [];
  for (const b of plan) {
    const r = await fetchFn(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: modelo, max_tokens: b.max_tokens, messages: [{ role: "user", content: b.prompt }] }),
    });
    if (!r.ok) throw new Error(`Bloque ${b.id}: HTTP ${r.status}`);
    const j = await r.json();
    const texto = j.choices?.[0]?.message?.content ?? "";
    mkdirSync(dirname(b.salida), { recursive: true });
    escribir(b.salida, texto, "utf8");
    resultados.push({ id: b.id, salida: b.salida, tokens: j.usage?.total_tokens ?? null });
  }
  return resultados;
}

function args(argv) {
  const a = { dryRun: false, maxBloques: 5, maxTokens: 20000 };
  for (const x of argv) {
    if (x === "--dry-run") a.dryRun = true;
    else if (x.startsWith("--max-bloques=")) a.maxBloques = Number(x.split("=")[1]);
    else if (x.startsWith("--max-tokens=")) a.maxTokens = Number(x.split("=")[1]);
  }
  return a;
}

async function main() {
  const a = args(process.argv.slice(2));
  const cola = JSON.parse(readFileSync("docs/coordinacion/cola-deepseek/cola.json", "utf8"));
  const { plan, tokensMaximos } = planear(cola.bloques, a);
  console.log(`Bloques en plan: ${plan.length}; tope de tokens: ${tokensMaximos} de ${a.maxTokens}`);
  for (const b of plan) console.log(`  - ${b.id} -> ${b.salida}`);
  if (a.dryRun) return console.log("Simulación: no se llamó a la API.");
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("Falta DEEPSEEK_API_KEY en el entorno (no en el repo).");
  const res = await ejecutar(plan, {
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    modelo: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  });
  console.log(JSON.stringify(res, null, 2));
}

if (process.argv[1]?.endsWith("cola.mjs")) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
