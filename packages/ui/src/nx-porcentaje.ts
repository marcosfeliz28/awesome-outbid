// Porcentaje con decimales de 0 a 4: «15.5 %» en español y «15.5%» en inglés (punto decimal en ambos, como en RD).
export function formatearPorcentaje(
  n: number,
  decimales: number,
  idioma: "es" | "en" = "es",
): string {
  if (!Number.isFinite(n)) return "—";
  const d = Math.min(4, Math.max(0, Math.trunc(decimales) || 0));
  const valor = Number(n.toFixed(d)) + 0; // +0 quita el signo de -0
  const texto = valor.toFixed(d);
  return idioma === "en" ? `${texto}%` : `${texto} %`;
}
