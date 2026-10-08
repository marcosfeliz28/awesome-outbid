export type OfflineSaleAction = "save" | "block" | "retry";

// Un corte después de enviar es distinto de estar desconectado desde el inicio:
// la API pudo registrar la venta y el reintento debe conservar el mismo UUID.
export function offlineSaleAction(
  allowOfflineSales: unknown,
  requestMayHaveReachedServer: boolean,
): OfflineSaleAction {
  // Sólo el booleano JSON true habilita el riesgo. Valores ausentes de una
  // instalación anterior o datos manipulados/corruptos conservan el bloqueo.
  if (allowOfflineSales === true) return "save";
  return requestMayHaveReachedServer ? "retry" : "block";
}
