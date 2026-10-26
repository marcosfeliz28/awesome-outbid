import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// La caja no cambia: Modal solo devuelve el foco con restoreFocus, y solo «Más» lo pide.
const ui = readFileSync("packages/ui/src/index.tsx", "utf8");
const src = (f: string) => readFileSync("apps/web/src/" + f, "utf8");

describe("Modal · restoreFocus es opt-in", () => {
  it("vale false por defecto y los manejadores de foco solo se pasan si está activo", () => {
    expect(ui).toContain("restoreFocus = false");
    expect(ui).toMatch(/\{\.\.\.\(restoreFocus && \{[\s\S]*onOpenAutoFocus[\s\S]*onCloseAutoFocus/);
    expect(ui).not.toMatch(/<Dialog\.Content[^>]*\n\s+onCloseAutoFocus/);
  });
  it("ninguna pantalla de la caja lo usa", () => {
    const users = readdirSync("apps/web/src")
      .filter((f) => f.endsWith(".tsx") && src(f).includes("restoreFocus"))
      .sort();
    expect(users).toEqual(["InventoryImport.tsx", "Management.tsx"]);
    for (const caja of ["POS.tsx", "Tienda.tsx"]) expect(src(caja)).not.toContain("restoreFocus");
  });
});
