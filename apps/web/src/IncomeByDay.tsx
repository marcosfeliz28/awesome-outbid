import { useLanguage } from "./inicioLanguage";
import { reportSecondaryLabel } from "./reportSecondaryCopy";
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
  const en = useLanguage() === "en";
  const text = (value: string) => reportSecondaryLabel(value, en);
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
    <section className="panel income-by-day report-workspace">
      <div className="panel-heading report-workspace-heading">
        <div>
          <h2>{text("Ingresos por d\u00eda y forma de pago")}</h2>
          <p>
            {text("Separa lo vendido del dinero que entr\u00f3 y del cr\u00e9dito a\u00fan por cobrar.")}
          </p>
        </div>
      </div>
      <div className="date-filters report-filters">
        <label className="field">
          <span>{text("Desde")}</span>
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
          <span>{text("Hasta")}</span>
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
          <span>{text("Alcance")}</span>
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as Scope);
              setScopeId("");
              setDay("");
            }}
          >
            <option value="all">{text("Todo el negocio")}</option>
            <option value="session">{text("Caja (turno)")}</option>
            <option value="user">{text("Usuario")}</option>
            <option value="equipment">{text("Equipo")}</option>
          </select>
        </label>
        {scope !== "all" && (
          <label className="field">
            <span>
              {scope === "session"
                ? text("Caja")
                : scope === "user"
                  ? text("Usuario")
                  : text("Equipo")}
            </span>
            <select
              value={scopeId}
              onChange={(e) => {
                setScopeId(e.target.value);
                setDay("");
              }}
            >
              <option value="">{text("Selecciona")}</option>
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
                    ? `${item.registerId} · ${new Date(item.openedAt).toLocaleDateString(en ? "en-US" : "es-DO")}`
                    : item.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!valid && (
        <p role="note">
          {text("Selecciona fechas v\u00e1lidas y el alcance para consultar el reporte.")}
        </p>
      )}
      <div className="table-actions report-export-actions">
        {(["csv", "xlsx", "pdf"] as const).map((format) => (
          <Button
            key={format}
            variant="secondary"
            disabled={!valid}
            onClick={() => exportFile(format)}
          >
            {en ? "Download" : "Descargar"} {format.toUpperCase()}
          </Button>
        ))}
      </div>
      {valid && (
        <QueryState query={query} english={en}>
          {query.data && (
            <>
              <div
                className="table-wrap"
                tabIndex={0}
                role="region"
                aria-label={text("Ingresos por d\u00eda; despl\u00e1zate para ver todas las columnas")}
              >
                <table>
                  <thead>
                    <tr>
                      <th>{text("Fecha")}</th>
                      {columns.map(([key, label]) => (
                        <th key={key}>{text(label)}</th>
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
              {query.data.gv && (query.data.gv.total || query.data.gv.moneyIn) ? (
                <div className="cod-hint" role="status">
                  <strong>{en ? "GV (separate, not added)" : "GV (aparte, no suma)"}</strong>{" "}
                  · {en ? "Net sold" : "Vendido neto"} {formatMoney(query.data.gv.total)} ·{" "}
                  {en ? "Money in" : "Dinero ingresado"} {formatMoney(query.data.gv.moneyIn)}
                </div>
              ) : null}
              {reconciliation && (
                <div className="cod-hint" role="status">
                  {reconciliation.comparable ? (
                    <>
                      <strong>
                        {reconciliation.matches
                          ? (en ? "Matches the closing" : "Cuadra con el cierre")
                          : (en ? "Difference from the closing" : "Diferencia con el cierre")}
                      </strong>{" "}
                      · {text("Efectivo")} {formatMoney(reconciliation.difference.cash)} ·
                      {text("Tarjeta")} {formatMoney(reconciliation.difference.card)} ·
                      {text("Transferencia")}{" "}
                      {formatMoney(reconciliation.difference.transfer)}
                    </>
                  ) : (
                    reconciliation.message
                  )}
                </div>
              )}
              {day && (
                <div className="income-day-detail">
                  <h3>{en ? "Movements on" : "Movimientos del"} {day}</h3>
                  <Button variant="secondary" onClick={() => setDay("")}>
                    {text("Cerrar detalle")}
                  </Button>
                  <div
                    className="table-wrap"
                    tabIndex={0}
                    role="region"
                    aria-label={text("Movimientos del d\u00eda")}
                  >
                    <table>
                      <thead>
                        <tr>
                          <th>{text("Hora")}</th>
                          <th>{text("Documento")}</th>
                          <th>{text("Tipo")}</th>
                          <th>{text("M\u00e9todo")}</th>
                          <th>{text("Importe")}</th>
                          <th>{text("\u00daltimos 4")}</th>
                          <th>{text("Aprobaci\u00f3n")}</th>
                          <th>{text("Banco")}</th>
                          <th>{text("Referencia")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(query.data.detail ?? []).map((item: any) => (
                          <tr key={item.id + item.kind}>
                            <td>
                              {new Date(item.date).toLocaleTimeString(en ? "en-US" : "es-DO", {
                                timeZone: "America/Santo_Domingo",
                              })}
                            </td>
                            <td>{item.number}</td>
                            <td>{text(kindName[item.kind] ?? item.kind)}</td>
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
                  <p>{query.data.detailTotal ?? 0} {en ? "movements" : "movimientos"}</p>
                  {page > 1 && (
                    <Button
                      variant="secondary"
                      onClick={() => setPage(page - 1)}
                    >
                      {text("Anterior")}
                    </Button>
                  )}
                  {page * 100 < (query.data.detailTotal ?? 0) && (
                    <Button
                      variant="secondary"
                      onClick={() => setPage(page + 1)}
                    >
                      {text("Siguiente")}
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
