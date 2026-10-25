import { useRef, useState, type PointerEvent } from "react";

import "./ApprovalDeck.css";

export type VoidApproval = {
  id: string;
  invoice: string;
  requestedAt: string;
  requestedBy: string;
  reason: string;
  requiresPin?: boolean;
  approvalBlocker?: string | null;
};

export type TransferApproval = {
  id: string;
  invoice: string;
  createdAt: string;
  customer?: string | null;
  amount: string | number;
  bank?: string | null;
  reference?: string | null;
};

export type ApprovalDeckItem =
  | (VoidApproval & { kind: "void"; occurredAt: string })
  | (TransferApproval & { kind: "transfer"; occurredAt: string });

export type ApprovalDeckProps = {
  voidRequests: VoidApproval[];
  pendingTransfers: TransferApproval[];
  onOpenDetail: (item: ApprovalDeckItem) => void;
  onApproveVoid: (
    item: VoidApproval,
    input: { managerPin?: string },
  ) => Promise<void>;
  onRejectVoid: (item: VoidApproval, input: { note: string }) => Promise<void>;
  onVerifyTransfer: (item: TransferApproval) => Promise<void>;
  onRejectTransfer: (
    item: TransferApproval,
    input: { reason: string },
  ) => Promise<void>;
};

export type ApprovalDeckGesture =
  "click" | "keyboard" | "swipe-left" | "swipe-right";

export const approvalDeckGestureIntent = (_gesture: ApprovalDeckGesture) =>
  "open-detail" as const;

export const validApprovalRejectReason = (reason: string) =>
  reason.trim().length >= 8;

export function buildApprovalDeckQueue({
  voidRequests,
  pendingTransfers,
}: Pick<ApprovalDeckProps, "voidRequests" | "pendingTransfers">) {
  return [
    ...voidRequests.map((item): ApprovalDeckItem => ({
      ...item,
      kind: "void",
      occurredAt: item.requestedAt,
    })),
    ...pendingTransfers.map((item): ApprovalDeckItem => ({
      ...item,
      kind: "transfer",
      occurredAt: item.createdAt,
    })),
  ].sort(
    (left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
  );
}

const money = new Intl.NumberFormat("es-DO", {
  style: "currency",
  currency: "DOP",
});

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("es-DO", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santo_Domingo",
  }).format(new Date(value));

type Decision = "approve" | "reject" | null;

