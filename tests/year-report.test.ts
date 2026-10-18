import { describe, expect, it } from "vitest";
import {
  monthNames,
  monthRange,
  monthShares,
  reportCsv,
} from "../apps/web/src/year-report-utils";

describe("círculo de ventas del año", () => {
  it("rango de cada mes, también febrero bisiesto", () => {
    expect(monthRange(2026, 10)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(monthRange(2026, 2).to).toBe("2026-02-28");
    expect(monthRange(2028, 2).to).toBe("2028-02-29");
    expect(monthNames).toHaveLength(12);
  });
  it("los porcentajes del círculo suman 100 y sin ventas son 0", () => {
    const shares = monthShares([100, 300, 0, 600]);
    expect(shares.reduce((a, v) => a + v, 0)).toBeCloseTo(100, 6);
    expect(shares[3]).toBeCloseTo(60, 6);
    expect(monthShares([0, 0, 0]).every((v) => v === 0)).toBe(true);
    expect(monthShares([-5, 10])[0]).toBe(0);
  });
  it("el CSV protege contra fórmulas", () => {
    const csv = reportCsv([
      ["Producto", "Uds"],
      ["=HYPERLINK(1)", 3],
    ]);
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv.startsWith("﻿")).toBe(true);
  });
});
