import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { customerPrivateDisplay } from "../apps/web/src/customer-display";
describe("P5: datos de clientes en la lista", () => {
  it("la lista aplica el filtro y el ticket declara lectura de facturas por IA", () => {
    const source = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(source).toMatch(/customerPrivateDisplay\(\s*c.phone/);
    expect(source).toMatch(/customerPrivateDisplay\(\s*c.legalId/);
    expect(
      readFileSync("apps/web/src/Prints.tsx", "utf8").replace(/\s+/g, " "),
    ).toContain("el documento se envía a Anthropic (IA)");
  });
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
