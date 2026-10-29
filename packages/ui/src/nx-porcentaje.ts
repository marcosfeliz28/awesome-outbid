// Porcentaje con decimales de 0 a 4: «15 %» en español (coma decimal), «15%» en inglés.
export function formatearPorcentaje(
  n: number,
  decimales: number,
  idioma: "es" | "en" = "es",
): string {
  if (!Number.isFinite(n)) return "—";
  const d = Math.min(4, Math.max(0, Math.trunc(decimales) || 0));
  const valor = Number(n.toFixed(d)) + 0; // +0 quita el signo de -0
  const texto = valor.toFixed(d);
  if (idioma === "en") return `${texto}%`;
  return `${texto.replace(".", ",")} %`;
}
