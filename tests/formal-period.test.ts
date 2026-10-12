import { describe, expect, it } from "vitest";
import {
  formalPeriod,
  reportMargin,
  isTestRegister,
} from "../apps/api/src/formal-period";

describe("3z · períodos, margen y cajas de prueba", () => {
  it("cierra mes completo y rechaza fechas imposibles", () => {
    expect(formalPeriod("month", "2026-02")).toMatchObject({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(formalPeriod("month", "2028-02").to).toBe("2028-02-29");
    expect(() => formalPeriod("day", "2026-02-30")).toThrow();
  });
  it("margen usa precio con ITBIS incluido y distingue cajas QA", () => {
    expect(reportMargin(43800, 36300)).toBe(17.12);
    expect(isTestRegister("QA-cred-123")).toBe(true);
    expect(isTestRegister("terminal-1")).toBe(false);
  });
});
