// Esqueleto de carga: un solo brillo suave. Se apaga con movimiento reducido.
export function brilloEsqueleto(reducido: boolean) {
  return { animado: !reducido, brillos: 1 };
}
