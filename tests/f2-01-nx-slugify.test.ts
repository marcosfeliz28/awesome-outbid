import { describe, it, expect } from "vitest";
import { slugify } from "../packages/ui/src/nx-slugify";

describe("nx-slugify", () => {
  it("pasa a minúsculas, quita acentos y convierte la ñ en n", () => {
    expect(slugify("Ñandú y Café")).toBe("nandu-y-cafe");
  });

  it("colapsa espacios múltiples y recorta los bordes", () => {
    expect(slugify("  Hola    mundo  ")).toBe("hola-mundo");
  });

  it("quita emojis y símbolos sin dejar guiones sobrantes", () => {
    expect(slugify("Pizza 🍕 2x1!")).toBe("pizza-2x1");
    expect(slugify("¡¿???")).toBe("");
  });

  it("un texto vacío da cadena vacía", () => {
    expect(slugify("")).toBe("");
  });

  it("colapsa guiones y convierte guion bajo en guion", () => {
    expect(slugify("a--b")).toBe("a-b");
    expect(slugify("ya_es-slug")).toBe("ya-es-slug");
  });
});
