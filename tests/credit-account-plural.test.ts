import { describe, expect, it } from "vitest";
import { creditSalesCount } from "../apps/web/src/cashLanguage";

describe("CC-10 · plural de ventas por cliente", () => {
  it.each([
    [1, false, "es", "1 venta abierta"],
    [2, false, "es", "2 ventas abiertas"],
    [1, true, "es", "1 venta pagada"],
    [2, true, "es", "2 ventas pagadas"],
    [1, false, "en", "1 open sale"],
    [2, false, "en", "2 open sales"],
    [1, true, "en", "1 paid sale"],
    [2, true, "en", "2 paid sales"],
  ] as const)("formatea %i", (count, paid, language, expected) => {
    expect(creditSalesCount(count, paid, language)).toBe(expected);
  });
});
