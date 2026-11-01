import { describe, expect, it } from "vitest";
import {
  sessionActivityGraceMs,
  TERMINAL_ONLINE_MS,
} from "../apps/api/src/session-activity";
import { parseUsdRate, usdPrice } from "../apps/api/src/usd-rate";
import { assertSheetCells, cellCodeText } from "../apps/api/src/xlsx-guard";

// Pieza 22 de la cola permanente: una prueba por módulo de apps/api con pocas
// pruebas directas. Solo pruebas; no cambia código de producción.

describe("sesiones · margen de inactividad", () => {
  it("con plazo menor de 10 minutos no hay margen", () => {
    expect(sessionActivityGraceMs(9 * 60_000)).toBe(0);
  });

  it("con plazo de 10 minutos o más, el margen es el intervalo de escritura", () => {
    expect(sessionActivityGraceMs(10 * 60_000)).toBe(60_000);
    expect(TERMINAL_ONLINE_MS).toBe(90_000);
  });
});

describe("tasa USD/DOP", () => {
  it("lee la tasa de rates.DOP y la redondea a 4 decimales", () => {
    expect(parseUsdRate({ rates: { DOP: 60.123456 } })).toBe(60.1235);
  });

  it("rechaza tasas fuera de 20–500 y respuestas sin tasa", () => {
    expect(() => parseUsdRate({ rates: { DOP: 20 } })).toThrow();
    expect(() => parseUsdRate({ rates: { DOP: 500 } })).toThrow();
    expect(() => parseUsdRate({})).toThrow();
    expect(() => parseUsdRate(null)).toThrow();
  });

  it("precio en pesos redondeado a centavos", () => {
    expect(usdPrice(10, 60.1235)).toBe(601.24);
  });
});

describe("xlsx · códigos de celda", () => {
  it("un entero con formato de ceros conserva los ceros a la izquierda", () => {
    expect(cellCodeText({ value: 123, numFmt: "00000", text: "123" })).toBe(
      "00123",
    );
  });

  it("un entero sin formato de ceros se devuelve tal cual", () => {
    expect(cellCodeText({ value: 123, numFmt: "General", text: "123" })).toBe(
      "123",
    );
  });

  it("el resto de celdas se lee como texto sin espacios sobrantes", () => {
    expect(cellCodeText({ value: "  ABC ", text: "  ABC " })).toBe("ABC");
    expect(cellCodeText({ value: 1.5, text: "1.5" })).toBe("1.5");
  });
});

describe("xlsx · presupuesto de celdas", () => {
  it("hoja sin contenido o dentro del presupuesto pasa", () => {
    expect(() => assertSheetCells(undefined)).not.toThrow();
    expect(() =>
      assertSheetCells({ rowCount: 5, columnCount: 10 } as any, 50),
    ).not.toThrow();
  });

  it("hoja que supera el máximo de celdas se rechaza", () => {
    expect(() =>
      assertSheetCells({ rowCount: 10, columnCount: 10 } as any, 50),
    ).toThrow(/demasiadas celdas/);
  });
});
