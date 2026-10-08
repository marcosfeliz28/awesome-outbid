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
});
