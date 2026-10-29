// Agrupa por día calendario de República Dominicana (UTC-4), del día más nuevo al más viejo.
// Las fechas inválidas, vacías o nulas no entran en ningún grupo: se cuentan en «omitidos».
const ZONA = "America/Santo_Domingo";
const formatoDia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export interface GrupoDia<T> {
  dia: string;
  items: T[];
}

export function agruparPorDia<T>(
  items: T[],
  campoFecha: keyof T,
): { grupos: GrupoDia<T>[]; omitidos: number } {
  const porDia = new Map<string, T[]>();
  let omitidos = 0;
  for (const item of items) {
    const valor = item[campoFecha];
    const ms = valor == null ? NaN : new Date(valor as string | number | Date).getTime();
    if (Number.isNaN(ms)) {
      omitidos++;
      continue;
    }
    const dia = formatoDia.format(ms);
    porDia.set(dia, [...(porDia.get(dia) ?? []), item]);
  }
  const grupos = [...porDia]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dia, lista]) => ({ dia, items: lista }));
  return { grupos, omitidos };
}
