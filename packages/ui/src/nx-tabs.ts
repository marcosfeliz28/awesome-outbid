// Pestañas: roles ARIA y navegación con flechas, Inicio y Fin (circular).
export function atributosPestana({
  id,
  panelId,
  activo,
}: {
  id: string;
  panelId: string;
  activo: boolean;
}) {
  return {
    role: "tab",
    id,
    "aria-selected": activo,
    "aria-controls": panelId,
    tabIndex: activo ? 0 : -1,
  };
}

export function indiceTecla(
  actual: number,
  total: number,
  tecla: string,
): number {
  if (total <= 0) return -1;
  if (tecla === "ArrowRight") return (actual + 1) % total;
  if (tecla === "ArrowLeft") return (actual - 1 + total) % total;
  if (tecla === "Home") return 0;
  if (tecla === "End") return total - 1;
  return actual;
}
