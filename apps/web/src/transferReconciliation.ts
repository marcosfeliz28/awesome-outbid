export type PendingTransfer = {
  id: string;
  date: string;
  invoice: string;
  customer: string | null;
  amount: string;
  bank: string | null;
  reference: string | null;
  cashier: string | null;
};

export const BANK_GROUPS = ["BHD", "Popular", "Banreservas", "Otros"] as const;
export type BankGroup = (typeof BANK_GROUPS)[number];

export function bankGroup(bank: string | null): BankGroup {
  const value = (bank ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\bbhd\b/.test(value)) return "BHD";
  if (/\bpopular\b/.test(value)) return "Popular";
  if (/\b(banreservas|reservas)\b/.test(value)) return "Banreservas";
  return "Otros";
}

export function amountCents(amount: string): number {
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(amount))
    throw new Error("Monto inválido.");
  const [whole, fraction = ""] = amount.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) throw new Error("Monto demasiado grande.");
  return cents;
}

export function selectedTotalCents(
  rows: PendingTransfer[],
  selected: Set<string>,
) {
  return rows.reduce((sum, row) => {
    const next = sum + (selected.has(row.id) ? amountCents(row.amount) : 0);
    if (!Number.isSafeInteger(next)) throw new Error("Total demasiado grande.");
    return next;
  }, 0);
}

const csvCell = (value: string) => {
  const safe = /^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function reconciliationCsv(rows: PendingTransfer[]) {
  const header = [
    "Fecha",
    "Factura",
    "Cliente",
    "Monto RD$",
    "Banco",
    "Referencia",
    "Cajera",
  ];
  const lines = rows.map((row) => [
    new Date(row.date).toLocaleString("es-DO", {
      timeZone: "America/Santo_Domingo",
    }),
    row.invoice,
    row.customer ?? "",
    row.amount,
    row.bank ?? "",
    row.reference ?? "",
    row.cashier ?? "",
  ]);
  return (
    "\uFEFF" +
    [header, ...lines].map((line) => line.map(csvCell).join(",")).join("\r\n") +
    "\r\n"
  );
}

export type VerifyResult = { id: string; ok: boolean; message: string };
export async function verifyOneByOne(
  ids: string[],
  verify: (id: string) => Promise<unknown>,
): Promise<VerifyResult[]> {
  const result: VerifyResult[] = [];
  for (const id of ids) {
    try {
      await verify(id);
      result.push({ id, ok: true, message: "Verificada" });
    } catch (error) {
      result.push({
        id,
        ok: false,
        message:
          error instanceof Error ? error.message : "No se pudo verificar.",
      });
    }
  }
  return result;
}
