// COM-08: buscar entre los créditos ya cargados, sin pedir más datos al servidor.
type CreditRow = {
  number?: string | number | null;
  customer?: { name?: string | null; phone?: string | null } | null;
};

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
const digits = (s: unknown) => String(s ?? "").replace(/\D/g, "");

export function filterCredits<T extends CreditRow>(
  rows: T[],
  search: string,
): T[] {
  const needle = norm(search);
  if (!needle) return rows;
  const needleDigits = digits(search);
  return rows.filter(
    (r) =>
      norm(r.customer?.name).includes(needle) ||
      norm(r.number).includes(needle) ||
      (needleDigits.length >= 3 &&
        digits(r.customer?.phone).includes(needleDigits)),
  );
}
