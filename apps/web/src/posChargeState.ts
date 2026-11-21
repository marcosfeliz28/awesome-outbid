/** El cobro solo puede empezar con artículos y una caja propia disponible. */
export const posChargeDisabled = (
  cartLength: number,
  hasSession: boolean,
  sessionElsewhere: boolean,
) => cartLength === 0 || !hasSession || sessionElsewhere;
