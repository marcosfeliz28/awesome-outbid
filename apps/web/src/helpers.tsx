import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Loading, Modal } from "@fitstore/ui";
import { AlertCircle, Check, WifiOff, X } from "lucide-react";
import { api } from "./api";
import {
  businessErrorMessage,
  managementQueryError,
} from "./managementMessages";

export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "America/Santo_Domingo" });
export const dateLabel = (value: string) =>
  new Date(value).toLocaleDateString("es-DO", {
    timeZone: "America/Santo_Domingo",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
export const attrLabel = (attributes: Record<string, string>) =>
  [
    ...new Set([
      "talla",
      "color",
      "sabor",
      "tamaño",
      "tono",
      ...Object.keys(attributes),
    ]),
  ]
    .filter((key) => attributes[key])
    .map((key) => attributes[key])
    .join(" · ") || "Única";
type ToastAction = { label: string; run: () => void };
let toastHandler: (
  message: string,
  error?: boolean,
  sticky?: boolean,
  action?: ToastAction,
) => void = () => {};
export const toast = (message: string, error = false) =>
  toastHandler(message, error);
// 05-M2: error de la caja (código no encontrado, sin stock, código de dos
// productos) que queda a la vista hasta el siguiente escaneo correcto o hasta
// cerrarlo; antes el aviso siguiente lo tapaba y se perdía. 05-N1: ya no es
// eterno: caduca a los 15 s (TOAST_MS.sticky) y la caja lo quita al teclear,
// al cobrar y al abrir una ventana, para que no quede sobre el cobro.
export const persistentError = (message: string) =>
  toastHandler(message, true, true);
// 05-M7: aviso con una acción (por ejemplo «Deshacer»), 8 s a la vista.
export const toastWithAction = (
  message: string,
  label: string,
  run: () => void,
) => toastHandler(message, false, false, { label, run });
let dismissHandler = () => {};
export const clearPersistentErrors = () => dismissHandler();
// G12: cuánto queda un aviso a la vista. Un error se lee con calma (no menos
// de 8 s); con el ratón encima o el foco dentro, no se cierra solo.
export const TOAST_MS = { info: 6000, error: 10000, sticky: 15000 } as const;
type Notice = {
  message: string;
  error: boolean;
  sticky: boolean;
  id: number;
  action?: ToastAction;
};
const ACTION_MS = 8000;
function Toast({
  notice,
  stacked,
  onClose,
}: {
  notice: Notice;
  stacked?: boolean;
  onClose: () => void;
}) {
  const [paused, setPaused] = useState(false);
  // Un temporizador por aviso: uno nuevo cancela el del anterior, y pausar
  // lo detiene; al salir se cuenta otra vez el plazo completo.
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(
      onClose,
      notice.sticky
        ? TOAST_MS.sticky
        : notice.error
          ? TOAST_MS.error
          : notice.action
            ? ACTION_MS
            : TOAST_MS.info,
    );
    return () => clearTimeout(timer);
  }, [notice, paused]);
  return (
    <div
      className={`toast ${notice.error ? "error" : ""} ${stacked ? "toast-stacked" : ""}`}
      role={notice.error ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          setPaused(false);
      }}
    >
      {notice.error ? <AlertCircle size={20} /> : <Check size={20} />}
      <span>{notice.message}</span>
      {notice.action && (
        <button
          className="toast-action"
          onClick={() => {
            notice.action!.run();
            onClose();
          }}
        >
          {notice.action.label}
        </button>
      )}
      <button onClick={onClose} aria-label="Cerrar aviso">
        <X size={18} />
      </button>
    </div>
  );
}
// Dos lugares: un error y un aviso informativo. Un aviso informativo ya no
// tapa un error que la cajera todavía no leyó (05-M2).
export function Toasts() {
  const [error, setError] = useState<Notice | null>(null);
  const [info, setInfo] = useState<Notice | null>(null);
  toastHandler = (message, isError = false, sticky = false, action) => {
    const notice = {
      message,
      error: isError,
      sticky,
      action,
      id: Date.now() + Math.random(),
    };
    // Un error nuevo reemplaza el aviso informativo anterior (por ejemplo
    // «X agregado.» junto a «No hay suficiente stock de X»); un aviso
    // informativo nuevo no tapa el error.
    if (isError) {
      setError(notice);
      setInfo(null);
    } else setInfo(notice);
  };
  dismissHandler = () =>
    setError((current) => (current?.sticky ? null : current));
  return (
    <>
      {error && (
        <Toast key={error.id} notice={error} onClose={() => setError(null)} />
      )}
      {info && (
        <Toast
          key={info.id}
          notice={info}
          stacked={!!error}
          onClose={() => setInfo(null)}
        />
      )}
    </>
  );
}
export function QueryState({
  query,
  children,
}: {
  query: any;
  children: ReactNode;
}) {
  // 05-M3: sin conexión React Query deja en pausa las consultas al servidor:
  // antes quedaba «Cargando datos…» para siempre.
  if (query.isPending && query.fetchStatus === "paused")
    return (
      <div className="error-panel" role="status">
        <WifiOff />
        <p>Sin conexión: esta información necesita internet.</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <div className="error-panel" role="alert">
        <AlertCircle />
        <p>{managementQueryError(query.error)}</p>
        <Button variant="secondary" onClick={() => query.refetch()}>
          Reintentar
        </Button>
      </div>
    );
  return <>{children}</>;
}
export type Field = {
  key: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "email"
    | "password"
    | "select"
    | "checkbox"
    | "textarea";
  options?: { label: string; value: string }[];
  required?: boolean;
  initial?: string | number | boolean;
  min?: number;
  max?: number;
  step?: string;
  help?: string;
};
// 03-A1: aviso corto al pedir los datos de un cliente. El texto jurídico
// completo lo redacta la tienda con su abogado; /privacidad.html es el resumen.
export function CustomerPrivacyNotice() {
  return (
    <p className="privacy-notice full">
      Usamos estos datos sólo para registrar las ventas, garantías y créditos
      del cliente. Teléfono, correo y cédula/RNC son opcionales. El cliente
      puede pedir verlos, corregirlos o borrarlos.{" "}
      <a href="/privacidad.html" target="_blank" rel="noopener">
        Privacidad
      </a>
    </p>
  );
}
export function FormModal({
  title,
  fields,
  onSubmit,
  onClose,
  initial = {},
  notice,
}: {
  title: string;
  fields: Field[];
  onSubmit: (data: Record<string, any>) => Promise<unknown>;
  onClose: () => void;
  initial?: Record<string, any>;
  notice?: ReactNode;
}) {
  const [values, setValues] = useState<Record<string, any>>(() =>
    Object.fromEntries(
      fields.map((f) => [
        f.key,
        initial[f.key] ?? f.initial ?? (f.type === "checkbox" ? false : ""),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const client = useQueryClient();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = { ...values };
      for (const f of fields)
        if (f.type === "number") data[f.key] = Number(data[f.key]);
      await onSubmit(data);
      await client.invalidateQueries();
      toast("Cambios guardados.");
      onClose();
    } catch (e: any) {
      setError(businessErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open onClose={onClose} title={title}>
      <form onSubmit={submit} className="form-grid">
        {fields.map((f) => (
          <label
            className={`field ${f.type === "textarea" ? "full" : ""}`}
            key={f.key}
          >
            <span>
              {f.label}
              {f.required ? " *" : ""}
            </span>
            {f.type === "select" ? (
              <select
                required={f.required}
                value={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              >
                <option value="">Seleccionar…</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.checked })
                }
              />
            ) : f.type === "textarea" ? (
              <textarea
                required={f.required}
                value={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            ) : (
              <input
                required={f.required}
                type={f.type || "text"}
                min={f.min}
                max={f.max}
                step={f.step || "0.01"}
                value={values[f.key]}
                onChange={(e) =>
                  setValues({ ...values, [f.key]: e.target.value })
                }
              />
            )}
            <small>{f.help}</small>
          </label>
        ))}
        {notice}
        {error && (
          <p className="form-error full" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer full">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={busy}>{busy ? "Guardando…" : "Guardar"}</Button>
        </div>
      </form>
    </Modal>
  );
}
export function ConfirmModal({
  title,
  description,
  confirmLabel = "Confirmar",
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal open title={title} onClose={onClose}>
      <p>{description}</p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await onConfirm(reason);
            onClose();
          } catch (e: any) {
            setError(businessErrorMessage(e));
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Motivo obligatorio</span>
          <textarea
            minLength={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-footer">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" disabled={busy}>
            {busy ? "Procesando…" : confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export async function mutate(path: string, data: unknown, method = "POST") {
  return api(path, { method, body: JSON.stringify(data) });
}

// Búsqueda de la caja: sin acentos, sin mayúsculas y por palabras sueltas.
const fold = (value: string) =>
  value
    .replace(/['’´`ʼ‘]/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export const searchWords = (query: string) =>
  fold(query)
    .split(/[\s/,-]+/)
    .filter(Boolean);
export const matchesWords = (text: string, words: string[]) => {
  const haystack = fold(text).replace(/(\d)\s+(lb|oz|g|kg|ml|mg)\b/g, "$1$2");
  return words.every((w) => haystack.includes(w));
};
// Imagen genérica por categoría cuando el producto no tiene foto.
export const categoryImage = (category = "") => {
  const c = fold(category);
  if (c.includes("suplement")) return "/products/supplements.svg";
  if (c.includes("maquill")) return "/products/makeup.svg";
  if (c.includes("faja")) return "/products/shapewear.svg";
  if (c.includes("ropa")) return "/products/clothing.svg";
  return "/products/accessories.svg";
};
