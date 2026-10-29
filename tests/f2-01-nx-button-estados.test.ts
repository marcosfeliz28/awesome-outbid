import { expect, it } from "vitest";
import { atributosBoton } from "../packages/ui/src/nx-button";

it("atributosBoton marca cargando con aria-busy y deshabilita el botón", () => {
  expect(
    atributosBoton({ variante: "primary", tamano: "md", cargando: true }),
  ).toEqual({
    className: "nx-button nx-button--primary nx-button--md",
    disabled: true,
    "aria-busy": true,
    alturaMinimaPx: 44,
  });
});

it("atributosBoton sin estados queda activo y con tamaño sm", () => {
  expect(atributosBoton({ variante: "ghost", tamano: "sm" })).toEqual({
    className: "nx-button nx-button--ghost nx-button--sm",
    disabled: false,
    "aria-busy": false,
    alturaMinimaPx: 44,
  });
});
