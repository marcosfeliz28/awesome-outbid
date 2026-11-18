import { usePremiumWorkspace } from "./PremiumWorkspace";
import { useLanguage } from "./inicioLanguage";
import { operationalAuxText } from "./operationalAuxLanguage";
import { ClipboardX } from "lucide-react";
import "./operationalAux.css";
import { useState } from "react";
import { METHOD_LABEL } from "./Prints";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Badge, Modal } from "@fitstore/ui";
import { can, formatMoney } from "@fitstore/shared";
import { api, post, useStore } from "./api";
import { FormModal, QueryState, dateLabel, toast } from "./helpers";

const states: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

export function VoidRequests() {
  usePremiumWorkspace();
  const english = useLanguage() === "en";
  const t = (text: string) => operationalAuxText(english, text);
  const user = useStore((s) => s.user)!;
  const admin = can(user.permissions, "*");
  const client = useQueryClient();
  const [status, setStatus] = useState("pending");
  const [approving, setApproving] = useState<any>(null);
  const [approvalError, setApprovalError] = useState("");
  const [approvalBusy, setApprovalBusy] = useState(false);
  const [rejecting, setRejecting] = useState<any>(null);
  const query = useQuery<any[]>({
    queryKey: ["void-requests", status],
    queryFn: () => api("/void-requests?status=" + status),
    refetchInterval: 15000,
  });
  const refresh = () => client.invalidateQueries();
  return (
    <section className="void-requests-page operational-aux operational-aux-void norexos-premium-workspace">
      <div className="page-heading">
        <span className="operational-aux-emblem" aria-hidden="true">
          <ClipboardX size={34} strokeWidth={1.6} />
        </span>
        <div>
          <div className="eyebrow">{t("VENTAS")}</div>
          <h1>{t("Solicitudes de anulación")}</h1>
          <p>
            {admin
              ? t("Revisa cada solicitud antes de decidir.")
              : t("Consulta el estado de tus solicitudes.")}
          </p>
        </div>
      </div>
      <div className="panel">
        <label className="field">
          <span>{t("Estado")}</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="pending">{t("Pendientes")}</option>
            <option value="all">{t("Todas")}</option>
            <option value="approved">{t("Aprobadas")}</option>
            <option value="rejected">{t("Rechazadas")}</option>
            <option value="cancelled">{t("Canceladas")}</option>
          </select>
        </label>
        <QueryState english={english} query={query}>
          {query.data?.length ? (
            <div className="void-request-grid">
              {query.data.map((row) => (
                <article className="void-request-card" key={row.id}>
                  <div className="void-request-head">
                    <h2>
                      {t("Factura")} {row.sale.number}
                    </h2>
                    <Badge
                      tone={
                        row.status === "pending"
                          ? "warning"
                          : row.status === "approved"
                            ? "success"
                            : "danger"
                      }
                    >
                      {t(states[row.status] ?? row.status)}
                    </Badge>
                  </div>
                  <p>
                    {dateLabel(row.requestedAt, english ? "en-US" : "es-DO")}{" "}
                    {t("· Solicitó")} {row.requester.name}
                  </p>
                  <p>
                    <strong>{t("Cliente:")}</strong>{" "}
                    {row.sale.customer || t("Sin nombre")} ·{" "}
                    <strong>{t("Total:")}</strong>{" "}
                    {row.sale.hiddenUntilClose ? (
                      "—"
                    ) : (
                      <span className="operational-aux-money">
                        {formatMoney(row.sale.total)}
                      </span>
                    )}
                  </p>
                  <p>
                    <strong>{t("Motivo:")}</strong> {row.reason}
                  </p>
                  <h3>{t("Artículos")}</h3>
                  <ul>
                    {row.sale.items.map((item: any, index: number) => (
                      <li key={index}>
                        {item.name} · {item.sku} · {item.qty} ·{" "}
                        {row.sale.hiddenUntilClose ? (
                          "—"
                        ) : (
                          <span className="operational-aux-money">
                            {formatMoney(item.lineTotal)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <h3>{t("Pagos")}</h3>
                  <ul>
                    {row.sale.payments.map((payment: any, index: number) => (
                      <li key={index}>
                        {t(METHOD_LABEL[payment.method] ?? payment.method)} ·{" "}
                        <span className="operational-aux-money">
                          {formatMoney(payment.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {row.approvalBlocker && row.status === "pending" && (
                    <p role="status" className="danger-text">
                      {t("No se puede aprobar:")} {row.approvalBlocker}
                    </p>
                  )}
                  {row.resolutionNote && (
                    <p>
                      <strong>{t("Nota:")}</strong> {row.resolutionNote}
                    </p>
                  )}
                  {row.reviewer && (
                    <p>
                      {t("Revisó")} {row.reviewer.name} ·{" "}
                      {dateLabel(row.reviewedAt, english ? "en-US" : "es-DO")}
                    </p>
                  )}
                  {row.status === "pending" && (
                    <div className="void-request-actions">
                      {admin ? (
                        <>
                          <Button
                            onClick={() => setApproving(row)}
                            disabled={!!row.approvalBlocker}
                          >
                            {t("Aprobar y anular")}
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setRejecting(row)}
                          >
                            {t("Rechazar")}
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={async () => {
                            try {
                              await post(
                                "/void-requests/" + row.id + "/cancel",
                                {},
                              );
                              await refresh();
                              toast("Solicitud cancelada.");
                            } catch (error: any) {
                              toast(error.message, true);
                            }
                          }}
                        >
                          {t("Cancelar solicitud")}
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>{t("No hay solicitudes en este estado.")}</p>
          )}
        </QueryState>
      </div>
      {approving && (
        <Modal
          closeLabel={english ? "Close" : "Cerrar"}
          open
          title={t("Aprobar solicitud · ") + approving.sale.number}
          onClose={() => setApproving(null)}
        >
          <p>
            {t(
              "Se anulará la venta y se revertirán sus movimientos. Si la caja original cerró y hubo efectivo, abre tu caja para el reembolso.",
            )}
          </p>
          {approvalError && (
            <p role="alert" className="danger-text">
              {approvalError}
            </p>
          )}
          <div className="void-request-actions">
            <Button variant="secondary" onClick={() => setApproving(null)}>
              {t("Cancelar")}
            </Button>
            <Button
              disabled={approvalBusy}
              onClick={async () => {
                setApprovalBusy(true);
                setApprovalError("");
                try {
                  await post("/void-requests/" + approving.id + "/approve", {});
                  await refresh();
                  setApproving(null);
                  toast("Solicitud aprobada; venta anulada.");
                } catch (error: any) {
                  setApprovalError(error.message);
                } finally {
                  setApprovalBusy(false);
                }
              }}
            >
              {t("Sí, aprobar y anular")}
            </Button>
          </div>
        </Modal>
      )}
      {rejecting && (
        <FormModal
          english={english}
          title={t("Rechazar solicitud · ") + rejecting.sale.number}
          fields={[
            {
              key: "note",
              label: t("Nota obligatoria para la solicitante"),
              type: "textarea",
              required: true,
            },
          ]}
          onClose={() => setRejecting(null)}
          onSubmit={async (data) => {
            await post("/void-requests/" + rejecting.id + "/reject", {
              note: data.note,
            });
            await refresh();
          }}
        />
      )}
    </section>
  );
}
