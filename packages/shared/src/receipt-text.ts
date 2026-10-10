// Textos legales del recibo no fiscal. Los usan el ticket térmico (web) y el
// PDF (API): una sola redacción para que las salidas no se
// contradigan entre sí (auditoría 03 v2, V2-01 y V2-02).

/**
 * 03-M3: plazo de devolución de Ajustes (returnDays) o un texto genérico.
 *
 * V2-01: no promete una «garantía de ley» para producto defectuoso o vencido.
 * La API rechaza toda devolución fuera de plazo (sales.ts, «La venta excede el
 * plazo de devolución») y no tiene todavía una excepción por defecto; mientras
 * no exista, el recibo no puede ofrecer algo que la caja no puede registrar.
 * La prueba tests/caja-web-ticket.test.ts exige que la frase vuelva sólo
 * cuando la API tenga esa excepción.
 */
export function returnPolicyText(config: any) {
  const days = Number(config?.returnDays);
  return Number.isInteger(days) && days > 0
    ? `Devoluciones: hasta ${days} días con este recibo y el empaque original, según la política de la tienda.`
    : "Devoluciones: según la política de la tienda; conserve este recibo.";
}

/**
 * 03-A1: aviso corto de privacidad del pie del recibo. Siempre dice dónde
 * ejercer los derechos (en caja); el teléfono es un extra si la tienda lo
 * configuró, nunca el único canal (V2-05).
 */
export function privacyNoticeText(config: any) {
  const phone = String(config?.phone ?? "").trim();
  return (
    "Privacidad: usamos sus datos sólo para esta venta, sus garantías y créditos. Puede pedir verlos, corregirlos o borrarlos en caja" +
    (phone ? " o al " + phone : "") +
    "."
  );
}
