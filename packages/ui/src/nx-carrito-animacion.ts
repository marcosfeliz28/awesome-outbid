// Carrito del POS: el contador rebota al subir y la línea nueva entra deslizando.
// Nunca bloquea el botón Cobrar.
import { DURACION } from "./nx-motion";
import { debeRebotar } from "./nx-count-bump";
import { valorMovimiento } from "./nx-reduced-motion";

export function animacionCarrito({
  anterior,
  actual,
  reducido,
}: {
  anterior: number;
  actual: number;
  reducido: boolean;
}) {
  return {
    rebota: debeRebotar(anterior, actual) && !reducido,
    entradaPx: valorMovimiento(12, reducido),
    duracionMs: reducido ? 0 : DURACION.base,
    cobrarBloqueado: false,
  };
}
