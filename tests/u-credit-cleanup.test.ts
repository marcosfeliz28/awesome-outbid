import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
const manual = readFileSync("docs/MANUAL.md", "utf8");

describe("U-crédito · contrato del cobro y manual", () => {
  it("elimina estado, validación, campo y envío del vencimiento inalcanzable", () => {
    expect(pos).not.toMatch(/creditDueDate|setCreditDueDate/);
    expect(pos).not.toContain("Vencimiento del crédito");
    expect(pos).not.toContain("Indica la fecha de vencimiento.");
  });

  it("conserva Crédito / contraentrega y sus controles de cliente y aprobación", () => {
    expect(pos).toContain('id: "cod", label: "Crédito / contraentrega"');
    expect(pos).toContain("receivableNeedsApproval(");
    expect(pos).toContain(
      "Selecciona el cliente para el crédito / contraentrega.",
    );
    expect(pos).toContain("payments,");
  });

  it("el manual describe el método visible, sin pedir un vencimiento inexistente", () => {
    expect(manual).not.toContain("agrega **A crédito** y su vencimiento");
    expect(manual).toContain("selecciona **Crédito / contraentrega**");
  });
});
