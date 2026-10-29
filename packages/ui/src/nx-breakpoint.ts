// Puntos de corte de la app: móvil < 768, tableta < 1200, escritorio desde 1200.
export function clasificarAncho(
  ancho: number,
): "movil" | "tableta" | "escritorio" {
  if (!Number.isFinite(ancho)) return "movil";
  if (ancho < 768) return "movil";
  if (ancho < 1200) return "tableta";
  return "escritorio";
}
