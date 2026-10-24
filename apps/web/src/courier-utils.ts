import { amountCents } from "./transfer-reconciliation-utils";
import { formatBusinessDateTime } from "./businessDates";

export const courierPresets = [100, 250, 300, 400, 450] as const;

export function expectedCents(amount: string, courierFee: string) {
  const total = amountCents(amount) + amountCents(courierFee);
  if (!Number.isSafeInteger(total)) throw new Error("Monto demasiado grande.");
  return total;
}

export function suggestedCourierFee(bankTotal: string, amount: string) {
  const difference = amountCents(bankTotal) - amountCents(amount);
  return courierPresets.find((value) => value * 100 === difference) ?? null;
}

export function feeText(value: number | string) {
  const text = String(value).trim();
  if (!/^(?:0|[1-9]\d{0,3})(?:\.\d{1,2})?$/.test(text) || Number(text) > 5000)
    throw new Error(
      "El envío debe estar entre RD$ 0 y RD$ 5,000, con hasta dos decimales.",
    );
  return text;
}

const csvCell = (value: string) => {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export type CourierRow = {
  id?: string;
  invoice: string;
  customer: string | null;
  date: string;
  courierName: string;
  courierFee: string;
};
export function courierCsv(rows: CourierRow[], timeZone?: string) {
  const header = ["Fecha", "Factura", "Cliente", "Mensajero", "Envío RD$"];
  return (
    "\uFEFF" +
    [
      header,
      ...rows.map((row) => [
        formatBusinessDateTime(row.date, timeZone, {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "numeric", minute: "2-digit", second: "2-digit",
        }),
        row.invoice,
        row.customer ?? "",
        row.courierName,
        row.courierFee,
      ]),
    ]
      .map((line) => line.map(csvCell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
