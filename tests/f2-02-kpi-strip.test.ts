import { expect, it } from "vitest";
import { buildKpis, kpiStripVisible } from "../apps/web/src/kpiStripModel";

const day = {
  revenue: 1000,
  invoices: 3,
  alerts: [
    { type: "low_stock" },
    { type: "out_of_stock" },
    { type: "overstock" },
  ],
};

it("muestra ventas, cajas y alertas tal como las devuelve la API, sin utilidad ni margen", () => {
  const k = buildKpis({
    day: { ...day, costTotal: 600, margin: 40 } as any,
    sessions: [{ closedAt: null }, { closedAt: "2026-10-30" }],
  });
  expect(k.map((x) => x.key)).toEqual(["ventas", "cajas", "inventario"]);
  expect(k[0].value).toContain("1,000");
  expect(k[1].value).toBe("1");
  expect(k[2].value).toBe("2");
  expect(JSON.stringify(k)).not.toMatch(/utilidad|margen|costo/i);
});

it("sin acceso a cajas no hay tarjeta de cajas", () => {
  const k = buildKpis({ day });
  expect(k.map((x) => x.key)).toEqual(["ventas", "inventario"]);
});

it("sin reports:read la franja no se muestra (nada de RD$ 0.00 sin consultar)", () => {
  expect(kpiStripVisible(["cash:write"])).toBe(false);
  expect(kpiStripVisible(["reports:read"])).toBe(true);
});

it("DIS-01: mientras carga o si falla, no muestra ceros ni «Sin faltantes»", () => {
  for (const status of ["pending", "error"] as const) {
    const k = buildKpis({ day: undefined, dayStatus: status });
    const text = JSON.stringify(k);
    expect(text).not.toMatch(/RD\$|Sin faltantes|\b0 facturas/);
    expect(k[0].value).toBe("—");
    expect(k[0].note).toBe(
      status === "error" ? "No se pudo cargar" : "Cargando…",
    );
  }
});

it("DIS-01: una respuesta válida con ceros sí muestra cero y «Sin faltantes»", () => {
  const k = buildKpis({
    day: { revenue: 0, invoices: 0, alerts: [] },
    dayStatus: "success",
  });
  expect(k[0].value).toContain("0");
  expect(k[0].note).toBe("0 facturas");
  expect(k[k.length - 1].note).toBe("Sin faltantes");
});
