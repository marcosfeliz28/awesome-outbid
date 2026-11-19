import { useRef, useState } from "react";
import { Button } from "@fitstore/ui";
import { api } from "./api";
import { DEFAULT_COURIER, PRODUCT_MODE } from "./productTenancy";
import { courierPresets, feeText } from "./courier-utils";

export function CourierFeeEditor({
  saleId,
  initialFee,
  initialName,
  onSaved,
  disabled = false,
  english = false,
}: {
  saleId: string;
  initialFee: string;
  initialName?: string | null;
  onSaved: (fee: string, name: string) => void;
  disabled?: boolean;
  english?: boolean;
}) {
  const [fee, setFee] = useState(initialFee);
  const [name, setName] = useState(initialName || (PRODUCT_MODE ? "" : DEFAULT_COURIER));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const save = async () => {
    if (busy || disabled) return;
    try {
      const validFee = feeText(fee);
      if (!name.trim()) throw new Error("Escribe el nombre del mensajero.");
      if (reason.trim().length < 3)
        throw new Error("Escribe el motivo del cambio.");
      setBusy(true);
      setError("");
      const result = await api<{ courierFee: string; courierName: string }>(
        `/sales/${saleId}/courier`,
        {
          method: "PATCH",
          body: JSON.stringify({
            fee: validFee,
            courierName: name.trim(),
            reason: reason.trim(),
          }),
        },
      );
      onSaved(result.courierFee, result.courierName);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar el envío.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="courier-fee-editor">
      <label className="field">
        <span>{english ? "Delivery (RD$)" : "Envío (RD$)"}</span>
        <input
          ref={input}
          type="text"
          inputMode="decimal"
          value={fee}
          disabled={disabled || busy}
          onChange={(event) => setFee(event.target.value)}
          maxLength={8}
        />
      </label>
      <div
        className="courier-presets"
        aria-label={
          english ? "Quick delivery amounts" : "Importes rápidos de envío"
        }
      >
        {courierPresets.map((value) => (
          <button
            type="button"
            key={value}
            disabled={disabled || busy}
            onClick={() => setFee(String(value))}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => input.current?.focus()}
        >
          {english ? "Other" : "Otro"}
        </button>
      </div>
      <label className="field">
        <span>{english ? "Courier" : "Mensajero"}</span>
        <input
          value={name}
          maxLength={100}
          disabled={disabled || busy}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="field">
        <span>{english ? "Reason" : "Motivo"}</span>
        <input
          value={reason}
          maxLength={200}
          disabled={disabled || busy}
          placeholder={
            english
              ? "E.g.: courier charged 300"
              : "Ej.: el mensajero cobró 300"
          }
          onChange={(event) => setReason(event.target.value)}
        />
      </label>
      {error && (
        <p className="reconciliation-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={disabled || busy} onClick={() => void save()}>
        {busy
          ? english
            ? "Saving…"
            : "Guardando…"
          : english
            ? "Save delivery"
            : "Guardar envío"}
      </Button>
    </div>
  );
}
