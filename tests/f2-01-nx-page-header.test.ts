import { expect, it } from "vitest";
import { encabezadoPagina } from "../packages/ui/src/nx-page-header";

it("encabezadoPagina devuelve un solo h1 con subtítulo y hasta 2 acciones", () => {
  expect(
    encabezadoPagina({
      titulo: "Caja",
      subtitulo: "Turno de hoy",
      acciones: ["Cobrar"],
    }),
  ).toEqual({
    h1: "Caja",
    subtitulo: "Turno de hoy",
    acciones: ["Cobrar"],
  });
  expect(encabezadoPagina({ titulo: "Caja" })).toEqual({
    h1: "Caja",
    subtitulo: null,
    acciones: [],
  });
});

it("encabezadoPagina rechaza título vacío y más de 2 acciones", () => {
  expect(() => encabezadoPagina({ titulo: "" })).toThrow();
  expect(() =>
    encabezadoPagina({ titulo: "Caja", acciones: ["a", "b", "c"] }),
  ).toThrow();
});
