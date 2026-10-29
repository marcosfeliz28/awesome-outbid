// Singular solo para exactamente 1; cualquier otro valor (0, negativos, fracciones) usa plural.
export function plural(
  n: number,
  formas: { uno: string; otros: string },
): string {
  return n === 1 ? formas.uno : formas.otros;
}
