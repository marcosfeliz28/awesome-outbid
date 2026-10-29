import { expect, it } from "vitest";
import { atributosCampo } from "../packages/ui/src/nx-field";

it("atributosCampo enlaza ayuda y error con aria-describedby", () => {
  expect(
    atributosCampo({
      id: "nombre",
      ayuda: "Como aparece en la factura",
      error: "Requerido",
    }),
  ).toEqual({
    id: "nombre",
    "aria-describedby": "nombre-ayuda nombre-error",
    "aria-invalid": true,
    ayudaId: "nombre-ayuda",
    errorId: "nombre-error",
  });
  expect(atributosCampo({ id: "tel" })).toEqual({
    id: "tel",
    "aria-describedby": undefined,
    "aria-invalid": false,
    ayudaId: "tel-ayuda",
    errorId: "tel-error",
  });
});
