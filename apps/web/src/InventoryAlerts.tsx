import { TriangleAlert, PackageCheck } from "lucide-react";
type Row = {
  id?: string;
  sku?: string;
  product?: { name?: string; minStock?: unknown };
};
export function InventoryAlerts({
  rows,
  stock,
  en,
  scope,
  onInspect,
}: {
  rows: Row[];
  stock: (row: Row) => unknown;
  en: boolean;
  scope: string;
  onInspect: (row: Row) => void;
}) {
  const valid = rows.map((row) => ({
    row,
    raw: stock(row),
    minimum: row.product?.minStock,
  }));
  if (
    valid.some(
      ({ raw }) =>
        raw === null ||
        raw === undefined ||
        raw === "" ||
        !Number.isFinite(Number(raw)),
    )
  )
    return null;
  const alerts = valid.filter(
    ({ raw, minimum }) =>
      Number(raw) <= 0 ||
      (minimum !== null &&
        minimum !== undefined &&
        Number.isFinite(Number(minimum)) &&
        Number(raw) <= Number(minimum)),
  );
  const empty = alerts.filter(({ raw }) => Number(raw) <= 0).length;
  return (
    <section
      className="inventory-alerts panel"
      aria-label={en ? "Stock alerts" : "Alertas de stock"}
    >
      <h2>
        <TriangleAlert aria-hidden="true" size={24} />
        {en ? "Stock alerts" : "Alertas de stock"}
      </h2>
      <p>
        {scope} ·{" "}
        {en
          ? "Loaded search results only"
          : "Solo resultados cargados de la búsqueda"}
      </p>
      {alerts.length === 0 ? (
        <p>
          <PackageCheck aria-hidden="true" size={18} />{" "}
          {en
            ? "No low-stock alerts in these results."
            : "Sin alertas de stock bajo en estos resultados."}
        </p>
      ) : (
        <>
          <p>
            {alerts.length}{" "}
            {en
              ? alerts.length === 1 ? "variant to review" : "variants to review"
              : alerts.length === 1 ? "variante por revisar" : "variantes por revisar"}
            {/* INV-009: misma regla en todo almacén; se dice qué suma. */}
            {` (${empty} ${en ? "with no stock" : "sin existencias"}, ${alerts.length - empty} ${en ? "low stock" : "con stock bajo"})`}
          </p>
          <ul>
            {alerts.slice(0, 5).map(({ row, raw, minimum }, index) => (
              <li key={row.id || row.sku || index} data-stock-tone={Number(raw) <= 0 ? "empty" : "low"}>
                <div>
                  <strong>{row.product?.name}</strong>
                  <small>
                    {row.sku} · {en ? "Stock" : "Existencia"}: {String(raw)}
                    {minimum !== null && minimum !== undefined
                      ? ` · ${en ? "Minimum" : "Mínimo"}: ${String(minimum)}`
                      : ""}
                  </small>
                </div>
                <button type="button" onClick={() => onInspect(row)}>
                  {en ? "View movements" : "Ver movimientos"}
                </button>
              </li>
            ))}
          </ul>
          {alerts.length > 5 && (
            <small>
              {en
                ? "First 5 alerts shown; the table contains all loaded results."
                : "Se muestran las primeras 5 alertas; la tabla contiene todos los resultados cargados."}
            </small>
          )}
        </>
      )}
    </section>
  );
}
