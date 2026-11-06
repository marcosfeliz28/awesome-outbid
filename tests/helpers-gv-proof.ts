// PNG de 1×1 (89504e47…) como data URL: foto de voucher válida para las pruebas de GV.
export const GV_PROOF_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
// Agrega la foto cuando el pago es con tarjeta o transferencia.
export const withGvProof = <T extends { method?: unknown }>(body: T) =>
  body.method === "tarjeta" || body.method === "transferencia"
    ? { proof: GV_PROOF_PNG, ...body }
    : body;
