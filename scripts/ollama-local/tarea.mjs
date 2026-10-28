// Ejecuta una tarea acotada en el modelo local de Ollama. Solo escribe en docs/.
// Uso: node scripts/ollama-local/tarea.mjs <archivo-de-encargo.md> <salida.md> [--max-tokens=N] [--dry-run]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, normalize } from "node:path";

export const SALIDA_PERMITIDA = "docs/";
export const MODELO = process.env.OLLAMA_MODEL ?? "deepseek-r1:latest";
export const URL_LOCAL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";

export function validarSalida(ruta) {
  const n = normalize(ruta).replaceAll("\\", "/");
  if (!n.startsWith(SALIDA_PERMITIDA) || n.includes("..")) {
    throw new Error(`Salida no permitida: ${ruta} (solo ${SALIDA_PERMITIDA})`);
  }
  return n;
}

export function quitarRazonamiento(texto) {
  return texto.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

export async function ejecutar({ encargo, maxTokens, fetchFn = fetch }) {
  const r = await fetchFn(`${URL_LOCAL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODELO, stream: false, prompt: encargo, options: { num_predict: maxTokens } }),
  });
  if (!r.ok) throw new Error(`Ollama respondió HTTP ${r.status}`);
  const j = await r.json();
  return { texto: quitarRazonamiento(j.response ?? ""), segundos: Math.round((j.total_duration ?? 0) / 1e9) };
}

async function main() {
  const [entrada, salida, ...resto] = process.argv.slice(2);
  if (!entrada || !salida) throw new Error("Uso: tarea.mjs <encargo.md> <salida.md> [--max-tokens=N] [--dry-run]");
  const maxTokens = Number((resto.find((x) => x.startsWith("--max-tokens=")) ?? "--max-tokens=2500").split("=")[1]);
  const ruta = validarSalida(salida);
  const encargo = readFileSync(entrada, "utf8");
  if (resto.includes("--dry-run")) return console.log(`Simulación: ${encargo.length} caracteres de encargo -> ${ruta} (máx ${maxTokens} tokens)`);
  const { texto, segundos } = await ejecutar({ encargo, maxTokens });
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, texto, "utf8");
  console.log(`Listo en ${segundos} s: ${ruta} (${texto.length} caracteres). Revisar antes de usar.`);
}

if (process.argv[1]?.endsWith("tarea.mjs")) main().catch((e) => { console.error(e.message); process.exit(1); });
