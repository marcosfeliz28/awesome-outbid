import { expect, it } from "vitest";
import { animacionCobro } from "../packages/ui/src/nx-cobro-animacion";

it("animacionCobro dibuja el check en 400 ms y no bloquea imprimir ni F12", () => {
  expect(animacionCobro(false)).toEqual({
    checkMs: 400,
    facturaSubeMs: 180,
    bloqueaImprimir: false,
  });
  expect(animacionCobro(true)).toEqual({
    checkMs: 0,
    facturaSubeMs: 0,
    bloqueaImprimir: false,
  });
});
