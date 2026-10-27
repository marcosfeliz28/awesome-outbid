import { useState } from "react";
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
    <section className="void-requests-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">VENTAS</div>
          <h1>Solicitudes de anulación</h1>
          <p>
            {admin
              ? "Revisa cada solicitud antes de decidir."
              : "Consulta el estado de tus solicitudes."}
          </p>
        </div>
      </div>
      <div className="panel">
        <label className="field">
          <span>Estado</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="pending">Pendientes</option>
            <option value="all">Todas</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </label>
        <QueryState query={query}>
          {query.data?.length ? (
            <div className="void-request-grid">
              {query.data.map((row) => (
                <article className="void-request-card" key={row.id}>
                  <div className="void-request-head">
                    <h2>Factura {row.sale.number}</h2>
                    <Badge
                      tone={
                        row.status === "pending"
                          ? "warning"
                          : row.status === "approved"
                            ? "success"
                            : "danger"
                      }
                    >
                      {states[row.status] ?? row.status}
                    </Badge>
                  </div>
                  <p>
                    {dateLabel(row.requestedAt)} · Solicitó {row.requester.name}
                  </p>
                  <p>
                    <strong>Cliente:</strong>{" "}
                    {row.sale.customer || "Sin nombre"}
                  </p>
                  <p>
                    <strong>Motivo:</strong> {row.reason}
                  </p>
                  {row.sale.hiddenUntilClose ? (
                    <p role="status">
                      Total, artículos y pagos ocultos hasta cerrar tu caja.
                    </p>
                  ) : (
                    <>
                      <p>
                        <strong>Total:</strong> {formatMoney(row.sale.total)}
                      </p>
                      <h3>Artículos</h3>
                      <ul>
                        {(row.sale.items ?? []).map(
                          (item: any, index: number) => (
                            <li key={index}>
                              {item.name} · {item.sku} · {item.qty} ·{" "}
                              {formatMoney(item.lineTotal)}
                            </li>
                          ),
                        )}
                      </ul>
                      <h3>Pagos</h3>
                      <ul>
                        {(row.sale.payments ?? []).map(
                          (payment: any, index: number) => (
                            <li key={index}>
                              {payment.method} · {formatMoney(payment.amount)}
                            </li>
                          ),
                        )}
                      </ul>
                    </>
                  )}
                  {row.approvalBlocker && row.status === "pending" && (
                    <p role="status" className="danger-text">
                      No se puede aprobar: {row.approvalBlocker}
                    </p>
                  )}
                  {row.resolutionNote && (
                    <p>
                      <strong>Nota:</strong> {row.resolutionNote}
                    </p>
                  )}
                  {row.reviewer && (
                    <p>
                      Revisó {row.reviewer.name} · {dateLabel(row.reviewedAt)}
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
                            Aprobar y anular
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setRejecting(row)}
                          >
                            Rechazar
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
                          Cancelar solicitud
                        </Button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p>No hay solicitudes en este estado.</p>
          )}
        </QueryState>
      </div>
      {approving && (
        <Modal
          open
          title={"Aprobar solicitud · " + approving.sale.number}
          onClose={() => setApproving(null)}
        >
          <p>
            Se anulará la venta y se revertirán sus movimientos. Si la caja
            original cerró y hubo efectivo, abre tu caja para el reembolso.
          </p>
          {approvalError && (
            <p role="alert" className="danger-text">
              {approvalError}
            </p>
          )}
          <div className="void-request-actions">
            <Button variant="secondary" onClick={() => setApproving(null)}>
              Cancelar
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
              Sí, aprobar y anular
            </Button>
          </div>
        </Modal>
      )}
      {rejecting && (
        <FormModal
          title={"Rechazar solicitud · " + rejecting.sale.number}
          fields={[
            {
              key: "note",
              label: "Nota obligatoria para la solicitante",
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
