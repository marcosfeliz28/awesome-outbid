/** Escena neutral antes de conocer el código de empresa del usuario. */
export const productLoginFaces = [
  { face: "front", title: "Productos", items: "Tu catálogo" },
  { face: "right", title: "Ventas", items: "Cobros ágiles" },
  { face: "back", title: "Clientes", items: "Cada relación cuenta" },
  { face: "left", title: "Inventario", items: "Existencias claras" },
  { face: "top", title: "Reportes", items: "Decisiones informadas" },
  { face: "bottom", title: "Tu equipo", items: "Todo conectado" },
] as const;

export function warehouseLabel(
  warehouse?: { name: string; kind: string } | null,
): string {
  return warehouse?.name.trim() || "Almacén";
}

export function businessSidebarLabels(settings?: {
  name?: string;
  branchName?: string;
} | null) {
  return {
    branch: settings?.branchName?.trim() || "Sucursal",
    business: settings?.name?.trim() || "Nexora POS",
  };
}
