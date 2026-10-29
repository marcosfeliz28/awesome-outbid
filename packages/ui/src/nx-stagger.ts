// Retraso de cada elemento de una lista, sin pasar de 240 ms.
export function retrasoEscalonado(
  indice: number,
  paso = 40,
  maximo = 240,
): number {
  return Math.min(Math.max(indice, 0) * paso, maximo);
}
