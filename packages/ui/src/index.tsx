import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, LoaderCircle } from "lucide-react";

export function Button({
  variant = "primary",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
}) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
  illustration,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  illustration?: ReactNode;
}) {
  return (
    <div className="empty">
      {illustration ?? <div className="empty-orbit">✦</div>}
      {/* Ilustración del modo Impacto (oculta en el modo estándar). */}
      <svg className="empty-art" viewBox="0 0 120 96" aria-hidden="true">
        <path
          d="M30 44 60 30l30 14v30L60 88 30 74Z"
          fill="currentColor"
          opacity=".12"
        />
        <path
          d="M30 44 60 58l30-14M60 58v30M30 44 60 30l30 14v30L60 88 30 74Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          className="flota"
          d="M22 18l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"
          fill="currentColor"
        />
        <path
          className="flota b"
          d="M96 10l2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"
          fill="currentColor"
          opacity=".7"
        />
      </svg>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading({ label = "Cargando datos…" }: { label?: string } = {}) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      <span>{label}</span>
      <div className="loading-skeleton" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
// DIS-02: con datos escritos, cerrar (X, Escape o clic fuera) pregunta antes de
// descartar. Sin datos, cierra como siempre.
export function closeAction(
  hasData: boolean,
  asking: boolean,
): "close" | "ask" | "stay" {
  if (!hasData) return "close";
  return asking ? "stay" : "ask";
}
export function DiscardNotice({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const keep = useRef<HTMLButtonElement>(null);
  useEffect(() => keep.current?.focus(), []);
  return (
    <div className="discard-notice" role="alertdialog" aria-label="Datos sin guardar">
      <p>Tienes datos escritos que se perderán. ¿Salir sin guardar?</p>
      <div>
        <button ref={keep} type="button" className="button primary" onClick={onKeep}>
          Seguir aquí
        </button>
        <button type="button" className="button ghost" onClick={onDiscard}>
          Salir y descartar
        </button>
      </div>
    </div>
  );
}

/** Primitivas aditivas: no cambian las APIs ni las clases de las pantallas existentes. */
export function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section className="panel" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** Etiqueta, ayuda y error enlazados al campo por id (lector de pantalla). */
export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const generated = useId();
  const inputId = id || generated;
  const describedBy =
    [
      props["aria-describedby"],
      hint && `${inputId}-hint`,
      error && `${inputId}-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={inputId}>{label}</label>
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={describedBy}
      />
      {hint && <small id={`${inputId}-hint`}>{hint}</small>}
      {error && (
        <small id={`${inputId}-error`} className="danger-text">
          {error}
        </small>
      )}
    </div>
  );
}

/** Tabla que desborda: región con nombre y alcanzable con el teclado. */
export function TableFrame({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  hasData = false,
  closeLabel = "Cerrar",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Si es true, cerrar pregunta antes de descartar lo escrito. */
  hasData?: boolean;
  closeLabel?: string;
}) {
  // Los consumidores abren el diálogo con botones propios, sin Dialog.Trigger:
  // al cerrar se devuelve el foco a quien lo abrió.
  const returnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open)
      returnFocus.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
  }, [open]);
  const [asking, setAsking] = useState(false);
  useEffect(() => {
    if (!hasData) setAsking(false);
  }, [hasData]);
  const request = () => {
    const action = closeAction(hasData, asking);
    if (action === "close") onClose();
    else if (action === "ask") setAsking(true);
  };
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && request()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""}`}
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            if (returnFocus.current?.isConnected) {
              event.preventDefault();
              returnFocus.current.focus();
            }
          }}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label={closeLabel}>
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {asking && (
            <DiscardNotice
              onKeep={() => setAsking(false)}
              onDiscard={() => {
                setAsking(false);
                onClose();
              }}
            />
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export * from "./nx-primitivos";
