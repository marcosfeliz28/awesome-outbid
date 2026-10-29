import { expect, it } from "vitest";
import { animacionCarrito } from "../packages/ui/src/nx-carrito-animacion";

it("animacionCarrito rebota el contador solo si sube y nunca bloquea Cobrar", () => {
  expect(animacionCarrito({ anterior: 1, actual: 2, reducido: false })).toEqual(
    {
      rebota: true,
      entradaPx: 12,
      duracionMs: 180,
      cobrarBloqueado: false,
    },
  );
  expect(
    animacionCarrito({ anterior: 2, actual: 2, reducido: false }).rebota,
  ).toBe(false);
  expect(animacionCarrito({ anterior: 1, actual: 2, reducido: true })).toEqual({
    rebota: false,
    entradaPx: 0,
    duracionMs: 0,
    cobrarBloqueado: false,
  });
});
