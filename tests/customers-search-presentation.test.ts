import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);

describe("buscador de clientes en Management", () => {
  it("usa la búsqueda sin acentos y conserva la exclusión del teléfono privado", () => {
    expect(management).toContain(
      'import { matchesSearch } from "./customerSearch";',
    );
    expect(management).toMatch(
      /matchesSearch\(\s*\[c\.name, fullCustomer \? c\.phone : ""\]\s*\.filter\(Boolean\)\s*\.join\(" "\),\s*search,\s*\)/,
    );
  });
});
