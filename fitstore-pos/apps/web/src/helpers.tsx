import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Loading, Modal } from "@fitstore/ui";
import { AlertCircle, Check, X } from "lucide-react";
import { api } from "./api";

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
let toastHandler: (message: string, error?: boolean) => void = () => {};
export const toast = (message: string, error = false) =>
  toastHandler(message, error);
export function Toasts() {
  const [notice, setNotice] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  toastHandler = (message, error = false) => {
    setNotice({ message, error });
    setTimeout(() => setNotice(null), 6000);
  };
  return notice ? (
    <div
      className={`toast ${notice.error ? "error" : ""}`}
      role={notice.error ? "alert" : "status"}
    >
      {notice.error ? <AlertCircle size={20} /> : <Check size={20} />}
      <span>{notice.message}</span>
      <button onClick={() => setNotice(null)} aria-label="Cerrar aviso">
        <X size={18} />
      </button>
    </div>
  ) : null;
}
export function QueryState({
  query,
  children,
}: {
  query: any;
  children: ReactNode;
}) {
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <div className="error-panel" role="alert">
        <AlertCircle />
        <p>{query.error.message}</p>
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
export function FormModal({
  title,
  fields,
  onSubmit,
  onClose,
  initial = {},
}: {
  title: string;
  fields: Field[];
  onSubmit: (data: Record<string, any>) => Promise<unknown>;
  onClose: () => void;
  initial?: Record<string, any>;
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
      setError(e.message);
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
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
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
            setError(e.message);
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
            Confirmar
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
