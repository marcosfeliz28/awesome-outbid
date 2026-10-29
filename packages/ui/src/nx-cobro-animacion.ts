// Cobro exitoso: el check se dibuja en 400 ms y la factura sube. Nunca bloquea imprimir ni F12.
import { DURACION } from "./nx-motion";

export function animacionCobro(reducido: boolean) {
  return {
    checkMs: reducido ? 0 : 400,
    facturaSubeMs: reducido ? 0 : DURACION.base,
    bloqueaImprimir: false,
  };
}
