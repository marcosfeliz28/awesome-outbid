import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@fitstore/ui";
import { api, post, useStore } from "./api";
import { businessErrorMessage } from "./managementMessages";
import { productTenancyRequired } from "./productTenancy";
import "./ncfSequenceSettings.css";

type Warning = { kind: "numbers" | "expiry"; message: string };
type Sequence = {
  id: string;
  type: string;
  authorizationReference: string;
  firstNumber: string;
  lastNumber: string;
  nextNumber: string;
  nextConfirmedAt: string;
  numberWidth: number;
  expiryApplies: boolean;
  expiresOn: string | null;
  active: boolean;
  warnings: Warning[];
  updatedAt: string;
};

const PRODUCT_MODE = productTenancyRequired(import.meta.env.VITE_PRODUCT_TENANCY);
const WITHOUT_EXPIRY = new Set(["B02", "B04", "B12"]);

function SequenceRow({
  sequence,
  busy,
  onUpdate,
}: {
  sequence: Sequence;
  busy: boolean;
  onUpdate: (id: string, change: { nextNumber?: string; active?: boolean }) => Promise<void>;
}) {
  const [nextNumber, setNextNumber] = useState(sequence.nextNumber);
  const hasChange = nextNumber !== sequence.nextNumber;
  return (
    <li className="ncf-sequence-row">
      <div className="ncf-sequence-heading">
        <strong>{sequence.type} · {sequence.firstNumber}–{sequence.lastNumber}</strong>
        <span>{sequence.active ? "Declarada activa" : "Inactiva"}</span>
      </div>
      <p>Referencia de autorización: {sequence.authorizationReference}</p>
      <p>
        Próximo número declarado: {sequence.nextNumber} ·{" "}
        Declarado el {new Date(sequence.nextConfirmedAt).toLocaleString("es-DO")} ·{" "}
        {sequence.expiryApplies && sequence.expiresOn
          ? `Fecha de vencimiento declarada: ${sequence.expiresOn}`
          : "Sin aviso de vencimiento"}
      </p>
      {sequence.warnings.map((warning) => (
        <p className="ncf-sequence-warning" key={warning.kind}>
          <AlertTriangle size={16} aria-hidden="true" /> {warning.message}
        </p>
      ))}
      <div className="ncf-sequence-actions">
        <label className="field">
          <span>Corregir próximo número declarado</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]+"
            minLength={sequence.numberWidth}
            maxLength={sequence.numberWidth + 1}
            value={nextNumber}
            disabled={!sequence.active || busy}
            onChange={(event) => setNextNumber(event.target.value)}
          />
        </label>
        <Button
          type="button"
          disabled={!sequence.active || !hasChange || busy}
          onClick={() => void onUpdate(sequence.id, { nextNumber })}
        >
          Guardar próximo
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={() => void onUpdate(sequence.id, { active: !sequence.active })}
        >
          {sequence.active ? "Desactivar" : "Reactivar"}
        </Button>
      </div>
    </li>
  );
}

