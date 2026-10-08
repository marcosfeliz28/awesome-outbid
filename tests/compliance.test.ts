import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((part) => parseInt(part, 16) / 255)
    .map((value) =>
      value <= 0.04045
        ? value / 12.92
        : Math.pow((value + 0.055) / 1.055, 2.4),
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (a: string, b: string) => {
  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (bright + 0.05) / (dark + 0.05);
};
const cssVariable = (css: string, name: string) =>
  new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1] ?? "";

describe("Cumplimiento legal y accesibilidad", () => {
  it("G1: el ticket sin NCF se identifica como no fiscal y no imprime una fila NCF vacía", () => {
    const source = readFileSync("apps/web/src/Prints.tsx", "utf8");
    expect(source).toContain(
      "DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL",
    );
    expect(source).not.toContain('<h3 className="tp-center">FACTURA</h3>');
    expect(source).not.toContain(
      '<Row label="NCF:" value={sale.ncf ?? ""} />',
    );
  });

  it("G2: el encabezado térmico usa los datos de Ajustes y un logo predeterminado", () => {
    const source = readFileSync("apps/web/src/Prints.tsx", "utf8");
    expect(source).not.toContain("<h2>Grupo Macgen</h2>");
    expect(source).not.toContain(
      '<p className="tp-branch">Plaza Lope de Vega</p>',
    );
    expect(source).toContain('{b.name || "Nexora POS"}');
    expect(source).toContain("b.branchName");
    expect(source).toContain("b.address");
    expect(source).toContain("b.phone");
    expect(source).toContain("b.legalId");
    expect(source).toContain('b.logo || "/logo-grupo-macgen.png"');
  });

  it("G5: los PDF incluyen contacto, hora, tratamiento del ITBIS y condiciones de la nota", () => {
    const source = readFileSync("apps/api/src/sales.ts", "utf8");
    const salePdf = source.slice(source.indexOf('@Get("sales/:id/receipt.pdf")'));
    const noteStart = source.indexOf('@Get("returns/:id/credit-note.pdf")');
    const notePdf = source.slice(
      noteStart,
      source.indexOf('@Post("sales/:id/installments")', noteStart),
    );
    expect(salePdf).toContain("business.phone");
    expect(salePdf).toContain("Fecha y hora:");
    expect(salePdf).toContain("ITBIS adicional:");
    expect(salePdf).toContain("business.taxIncluded");
    expect(notePdf).toContain("this.db.settings.findUnique");
    expect(notePdf).toContain("business.address");
    expect(notePdf).toContain("Fecha:");
    expect(notePdf).toContain("Condiciones de uso:");
  });

  it("G10: los colores funcionales alcanzan contraste AA y los controles conservan foco visible", () => {
    const css = readFileSync("apps/web/src/styles.css", "utf8");
    expect(contrast(cssVariable(css, "--success-strong"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssVariable(css, "--warning-text"), "#fff5e6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssVariable(css, "--danger-text"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(cssVariable(css, "--focus"), "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast(cssVariable(css, "--input-border"), "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(css).toContain('input[type="checkbox"]:focus-visible');
    expect(css).toContain('input[type="radio"]:focus-visible');
    expect(css).toContain("background: var(--success-strong)");
    expect(css).toContain("outline: 3px solid var(--focus)");
  });
});
