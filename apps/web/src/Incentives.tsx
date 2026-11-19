import {
  configRatesSurveyText,
  type ConfigRatesSurveyKey,
} from "./configRatesSurveyLanguage";
import { useLanguage } from "./inicioLanguage";
import { useOperationsText } from "./operationsLanguage";
import { PremiumWorkspace } from "./PremiumWorkspace";
import "./premiumOperations.css";
// Incentivos por cajera (docs/INCENTIVOS.md): interruptor «Venta al por
// mayor» del punto de venta, cuadro «Mis incentivos» de la cajera (sólo lo
// suyo), tarifas por categoría en Configuración y la pantalla «Incentivos»
// de gerencia/administración con el cuadre mensual, el cierre, el Excel y el
// recibo para firmar.
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { create } from "zustand";
import {
  AlertTriangle,
  Download,
  FileText,
  HandCoins,
  Lock,
  Tags,
} from "lucide-react";
import { Badge, Button, Modal } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, download, post, useStore } from "./api";
import { QueryState, toast } from "./helpers";
import "./incentives.css";

export const IncentivesIcon = HandCoins;

type Units = { category: string; sold: number; returned: number };
type Row = {
  userId: string;
  name: string;
  units: Units[];
  salesCount: number;
  wholesaleSales: number;
  gross: number;
  deductions: number;
  net: number;
  pendingCollection: number;
  pendingEstimate?: number;
  priorDeductions: number;
  entryCount: number;
  lateEntries: number;
  negative: boolean;
};
type Report = {
  month: string;
  label: string;
  openPeriod?: string;
  closed: { closedAt: string; closedByName: string } | null;
  rows: Row[];
};
type Rate = {
  categoryId: string;
  name: string;
  amount: number;
  isDefault: boolean;
  defaultAmount: number;
};

const currentMonth = () =>
  new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" })
    .slice(0, 7);
const netUnits = (units: Units[]) =>
  units.reduce((sum, u) => sum + u.sold - u.returned, 0);
const unitsLabel = (units: Units[]) =>
  units
    .filter((u) => u.sold || u.returned)
    .map(
      (u) =>
        `${u.category}: ${u.sold}` + (u.returned ? ` (−${u.returned})` : ""),
    )
    .join(" · ") || "—";

// ---------------------------------------------------------------------------
// «Venta al por mayor» en el punto de venta

/**
 * Marca de la venta actual. Se envía con la venta (también offline y en
 * espera) y vuelve a «no» cuando el carrito queda vacío: al cobrar («Nueva
 * venta»), al limpiarlo o al cambiar de usuaria.
 */
export const useWholesale = create<{ on: boolean; set: (on: boolean) => void }>(
  (set) => ({ on: false, set: (on) => set({ on }) }),
);
useStore.subscribe((state, previous) => {
  if (previous.cart.length && !state.cart.length)
    useWholesale.getState().set(false);
});
/** Lo que se agrega al cuerpo de la venta o de la venta en espera. */
export const wholesaleField = () =>
  useWholesale.getState().on ? { wholesale: true as const } : {};

export function WholesaleToggle() {
  const { on, set } = useWholesale();
  const en = useLanguage() === "en";
  return (
    <div className={`wholesale-toggle${on ? " active" : ""}`}>
      <button
        type="button"
        aria-pressed={on}
        onClick={() => set(!on)}
        title={
          en
            ? "Only your incentive changes; prices and total stay the same"
            : "Sólo cambia tu incentivo: precios y total quedan igual"
        }
      >
        <Tags size={16} aria-hidden="true" />
        <span>{en ? "Wholesale sale" : "Venta al por mayor"}</span>
        <span className="wholesale-switch" aria-hidden="true" />
      </button>
      {on && (
        <small role="status">
          Activa: el incentivo de esta venta será la mitad. Precios y total no
          cambian.
        </small>
      )}
    </div>
  );
}

/** Aviso en el cobro y en la venta registrada. */
export function WholesaleNotice({ on }: { on?: boolean }) {
  const active = useWholesale((s) => s.on);
  const en = useLanguage() === "en";
  if (!(on ?? active)) return null;
  return (
    <p className="wholesale-notice">
      <Tags size={15} aria-hidden="true" />
      {en
        ? "Wholesale sale · half incentive"
        : "Venta al por mayor · incentivo a la mitad"}
    </p>
  );
}

// ---------------------------------------------------------------------------
// «Mis incentivos»: la cajera ve sólo lo suyo (en Caja)

