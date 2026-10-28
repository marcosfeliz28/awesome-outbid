// Clase CSS del botón según su variante.
export type VarianteBoton = "primary" | "pos-charge" | "secondary" | "ghost" | "danger";

export function claseVariante(variante: VarianteBoton): string {
  const validas: readonly string[] = ["primary", "pos-charge", "secondary", "ghost", "danger"];
  if (!validas.includes(variante)) {
    throw new Error(`La variante debe ser una de: ${validas.join(", ")}`);
  }
  return `nx-button nx-button--${variante}`;
}
