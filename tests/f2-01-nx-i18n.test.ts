import { expect, it } from "vitest";
import { crearTraductor } from "../packages/ui/src/nx-i18n";

it("crearTraductor usa el diccionario y cae al respaldo en español", () => {
  const t = crearTraductor({ hola: "Hola" }, { adios: "Adiós" });
  expect(t("hola")).toBe("Hola");
  expect(t("adios")).toBe("Adiós");
  expect(t("nada")).toBe("nada");
});
