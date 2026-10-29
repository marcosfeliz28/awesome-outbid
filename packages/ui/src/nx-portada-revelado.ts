// Revelado de secciones de la portada: una vez, con retraso escalonado.
import { DURACION } from "./nx-motion";
import { retrasoEscalonado } from "./nx-stagger";

export function revelarSeccion(indice: number, reducido: boolean) {
  return {
    retrasoMs: reducido ? 0 : retrasoEscalonado(indice),
    duracionMs: reducido ? 0 : DURACION.base,
    unaVez: true,
  };
}
