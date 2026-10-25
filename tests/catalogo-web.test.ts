import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { matchesSearch, searchTerms } from "../packages/shared/src/index";
import { confirmMargin, marginWarning, productSearchText } from "../apps/web/src/catalogChecks";

// Auditoría de inventario (25-oct-2026), puntos 4 y 5.
const web = (file: string) => readFileSync(`apps/web/src/${file}`, "utf8");
const finds = (text: string, query: string) =>
  searchTerms(query).every((alts) => matchesSearch(text, alts[0]));

describe("4 · aviso de margen (precio − costo) / precio", () => {
  it("avisa con precio 0, bajo el costo o margen < 15 %, y no con 15 % o más", () => {
    expect(marginWarning(0, 0)).toContain("es 0");
    expect(marginWarning(90, 100)).toContain("por debajo del costo");
    expect(marginWarning(100, 86)).toContain("14.0 %");
    expect(marginWarning(100, 85)).toBeNull();
    expect(marginWarning(1000, 500)).toBeNull();
  });
  it("pide confirmación sólo cuando hay aviso", () => {
    const asked: string[] = [];
    const no = (m: string) => (asked.push(m), false);
    expect(confirmMargin(100, 50, no)).toBe(true);
    expect(confirmMargin(100, 95, no)).toBe(false);
    expect(asked[0]).toContain("¿Guardar de todos modos?");
    expect(confirmMargin(100, 95, () => true)).toBe(true);
  });
  it("Nuevo producto, variantes y Editar precio confirman antes de guardar", () => {
    const source = web("Management.tsx");
    expect(source.match(/confirmMargin\(/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("5 · Productos busca como la caja", () => {
  const faja = {
    name: "Faja colombiana Reductora", sku: "FAJ-1", brand: "Ann Chery",
    variants: [{ sku: "FAJ-1-M", barcode: "7701234567890", attributes: { Talla: "M", Color: "Café" } }],
  };
  it("encuentra por código de barras, SKU de variante y sin acentos", () => {
    const text = productSearchText(faja);
    expect(finds(text, "7701234567890")).toBe(true);
    expect(finds(text, "faj-1-m")).toBe(true);
    expect(finds(text, "cafe reductora")).toBe(true);
    expect(finds(text, "chery")).toBe(true);
    expect(finds(text, "negro")).toBe(false);
  });
  it("Productos, Inventario y la caja usan el mismo texto de búsqueda", () => {
    expect(web("POS.tsx")).toContain("productSearchText(p)");
    const management = web("Management.tsx");
    expect(management).toContain("matchesWords(productSearchText(p), words)");
    expect(management).toContain("matchesWords(productSearchText({ ...v.product, variants: [v] }), words)");
  });
});
