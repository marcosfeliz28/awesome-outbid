// Clase CSS del esqueleto de carga según su forma.
export type FormaEsqueleto = "linea" | "bloque" | "circulo";

export function claseEsqueleto(forma: FormaEsqueleto): string {
  switch (forma) {
    case "linea":
      return "nx-skeleton nx-skeleton--linea";
    case "bloque":
      return "nx-skeleton nx-skeleton--bloque";
    case "circulo":
      return "nx-skeleton nx-skeleton--circulo";
    default:
      throw new Error(`Forma no válida: ${String(forma)}`);
  }
}
