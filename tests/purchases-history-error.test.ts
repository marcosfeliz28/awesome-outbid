import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const purchases = readFileSync(
  new URL("../apps/web/src/Purchases.tsx", import.meta.url),
  "utf8",
);

describe("historial de recepciones cuando falla la consulta", () => {
  it("distingue el error del historial vacío y permite reintentar", () => {
    const errorBranch = purchases.indexOf(") : query.isError ? (");
    const emptyBranch = purchases.indexOf(") : !rows.length ? (");

    expect(errorBranch).toBeGreaterThan(-1);
    expect(emptyBranch).toBeGreaterThan(errorBranch);
    expect(purchases).toMatch(
      /english\s*\? "Could not load receipt history\."\s*:\s*"No se pudo cargar el historial de recepciones\."/,
    );
    expect(purchases).toContain('onClick={() => query.refetch()}');
    expect(purchases).toContain('{english ? "Retry" : "Reintentar"}');
  });
});
