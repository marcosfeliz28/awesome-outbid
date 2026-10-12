import { describe, expect, it } from "vitest";
import { groupIncomeDays } from "../apps/api/src/income-day";
import { businessDate } from "../packages/shared/src/index";

describe("3w · movimientos por día de República Dominicana", () => {
  it("cambia de día a las 00:00 de Santo Domingo", () => {
    expect(businessDate("2026-10-12T03:59:59Z")).toBe("2026-10-11");
    expect(businessDate("2026-10-12T04:00:00Z")).toBe("2026-10-12");
  });
  it("separa venta, crédito cobrado otro día y devolución sin doble conteo", () => {
    const rows = groupIncomeDays([
      { day: "2026-10-11", kind: "sold", amount: "100.01" },
      { day: "2026-10-11", kind: "sale_cash", amount: "0.01" },
      { day: "2026-10-11", kind: "credit_generated", amount: "100.00" },
      { day: "2026-10-12", kind: "collection_card", amount: "100.00" },
      { day: "2026-10-12", kind: "return_total", amount: "-0.01" },
      { day: "2026-10-12", kind: "return_cash", amount: "-0.01" },
    ]);
    expect(rows).toMatchObject([
      { day: "2026-10-11", sold: 100.01, moneyIn: 0.01, creditGenerated: 100 },
      { day: "2026-10-12", sold: -0.01, moneyIn: 99.99, collectionCard: 100 },
    ]);
  });
  it("suma centavos y método de devolución con signo", () => {
    expect(
      groupIncomeDays([
        { day: "2026-10-12", kind: "sale_transfer", amount: "0.10" },
        { day: "2026-10-12", kind: "sale_transfer", amount: "0.20" },
        { day: "2026-10-12", kind: "return_transfer", amount: "-0.01" },
      ])[0].moneyIn,
    ).toBe(0.29);
  });
});
