/** Accessible chart text; Recharts can supply a stacked range in value. */
export function chartSalesLabel(
  point: { value?: unknown; payload?: { total?: unknown } },
  money: (value: number) => string,
  language: "es" | "en" = "es",
): string {
  const raw =
    point.payload?.total ??
    (Array.isArray(point.value) ? point.value.at(-1) : point.value);
  if (typeof raw !== "number" || !Number.isFinite(raw))
    return language === "en"
      ? "Sales: data unavailable"
      : "Ventas: dato no disponible";
  return (language === "en" ? "Sales: " : "Ventas: ") + money(raw);
}
