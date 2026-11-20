const daysBefore = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days);
  return value.toISOString().slice(0, 10);
};

/** Refleja en pantalla los mismos valores por defecto de dateRange en la API. */
export function reportAppliedRange(
  from: string,
  to: string,
  currentDate: string,
) {
  return {
    from: from || daysBefore(currentDate, 30),
    to: to || currentDate,
    usedDefaultFrom: !from,
  };
}
