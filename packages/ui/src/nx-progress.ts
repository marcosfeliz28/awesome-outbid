// Porcentaje entero de avance, entre 0 y 100.
export function porcentajeProgreso(valor: number, total: number): number {
  if (total <= 0) return 0;
  const porcentaje = Math.round((valor / total) * 100);
  return Math.min(Math.max(porcentaje, 0), 100);
}
