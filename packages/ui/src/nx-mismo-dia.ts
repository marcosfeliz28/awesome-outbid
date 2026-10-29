// ¿Dos instantes caen en el mismo día calendario de Santo Domingo (UTC-4, sin horario de verano)?
const RD_DESFASE_MS = 4 * 3600_000;

function diaRD(fecha: Date): string | null {
  if (!(fecha instanceof Date)) return null;
  const t = fecha.getTime();
  if (!Number.isFinite(t)) return null;
  return new Date(t - RD_DESFASE_MS).toISOString().slice(0, 10);
}

export function esMismoDia(a: Date, b: Date): boolean {
  const da = diaRD(a);
  const db = diaRD(b);
  return da !== null && da === db;
}
