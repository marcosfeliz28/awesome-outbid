// Clase CSS de la tarjeta según su variante.
export type VarianteTarjeta = "default" | "glass" | "interactive" | "metric";

export function claseVariante(variante: VarianteTarjeta): string {
  const validas: readonly string[] = [
    "default",
    "glass",
    "interactive",
    "metric",
  ];
  if (!validas.includes(variante)) {
    throw new Error(`La variante debe ser una de: ${validas.join(", ")}`);
  }
  return `nx-card nx-card--${variante}`;
}

// Superficie normal o elevada. Las sombras salen solo de los tokens.
export function claseSuperficie(elevada: boolean): string {
  return elevada ? "nx-superficie nx-superficie--elevada" : "nx-superficie";
}
