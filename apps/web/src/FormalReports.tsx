import { useLanguage } from "./inicioLanguage";
import { reportSecondaryLabel } from "./reportSecondaryCopy";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { api, download } from "./api";
import { QueryState, toast, today } from "./helpers";

export function FormalReports() {
  const en = useLanguage() === "en";
  const text = (value: string) => reportSecondaryLabel(value, en);
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [date, setDate] = useState(today());
  const params = new URLSearchParams({ period, date });
  const query = useQuery({
    queryKey: ["formal-report", period, date],
    queryFn: () => api<any>("/reports/formal?" + params),
    enabled: !!date,
  });
  const report = query.data;
  const pdf = async () => {
    try {
      await download(
        "/reports/formal?" +
          new URLSearchParams({ period, date, format: "pdf" }),
        `informe-${period}-${date}.pdf`,
      );
    } catch (error: any) {
      toast(error.message, true);
    }
  };
  return (
    <section className="panel formal-report">
      <div className="panel-heading">
        <div>
          <h2>{text("Informe formal diario o mensual")}</h2>
          <p>
            {en ? "Sales, collections, banks, registers, credit and audit in a shareable PDF." : "Ventas, cobros, bancos, cajas, créditos y auditoría en un PDF para compartir."}
          </p>
        </div>
        <Button onClick={pdf} disabled={!date || query.isLoading}>
          {text("Descargar PDF")}
        </Button>
      </div>
      <div className="date-filters">
        <label className="field">
          <span>{text("Per\u00edodo")}</span>
          <select
            value={period}
            onChange={(e) => {
              const next = e.target.value as "day" | "month";
              setPeriod(next);
              setDate(next === "month" ? today().slice(0, 7) : today());
            }}
          >
            <option value="day">{text("D\u00eda")}</option>
            <option value="month">{text("Mes")}</option>
          </select>
        </label>
        <label className="field">
          <span>{text(period === "day" ? "Fecha" : "Mes") }</span>
          <input
            type={period === "day" ? "date" : "month"}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <QueryState query={query} english={en}>
        {report && (
          <div>
            <p>
              <strong>{report.business.name}</strong> · {report.title} ·{" "}
              {report.from} {en ? "to" : "a"} {report.to}
            </p>
            <div className="settings-rules">
              <div>
                <span>{text("Vendido neto")}</span>
                <strong>{formatMoney(report.totals.sold)}</strong>
              </div>
              <div>
                <span>{text("Ingres\u00f3")}</span>
                <strong>{formatMoney(report.totals.moneyIn)}</strong>
              </div>
              <div>
                <span>{text("Banco (tarjeta + transferencia)")}</span>
                <strong>{formatMoney(report.totals.bankIn)}</strong>
              </div>
              <div>
                <span>{text("Efectivo ingresado")}</span>
                <strong>{formatMoney(report.totals.cashIn)}</strong>
              </div>
              <div>
                <span>{text("Cr\u00e9dito generado")}</span>
                <strong>{formatMoney(report.totals.creditGenerated)}</strong>
              </div>
              <div>
                <span>{text("Margen sobre precio")}</span>
                <strong>{report.totals.margin} %</strong>
              </div>
            </div>
            <p>
              {en ? "Informational ITBIS:" : "ITBIS informativo:"} {formatMoney(report.totals.tax)} · {en ? "Discounts:" : "Descuentos:"}{" "}
              {formatMoney(report.totals.discounts)} · {en ? "Returns:" : "Devoluciones:"}{" "}
              {report.totals.returns}
            </p>
            <h3>{text("Cajas y diferencias")}</h3>
            <p role="status">
              {en ? "Received" : "Ingresó"} {formatMoney(report.cashReconciliation.moneyIn)} · {en ? "Per register" : "Según cajas"} {formatMoney(report.cashReconciliation.sessionMoney)} ·
              {en ? "Difference" : "Diferencia"} {formatMoney(report.cashReconciliation.difference)}
              {!report.cashReconciliation.comparable
                ? (en ? " · Partial comparison" : " · Comparación parcial")
                : ""}
            </p>
            <div
              className="table-wrap"
              role="region"
              aria-label={text("Cajas y arqueo")}
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>{text("Caja")}</th>
                    <th>{text("Usuario")}</th>
                    <th>{text("Efectivo esperado")}</th>
                    <th>{text("Efectivo contado")}</th>
                    <th>{text("Diferencia")}</th>
                    <th>{text("Tarjeta diferencia")}</th>
                    <th>{text("Transferencia diferencia")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.cash.map((c: any) => (
                    <tr key={c.id}>
                      <td>{c.register}</td>
                      <td>{c.user}</td>
                      <td>{formatMoney(c.expectedCash)}</td>
                      <td>
                        {c.countedCash === null
                          ? (en ? "Open" : "Abierta")
                          : formatMoney(c.countedCash)}
                      </td>
                      <td>
                        {c.differenceCash === null
                          ? "—"
                          : formatMoney(c.differenceCash)}
                      </td>
                      <td>
                        {c.differenceCard === null
                          ? "—"
                          : formatMoney(c.differenceCard)}
                      </td>
                      <td>
                        {c.differenceTransfer === null
                          ? "—"
                          : formatMoney(c.differenceTransfer)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3>{text("Por usuario")}</h3>
            <ul>
              {report.users.map((u: any) => (
                <li key={u.name}>
                  {u.name}: {u.sales} {en ? "sales" : "ventas"} · {formatMoney(u.sold)}
                </li>
              ))}
            </ul>
            <h3>{text("Por categor\u00eda")}</h3>
            <ul>
              {report.categories.map((c: any) => (
                <li key={c.name}>
                  {c.name}: {c.soldProducts} {en ? "products sold," : "productos vendidos,"}{" "}
                  {c.notSoldProducts} {en ? "unsold" : "sin vender"} · {formatMoney(c.sold)}
                </li>
              ))}
            </ul>
            <h3>{text("Cr\u00e9ditos")}</h3>
            <p>
              {en ? "Open:" : "Abiertos:"} {report.credits.openCount} · {en ? "Balance:" : "Saldo:"}{" "}
              {formatMoney(report.credits.openTotal)} · {en ? "Closed in period:" : "Cerrados en el período:"}{" "}
              {report.credits.closedCount}
            </p>
            <p>
              {en ? "Voided:" : "Anuladas:"} {report.voids.length} · {en ? "Discounted sales:" : "Ventas con descuento:"}{" "}
              {report.discounts.length} · {en ? "Cost changes:" : "Cambios de costo:"}{" "}
              {report.costChanges.length}
            </p>
            {report.findings.length > 0 && (
              <>
                <h3>{text("Se\u00f1ales para revisar")}</h3>
                <ul>
                  {report.findings.map((item: string) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            <small>{report.note}</small>
            {Object.values(report.truncated).some(Boolean) && (
              <p role="status">
                {en ? "A section exceeds 500 rows. Open the full history in the system." : "Alguna sección supera 500 filas. Consulta el sistema para ver el historial completo."}
              </p>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