function NcfSequenceSettingsContent() {
  const userId = useStore((state) => state.user?.id);
  const client = useQueryClient();
  const queryKey = ["ncf-sequences", userId];
  const sequences = useQuery<Sequence[]>({
    queryKey,
    queryFn: () => api<Sequence[]>("/ncf-sequences"),
    enabled: !!userId,
  });
  const [type, setType] = useState("");
  const [authorizationReference, setAuthorizationReference] = useState("");
  const [firstNumber, setFirstNumber] = useState("");
  const [lastNumber, setLastNumber] = useState("");
  const [nextNumber, setNextNumber] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const expiryApplies = type !== "" && !WITHOUT_EXPIRY.has(type);
  const numberWidth = type.startsWith("B") ? 8 : type.startsWith("E") ? 10 : 12;

  const refresh = async () => {
    await client.invalidateQueries({ queryKey });
    await client.invalidateQueries({ queryKey: ["alerts"] });
  };
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm("¿Los números y la fecha coinciden con la autorización de la DGII? Nexora no los verifica ni emite NCF.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await post("/ncf-sequences", {
        type,
        authorizationReference: authorizationReference.trim(),
        firstNumber,
        lastNumber,
        nextNumber,
        expiryApplies,
        expiresOn: expiryApplies ? expiresOn : null,
      });
      await refresh();
      setAuthorizationReference("");
      setFirstNumber("");
      setLastNumber("");
      setNextNumber("");
      setExpiresOn("");
      setNotice("Secuencia declarada. Confirma el saldo con tu contable antes de usar el aviso.");
    } catch (cause) {
      setError(businessErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };
  const update = async (id: string, change: { nextNumber?: string; active?: boolean }) => {
    if (!window.confirm("¿Confirmas este cambio del inventario NCF declarado? Nexora no altera ni emite comprobantes.")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`/ncf-sequences/${id}`, { method: "PATCH", body: JSON.stringify(change) });
      await refresh();
      setNotice("Declaración actualizada; revisa los avisos con tu contable.");
    } catch (cause) {
      setError(businessErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ncf-sequence-settings" aria-labelledby="ncf-sequence-title">
      <div className="ncf-sequence-intro">
        <h3 id="ncf-sequence-title">Avisos de secuencias NCF</h3>
        <p>
          Inventario declarado por administración. No emite NCF, no consulta la DGII y
          no certifica que una secuencia esté vigente. Registra solo datos de una
          autorización real y concilia el próximo número utilizado fuera de Nexora.
        </p>
      </div>
      <form className="ncf-sequence-form" onSubmit={(event) => void create(event)}>
        <label className="field">
          <span>Tipo según la autorización</span>
          <input required type="text" inputMode="text" pattern="[BE][0-9]{2}" maxLength={3}
            placeholder="B01" value={type} onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setType(value);
              if (WITHOUT_EXPIRY.has(value)) setExpiresOn("");
            }} />
          <small>Escribe el código Bxx o Exx tal como aparece en la autorización; Nexora no lo valida con la DGII.</small>
        </label>
        <label className="field">
          <span>Referencia de autorización</span>
          <input required maxLength={100} value={authorizationReference}
            onChange={(event) => setAuthorizationReference(event.target.value)} />
        </label>
        <label className="field">
          <span>Primer número autorizado</span>
          <input required type="text" inputMode="numeric" pattern="[0-9]+"
            minLength={numberWidth} maxLength={numberWidth} value={firstNumber}
            onChange={(event) => setFirstNumber(event.target.value)} />
        </label>
        <label className="field">
          <span>Último número autorizado</span>
          <input required type="text" inputMode="numeric" pattern="[0-9]+"
            minLength={numberWidth} maxLength={numberWidth} value={lastNumber}
            onChange={(event) => setLastNumber(event.target.value)} />
        </label>
        <label className="field">
          <span>Próximo número declarado</span>
          <input required type="text" inputMode="numeric" pattern="[0-9]+"
            minLength={numberWidth} maxLength={numberWidth + 1} value={nextNumber}
            onChange={(event) => setNextNumber(event.target.value)} />
          <small>Usa {numberWidth} dígitos (o uno más solo si se agotó). Incluye comprobantes utilizados fuera de Nexora; nunca se deduce de las ventas.</small>
        </label>
        {WITHOUT_EXPIRY.has(type) && <p className="ncf-sequence-no-expiry">
          {type} no recibe aviso de vencimiento según la regla general de DGII.
        </p>}
        {expiryApplies && (
          <label className="field">
            <span>Fecha de vencimiento de la autorización</span>
            <input required type="date" value={expiresOn}
              onChange={(event) => setExpiresOn(event.target.value)} />
          </label>
        )}
        <Button type="submit" disabled={busy}>Registrar secuencia declarada</Button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="ncf-sequence-notice" role="status">{notice}</p>}
      {sequences.isLoading && <p>Cargando secuencias declaradas…</p>}
      {sequences.isError && <p className="form-error" role="alert">
        No se pudieron cargar las secuencias: {businessErrorMessage(sequences.error)}
      </p>}
      {sequences.data?.length === 0 && <p>No hay secuencias declaradas. Los avisos fiscales están inactivos.</p>}
      {!!sequences.data?.length && (
        <ul className="ncf-sequence-list">
          {sequences.data.map((sequence) => (
            <SequenceRow key={`${sequence.id}:${sequence.updatedAt}`} sequence={sequence}
              busy={busy} onUpdate={update} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function NcfSequenceSettings() {
  if (!PRODUCT_MODE) return null;
  return <NcfSequenceSettingsContent />;
}
