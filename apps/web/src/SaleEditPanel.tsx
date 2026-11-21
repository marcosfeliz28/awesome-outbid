import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@fitstore/ui";
import { api } from "./api";
import { useLanguage } from "./inicioLanguage";

// Anclas temporales para regenerar docs/sistema después de mezclar esta rama:
// <h3>Corregir factura</h3>
// {sale.wholesale ? "Quitar «al por mayor»" : "Marcar «al por mayor»"}

// Orden de la dueña (18-oct): corregir vendedora y «al por mayor» de una
// factura vigente, hasta 7 días después. Solo administración; nunca borra.
export const EDIT_DAYS = 7;
export const editableNow = (sale: { status: string; createdAt: string }) =>
  sale.status === "completed" &&
  Date.now() - new Date(sale.createdAt).getTime() <= EDIT_DAYS * 86400000;

// Métodos que se pueden corregir después de la venta (dueña, 23-oct).
const PAYMENT_METHODS: Record<string, { es: string; en: string }> = {
  cash: { es: "Efectivo", en: "Cash" },
  card: { es: "Tarjeta", en: "Card" },
  transfer: { es: "Transferencia", en: "Transfer" },
  cod: { es: "Contraentrega", en: "Cash on delivery" },
  credit: { es: "Crédito", en: "Credit" },
};

export type CorrectMethodPayment = {
  id: string;
  method: string;
  cashSessionId?: string | null;
};

export type CashSessionOption = {
  id: string;
  openedAt: string;
  closedAt?: string | null;
  registerName?: string | null;
  userName?: string | null;
};

export const openCashSessions = (sessions: CashSessionOption[]) =>
  sessions.filter((session) => !session.closedAt);

export const needsCashDestination = (
  payment: CorrectMethodPayment,
  method: string,
) => method === "cash" && !payment.cashSessionId;

export function buildCorrectMethodPayload({
  payment,
  method,
  bank,
  reference,
  cashSessionId,
  ownerConfirmed,
}: {
  payment: CorrectMethodPayment;
  method: string;
  bank?: string;
  reference?: string;
  cashSessionId?: string;
  ownerConfirmed?: boolean;
}) {
  return {
    method,
    ...(method === "transfer" ? { bank, reference } : {}),
    ...(needsCashDestination(payment, method)
      ? cashSessionId
        ? { cashSessionId }
        : ownerConfirmed
          ? { ownerConfirmed: true }
          : {}
      : {}),
  };
}

