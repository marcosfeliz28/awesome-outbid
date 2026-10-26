import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import "./admin-ui.css";

/**
 * Obsidian Lumina · fase 3. Una sola acción principal por cabecera: las demás
 * van aquí, dentro de «Más». Es un menú de apertura (disclosure), no un menú
 * ARIA: sus hijos son botones normales, cada uno con su nombre.
 * Escape o un clic fuera lo cierran y devuelven el foco al botón.
 */
export function MoreMenu({
  label = "Más",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  // Al elegir una opción su botón se desmonta: el foco vuelve al disparador.
  const closeAndFocus = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeAndFocus();
    };
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="more-menu" ref={root}>
      <button
        ref={trigger}
        type="button"
        className="button secondary more-menu-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
        {label}
      </button>
      {open && (
        <div
          id={panelId}
          className="more-menu-panel"
          onClick={(event) => {
            // Cualquier botón elegido cierra el menú.
            if ((event.target as HTMLElement).closest("button, a"))
              closeAndFocus();
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** Esqueleto de tabla mientras carga; sin animación con movimiento reducido. */
export function TableSkeleton({
  rows = 5,
  cols = 4,
  label = "Cargando datos",
}: {
  rows?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <div className="table-skeleton" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, row) => (
        <div className="table-skeleton-row" key={row} aria-hidden="true">
          {Array.from({ length: cols }, (_, col) => (
            <span className="skeleton" key={col} />
          ))}
        </div>
      ))}
    </div>
  );
}
