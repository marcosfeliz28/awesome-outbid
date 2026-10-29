// Índice de la siguiente pestaña, dando la vuelta al llegar al final.
export function siguienteIndice(
  actual: number,
  total: number,
  direccion: 1 | -1,
): number {
  if (total <= 0) return 0;
  return (((actual + direccion) % total) + total) % total;
}
