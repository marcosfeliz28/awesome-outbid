import { useState, type FormEvent } from "react";
import { Button, Modal } from "@fitstore/ui";
import { formatMoney } from "@fitstore/shared";
import { post } from "./api";
import {
  cashSessionComparisons,
  serializePaymentReplacement,
  type PaymentReplacementDraft,
  type PaymentReplacementResult,
  type ReplacementPaymentDraft,
} from "./salePaymentReplacement";

type Sale = {
  id: string;
  number: string;
  cashSessionId?: string | null;
  payments?: Record<string, any>[];
};

type Result = PaymentReplacementResult & {
  ok: true;
  number: string;
  total: number;
};

const blankPayment = (cashSessionId = ""): ReplacementPaymentDraft => ({
  method: "cash",
  amount: "",
  currency: "DOP",
  cashSessionId,
});

const initialPayments = (sale: Sale): ReplacementPaymentDraft[] => {
  const rows = (sale.payments ?? [])
    .filter(
      (payment) =>
        ["cash", "card", "transfer"].includes(payment.method) &&
        (!payment.entryType || payment.entryType === "sale"),
    )
    .map((payment) => ({
      method: payment.method,
      amount: String(payment.amount ?? ""),
      currency:
        payment.currency === "USD" || payment.amountUsd != null ? "USD" : "DOP",
      amountUsd: payment.amountUsd == null ? "" : String(payment.amountUsd),
      usdRate: payment.usdRate == null ? "" : String(payment.usdRate),
      cashSessionId: payment.cashSessionId ?? sale.cashSessionId ?? "",
      bank: payment.bank ?? "",
      reference: payment.reference ?? "",
      approvalCode: payment.approvalCode ?? "",
      cardLast4: payment.cardLast4 ?? "",
      cardBrand: payment.cardBrand ?? "",
      cardType: payment.cardType ?? "",
    })) as ReplacementPaymentDraft[];
  return rows.length ? rows : [blankPayment(sale.cashSessionId ?? "")];
};

