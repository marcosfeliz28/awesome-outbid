// Salida externa del runner: guarda fuera del repositorio (que es público) y revisa
// cada salida antes de guardarla. Orden 120, punto 2e.
import { resolve, basename, relative, isAbsolute } from "node:path";
import { validarSalida } from "../ollama-local/tarea.mjs";

const tieneDosPuntos = (ruta) => ruta.split(/[\\/]+/).includes("..");

// Sin carpeta externa: igual que antes (solo docs/). Con carpeta: debe estar fuera del repo y sin "..".
export function resolverSalida(salida, carpetaExterna, repo = process.cwd()) {
  if (carpetaExterna === undefined) return validarSalida(salida);
  if (!carpetaExterna.trim()) throw new Error("--salida-externa vacía");
  if (tieneDosPuntos(carpetaExterna) || tieneDosPuntos(salida)) throw new Error("Ruta con '..' no permitida");
  const carpeta = resolve(carpetaExterna);
  const rel = relative(resolve(repo), carpeta);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) throw new Error(`La carpeta externa está dentro del repositorio: ${carpetaExterna}`);
  return resolve(carpeta, basename(salida));
}

const REGLAS = [
  ["teléfono", /(?<!\d)(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}(?!\d)/],
  ["teléfono", /(?<!\d)8[024]9\d{7}(?!\d)/],
  ["cédula", /(?<!\d)\d{3}-\d{7}-\d(?!\d)/],
  ["correo", /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ["clave de API", /\b(?:sk|pk|ghp|gho|xox[bp])[-_][A-Za-z0-9_-]{10,}/],
  ["contraseña", /(?:contrase(?:ñ|n)a|password|clave|token|secret)\s*[:=]\s*\S+/i],
  ["dinero", /(?:RD\s?\$|US\s?\$|\$)\s*\d[\d,.]*|\b\d[\d,.]*\s*(?:pesos|dólares|dolares)\b/i],
];

// Devuelve la lista de hallazgos; vacía = limpia. Quien llama no guarda si hay hallazgos.
export function revisarSensible(texto) {
  return REGLAS.filter(([, re]) => re.test(texto)).map(([nombre]) => nombre);
}

// Orden 122: se revisa siempre. Con salida externa todo bloquea; hacia docs/ (público) el
// «dinero» solo avisa, porque la ayuda cita montos de ejemplo como «RD$ 0.00».
export function evaluarSalida(texto, externa) {
  const hallazgos = [...new Set(revisarSensible(texto))];
  const avisar = externa ? [] : hallazgos.filter((h) => h === "dinero");
  return { bloquear: hallazgos.filter((h) => !avisar.includes(h)), avisar };
}
