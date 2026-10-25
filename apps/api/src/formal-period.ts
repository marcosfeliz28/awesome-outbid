import { margin } from "@fitstore/shared";

/** Rango civil completo de Santo Domingo para informes diarios y mensuales. */
export function formalPeriod(period: string, value: string) {
  if (
    period === "day" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  )
    return { from: value, to: value, label: `Día ${value}` };
  if (period === "month" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: value + "-01",
      to: value + "-" + String(last).padStart(2, "0"),
      label: `Mes ${value}`,
    };
  }
  throw new Error("Indica un día AAAA-MM-DD o un mes AAAA-MM válido.");
}
// La misma fórmula de margen de todo el sistema (revisión 25-oct #8).
export const reportMargin = (sold: number, cost: number) => margin(sold, cost);
export const isTestRegister = (name: string) =>
  /^(qa|test|prueba)[-_]/i.test(name);
