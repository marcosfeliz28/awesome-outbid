import { describe, expect, it } from "vitest";
import { allocateCredit } from "../apps/api/src/credit-allocation";

const old = new Date("2026-01-01T00:00:00Z");
const recent = new Date("2026-01-02T00:00:00Z");
describe("3v: reparto por antigüedad con centavos exactos", () => {
  const sales = [
    { id: "new", createdAt: recent, availableCents: 200 },
    { id: "old", createdAt: old, availableCents: 101 },
  ];
  it("paga primero la factura antigua y conserva el centavo", () => {
    expect(allocateCredit(sales, 102)).toEqual([
      { saleId: "old", amountCents: 101 },
      { saleId: "new", amountCents: 1 },
    ]);
    expect(sales[0].availableCents).toBe(200);
  });
  it("rechaza sobrepago y monto no positivo", () => {
    expect(() => allocateCredit(sales, 302)).toThrow("supera");
    expect(() => allocateCredit(sales, 0)).toThrow("positivo");
  });
  it("ignora ventas sin disponible y desempata por ID", () => {
    expect(
      allocateCredit(
        [
          { id: "b", createdAt: old, availableCents: 0 },
          { id: "a", createdAt: old, availableCents: 1 },
        ],
        1,
      ),
    ).toEqual([{ saleId: "a", amountCents: 1 }]);
  });
});
