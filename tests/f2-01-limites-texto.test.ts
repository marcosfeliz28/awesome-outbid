import { describe, it, expect } from "vitest";
import { iniciales } from "../packages/ui/src/nx-iniciales";
import { normalizarTexto } from "../packages/ui/src/nx-normalizar-texto";

describe("límites de nx-iniciales", () => {
  it("nombre vacío, solo espacios o solo palabras de enlace devuelve ?", () => {
    expect(iniciales("")).toBe("?");
    expect(iniciales("   ")).toBe("?");
    expect(iniciales("de la las")).toBe("?");
  });

  it("una sola palabra da una inicial; tres o más dan las dos primeras", () => {
    expect(iniciales("Juan")).toBe("J");
    expect(iniciales("Ana Maria Perez Lopez")).toBe("AM");
  });

  it("ignora mayúsculas en las palabras de enlace y tolera espacios repetidos", () => {
    expect(iniciales("Ana DE la   Cruz")).toBe("AC");
  });

  it("Unicode: letras con tilde y ñ se toman como inicial", () => {
    expect(iniciales("Ñandú Árbol")).toBe("ÑÁ");
  });
});

describe("límites de nx-normalizar-texto", () => {
  it("cadena vacía y solo espacios quedan igual", () => {
    expect(normalizarTexto("")).toBe("");
    expect(normalizarTexto("   ")).toBe("   ");
  });

  it("una letra con tilde escrita en forma descompuesta (e + acento combinado) queda sin tilde", () => {
    expect(normalizarTexto("e\u0301")).toBe("e");
    expect(normalizarTexto("Pingu\u0308ino")).toBe("pinguino");
  });

  it("la Ñ mayúscula queda como ñ minúscula, y la ñ se conserva", () => {
    expect(normalizarTexto("ÑANDÚ")).toBe("ñandu");
    expect(normalizarTexto("año Ñ")).toBe("año ñ");
  });
});
