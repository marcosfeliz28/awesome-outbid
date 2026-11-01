// Revisión antes de empujar: marcadores de conflicto, citas de docs/sistema, prettier/eslint de lo cambiado y typecheck.
// Uso: node scripts/pre-empuje.mjs [--base origin/nexora-cloud] [--sin-typecheck]   (sale con 1 si algo falla)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { reanclar } from "./citas-reanclar.mjs";

const MARCADOR = /^(<<<<<<< |=======$|>>>>>>> )/m;
const CODIGO = /\.(?:[cm]?[jt]sx?)$/;
const FORMATEABLE = /\.(?:[cm]?[jt]sx?|json|md|css|html|ya?ml)$/;

// Devuelve «archivo:línea» de cada marcador de conflicto (sin imprimir contenido).
export function marcadoresEn(archivo, texto) {
  if (!MARCADOR.test(texto)) return [];
  return texto.split("\n").flatMap((l, i) => (/^(<<<<<<< |>>>>>>> )/.test(l) ? [`${archivo}:${i + 1}`] : []));
}

export function filtrarCambiados(lista) {
  return {
    formateables: lista.filter((f) => FORMATEABLE.test(f)),
    codigo: lista.filter((f) => CODIGO.test(f)),
  };
}

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

function cambiados(base) {
  const nombres = (args) => sh("git", args).split("\n").filter(Boolean);
  const set = new Set([
    ...nombres(["diff", "--name-only", "--diff-filter=d", `${base}...HEAD`]),
    ...nombres(["diff", "--name-only", "--diff-filter=d", "HEAD"]),
    ...nombres(["ls-files", "--others", "--exclude-standard"]),
  ]);
  return [...set].filter((f) => existsSync(f));
}

export function ejecutar({ base = "origin/nexora-cloud", typecheck = true } = {}) {
  const fallos = [];
  const lista = cambiados(base);
  const { formateables, codigo } = filtrarCambiados(lista);

  const marcadores = lista.flatMap((f) => marcadoresEn(f, readFileSync(f, "utf8")));
  if (marcadores.length) fallos.push(`marcadores de conflicto: ${marcadores.join(", ")}`);

  const citas = reanclar({ escribir: false });
  if (citas.perdidas.length) fallos.push(`citas perdidas: ${citas.perdidas.join(", ")}`);
  if (citas.movidas.length) fallos.push(`citas por mover (corre pnpm docs:citas): ${citas.movidas.map((m) => m.cita).join(", ")}`);

  const correr = (nombre, cmd, args) => {
    try {
      sh(cmd, args);
    } catch (e) {
      fallos.push(`${nombre}: ${String(e.stdout || e.stderr || e.message).split("\n").slice(0, 8).join(" | ")}`);
    }
  };
  if (formateables.length) correr("prettier", "pnpm", ["exec", "prettier", "--check", ...formateables]);
  if (codigo.length) correr("eslint", "pnpm", ["exec", "eslint", ...codigo]);
  if (typecheck) correr("typecheck", "pnpm", ["typecheck"]);
  return { fallos, revisados: lista.length };
}

if (process.argv[1]?.endsWith("pre-empuje.mjs")) {
  const i = process.argv.indexOf("--base");
  const r = ejecutar({ base: i > 0 ? process.argv[i + 1] : undefined, typecheck: !process.argv.includes("--sin-typecheck") });
  for (const f of r.fallos) console.log(`FALLA ${f}`);
  console.log(r.fallos.length ? `${r.fallos.length} problema(s) en ${r.revisados} archivos.` : `Listo para empujar (${r.revisados} archivos revisados).`);
  process.exit(r.fallos.length ? 1 : 0);
}
