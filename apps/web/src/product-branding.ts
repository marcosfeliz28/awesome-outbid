/** Escena neutral antes de conocer el código de empresa del usuario. */
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
