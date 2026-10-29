// Cambio de vista: fundido y 8 px de desplazamiento. Con movimiento reducido solo fundido.
import { DURACION } from "./nx-motion";
import { valorMovimiento } from "./nx-reduced-motion";

export function transicionVista(reducido: boolean) {
  return {
    desplazamientoPx: valorMovimiento(8, reducido),
    duracionMs: DURACION.base,
    opacidad: [0, 1],
  };
}
