// Orden natural en español: «item2» va antes que «item10»; no distingue mayúsculas ni acentos.
const colator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

export function compararNatural(a: string, b: string): number {
  return colator.compare(a, b);
}
