import { expect, it } from "vitest";
import { buildKpis } from "../apps/web/src/kpiStripModel";

const day = {
  revenue: 1000,
  costTotal: 600,
  margin: 40,
  invoices: 3,
  alerts: [
    { type: "low_stock" },
    { type: "out_of_stock" },
    { type: "overstock" },
  ],
};

it("con profit:read muestra ventas, utilidad con margen (venta − costo)/venta, cajas y alertas", () => {
  const k = buildKpis({
    day,
    sessions: [{ closedAt: null }, { closedAt: "2026-10-30" }],
    showProfit: true,
  });
  expect(k.map((x) => x.key)).toEqual([
    "ventas",
    "utilidad",
    "cajas",
    "inventario",
  ]);
  expect(k[0].value).toContain("1,000");
  expect(k[1].value).toContain("400");
  expect(k[1].note).toBe("40% de margen");
  expect(k[2].value).toBe("1");
  expect(k[3].value).toBe("2");
});

it("sin profit:read no hay utilidad ni costo; sin acceso a cajas no hay tarjeta de cajas", () => {
  const k = buildKpis({ day, showProfit: false });
  expect(k.map((x) => x.key)).toEqual(["ventas", "inventario"]);
  expect(JSON.stringify(k)).not.toContain("margen");
});

it("sin datos no inventa cifras", () => {
  const k = buildKpis({ showProfit: false });
  expect(k[0].note).toBe("0 facturas");
  expect(k[1].value).toBe("0");
});
