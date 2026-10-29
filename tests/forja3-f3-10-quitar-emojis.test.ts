import { describe, it, expect } from "vitest";
import { quitarEmojis } from "../packages/ui/src/nx-quitar-emojis";

describe("quitarEmojis (F3-10)", () => {
  it("un texto solo de emojis queda vacío", () => {
    expect(quitarEmojis("😀")).toBe("");
  });
  it("quita el modificador de tono de piel y conserva ñ y acentos", () => {
    expect(quitarEmojis("ñandú 👍🏽")).toBe("ñandú ");
    expect(quitarEmojis("café niño")).toBe("café niño");
  });
  it("quita secuencias con unión de caracteres (familia)", () => {
    expect(quitarEmojis("👨‍👩‍👧")).toBe("");
  });
});
