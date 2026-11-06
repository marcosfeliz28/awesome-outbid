// Mantiene vivas las citas `archivo:línea` de docs/sistema/*.md cuando el código cambia de línea.
// Cada cita guarda un fragmento del texto de su línea en docs/sistema/CITAS_ANCLAS.json; si en esa línea
// ya no está el fragmento, se busca en el mismo archivo y la cita se mueve sola a la línea nueva.
// Uso: node scripts/citas-reanclar.mjs [--revisar]   (--revisar no escribe; sale con 1 si hay citas movidas o perdidas)
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const CITA =
  /([A-Za-z0-9_./-]+\.(?:tsx?|mjs|cjs|ps1|md|json|nsi|sql|css|html|yml|yaml|txt|cs|rs)):(\d+)(?:-(\d+))?/g;
const SOLO_CIERRE = /^[\s{}()[\];,]*$/;
const RAICES = ["apps", "packages", "docs", "scripts", "tests", ".claude", ".github"];
const MIN_FRAGMENTO = 6;

export const normalizar = (linea) => linea.trim().replace(/\s+/g, " ").slice(0, 120);

function archivos(dir, filtro) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n === ".git" || n === "dist") return [];
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta, filtro);
    return filtro(n) ? [ruta] : [];
  });
}

export function indiceDe(raiz) {
  return RAICES.flatMap((r) => archivos(join(raiz, r), () => true)).concat(
    readdirSync(raiz)
      .map((n) => join(raiz, n))
      .filter((r) => statSync(r).isFile()),
  );
}

export function resolver(raiz, indice, cita) {
  if (cita.includes("/")) {
    const directa = join(raiz, cita);
    if (existsSync(directa) && statSync(directa).isFile()) return [directa];
  }
  const nombre = cita.split("/").pop();
  return indice.filter(
    (f) => f.split(/[\\/]/).pop() === nombre && (!cita.includes("/") || f.endsWith(cita)),
  );
}

// Devuelve la línea nueva (1-based) donde está el fragmento, la más cercana a `cerca`, o null si no está.
export function buscarLinea(lineas, fragmento, cerca) {
  const encontradas = [];
  lineas.forEach((l, i) => {
    if (normalizar(l).includes(fragmento)) encontradas.push(i + 1);
  });
  if (!encontradas.length) return null;
  encontradas.sort((a, b) => Math.abs(a - cerca) - Math.abs(b - cerca) || a - b);
  if (
    encontradas.length > 1 &&
    Math.abs(encontradas[0] - cerca) === Math.abs(encontradas[1] - cerca)
  )
    return null; // empate: ambiguo, no se adivina
  return encontradas[0];
}

export function reanclar({ raiz = process.cwd(), escribir = true } = {}) {
  const dirDocs = join(raiz, "docs", "sistema");
  const rutaAnclas = join(dirDocs, "CITAS_ANCLAS.json");
  const anclas = existsSync(rutaAnclas) ? JSON.parse(readFileSync(rutaAnclas, "utf8")) : {};
  const indice = indiceDe(raiz);
  const docs = archivos(dirDocs, (n) => n.endsWith(".md"));
  const textos = new Map(docs.map((d) => [d, readFileSync(d, "utf8")]));
  const cache = new Map();
  const lineasDe = (ruta) => {
    if (!cache.has(ruta)) cache.set(ruta, readFileSync(ruta, "utf8").split("\n"));
    return cache.get(ruta);
  };

  const nuevasAnclas = {};
  const movidas = []; // { cita, de, a }
  const perdidas = []; // cita
  const sinAncla = []; // cita
  const mapa = new Map(); // clave vieja -> línea nueva
  const claves = new Set();
  for (const texto of textos.values())
    for (const m of texto.matchAll(CITA)) claves.add(`${m[1]}:${m[2]}`);

  for (const clave of claves) {
    const i = clave.lastIndexOf(":");
    const archivo = clave.slice(0, i);
    const linea = Number(clave.slice(i + 1));
    const candidatos = resolver(raiz, indice, archivo);
    const fragmento = anclas[clave];
    if (fragmento === undefined) {
      const l = candidatos.map((c) => lineasDe(c)[linea - 1]).find((x) => x !== undefined);
      const f = l === undefined ? "" : normalizar(l);
      if (f.length >= MIN_FRAGMENTO && !SOLO_CIERRE.test(f)) nuevasAnclas[clave] = f;
      else sinAncla.push(clave);
      continue;
    }
    if (candidatos.some((c) => normalizar(lineasDe(c)[linea - 1] ?? "").includes(fragmento))) {
      nuevasAnclas[clave] = fragmento;
      continue;
    }
    let destino = null;
    for (const c of candidatos) {
      destino = buscarLinea(lineasDe(c), fragmento, linea);
      if (destino) break;
    }
    if (!destino) {
      perdidas.push(clave);
      nuevasAnclas[clave] = fragmento;
      continue;
    }
    mapa.set(clave, destino);
    movidas.push({ cita: clave, de: linea, a: destino });
    nuevasAnclas[`${archivo}:${destino}`] = fragmento;
  }

  if (escribir && mapa.size) {
    for (const [doc, texto] of textos) {
      const nuevo = texto.replace(CITA, (todo, archivo, desde, hasta) => {
        const destino = mapa.get(`${archivo}:${desde}`);
        if (!destino) return todo;
        const delta = destino - Number(desde);
        return `${archivo}:${destino}${hasta ? `-${Number(hasta) + delta}` : ""}`;
      });
      if (nuevo !== texto) writeFileSync(doc, nuevo);
    }
  }
  if (escribir) {
    const ordenadas = Object.fromEntries(Object.entries(nuevasAnclas).sort(([a], [b]) => a.localeCompare(b)));
    const json = `${JSON.stringify(ordenadas, null, 2)}\n`;
    if (!existsSync(rutaAnclas) || readFileSync(rutaAnclas, "utf8") !== json) writeFileSync(rutaAnclas, json);
  }
  return { movidas, perdidas, sinAncla, total: claves.size, relativo: relative(raiz, rutaAnclas) };
}

if (process.argv[1]?.endsWith("citas-reanclar.mjs")) {
  const revisar = process.argv.includes("--revisar");
  const r = reanclar({ escribir: !revisar });
  for (const m of r.movidas) console.log(`${revisar ? "movería" : "movida"}: ${m.cita} -> línea ${m.a}`);
  for (const p of r.perdidas) console.log(`PERDIDA (el fragmento ya no está en el archivo): ${p}`);
  console.log(`${r.total} citas; ${r.movidas.length} movidas; ${r.perdidas.length} perdidas; ${r.sinAncla.length} sin ancla (línea vacía o de cierre).`);
  process.exit(r.perdidas.length || (revisar && r.movidas.length) ? 1 : 0);
}
