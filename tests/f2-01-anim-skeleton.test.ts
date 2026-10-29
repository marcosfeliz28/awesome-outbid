import { expect, it } from "vitest";
import { brilloEsqueleto } from "../packages/ui/src/nx-skeleton-brillo";

it("brilloEsqueleto anima un solo brillo y se apaga con movimiento reducido", () => {
  expect(brilloEsqueleto(false)).toEqual({ animado: true, brillos: 1 });
  expect(brilloEsqueleto(true)).toEqual({ animado: false, brillos: 1 });
});