export function MyIncentives() {
  const cashText = useOperationsText();
  const user = useStore((s) => s.user)!;
  const online = useStore((s) => s.online);
  const query = useQuery({
    queryKey: ["incentives-me"],
    queryFn: () =>
      api<{
        label: string;
        row: Row | null;
        pendingEstimate?: number;
      }>("/incentives/me"),
    enabled: online && can(user.permissions, "sale:write"),
  });
  if (!query.data) return null;
  const row = query.data.row;
  return (
    <section className="incentive-mine" aria-labelledby="incentive-mine-title">
      <div>
        <h3 id="incentive-mine-title">
          <HandCoins size={17} aria-hidden="true" />
          {cashText("Mis incentivos")} · {query.data.label}
        </h3>
        <strong data-testid="mis-incentivos-neto">
          {formatMoney(row?.net ?? 0)}
        </strong>
      </div>
      <p>
        {netUnits(row?.units ?? [])} unidades · {row?.salesCount ?? 0} ventas ·{" "}
        {row?.wholesaleSales ?? 0} al por mayor
        {row?.deductions ? (
          <> · devoluciones {formatMoney(row.deductions)}</>
        ) : null}
        {row?.pendingCollection ? (
          <> · {formatMoney(row.pendingCollection)} de ventas por cobrar</>
        ) : null}
      </p>
      {query.data.pendingEstimate ? (
        <p className="incentive-pending" data-testid="incentivo-pendiente">
          Incentivo pendiente de cobro (estimado):{" "}
          <strong>{formatMoney(query.data.pendingEstimate)}</strong>
          <small>
            {" "}
            No está en tu total. Se suma, en el mes del pago, cuando la
            administración cobre esos créditos.
          </small>
        </p>
      ) : null}
      <small>
        {cashText(
          "Sólo tú ves este cuadro. Se cuadra a fin de mes con la administración.",
        )}
      </small>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tarifas por categoría (Configuración, administración)

export function IncentiveRates() {
  const english = useLanguage() === "en";
  const t = (key: ConfigRatesSurveyKey) => configRatesSurveyText(english, key);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["incentive-rates"],
    queryFn: () => api<Rate[]>("/incentives/rates"),
  });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (query.data)
      setDraft(
        Object.fromEntries(
          query.data.map((r) => [r.categoryId, String(r.amount)]),
        ),
      );
  }, [query.data]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const rates = (query.data ?? []).map((r) => ({
      categoryId: r.categoryId,
      amount: Number(draft[r.categoryId] ?? r.amount),
    }));
    if (rates.some((r) => !Number.isFinite(r.amount) || r.amount < 0)) {
      toast(t("Cada tarifa debe ser un monto de 0 o más."), true);
      return;
    }
    setBusy(true);
    try {
      await api("/incentives/rates", {
        method: "PUT",
        body: JSON.stringify({ rates }),
      });
      await client.invalidateQueries({ queryKey: ["incentive-rates"] });
      toast(t("Tarifas de incentivos guardadas."));
    } catch (error: any) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="incentive-rates"
      aria-labelledby="incentive-rates-title"
    >
      <div className="panel-heading">
        <h3 id="incentive-rates-title">{t("Incentivos por categoría")}</h3>
      </div>
      <p>
        {t(
          "Lo que gana la cajera por cada unidad vendida. «Venta al por mayor» paga la mitad. Cambiar una tarifa no altera lo ya ganado: cada venta guarda la tarifa vigente al cobrar.",
        )}
      </p>
      <QueryState english={english} query={query}>
        <form onSubmit={save}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("CATEGORÍA")}</th>
                  <th>{t("RD$ POR UNIDAD")}</th>
                </tr>
              </thead>
              <tbody>
                {(query.data ?? []).map((r) => (
                  <tr key={r.categoryId}>
                    <td>
                      {r.name}{" "}
                      {r.isDefault && (
                        <Badge tone="neutral">{t("Por defecto")}</Badge>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        aria-label={t("Incentivo por unidad de ") + r.name}
                        value={draft[r.categoryId] ?? ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [r.categoryId]: e.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button disabled={busy}>
            {busy ? t("Guardando…") : t("Guardar tarifas")}
          </Button>
        </form>
      </QueryState>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Pantalla «Incentivos» (gerencia y administración)

export function IncentivesPage() {
  const ot = useOperationsText();
  const en = useLanguage() === "en";
  const user = useStore((s) => s.user)!;
  const admin = can(user.permissions, "*");
  const client = useQueryClient();
  const [month, setMonth] = useState(currentMonth());
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ["incentives", month],
    queryFn: () => api<Report>("/incentives?month=" + month),
  });
  const rates = useQuery({
    queryKey: ["incentive-rates"],
    queryFn: () => api<Rate[]>("/incentives/rates"),
  });
  const report = query.data;
  const rows = report?.rows ?? [];
  const sum = (key: keyof Row) =>
    rows.reduce((total, r) => total + Number(r[key] ?? 0), 0);
  const close = async () => {
    setBusy(true);
    try {
      await post("/incentives/close", { month });
      toast("Mes cerrado. El cuadre quedó guardado y ya no cambia.");
      setClosing(false);
      await client.invalidateQueries({ queryKey: ["incentives"] });
      await client.invalidateQueries({ queryKey: ["incentives-me"] });
    } catch (error: any) {
      toast(error.message, true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <PremiumWorkspace area="incentives">
      <div className="incentives-page">
        <div className="page-heading">
          <div>
            <span className="eyebrow">{ot("CUADRE MENSUAL")}</span>
            <h1>{ot("Incentivos")}</h1>
            <p>
              {ot(
                "Lo que gana cada cajera por unidad vendida, con su nombre. Se cuadra y se cierra a fin de mes.",
              )}
            </p>
          </div>
          <div className="heading-actions">
            <label className="field incentive-month">
              <span>{ot("Mes")}</span>
              <input
                type="month"
                value={month}
                max={report?.openPeriod ?? currentMonth()}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </label>
            <Button
              variant="secondary"
              onClick={() =>
                download(
                  "/incentives/export.xlsx?month=" + month,
                  `incentivos-${month}.xlsx`,
                ).catch((e) => toast(e.message, true))
              }
            >
              <Download size={16} />
              {ot("Exportar Excel")}
            </Button>
            {/* B-3: sólo un mes terminado se cierra (la API lo exige). */}
            {admin && report && !report.closed && month < currentMonth() && (
              <Button onClick={() => setClosing(true)}>
                <Lock size={16} />
                {ot("Cerrar mes")}
              </Button>
            )}
          </div>
        </div>
        <QueryState english={en} query={query}>
          {report && (
            <div className="panel">
              <div className="panel-heading incentive-status">
                <h2>{report.label}</h2>
                {report.closed ? (
                  <Badge tone="success">
                    {ot("Mes cerrado ·")}{" "}
                    {new Date(report.closed.closedAt).toLocaleString("es-DO", {
                      timeZone: "America/Santo_Domingo",
                      dateStyle: "short",
                      timeStyle: "short",
                    })}{" "}
                    · {report.closed.closedByName}
                  </Badge>
                ) : (
                  <Badge tone="warning">
                    {ot("Mes abierto · cifras preliminares")}
                  </Badge>
                )}
              </div>
              {admin && !report.closed && month === currentMonth() && (
                <p className="incentive-hint">
                  {ot(
                    "El mes en curso se cierra cuando termine, a partir del día 1 del mes siguiente.",
                  )}
                </p>
              )}
              {report.openPeriod && report.openPeriod !== currentMonth() && (
                <p className="incentive-hint">
                  {ot(
                    "Este mes ya se cerró: las ventas y devoluciones nuevas cuentan en",
                  )}
                  {report.openPeriod}.
                </p>
              )}
              {rows.length ? (
                <div className="table-wrap">
                  <table className="incentive-table">
                    <thead>
                      <tr>
                        <th>{ot("CAJERA")}</th>
                        <th>{ot("VENTAS")}</th>
                        <th>{ot("UNIDADES POR CATEGORÍA")}</th>
                        <th>{ot("BRUTO")}</th>
                        <th>{ot("DEVOLUCIONES Y ANULACIONES")}</th>
                        <th>{ot("AL POR MAYOR")}</th>
                        <th>{ot("NETO")}</th>
                        <th>{ot("POR COBRAR")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.userId}>
                          <td>
                            <strong>{r.name}</strong>
                            <button
                              type="button"
                              className="incentive-receipt"
                              aria-label={"Recibo para firmar de " + r.name}
                              onClick={() =>
                                download(
                                  `/incentives/receipt.pdf?month=${month}&userId=${r.userId}`,
                                  `incentivo-${month}-${r.name}.pdf`,
                                ).catch((e) => toast(e.message, true))
                              }
                            >
                              <FileText size={14} aria-hidden="true" />
                              {ot("Recibo PDF")}
                            </button>
                            {r.lateEntries > 0 && (
                              <small>
                                {r.lateEntries}{" "}
                                {ot("movimiento(s) de un mes ya cerrado")}
                              </small>
                            )}
                          </td>
                          <td>{r.salesCount}</td>
                          <td>{unitsLabel(r.units)}</td>
                          <td>{formatMoney(r.gross)}</td>
                          <td>
                            {formatMoney(r.deductions)}
                            {r.priorDeductions !== 0 && (
                              <small>
                                {formatMoney(r.priorDeductions)}{" "}
                                {ot("de ventas de meses anteriores")}
                              </small>
                            )}
                          </td>
                          <td>
                            {r.wholesaleSales}{" "}
                            {r.salesCount > 0 &&
                              r.wholesaleSales / r.salesCount >= 0.5 && (
                                <Badge tone="warning">{ot("Revisar")}</Badge>
                              )}
                          </td>
                          <td>
                            <strong>{formatMoney(r.net)}</strong>
                            {r.negative && (
                              <small className="incentive-negative">
                                <AlertTriangle size={13} aria-hidden="true" />
                                {ot("Saldo negativo por devoluciones")}
                              </small>
                            )}
                          </td>
                          <td>
                            {r.pendingCollection ? (
                              <Badge tone="warning">
                                {formatMoney(r.pendingCollection)}
                              </Badge>
                            ) : (
                              "—"
                            )}
                            {r.pendingEstimate ? (
                              <small>
                                {ot("Por cobrar (estimado):")}{" "}
                                {formatMoney(r.pendingEstimate)}
                              </small>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td>{sum("salesCount")}</td>
                        <td />
                        <td>{formatMoney(sum("gross"))}</td>
                        <td>{formatMoney(sum("deductions"))}</td>
                        <td>{sum("wholesaleSales")}</td>
                        <td>
                          <strong>{formatMoney(sum("net"))}</strong>
                        </td>
                        <td>{formatMoney(sum("pendingCollection"))}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <p className="incentive-hint">
                  {ot("Todavía no hay ventas con incentivo en este mes.")}
                </p>
              )}
            </div>
          )}
        </QueryState>
        <div className="panel incentive-rules">
          <h2>{ot("Cómo se calcula")}</h2>
          <ul>
            <li>
              {ot(
                "Cada unidad vendida paga la tarifa de su categoría a la cajera que registra la venta:",
              )}{" "}
              {(rates.data ?? [])
                .filter((r) => r.amount > 0)
                .map((r) => `${r.name} ${formatMoney(r.amount)}`)
                .join(" · ") || ot("sin tarifas")}
              {ot(
                ". Las tarifas se cambian en Configuración y no alteran lo ya ganado.",
              )}
            </li>
            <li>
              {ot(
                "«Venta al por mayor» (un clic en el punto de venta) paga la mitad del incentivo de esa venta; no cambia precios ni totales. La columna «Al por mayor» ayuda a revisar su uso.",
              )}
            </li>
            <li>
              {ot(
                "Devoluciones y anulaciones descuentan en el mes en que ocurren, por unidades devueltas, aunque la venta sea de un mes anterior.",
              )}
            </li>
            <li>
              {ot(
                "«Por cobrar»: incentivo de ventas a crédito o contraentrega aún sin cobrar. Está incluido en el neto; la dueña decide si lo retiene.",
              )}
            </li>
            <li>
              {ot(
                "«Cerrar mes» guarda el cuadre y ya no cambia. Una venta tardía o una devolución de ese mes cuenta en el siguiente mes abierto, con nota.",
              )}
            </li>
          </ul>
        </div>
        <Modal
          closeLabel={en ? "Close" : "Cerrar"}
          open={closing}
          onClose={() => setClosing(false)}
          title={"Cerrar " + (report?.label ?? month)}
        >
          <p>
            {ot(
              "Se guardará el cuadre de cada cajera tal como está ahora (neto",
            )}{" "}
            {formatMoney(sum("net"))}
            {ot(
              "). Después no se recalcula: las ventas tardías y devoluciones de este mes contarán en el mes siguiente.",
            )}
          </p>
          <div className="modal-footer">
            <Button variant="secondary" onClick={() => setClosing(false)}>
              {ot("Cancelar")}
            </Button>
            <Button onClick={close} disabled={busy}>
              {busy ? "Cerrando…" : "Cerrar el mes"}
            </Button>
          </div>
        </Modal>
      </div>
    </PremiumWorkspace>
  );
}