export function SaleEditPanel({
  sale,
  onSaved,
}: {
  sale: {
    id: string;
    sellerId: string;
    wholesale: boolean;
    payments?: {
      id: string;
      method: string;
      amount: string | number;
      entryType: string;
      status: string;
      cashSessionId?: string | null;
    }[];
  };
  onSaved: (change: { sellerId?: string; wholesale?: boolean }) => void;
}) {
  const english = useLanguage() === "en";
  const staff = useQuery({
    queryKey: ["staff"],
    queryFn: () => api<{ id: string; name: string }[]>("/staff"),
  });
  const cashSessions = useQuery({
    queryKey: ["cash-sessions"],
    queryFn: () => api<CashSessionOption[]>("/cash-sessions"),
  });
  const [sellerId, setSellerId] = useState(sale.sellerId);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [bank, setBank] = useState("");
  const [reference, setReference] = useState("");
  const [cashSessionIds, setCashSessionIds] = useState<Record<string, string>>(
    {},
  );
  const [ownerConfirmations, setOwnerConfirmations] = useState<
    Record<string, boolean>
  >({});
  const availableCashSessions = openCashSessions(cashSessions.data ?? []);
  const salePayments = (sale.payments ?? []).filter(
    (p) =>
      p.entryType === "sale" &&
      p.status !== "rejected" &&
      p.method in PAYMENT_METHODS,
  );
  const send = async (path: string, body: object) => {
    if (reason.trim().length < 3) {
      setError(
        english
          ? "Enter the reason for the change."
          : "Escribe el motivo del cambio.",
      );
      return false;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/sales/${sale.id}/${path}`, {
        method: "POST",
        body: JSON.stringify({ ...body, reason: reason.trim() }),
      });
      setReason("");
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : english
            ? "The change could not be saved."
            : "No se pudo guardar.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="panel">
      <h3>{english ? "Correct invoice" : "Corregir factura"}</h3>
      <p>
        {english
          ? "Available for 7 days after the sale. The change is recorded in the audit log."
          : "Hasta 7 días después de la venta. Queda en la bitácora."}
      </p>
      <label className="field">
        <span>{english ? "Reason" : "Motivo"}</span>
        <input
          value={reason}
          maxLength={200}
          disabled={busy}
          placeholder={
            english
              ? "Example: Manuela made the sale"
              : "Ej.: la vendió Manuela"
          }
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      <label className="field">
        <span>{english ? "Salesperson" : "Vendedora"}</span>
        <select
          value={sellerId}
          disabled={busy || !staff.data}
          onChange={(event) => setSellerId(event.target.value)}
        >
          {(staff.data ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      <div className="row">
        <Button
          disabled={busy || sellerId === sale.sellerId}
          onClick={async () => {
            if (await send("seller", { sellerId })) onSaved({ sellerId });
          }}
        >
          {english ? "Change salesperson" : "Cambiar vendedora"}
        </Button>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            const wholesale = !sale.wholesale;
            if (await send("mark-wholesale", { wholesale }))
              onSaved({ wholesale });
          }}
        >
          {sale.wholesale
            ? english
              ? "Remove wholesale mark"
              : "Quitar «al por mayor»"
            : english
              ? "Mark as wholesale"
              : "Marcar «al por mayor»"}
        </Button>
      </div>
      {salePayments.map((p) => {
        const method = methods[p.id] ?? p.method;
        const needsDestination = needsCashDestination(p, method);
        const cashSessionId = cashSessionIds[p.id] ?? "";
        const ownerConfirmed = ownerConfirmations[p.id] ?? false;
        const destinationHelpId = `cash-destination-help-${p.id}`;
        return (
          <div className="row" key={p.id}>
            <label className="field">
              <span>
                {english ? "Payment of" : "Pago de"}{" "}
                {Number(p.amount).toFixed(2)} (
                {PAYMENT_METHODS[p.method]?.[english ? "en" : "es"] ?? p.method}
                )
              </span>
              <select
                value={method}
                disabled={busy}
                onChange={(event) =>
                  setMethods({ ...methods, [p.id]: event.target.value })
                }
              >
                {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label[english ? "en" : "es"]}
                  </option>
                ))}
              </select>
            </label>
            {method === "transfer" && method !== p.method && (
              <>
                <label className="field">
                  <span>{english ? "Bank" : "Banco"}</span>
                  <input
                    value={bank}
                    maxLength={80}
                    disabled={busy}
                    onChange={(event) => setBank(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>{english ? "Reference" : "Referencia"}</span>
                  <input
                    value={reference}
                    maxLength={120}
                    disabled={busy}
                    onChange={(event) => setReference(event.target.value)}
                  />
                </label>
              </>
            )}
            {needsDestination && (
              <fieldset className="field" aria-describedby={destinationHelpId}>
                <legend>
                  {english
                    ? "Where was the cash received?"
                    : "¿Dónde se recibió el efectivo?"}
                </legend>
                <p id={destinationHelpId}>
                  {english
                    ? "Choose an open register or confirm that the owner received the cash."
                    : "Elige una caja abierta o confirma que la dueña recibió el efectivo."}
                </p>
                <label className="field">
                  <span>{english ? "Open register" : "Caja abierta"}</span>
                  <select
                    value={cashSessionId}
                    disabled={busy || cashSessions.isPending || ownerConfirmed}
                    onChange={(event) => {
                      const value = event.target.value;
                      setCashSessionIds({
                        ...cashSessionIds,
                        [p.id]: value,
                      });
                      if (value)
                        setOwnerConfirmations({
                          ...ownerConfirmations,
                          [p.id]: false,
                        });
                    }}
                  >
                    <option value="">
                      {cashSessions.isPending
                        ? english
                          ? "Loading open registers…"
                          : "Cargando cajas abiertas…"
                        : availableCashSessions.length
                          ? english
                            ? "Select an open register"
                            : "Selecciona una caja abierta"
                          : english
                            ? "No open registers"
                            : "No hay cajas abiertas"}
                    </option>
                    {availableCashSessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.registerName ??
                          (english ? "Register" : "Caja")}
                        {session.userName ? ` · ${session.userName}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {cashSessions.isError && (
                  <p className="reconciliation-error" role="alert">
                    {english
                      ? "Open registers could not be loaded. You may confirm that the owner received the cash."
                      : "No se pudieron cargar las cajas abiertas. Puedes confirmar que la dueña recibió el efectivo."}
                  </p>
                )}
                <label className="field">
                  <span>
                    <input
                      type="checkbox"
                      checked={ownerConfirmed}
                      disabled={busy}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setOwnerConfirmations({
                          ...ownerConfirmations,
                          [p.id]: checked,
                        });
                        if (checked)
                          setCashSessionIds({
                            ...cashSessionIds,
                            [p.id]: "",
                          });
                      }}
                    />{" "}
                    {english
                      ? "The owner received this cash outside a register"
                      : "La dueña recibió este efectivo fuera de una caja"}
                  </span>
                </label>
              </fieldset>
            )}
            <Button
              variant="secondary"
              disabled={busy || method === p.method}
              onClick={async () => {
                if (needsDestination && !cashSessionId && !ownerConfirmed) {
                  setError(
                    english
                      ? "Choose the open register that received the cash or confirm that the owner received it."
                      : "Elige la caja abierta que recibió el efectivo o confirma que lo recibió la dueña.",
                  );
                  return;
                }
                if (
                  await send(
                    `payments/${p.id}/correct-method`,
                    buildCorrectMethodPayload({
                      payment: p,
                      method,
                      bank,
                      reference,
                      cashSessionId,
                      ownerConfirmed,
                    }),
                  )
                )
                  onSaved({});
              }}
            >
              {english ? "Change payment method" : "Cambiar método de pago"}
            </Button>
          </div>
        );
      })}
      {error && (
        <p className="reconciliation-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
