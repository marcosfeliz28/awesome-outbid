import { describe, it, expect } from "vitest";
import { iniciales } from "../packages/ui/src/nx-iniciales";

describe("nx-iniciales", () => {
  it("toma la inicial de las dos primeras palabras significativas", () => {
    expect(iniciales("Ana Maria Perez")).toBe("AM");
  });

  it("ignora de, del, la, las, los, y, e", () => {
    expect(iniciales("María de la Cruz")).toBe("MC");
  });

  it("devuelve una sola inicial si hay una palabra", () => {
    expect(iniciales("Juan")).toBe("J");
  });

  it("tolera espacios repetidos", () => {
    expect(iniciales("Ana   Maria")).toBe("AM");
  });

  it("devuelve ? si el nombre está vacío o solo tiene espacios", () => {
    expect(iniciales("")).toBe("?");
    expect(iniciales("   ")).toBe("?");
  });
});
