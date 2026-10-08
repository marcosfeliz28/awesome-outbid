import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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
});
