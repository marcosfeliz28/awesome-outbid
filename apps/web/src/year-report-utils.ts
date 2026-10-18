export const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

/** Primer y último día del mes (1 a 12) como fechas AAAA-MM-DD. */
export function monthRange(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
}

/** Parte del círculo de cada mes: suma 100 % cuando hay ventas, 0 si no. */
export function monthShares(revenues: number[]) {
  const total = revenues.reduce((a, v) => a + Math.max(0, v), 0);
  return revenues.map((v) => (total > 0 ? (Math.max(0, v) / total) * 100 : 0));
}

const csvCell = (value: string | number) => {
  const text = String(value);
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function reportCsv(rows: (string | number)[][]) {
  return "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
