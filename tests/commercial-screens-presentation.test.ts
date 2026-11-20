import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) =>
  readFileSync(new URL("../apps/web/src/" + name, import.meta.url), "utf8");

describe("Presentación comercial: reportes, POS, Caja y tablero", () => {
  it("traduce códigos de Reportes sin perder referencias legibles ni importes", async () => {
    const { reportDisplayRows } = await import("../apps/web/src/report-format");
    expect(
      reportDisplayRows("by-payment", [{ Método: "cash", Total: 125 }]),
    ).toEqual([{ Método: "Efectivo", Total: 125 }]);
    expect(
      reportDisplayRows("kardex", [{ Tipo: "return_waste", Cantidad: -2 }]),
    ).toEqual([{ Tipo: "Merma por devolución", Cantidad: -2 }]);
    const legacy = { Evento: "return", Referencia: "DEV-001" };
    expect(reportDisplayRows("returns-discounts", [legacy])).toEqual([
      { Evento: "Devolución", Referencia: "DEV-001" },
    ]);
    expect(legacy.Evento).toBe("return");
    expect(
      reportDisplayRows("returns-discounts", [
        { Evento: "void", Referencia: "id-interno", Factura: "001" },
      ]),
    ).toEqual([{ Evento: "Anulación", Factura: "001" }]);
    expect(read("Management.tsx")).toContain("rows={displayRows}");
  });

  it("muestra servicio en vez de Infinity, sin perder existencias numéricas", async () => {
    const { posStockLabel } = await import("../apps/web/src/posStockLabel");
    expect(posStockLabel(Infinity, true, "es")).toBe("Servicio");
    expect(posStockLabel(Infinity, true, "en")).toBe("Service");
    expect(posStockLabel(-2, false, "es")).toBe("-2 en stock");
    expect(posStockLabel(0, false, "en")).toBe("0 in stock");
    expect(read("POS.tsx")).toContain(
      "posStockLabel(stock, isService(p), language)",
    );
  });

  it("traduce los botones de impresión sin cambiar sus acciones", async () => {
    const { cashPrintLabel } =
      await import("../apps/web/src/cashPrintLanguage");
    expect(cashPrintLabel("Cuadre", "es")).toBe("Cuadre");
    expect(cashPrintLabel("Cuadre", "en")).toBe("Reconciliation");
    expect(cashPrintLabel("Por forma de pago del día", "en")).toBe(
      "Daily payment-method report",
    );
    const tienda = read("Tienda.tsx");
    expect(tienda).toContain('onClick={() => open("cuadre")}');
    expect(tienda).toContain('cashPrintLabel("Cuadre", language)');
  });

  it("distribuye por mayor resto y conserva un total visible de 100%", async () => {
    const { dashboardCategoryShares } =
      await import("../apps/web/src/dashboardCategoryShares");
    const equal = dashboardCategoryShares([1, 1, 1]);
    expect(equal.map(({ rounded }) => rounded)).toEqual([34, 33, 33]);
    expect(equal[0].exact).toBeCloseTo(100 / 3);
    expect(
      dashboardCategoryShares([1, 2, 4, 0]).map(({ rounded }) => rounded),
    ).toEqual([14, 29, 57, 0]);
    expect(
      dashboardCategoryShares([0, 0]).map(({ rounded }) => rounded),
    ).toEqual([0, 0]);
    expect(dashboardCategoryShares([])).toEqual([]);
    expect(read("Dashboard.tsx")).toContain("{rounded}%");
  });
});