const comparisonValue = (
  value: number | string | null,
  currency: "DOP" | "USD",
  english: boolean,
) => {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  if (currency === "DOP") return formatMoney(number);
  return `US$ ${number.toLocaleString(english ? "en-US" : "es-DO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

export function SalePaymentReplacement({
  sale,
  operationId,
  english,
  onClose,
  onSaved,
}: {
  sale: Sale;
  operationId: string;
  english: boolean;
  onClose: () => void;
  onSaved: (result: Result) => void;
}) {
  const [draft, setDraft] = useState<PaymentReplacementDraft>(() => ({
    operationId,
    reason: "",
    ownerConfirmed: false,
    payments: initialPayments(sale),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const text = (es: string, en: string) => (english ? en : es);
  const sessions = [
    ...new Set(
      [
        sale.cashSessionId,
        ...(sale.payments ?? []).map((payment) => payment.cashSessionId),
      ].filter((id): id is string => typeof id === "string" && !!id),
    ),
  ];
  const comparisons = result ? cashSessionComparisons(result, english) : [];

  const updatePayment = (
    index: number,
    patch: Partial<ReplacementPaymentDraft>,
  ) =>
    setDraft((current) => ({
      ...current,
      payments: current.payments.map((payment, position) =>
        position === index ? { ...payment, ...patch } : payment,
      ),
    }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await post<Result>(
        `/sales/${sale.id}/payments/replace`,
        serializePaymentReplacement(draft),
      );
      setResult(response);
      onSaved(response);
    } catch (caught: any) {
      setError(
        caught?.message ??
          text(
            "No se pudieron corregir los pagos.",
            "The payments could not be corrected.",
          ),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      wide
      closeLabel={text("Cerrar", "Close")}
      hasData={!result}
      onClose={onClose}
      title={`${text("Corregir pagos", "Correct payments")} · ${sale.number}`}
    >
      {result ? (
        <div aria-live="polite">
          <p>
            <strong>{text("Pagos corregidos.", "Payments corrected.")}</strong>{" "}
            {text(
              "Esta comparación es la respuesta registrada por el servidor.",
              "This comparison is the response recorded by the server.",
            )}
          </p>
          {comparisons.length ? (
            comparisons.map((comparison) => (
              <section className="panel" key={comparison.id}>
                <h3>
                  {comparison.kindLabel} · {comparison.id}
                </h3>
                <div
                  className="table-wrap"
                  tabIndex={0}
                  role="region"
                  aria-label={`${comparison.kindLabel} ${comparison.id}`}
                >
                  <table>
                    <thead>
                      <tr>
                        <th>{text("Concepto", "Item")}</th>
                        <th>{text("Antes", "Before")}</th>
                        <th>{text("Después", "After")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.rows.map((row) => (
                        <tr key={row.key}>
                          <th>{row.label}</th>
                          <td>
                            {comparisonValue(row.before, row.currency, english)}
                          </td>
                          <td>
                            {comparisonValue(row.after, row.currency, english)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))
          ) : (
            <p>
              {text(
                "La respuesta no incluyó cambios de caja.",
                "The response did not include register changes.",
              )}
            </p>
          )}
          <div className="modal-footer">
            <Button onClick={onClose}>{text("Cerrar", "Close")}</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit}>
          <p>
            {text(
              "Reemplaza todos los pagos de esta venta. Los importes se envían tal como los escribes; el servidor valida el total, la tasa y la caja.",
              "Replace every payment for this sale. Amounts are sent exactly as entered; the server validates the total, exchange rate and register.",
            )}
          </p>
          {draft.payments.map((payment, index) => (
            <fieldset className="panel" key={index} disabled={busy}>
              <legend>
                {text("Pago", "Payment")} {index + 1}
              </legend>
              <div className="form-grid">
                <label className="field">
                  <span>{text("Método", "Method")}</span>
                  <select
                    value={payment.method}
                    onChange={(event) => {
                      const method = event.target
                        .value as ReplacementPaymentDraft["method"];
                      updatePayment(index, {
                        method,
                        ...(method === "cash"
                          ? {}
                          : {
                              currency: "DOP",
                              amountUsd: "",
                              usdRate: "",
                            }),
                      });
                    }}
                  >
                    <option value="cash">{text("Efectivo", "Cash")}</option>
                    <option value="card">{text("Tarjeta", "Card")}</option>
                    <option value="transfer">
                      {text("Transferencia", "Transfer")}
                    </option>
                  </select>
                </label>
                <label className="field">
                  <span>
                    {text("Monto aplicado (RD$)", "Applied amount (RD$)")}
                  </span>
                  <input
                    required
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    type="number"
                    value={payment.amount}
                    onChange={(event) =>
                      updatePayment(index, { amount: event.target.value })
                    }
                  />
                </label>
                {payment.method === "cash" && (
                  <label className="field">
                    <span>{text("Moneda", "Currency")}</span>
                    <select
                      value={payment.currency}
                      onChange={(event) =>
                        updatePayment(index, {
                          currency: event.target
                            .value as ReplacementPaymentDraft["currency"],
                        })
                      }
                    >
                      <option value="DOP">DOP</option>
                      <option value="USD">USD</option>
                    </select>
                  </label>
                )}
                {payment.method === "cash" && payment.currency === "USD" && (
                  <>
                    <label className="field">
                      <span>{text("US$ recibidos", "US$ received")}</span>
                      <input
                        required
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        type="number"
                        value={payment.amountUsd ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            amountUsd: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{text("Tasa USD", "USD rate")}</span>
                      <input
                        required
                        min="0.0001"
                        step="0.0001"
                        inputMode="decimal"
                        type="number"
                        value={payment.usdRate ?? ""}
                        onChange={(event) =>
                          updatePayment(index, { usdRate: event.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {payment.method === "cash" && (
                  <label className="field full">
                    <span>{text("Caja", "Register")}</span>
                    {sessions.length ? (
                      <select
                        value={payment.cashSessionId ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            cashSessionId: event.target.value,
                          })
                        }
                      >
                        <option value="">
                          {text(
                            "Usar la caja de la venta",
                            "Use the sale register",
                          )}
                        </option>
                        {sessions.map((id) => (
                          <option key={id} value={id}>
                            {id}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={payment.cashSessionId ?? ""}
                        placeholder={text("UUID de la caja", "Register UUID")}
                        onChange={(event) =>
                          updatePayment(index, {
                            cashSessionId: event.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                )}
                {payment.method === "card" && (
                  <>
                    <label className="field">
                      <span>
                        {text("Código de aprobación", "Approval code")}
                      </span>
                      <input
                        required={!payment.reference?.trim()}
                        maxLength={100}
                        value={payment.approvalCode ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            approvalCode: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{text("Referencia", "Reference")}</span>
                      <input
                        maxLength={100}
                        value={payment.reference ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            reference: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{text("Últimos 4 dígitos", "Last 4 digits")}</span>
                      <input
                        inputMode="numeric"
                        maxLength={4}
                        pattern="[0-9]{4}"
                        value={payment.cardLast4 ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            cardLast4: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{text("Marca", "Brand")}</span>
                      <input
                        maxLength={40}
                        value={payment.cardBrand ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            cardBrand: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{text("Tipo de tarjeta", "Card type")}</span>
                      <select
                        value={payment.cardType ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            cardType: event.target
                              .value as ReplacementPaymentDraft["cardType"],
                          })
                        }
                      >
                        <option value="">
                          {text("Sin indicar", "Not set")}
                        </option>
                        <option value="credit">
                          {text("Crédito", "Credit")}
                        </option>
                        <option value="debit">{text("Débito", "Debit")}</option>
                      </select>
                    </label>
                  </>
                )}
                {payment.method === "transfer" && (
                  <>
                    <label className="field">
                      <span>{text("Banco", "Bank")}</span>
                      <input
                        required
                        maxLength={100}
                        value={payment.bank ?? ""}
                        onChange={(event) =>
                          updatePayment(index, { bank: event.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>{text("Referencia", "Reference")}</span>
                      <input
                        required
                        maxLength={100}
                        value={payment.reference ?? ""}
                        onChange={(event) =>
                          updatePayment(index, {
                            reference: event.target.value,
                          })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              {draft.payments.length > 1 && (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      payments: current.payments.filter(
                        (_, position) => position !== index,
                      ),
                    }))
                  }
                >
                  {text("Quitar pago", "Remove payment")} {index + 1}
                </Button>
              )}
            </fieldset>
          ))}
          <div className="table-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={busy || draft.payments.length >= 10}
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  payments: [
                    ...current.payments,
                    blankPayment(sale.cashSessionId ?? ""),
                  ],
                }))
              }
            >
              {text("Agregar pago", "Add payment")}
            </Button>
          </div>
          <label className="field">
            <span>{text("Motivo de la corrección", "Correction reason")}</span>
            <textarea
              required
              maxLength={500}
              value={draft.reason}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
            />
          </label>
          <label className="field">
            <input
              type="checkbox"
              checked={draft.ownerConfirmed}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  ownerConfirmed: event.target.checked,
                }))
              }
            />
            <span>
              {text(
                "La venta toca una caja cerrada y la dueña confirmó esta corrección",
                "The sale affects a closed register and the owner confirmed this correction",
              )}
            </span>
          </label>
          <p>
            <small>
              {text(
                "Marca esa confirmación solo cuando corresponda. Si el intento falla, se conserva la misma clave de operación para reintentar sin duplicar.",
                "Check that confirmation only when applicable. If the attempt fails, the same operation key is kept for a retry without duplication.",
              )}
            </small>
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-footer">
            <Button type="button" variant="secondary" onClick={onClose}>
              {text("Cancelar", "Cancel")}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy
                ? text("Guardando…", "Saving…")
                : text("Reemplazar pagos", "Replace payments")}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
