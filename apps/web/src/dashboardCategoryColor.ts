const GV_CATEGORY_COLORS: Record<string, string> = {
  "gv productos": "#2563EB",
  "gv servicios": "#0F766E",
  "gv cursos": "#B45309",
};

/**
 * Paleta visual del resumen. Sólo separa las tres líneas de GV que el API
 * entregaba con el mismo rosa de Fajas; las demás categorías conservan el
 * color recibido y ningún dato de ventas cambia.
 */
export function dashboardCategoryColor(name: string, sourceColor: string) {
  const key = name.trim().toLocaleLowerCase("es-DO");
  return GV_CATEGORY_COLORS[key] ?? sourceColor;
}
