// Palabras de enlace que no cuentan para las iniciales (María de la Cruz → MC).
const PALABRAS_IGNORADAS = new Set(["de", "del", "la", "las", "los", "y", "e"]);

export function iniciales(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((p) => p !== "" && !PALABRAS_IGNORADAS.has(p.toLowerCase()));
  if (palabras.length === 0) return "?";
  return palabras
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}
