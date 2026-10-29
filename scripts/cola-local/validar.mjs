// Bucle de seguridad: rechaza cambios del modelo local fuera de la lista permitida
// y cambios de más de 5 archivos. Reglas de docs/coordinacion/REPARTO_B9.md y EDUCACION_MODELO_LOCAL.md.
import { normalize, isAbsolute } from "node:path";

export const MAX_ARCHIVOS = 5;

// Patrones de ruta prohibidos (dinero, mercancía, auth/permisos, migraciones, CI, config, secretos, datos del negocio).
const PROHIBIDOS = [
  /^\.github\//,
  /^render\.yaml$/,
  /^CLAUDE\.md$/,
  /^AGENTS\.md$/,
  /(^|\/)\.env/,
  /^docs\/(operacion|legal|seguridad)\//,
  /^apps\/api\/prisma\//,
  /(^|\/)(cash|sales|sale|payment|pago|cobro|cuadre|margen|precio|ncf|dgii|itbis|factura|invoice)[^/]*\.(ts|tsx|mjs)$/i,
  /(^|\/)(auth|permis|permission|role|rol)[^/]*\.(ts|tsx|mjs)$/i,
  /(^|\/)(inventario|inventory|merchandise|mercancia|stock)[^/]*\.(ts|tsx|mjs)$/i,
];

export function validarCambio(archivos) {
  const motivos = [];
  if (archivos.length > MAX_ARCHIVOS) motivos.push(`más de ${MAX_ARCHIVOS} archivos (${archivos.length})`);
  for (const f of archivos) {
    const n = normalize(f).replaceAll("\\", "/");
    if (isAbsolute(f) || n.startsWith("..") || n.includes("/../")) {
      motivos.push(`ruta fuera del repositorio: ${f}`);
      continue;
    }
    if (PROHIBIDOS.some((re) => re.test(n))) motivos.push(`archivo prohibido: ${f}`);
  }
  return { ok: motivos.length === 0, motivos };
}
