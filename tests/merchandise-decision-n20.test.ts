import { describe, expect, it } from "vitest";
import { merchandiseDecision } from "../apps/web/src/merchandiseDecision";

describe("N-20 · decisiones explícitas en mercancía", () => {
  it("explica que cambiar de modo descarta las líneas sin registrar stock", () => {
    expect(merchandiseDecision("change-mode", { lines: 3 })).toEqual({
      title: "Cambiar de modo",
      consequence:
        "Se descartarán 3 líneas sin registrar ningún movimiento de inventario.",
      confirmLabel: "Descartar y cambiar",
    });
  });

  it("distingue entrada y salida e informa las unidades afectadas", () => {
    expect(
      merchandiseDecision("register", {
        direction: "entry",
        units: 5,
        damaged: 2,
      }).consequence,
    ).toBe(
      "Se registrarán 5 unidades en inventario. Otras 2 dañadas no entrarán al stock.",
    );
    expect(
      merchandiseDecision("register", {
        direction: "exit",
        units: 5,
        reason: "Merma",
      }).consequence,
    ).toBe("Se descontarán 5 unidades del inventario por merma.");
  });

  it("aclara que cargar un conflicto no borra la operación original", () => {
    expect(merchandiseDecision("review-conflict", {}).consequence).toBe(
      "La operación original seguirá en la cola hasta que confirmes la corrección.",
    );
  });
});
