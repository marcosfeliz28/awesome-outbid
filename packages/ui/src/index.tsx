import { useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
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
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-orbit">✦</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" />
      <span>Cargando datos…</span>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
  restoreFocus = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
  /** Al cerrar, devuelve el foco a quien lo tenía al abrir (solo diálogos abiertos desde «Más»); por defecto no toca el foco. */
  restoreFocus?: boolean;
}) {
  // Sin Dialog.Trigger Radix no sabe a quién devolver el foco: se guarda quien lo tenía al abrir.
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={(value) => !value && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content
          className={`modal ${wide ? "wide" : ""}`}
          aria-describedby={undefined}
          {...(restoreFocus && {
            onOpenAutoFocus: () => {
              opener.current = document.activeElement as HTMLElement | null;
            },
            onCloseAutoFocus: (event: Event) => {
              const back = opener.current;
              opener.current = null;
              if (back?.isConnected && back !== document.body) {
                event.preventDefault();
                back.focus();
              }
            },
          })}
        >
          <div className="modal-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Cerrar">
                <X size={20} />
              </button>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
