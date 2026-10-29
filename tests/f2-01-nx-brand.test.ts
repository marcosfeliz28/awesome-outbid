import { describe, it, expect } from "vitest";
import { BRAND_NAME, BRAND_SLUG, BRAND_DOMAIN, tituloPagina } from "../packages/ui/src/nx-brand";

describe("nx-brand", () => {
  it("exporta el nombre, el slug y el dominio de Norexos", () => {
    expect(BRAND_NAME).toBe("Norexos");
    expect(BRAND_SLUG).toBe("norexos");
    expect(BRAND_DOMAIN).toBe("norexos.ai");
  });

  it("el título de página lleva la sección y la marca", () => {
    expect(tituloPagina("Ventas")).toBe("Ventas · Norexos");
  });

  it("el slug no tiene tildes ni mayúsculas", () => {
    expect(BRAND_SLUG).toMatch(/^[a-z0-9-]+$/);
  });
});
