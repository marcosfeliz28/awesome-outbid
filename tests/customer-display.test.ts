import { describe, expect, it } from "vitest";
import { customerPrivateDisplay } from "../apps/web/src/customer-display";
describe("P5: datos de clientes en la lista", () => {
  it("cajera sólo ve los tres últimos dígitos y nunca un dato corto completo", () => {
    expect(customerPrivateDisplay("809-555-0123", false)).toBe("•••123");
    expect(customerPrivateDisplay("001-1234567-8", false)).toBe("•••678");
    expect(customerPrivateDisplay("12", false)).toBe("•••");
    expect(customerPrivateDisplay("", false)).toBe("—");
  });
  it("gerencia conserva el dato completo", () => {
    expect(customerPrivateDisplay("809-555-0123", true)).toBe("809-555-0123");
  });
});
