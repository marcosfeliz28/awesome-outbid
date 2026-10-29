// Entrada del aviso: sube desde abajo. Los errores no se ocultan solos.
import { DURACION } from "./nx-motion";
import { valorMovimiento } from "./nx-reduced-motion";
import type { TipoToast } from "./nx-toast";

export function entradaToast(tipo: TipoToast, reducido: boolean) {
  return {
    desdeAbajoPx: valorMovimiento(16, reducido),
    duracionMs: reducido ? 0 : DURACION.base,
    ocultaSola: tipo !== "error",
  };
}
