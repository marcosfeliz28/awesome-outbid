import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("UC-07 · acciones de usuarios en móvil", () => {
  const css = readFileSync("apps/web/src/premiumWorkspace.css", "utf8");

  it("envuelve las acciones dentro de la tarjeta sin cortar sus textos", () => {
    expect(css).toContain(
      '.norexos-premium-workspace[data-premium-area="configuration"] .table-cards td:is([data-label="Acción"], [data-label="Action"]) .inline-actions',
    );
    expect(css).toMatch(
      /td:is\(\[data-label="Acción"\], \[data-label="Action"\]\)\s*\{[^}]*display:\s*block;[^}]*text-align:\s*left;/s,
    );
    expect(css).toMatch(
      /td:is\(\[data-label="Acción"\], \[data-label="Action"\]\) \.inline-actions\s*\{[^}]*width:\s*100%;[^}]*flex-wrap:\s*wrap;[^}]*min-width:\s*0;/s,
    );
    expect(css).toMatch(
      /td:is\(\[data-label="Acción"\], \[data-label="Action"\]\) \.text-link\s*\{[^}]*flex:\s*1 1 100%;[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });
});
