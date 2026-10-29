import { expect, it } from "vitest";
import { changeRequestInput } from "../apps/api/src/change-request-input";

const valido = {
  title: "Botón de cobrar muy claro",
  description: "En la caja el botón casi no se ve con sol.",
};

it("acepta una solicitud con título y descripción dentro de los límites", () => {
  expect(changeRequestInput.parse(valido)).toEqual(valido);
});

it("recorta el título y rechaza títulos fuera de 3 a 120 caracteres", () => {
  expect(changeRequestInput.parse({ ...valido, title: "  Caja  " }).title).toBe(
    "Caja",
  );
  expect(() => changeRequestInput.parse({ ...valido, title: "ab" })).toThrow();
  expect(() =>
    changeRequestInput.parse({ ...valido, title: "x".repeat(121) }),
  ).toThrow();
});

it("rechaza descripciones fuera de 10 a 2000 caracteres", () => {
  expect(() =>
    changeRequestInput.parse({ ...valido, description: "corta" }),
  ).toThrow();
  expect(() =>
    changeRequestInput.parse({ ...valido, description: "x".repeat(2001) }),
  ).toThrow();
});

it("no deja elegir estado ni autor desde el cuerpo", () => {
  const parsed = changeRequestInput.parse({
    ...valido,
    status: "resuelto",
    userId: "otro",
  });
  expect(parsed).not.toHaveProperty("status");
  expect(parsed).not.toHaveProperty("userId");
});
