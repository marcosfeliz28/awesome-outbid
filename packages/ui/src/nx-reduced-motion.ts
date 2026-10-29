// Con movimiento reducido se quita el desplazamiento; el cambio de estado sigue.
export function valorMovimiento(valor: number, reducido: boolean): number {
  return reducido ? 0 : valor;
}
