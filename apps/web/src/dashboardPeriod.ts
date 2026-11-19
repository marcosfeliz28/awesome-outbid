/** Primer día de un intervalo inclusivo de siete fechas civiles. */
export function dashboardSevenDayStart(to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) return to;
  const date = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== to)
    return to;
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}
