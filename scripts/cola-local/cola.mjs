// Cola de tareas para el modelo local: toma la siguiente tarea pendiente, arma el encargo
// con archivos del repo y guarda la salida en docs/. Estado en disco: se retoma tras un corte.
// Uso: node scripts/cola-local/cola.mjs [--una] [--cola=docs/coordinacion/COLA_LOCAL_ACTIVA.json]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { ejecutar, validarSalida } from "../ollama-local/tarea.mjs";

export const LIMITE_ENTRADA = 6000;

export function siguienteTarea(cola, estado) {
  // Pendientes, las que quedaron "en curso" por un corte, y errores con menos de 2 intentos.
  return cola.tareas.find((t) => {
    const e = estado[t.id];
    if (!e) return true;
    if (e.estado === "pendiente" || e.estado === "en curso") return true;
    return e.estado === "error" && (e.intentos ?? 0) < 2;
  }) ?? null;
}

export function construirEncargo(tarea, leer, contexto = "") {
  const bloques = (tarea.entradas ?? []).map((ruta) => {
    const texto = leer(ruta);
    const recorte = texto.length > LIMITE_ENTRADA ? texto.slice(0, LIMITE_ENTRADA) + "\n[...recortado]" : texto;
    return `### Archivo: ${ruta}\n\`\`\`\n${recorte}\n\`\`\``;
  });
  return [contexto, tarea.instrucciones, "", ...bloques].filter(Boolean).join("\n");
}

// Une los archivos de contexto fijo (en orden); omite los que no existen.
export function cargarContexto(rutas, leer, existe) {
  return rutas.filter(existe).map((r) => leer(r).trim()).join("\n\n");
}

export function registrar(estado, id, cambios) {
  return { ...estado, [id]: { ...(estado[id] ?? {}), ...cambios, actualizado: new Date().toISOString() } };
}

function cargarEstado(ruta) {
  return existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : {};
}

async function main() {
  const args = process.argv.slice(2);
  const rutaCola = args.find((a) => a.startsWith("--cola="))?.slice(7) ?? "docs/coordinacion/COLA_LOCAL_ACTIVA.json";
  const rutaEstado = rutaCola.replace(/\.json$/, "_ESTADO.json");
  const una = args.includes("--una");
  const cola = JSON.parse(readFileSync(rutaCola, "utf8"));
  const leer = (ruta) => readFileSync(ruta, "utf8");
  // Contexto fijo: la guía de educación que Norexos 1 escribió para el modelo (si existe).
  // Contexto fijo: la guía de Norexos 1 y las reglas de Claude PC (en ese orden).
  const contexto = cargarContexto(
    ["docs/coordinacion/EDUCACION_MODELO_LOCAL.md", "docs/coordinacion/INSTRUCCIONES_QWEN_CLAUDE_PC.md", "docs/educacion/CONOCIMIENTO_NOREXOS.md"],
    leer,
    existsSync,
  );
  for (;;) {
    let estado = cargarEstado(rutaEstado);
    const tarea = siguienteTarea(cola, estado);
    if (!tarea) return console.log("Cola vacía: no hay tareas pendientes.");
    const salida = validarSalida(tarea.salida);
    estado = registrar(estado, tarea.id, { estado: "en curso" });
    mkdirSync(dirname(rutaEstado), { recursive: true });
    writeFileSync(rutaEstado, JSON.stringify(estado, null, 2), "utf8");
    try {
      const { texto, segundos } = await ejecutar({ encargo: construirEncargo(tarea, leer, contexto), maxTokens: tarea.maxTokens ?? 2500, modelo: tarea.modelo });
      mkdirSync(dirname(salida), { recursive: true });
      writeFileSync(salida, texto, "utf8");
      estado = registrar(estado, tarea.id, { estado: "hecha", segundos });
      console.log(`[${tarea.id}] hecha en ${segundos} s -> ${salida}`);
    } catch (e) {
      const intentos = (estado[tarea.id]?.intentos ?? 0) + 1;
      estado = registrar(estado, tarea.id, { estado: "error", intentos, error: e.message });
      console.log(`[${tarea.id}] error (${intentos}): ${e.message}`);
    }
    writeFileSync(rutaEstado, JSON.stringify(estado, null, 2), "utf8");
    if (una) return;
  }
}

if (process.argv[1]?.endsWith("cola.mjs")) main().catch((e) => { console.error(e.message); process.exit(1); });
