#!/usr/bin/env node
// Candado de integridad de plugins: guarda y verifica el hash de los archivos que ejecutan algo
// (hooks, scripts, .mcp.json, plugin.json). Si un plugin cambia sin pasar por el Revisor, falla.
//   node scripts/plugins-lock.mjs generar     → escribe docs/seguridad/plugins.lock.json
//   node scripts/plugins-lock.mjs verificar   → compara; sale con código 1 si algo cambió o falta
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";

const CACHE = join(homedir(), ".claude", "plugins", "cache");
const LOCK = new URL("../docs/seguridad/plugins.lock.json", import.meta.url).pathname;
const SENSIBLES = [/^hooks\//, /^scripts\//, /^bin\//, /^bridge\//, /^dist\/hooks\//, /^\.mcp\.json$/, /^mcp\.json$/, /^\.claude-plugin\//, /^agents\/claude\/\.mcp\.json$/];
const IGNORAR = /(^|\/)(node_modules|\.git|__tests__|tests?)(\/|$)/;

function archivos(dir, base = dir, salida = []) {
  for (const nombre of readdirSync(dir).sort()) {
    const ruta = join(dir, nombre);
    const rel = relative(base, ruta);
    if (IGNORAR.test(rel)) continue;
    const st = statSync(ruta);
    if (st.isDirectory()) archivos(ruta, base, salida);
    else if (SENSIBLES.some((re) => re.test(rel)) && st.size < 20_000_000) salida.push(rel);
  }
  return salida;
}

function huella(dir) {
  const h = createHash("sha256");
  const lista = archivos(dir);
  for (const rel of lista) {
    h.update(rel + "\0");
    h.update(createHash("sha256").update(readFileSync(join(dir, rel))).digest());
  }
  return { sha256: h.digest("hex"), archivos: lista.length };
}

function recorrer() {
  const r = {};
  if (!existsSync(CACHE)) return r;
  for (const mercado of readdirSync(CACHE).sort())
    for (const plugin of readdirSync(join(CACHE, mercado)).sort())
      for (const version of readdirSync(join(CACHE, mercado, plugin)).sort()) {
        const dir = join(CACHE, mercado, plugin, version);
        if (statSync(dir).isDirectory()) r[`${plugin}@${mercado}@${version}`] = huella(dir);
      }
  return r;
}

const modo = process.argv[2];
const actual = recorrer();
if (modo === "generar") {
  writeFileSync(LOCK, JSON.stringify({ generado: new Date().toISOString(), plugins: actual }, null, 2) + "\n");
  console.log(`Candado escrito: ${Object.keys(actual).length} plugins → ${LOCK}`);
} else if (modo === "verificar") {
  if (!existsSync(LOCK)) {
    console.error("No existe docs/seguridad/plugins.lock.json; corre «generar» después de que el Revisor apruebe.");
    process.exit(1);
  }
  const guardado = JSON.parse(readFileSync(LOCK, "utf8")).plugins;
  let mal = 0;
  for (const [k, v] of Object.entries(actual)) {
    if (!guardado[k]) {
      console.error(`NUEVO sin aprobar: ${k}`);
      mal++;
    } else if (guardado[k].sha256 !== v.sha256) {
      console.error(`CAMBIÓ: ${k} (hooks/scripts distintos a los revisados)`);
      mal++;
    }
  }
  for (const k of Object.keys(guardado)) if (!actual[k]) console.log(`aviso: ${k} ya no está instalado`);
  if (mal) process.exit(1);
  console.log(`Integridad correcta: ${Object.keys(actual).length} plugins coinciden con lo revisado.`);
} else {
  console.error("Uso: node scripts/plugins-lock.mjs generar|verificar");
  process.exit(2);
}
