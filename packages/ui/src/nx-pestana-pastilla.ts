// Pastilla deslizante bajo la pestaña activa.
import { DURACION } from "./nx-motion";

export function posicionPastilla(
  indiceActivo: number,
  anchoPorPestana: number,
) {
  return {
    xPx: Math.max(indiceActivo, 0) * anchoPorPestana,
    duracionMs: DURACION.base,
  };
}
