import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { api, download } from "./api";
import { QueryState, toast, today } from "./helpers";

const columns = [
  ["cash", "Efectivo"],
  ["card", "Tarjeta"],
  ["transfer", "Transferencia"],
  ["pendingTransfer", "Transferencia por verificar"],
  ["creditGenerated", "Crédito generado"],
  ["collectionCash", "Cobro crédito efectivo"],
  ["collectionCard", "Cobro crédito tarjeta"],
  ["collectionTransfer", "Cobro crédito transferencia"],
  ["returns", "Devoluciones"],
  ["moneyIn", "Dinero ingresado"],
  ["sold", "Vendido neto"],
] as const;
type Scope = "all" | "session" | "user" | "equipment";
const kindName: Record<string, string> = {
  sale_cash: "Venta en efectivo",
  sale_card: "Venta con tarjeta",
  sale_transfer: "Venta por transferencia",
  pending_transfer: "Transferencia por verificar (no ingresada)",
  credit_generated: "Crédito generado",
  collection_cash: "Cobro de crédito en efectivo",
  collection_card: "Cobro de crédito con tarjeta",
  collection_transfer: "Cobro de crédito por transferencia",
  return_cash: "Devolución en efectivo",
  return_card: "Devolución a tarjeta",
  return_transfer: "Devolución por transferencia",
};
export function IncomeByDay() {
  const [from, setFrom] = useState(today().slice(0, 8) + "01");
  const [to, setTo] = useState(today());
  const [scope, setScope] = useState<Scope>("all");
  const [scopeId, setScopeId] = useState("");
  const [day, setDay] = useState("");
  const [page, setPage] = useState(1);
  const valid = !!from && !!to && from <= to && (scope === "all" || !!scopeId);
  const params = new URLSearchParams({
    from,
    to,
    scope,
    ...(scopeId ? { scopeId } : {}),
    ...(day ? { day } : {}),
    page: String(page),
  });
  const query = useQuery({
    queryKey: ["income-by-day", from, to, scope, scopeId, day, page],
    queryFn: () => api<any>("/reports/income-by-day?" + params),
    enabled: valid,
  });
  const sessions = useQuery({
    queryKey: ["income-sessions"],
    queryFn: () => api<any[]>("/cash-sessions"),
    enabled: scope === "session",
  });
  const users = useQuery({
    queryKey: ["income-users"],
    queryFn: () => api<any[]>("/users"),
    enabled: scope === "user",
  });
  const equipment = useQuery({
    queryKey: ["income-equipment"],
    queryFn: () => api<any[]>("/terminals"),
    enabled: scope === "equipment",
  });
  const choices =
    scope === "session"
      ? sessions.data
      : scope === "user"
        ? users.data
        : equipment.data;
  const exportFile = async (format: "csv" | "xlsx" | "pdf") => {
    try {
      const exportParams = new URLSearchParams({
        from,
        to,
        scope,
        ...(scopeId ? { scopeId } : {}),
        format,
      });
      await download(
        "/reports/income-by-day?" + exportParams,
        `ingresos-${from}-${to}.${format}`,
      );
    } catch (e: any) {
      toast(e.message, true);
    }
  };
  const reconciliation = query.data?.reconciliation;
  return (
    <section className="panel income-by-day">
      <div className="panel-heading">
        <div>
          <h2>Ingresos por día y forma de pago</h2>
          <p>
            Separa lo vendido del dinero que entró y del crédito aún por cobrar.
          </p>
        </div>
      </div>
      <div className="date-filters">
        <label className="field">
          <span>Desde</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setDay("");
            }}
          />
        </label>
        <label className="field">
          <span>Hasta</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setDay("");
            }}
          />
        </label>
        <label className="field">
          <span>Alcance</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              setScopeId("");
              setDay("");
            }}
          >
            <option value="all">Todo el negocio</option>
            <option value="session">Caja (turno)</option>
            <option value="user">Usuario</option>
            <option value="equipment">Equipo</option>
          </select>
        </label>
        {scope !== "all" && (
          <label className="field">
            <span>
              {scope === "session"
                ? "Caja"
                : scope === "user"
                  ? "Usuario"
                  : "Equipo"}
            </span>
            <select
              value={scopeId}
              onChange={(e) => {
                setScopeId(e.target.value);
                setDay("");
              }}
            >
              <option value="">Selecciona</option>
              {(choices ?? []).map((item: any) => (
                <option
                  key={item.id}
                  value={
                    scope === "equipment"
                      ? (item.id ?? item.registerId)
                      : item.id
                  }
                >
                  {scope === "session"
                    ? `${item.registerId} · ${new Date(item.openedAt).toLocaleDateString("es-DO")}`
                    : item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!valid && (
        <p role="note">
          Selecciona fechas válidas y el alcance para consultar el reporte.
        </p>
      )}
      <div className="table-actions">
        {(["csv", "xlsx", "pdf"] as const).map((format) => (
          <Button
            key={format}
            variant="secondary"
            disabled={!valid}
            onClick={() => exportFile(format)}
          >
            Descargar {format.toUpperCase()}
          </Button>
        ))}
      </div>
      {valid && (
        <QueryState query={query}>
          {query.data && (
            <>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label="Ingresos por día; desplázate para ver todas las columnas"
              >
                <table>
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      {columns.map(([key, label]) => (
                        <th key={key}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(query.data.rows ?? []).map((row: any) => (
                      <tr key={row.day}>
                        <th>
                          <button
                            className="text-link"
                            onClick={() => {
                              setDay(row.day);
                              setPage(1);
                            }}
                          >
                            {row.day}
                          </button>
                        </th>
                        {columns.map(([key]) => (
                          <td key={key}>{formatMoney(row[key] ?? 0)}</td>
                        ))}
                      </tr>
                    ))}
                    {query.data.totals && (
                      <tr>
                        <th>Total</th>
                        {columns.map(([key]) => (
                          <th key={key}>
                            {formatMoney(query.data.totals[key] ?? 0)}
                          </th>
                        ))}
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {reconciliation && (
                <div className="cod-hint" role="status">
                  {reconciliation.comparable ? (
                    <>
                      <strong>
                        {reconciliation.matches
                          ? "Cuadra con el cierre"
                          : "Diferencia con el cierre"}
                      </strong>{" "}
                      · Efectivo {formatMoney(reconciliation.difference.cash)} ·
                      Tarjeta {formatMoney(reconciliation.difference.card)} ·
                      Transferencia{" "}
                      {formatMoney(reconciliation.difference.transfer)}
                    </>
                  ) : (
                    reconciliation.message
                  )}
                </div>
              )}
              {day && (
                <div>
                  <h3>Movimientos del {day}</h3>
                  <Button variant="secondary" onClick={() => setDay("")}>
                    Cerrar detalle
                  </Button>
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label="Movimientos del día"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>Hora</th>
                          <th>Documento</th>
                          <th>Tipo</th>
                          <th>Método</th>
                          <th>Importe</th>
                          <th>Últimos 4</th>
                          <th>Aprobación</th>
                          <th>Banco</th>
                          <th>Referencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(query.data.detail ?? []).map((item: any) => (
                          <tr key={item.id + item.kind}>
                            <td>
                              {new Date(item.date).toLocaleTimeString("es-DO", {
                                timeZone: "America/Santo_Domingo",
                              })}
                            </td>
                            <td>{item.number}</td>
                            <td>{kindName[item.kind] ?? item.kind}</td>
                            <td>{item.method}</td>
                            <td>{formatMoney(item.amount)}</td>
                            <td>{item.cardLast4 ?? "—"}</td>
                            <td>{item.approvalCode ?? "—"}</td>
                            <td>{item.bank ?? "—"}</td>
                            <td>{item.reference ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p>{query.data.detailTotal ?? 0} movimientos</p>
                  {page > 1 && (
                    <Button
                      variant="secondary"
                      onClick={() => setPage(page - 1)}
                    >
                      Anterior
                    </Button>
                  )}
                  {page * 100 < (query.data.detailTotal ?? 0) && (
                    <Button
                      variant="secondary"
                      onClick={() => setPage(page + 1)}
                    >
                      Siguiente
                    </Button>
                  )}
                </div>
              )}
            </>
          )}
        </QueryState>
      )}
    </section>
  );
}
