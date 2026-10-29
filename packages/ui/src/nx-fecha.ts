// Zona fija de República Dominicana (UTC-4, sin horario de verano): no depende de la zona del equipo.
const ZONA_RD = "America/Santo_Domingo";

export function fechaCorta(iso: string, idioma: "es" | "en"): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  const opciones: Intl.DateTimeFormatOptions = {
    timeZone: ZONA_RD,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  return new Intl.DateTimeFormat(
    idioma === "es" ? "es-DO" : "en-US",
    opciones,
  ).format(fecha);
}
