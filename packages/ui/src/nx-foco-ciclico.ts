// Siguiente elemento enfocable en círculo; fuera de rango empieza por el primero (o el último si va hacia atrás).
export function siguienteFoco(
  indiceActual: number,
  total: number,
  direccion: 1 | -1,
): number {
  if (total <= 0) return -1;
  if (indiceActual < 0 || indiceActual >= total) {
    return direccion === 1 ? 0 : total - 1;
  }
  return (indiceActual + total + direccion) % total;
}
