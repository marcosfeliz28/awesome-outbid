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

describe("quitarEmojis: comportamiento conocido (orden 75)", () => {
  it("©, ® y ™ también se quitan por ser pictográficos", () => {
    expect(quitarEmojis("©®™")).toBe("");
  });
  it("las flechas como ↔ también se quitan", () => {
    expect(quitarEmojis("↔")).toBe("");
  });
  it("la secuencia keycap 1️⃣ deja el U+20E3 suelto; no se cambia, queda documentado", () => {
    expect(quitarEmojis("1\uFE0F\u20E3")).toBe("1\u20E3");
  });
});
