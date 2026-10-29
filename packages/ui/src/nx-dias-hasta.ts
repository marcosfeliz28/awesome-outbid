// Días de calendario desde «ahora» hasta «fecha», contados en la zona de República Dominicana (UTC-4).
const ZONA = "America/Santo_Domingo";

function diaRD(d: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const valor = (tipo: string) =>
    Number(partes.find((p) => p.type === tipo)?.value);
  return Date.UTC(valor("year"), valor("month") - 1, valor("day")) / 86400000;
}

export function diasHasta(fecha: Date, ahora: Date): number {
  if (Number.isNaN(fecha.getTime()) || Number.isNaN(ahora.getTime()))
    return NaN;
  return diaRD(fecha) - diaRD(ahora);
}
