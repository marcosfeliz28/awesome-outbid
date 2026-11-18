import { Boxes, TriangleAlert, PackageX } from "lucide-react";

type StockRow = { product?: { minStock?: unknown } };
export function inventorySummary(
  rows: StockRow[],
  stock: (row: StockRow) => unknown,
) {
  let units = 0,
    low = 0,
    empty = 0;
  for (const row of rows) {
    const raw = stock(row);
    if (raw === null || raw === undefined || raw === "") return null;
    const qty = Number(raw);
    if (!Number.isFinite(qty)) return null;
    units += qty;
    const minimum = Number(row.product?.minStock);
    if (qty <= 0) empty++;
    else if (Number.isFinite(minimum) && qty <= minimum) low++;
  }
  return { units, low, empty };
}
/** Only the currently loaded, filtered rows and selected warehouse; never a global total. */
export function InventorySummary({
  rows,
  stock,
  en,
  scope,
}: {
  rows: StockRow[];
  stock: (row: StockRow) => unknown;
  en: boolean;
  scope: string;
}) {
  const summary = inventorySummary(rows, stock);
  if (!summary) return null;
  const number = new Intl.NumberFormat(en ? "en-US" : "es-DO", {
    maximumFractionDigits: 3,
  });
  return (
    <section
      className="inventory-summary"
      aria-label={
        en ? "Loaded stock summary" : "Resumen de existencias cargadas"
      }
    >
      <p className="inventory-summary-scope">
        {scope} ·{" "}
        {en
          ? "Loaded items matching your search"
          : "Artículos cargados que coinciden con tu búsqueda"}{" "}
        ({rows.length})
      </p>
      <div className="inventory-summary-cards">
        {[
          {
            Icon: Boxes,
            label: en ? "Stock units" : "Unidades en existencia",
            value: summary.units,
            tone: "units",
          },
          {
            Icon: TriangleAlert,
            label: en
              ? "Variants with low stock"
              : "Variantes con stock bajo",
            value: summary.low,
            tone: "low",
          },
          {
            Icon: PackageX,
            label: en ? "Variants with no stock" : "Variantes sin existencias",
            value: summary.empty,
            tone: "empty",
          },
        ].map(({ Icon, label, value, tone }) => (
          <article
            className={`inventory-summary-card inventory-summary-${tone}`}
            key={tone}
          >
            <Icon aria-hidden="true" size={30} />
            <div>
              <span>{label}</span>
              <strong>{number.format(value)}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
