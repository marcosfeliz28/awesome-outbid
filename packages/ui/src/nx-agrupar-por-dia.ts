// Agrupa por día de calendario de República Dominicana (UTC-4), del más reciente al más antiguo.
// Las fechas inválidas se omiten y se cuentan en `omitidos`.
const ZONA = "America/Santo_Domingo";

const formato = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export type GrupoDia<T> = { dia: string; items: T[] };

export function agruparPorDia<T extends Record<string, unknown>>(
  items: readonly T[],
  campoFecha: keyof T,
): { grupos: GrupoDia<T>[]; omitidos: number } {
  const porDia = new Map<string, T[]>();
  let omitidos = 0;
  for (const item of items) {
    const crudo = item[campoFecha];
    const fecha = crudo instanceof Date ? crudo : new Date(crudo as string | number);
    if (Number.isNaN(fecha.getTime())) {
      omitidos += 1;
      continue;
    }
    const dia = formato.format(fecha);
    const lista = porDia.get(dia);
    if (lista) lista.push(item);
    else porDia.set(dia, [item]);
  }
  const grupos = [...porDia.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dia, lista]) => ({ dia, items: lista }));
  return { grupos, omitidos };
}