export function ApprovalDeck(props: ApprovalDeckProps) {
  const queue = buildApprovalDeckQueue(props);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision>(null);
  const [reason, setReason] = useState("");
  const [managerPin, setManagerPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pointerStarts = useRef<Record<string, number>>({});

  const active = queue.find((item) => item.id === activeId) ?? null;
  const resetDecision = () => {
    setDecision(null);
    setReason("");
    setManagerPin("");
    setMessage("");
  };
  const openDetail = (item: ApprovalDeckItem) => {
    resetDecision();
    props.onOpenDetail(item);
  };
  const startDecision = (
    item: ApprovalDeckItem,
    next: Exclude<Decision, null>,
  ) => {
    setActiveId(item.id);
    setDecision(next);
    setReason("");
    setManagerPin("");
    setMessage("");
  };
  const finish = async () => {
    if (!active || !decision || busy) return;
    if (decision === "reject" && !validApprovalRejectReason(reason)) return;
    if (
      decision === "approve" &&
      active.kind === "void" &&
      active.requiresPin &&
      !/^\d{4,6}$/.test(managerPin)
    )
      return;

    setBusy(true);
    setMessage("");
    try {
      if (decision === "approve") {
        if (active.kind === "void") {
          await props.onApproveVoid(active, {
            ...(active.requiresPin ? { managerPin } : {}),
          });
        } else {
          await props.onVerifyTransfer(active);
        }
      } else if (active.kind === "void") {
        await props.onRejectVoid(active, { note: reason.trim() });
      } else {
        await props.onRejectTransfer(active, { reason: reason.trim() });
      }
      setMessage(
        decision === "approve"
          ? active.kind === "void"
            ? "Anulación aprobada."
            : "Transferencia verificada."
          : "Solicitud rechazada con motivo.",
      );
      setDecision(null);
      setReason("");
      setManagerPin("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo completar la acción.",
      );
    } finally {
      setBusy(false);
    }
  };
  const rememberPointer = (item: ApprovalDeckItem, event: PointerEvent) => {
    pointerStarts.current[item.id] = event.clientX;
  };
  const openAfterSwipe = (item: ApprovalDeckItem, event: PointerEvent) => {
    const start = pointerStarts.current[item.id];
    delete pointerStarts.current[item.id];
    if (Number.isFinite(start) && Math.abs(event.clientX - start) >= 36) {
      openDetail(item);
    }
  };

  return (
    <section className="approval-deck" aria-labelledby="approval-deck-title">
      <header className="approval-deck__header">
        <div>
          <p className="approval-deck__eyebrow">ADMINISTRACIÓN</p>
          <h2 id="approval-deck-title">Aprobaciones pendientes</h2>
        </div>
        <span
          className="approval-deck__count"
          aria-label={`${queue.length} pendientes`}
        >
          {queue.length}
        </span>
      </header>
      <p className="approval-deck__help">
        Tocar, pulsar o deslizar solo abre el detalle; no aprueba ni rechaza.
      </p>

      {queue.length === 0 ? (
        <p className="approval-deck__empty">No hay decisiones pendientes.</p>
      ) : (
        <div className="approval-deck__stack">
          {queue.map((item) => (
            <article
              className="approval-deck__card"
              data-kind={item.kind}
              key={`${item.kind}:${item.id}`}
              onPointerDown={(event) => rememberPointer(item, event)}
              onPointerUp={(event) => openAfterSwipe(item, event)}
            >
              <button
                className="approval-deck__detail"
                type="button"
                onClick={() => openDetail(item)}
                aria-label={`Abrir detalle de ${item.invoice}`}
              >
                <span className="approval-deck__kind">
                  {item.kind === "void"
                    ? "Solicitud de anulación"
                    : "Transferencia por verificar"}
                </span>
                <strong>{item.invoice}</strong>
                <span>{dateTime(item.occurredAt)}</span>
                {item.kind === "void" ? (
                  <span>
                    {item.requestedBy} · {item.reason}
                  </span>
                ) : (
                  <span>
                    <span data-private-value>
                      {money.format(Number(item.amount))}
                    </span>{" "}
                    · {item.bank || "Otro banco"}
                    {item.reference
                      ? ` · Ref. ${item.reference}`
                      : " · Sin referencia"}
                  </span>
                )}
                <span className="approval-deck__open">Abrir detalle</span>
              </button>

              {item.kind === "void" && item.approvalBlocker && (
                <p className="approval-deck__blocker" role="status">
                  No se puede aprobar: {item.approvalBlocker}
                </p>
              )}

              <div className="approval-deck__actions">
                <button
                  type="button"
                  className="approval-deck__primary"
                  disabled={
                    busy ||
                    (item.kind === "void" && Boolean(item.approvalBlocker))
                  }
                  onClick={() => startDecision(item, "approve")}
                >
                  {item.kind === "void"
                    ? "Aprobar anulación"
                    : "Verificar transferencia"}
                </button>
                <button
                  type="button"
                  className="approval-deck__secondary"
                  disabled={busy}
                  onClick={() => startDecision(item, "reject")}
                >
                  Rechazar
                </button>
              </div>

              {activeId === item.id && decision && (
                <form
                  className="approval-deck__decision"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void finish();
                  }}
                >
                  <p>
                    {decision === "approve"
                      ? item.kind === "void"
                        ? "Confirma que revisaste la venta antes de anularla."
                        : "Confirma que el dinero aparece en el banco."
                      : "Escribe por qué rechazas esta solicitud."}
                  </p>
                  {decision === "approve" &&
                    item.kind === "void" &&
                    item.requiresPin && (
                      <label>
                        <span>PIN de gerente</span>
                        <input
                          autoComplete="off"
                          inputMode="numeric"
                          minLength={4}
                          maxLength={6}
                          pattern="[0-9]{4,6}"
                          required
                          type="password"
                          value={managerPin}
                          onChange={(event) =>
                            setManagerPin(event.target.value)
                          }
                        />
                      </label>
                    )}
                  {decision === "reject" && (
                    <label>
                      <span>Motivo del rechazo</span>
                      <textarea
                        autoFocus
                        required
                        minLength={8}
                        maxLength={1000}
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                      />
                    </label>
                  )}
                  <div className="approval-deck__actions">
                    <button
                      type="submit"
                      className="approval-deck__primary"
                      disabled={
                        busy ||
                        (decision === "reject" &&
                          !validApprovalRejectReason(reason)) ||
                        (decision === "approve" &&
                          item.kind === "void" &&
                          Boolean(item.requiresPin) &&
                          !/^\d{4,6}$/.test(managerPin))
                      }
                    >
                      {busy
                        ? "Procesando…"
                        : decision === "approve"
                          ? "Confirmar"
                          : "Confirmar rechazo"}
                    </button>
                    <button
                      type="button"
                      className="approval-deck__secondary"
                      disabled={busy}
                      onClick={resetDecision}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
        </div>
      )}

      {message && (
        <p
          className="approval-deck__message"
          role={/no se pudo/i.test(message) ? "alert" : "status"}
          aria-live="polite"
        >
          {message}
        </p>
      )}
    </section>
  );
}
