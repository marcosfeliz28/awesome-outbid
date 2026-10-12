import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { api, download } from "./api";
import { QueryState, toast, today } from "./helpers";

export function FormalReports() {
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
          <h2>Informe formal diario o mensual</h2>
          <p>
            Ventas, cobros, bancos, cajas, créditos y auditoría en un PDF para
            compartir.
          </p>
        </div>
        <Button onClick={pdf} disabled={!date || query.isLoading}>
          Descargar PDF
        </Button>
      </div>
      <div className="date-filters">
        <label className="field">
          <span>Período</span>
          <select
            value={period}
            onChange={(e) => {
              const next = e.target.value as "day" | "month";
              setPeriod(next);
              setDate(next === "month" ? today().slice(0, 7) : today());
            }}
          >
            <option value="day">Día</option>
            <option value="month">Mes</option>
          </select>
        </label>
        <label className="field">
          <span>{period === "day" ? "Fecha" : "Mes"}</span>
          <input
            type={period === "day" ? "date" : "month"}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
      </div>
      <QueryState query={query}>
        {report && (
          <div>
            <p>
              <strong>{report.business.name}</strong> · {report.title} ·{" "}
              {report.from} a {report.to}
            </p>
            <div className="settings-rules">
              <div>
                <span>Vendido neto</span>
                <strong>{formatMoney(report.totals.sold)}</strong>
              </div>
              <div>
                <span>Ingresó</span>
                <strong>{formatMoney(report.totals.moneyIn)}</strong>
              </div>
              <div>
                <span>Banco (tarjeta + transferencia)</span>
                <strong>{formatMoney(report.totals.bankIn)}</strong>
              </div>
              <div>
                <span>Efectivo ingresado</span>
                <strong>{formatMoney(report.totals.cashIn)}</strong>
              </div>
              <div>
                <span>Crédito generado</span>
                <strong>{formatMoney(report.totals.creditGenerated)}</strong>
              </div>
              <div>
                <span>Margen sobre precio</span>
                <strong>{report.totals.margin} %</strong>
              </div>
            </div>
            <p>
              ITBIS informativo: {formatMoney(report.totals.tax)} · Descuentos:{" "}
              {formatMoney(report.totals.discounts)} · Devoluciones:{" "}
              {report.totals.returns}
            </p>
            <h3>Cajas y diferencias</h3>
            <p role="status">
              Ingresó {formatMoney(report.cashReconciliation.moneyIn)} · Según
              cajas {formatMoney(report.cashReconciliation.sessionMoney)} ·
              Diferencia {formatMoney(report.cashReconciliation.difference)}
              {!report.cashReconciliation.comparable
                ? " · Comparación parcial"
                : ""}
            </p>
            <div
              className="table-wrap"
              role="region"
              aria-label="Cajas y arqueo"
              tabIndex={0}
            >
              <table>
                <thead>
                  <tr>
                    <th>Caja</th>
                    <th>Usuario</th>
                    <th>Efectivo esperado</th>
                    <th>Efectivo contado</th>
                    <th>Diferencia</th>
                    <th>Tarjeta diferencia</th>
                    <th>Transferencia diferencia</th>
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
                          ? "Abierta"
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
            <h3>Por usuario</h3>
            <ul>
              {report.users.map((u: any) => (
                <li key={u.name}>
                  {u.name}: {u.sales} ventas · {formatMoney(u.sold)}
                </li>
              ))}
            </ul>
            <h3>Por categoría</h3>
            <ul>
              {report.categories.map((c: any) => (
                <li key={c.name}>
                  {c.name}: {c.soldProducts} productos vendidos,{" "}
                  {c.notSoldProducts} sin vender · {formatMoney(c.sold)}
                </li>
              ))}
            </ul>
            <h3>Créditos</h3>
            <p>
              Abiertos: {report.credits.openCount} · Saldo:{" "}
              {formatMoney(report.credits.openTotal)} · Cerrados en el período:{" "}
              {report.credits.closedCount}
            </p>
            <p>
              Anuladas: {report.voids.length} · Ventas con descuento:{" "}
              {report.discounts.length} · Cambios de costo:{" "}
              {report.costChanges.length}
            </p>
            {report.findings.length > 0 && (
              <>
                <h3>Señales para revisar</h3>
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
                Alguna sección supera 500 filas. Consulta el sistema para ver el
                historial completo.
              </p>
            )}
          </div>
        )}
      </QueryState>
    </section>
  );
}
