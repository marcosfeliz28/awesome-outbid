// Umbral de «pocos lugares» por defecto. Es decisión del negocio (cupo de GV): se pasa como parámetro.
export const UMBRAL_POCOS_POR_DEFECTO = 3;

// Etiqueta de cupo de un curso; capacidad 0, nula o inválida → «Sin cupo definido».
export function etiquetaCupo(
  inscritos: number,
  capacidad: number | null | undefined,
  umbralPocos: number = UMBRAL_POCOS_POR_DEFECTO,
): string {
  if (capacidad == null || !Number.isFinite(capacidad) || capacidad <= 0)
    return "Sin cupo definido";
  const ocupados = Number.isFinite(inscritos) && inscritos > 0 ? inscritos : 0;
  const libres = capacidad - ocupados;
  if (libres <= 0) return "Lleno";
  if (libres <= umbralPocos)
    return libres === 1 ? "Queda 1" : `Quedan ${libres}`;
  return "Disponible";
}
