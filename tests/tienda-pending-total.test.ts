import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { creditPendingSummary } from "../apps/web/src/codPendingSummary";

const tienda = readFileSync(
  new URL("../apps/web/src/Tienda.tsx", import.meta.url),
  "utf8",
);

describe("P11 · total visible de créditos pendientes", () => {
  it("avisa cuando el total omite importes ocultos hasta cerrar la caja", () => {
    expect(tienda).toContain('ct("Por cobrar visible:")');
    expect(tienda).toContain(
      "Hay importes ocultos hasta cerrar la caja; este total no incluye esas ventas.",
    );
    expect(tienda).toContain('role="status"');
  });

  it("mantiene el mismo total visible y cuenta las ventas ocultas", () => {
    expect(
      creditPendingSummary([
        { pending: 250 },
        { pending: null, hiddenUntilClose: true },
        { pending: "75.50" },
      ]),
    ).toEqual({ visibleTotal: 325.5, hiddenCount: 1 });
  });

  it("no marca advertencia cuando todos los importes son visibles", () => {
    expect(creditPendingSummary([{ pending: 100 }, { pending: 40 }])).toEqual({
      visibleTotal: 140,
      hiddenCount: 0,
    });
  });

  it("no presenta cero como deuda total cuando todos los importes están ocultos", () => {
    expect(
      creditPendingSummary([
        { pending: null, hiddenUntilClose: true },
        { pending: null, hiddenUntilClose: true },
      ]),
    ).toEqual({ visibleTotal: 0, hiddenCount: 2 });
  });
});
