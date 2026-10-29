// Apertura del asistente: escala de 0.96 a 1 y fundido. No roba el foco del POS.
import { DURACION } from "./nx-motion";

export function aperturaAsistente(reducido: boolean) {
  return {
    desdeEscala: reducido ? 1 : 0.96,
    hastaEscala: 1,
    duracionMs: reducido ? 0 : DURACION.base,
    robaFoco: false,
  };
}
