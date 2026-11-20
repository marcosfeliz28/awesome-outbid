import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  reportCellTextForLanguage,
  reportColumnIsMoney,
} from "../apps/web/src/reportPresentationCopy";
import { reportAppliedRange } from "../apps/web/src/reportDateRange";

const management = readFileSync(
  new URL("../apps/web/src/Management.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../apps/web/src/styles.css", import.meta.url),
  "utf8",
);

describe("presentación de reportes en Management", () => {
  it("traduce códigos, oculta columnas internas y muestra las filas preparadas", () => {
    expect(management).toContain("reportCellText");
    expect(management).toContain("reportColumnVisible");
    expect(management).toContain("reportDisplayRows");
    expect(management).toMatch(
      /\.filter\(\(k\) => k !== "class" && reportColumnVisible\(report, k\)\)/,
    );
    expect(management).toMatch(
      /reportCellTextForLanguage\(report, key, row\[key\], en\)/,
    );
    expect(management).toContain("rows={displayRows}");
  });

  it("presenta métodos y eventos en el idioma elegido sin alterar los datos", () => {
    expect(
      reportCellTextForLanguage("by-payment", "Método", "cash", true),
    ).toBe("Cash");
    expect(
      reportCellTextForLanguage("returns-discounts", "Evento", "return", true),
    ).toBe("Return");
    expect(
      reportCellTextForLanguage("kardex", "Tipo", "return_waste", true),
    ).toBe("Returned item written off");
    expect(
      reportCellTextForLanguage("by-payment", "Método", "cash", false),
    ).toBe("Efectivo");
  });

  it("distingue importes de cantidades y porcentajes", () => {
    expect(reportColumnIsMoney("sales", "Total")).toBe(true);
    expect(reportColumnIsMoney("kardex", "Costo")).toBe(true);
    expect(reportColumnIsMoney("sales", "Factura")).toBe(false);
    expect(reportColumnIsMoney("profit", "Unidades")).toBe(false);
    expect(reportColumnIsMoney("profit", "Margen")).toBe(false);
    expect(reportColumnIsMoney("kardex", "Saldo")).toBe(false);
    expect(management).toContain("return formatMoney(Number(value))");
  });

  it("muestra el error del catálogo con reintento y fija encabezados", () => {
    expect(management).toContain("extra.isError");
    expect(management).toContain("extra.refetch()");
    expect(styles).toMatch(
      /data-premium-area="reports"[^}]*\.table-wrap[^}]*thead th[^{]*\{[^}]*position:\s*sticky/s,
    );
  });

  it("expone el rango aplicado cuando Desde queda vacío", () => {
    expect(reportAppliedRange("", "2026-11-20", "2026-11-20")).toEqual({
      from: "2026-10-21",
      to: "2026-11-20",
      usedDefaultFrom: true,
    });
    expect(
      reportAppliedRange("2026-11-01", "2026-11-20", "2026-11-20"),
    ).toEqual({
      from: "2026-11-01",
      to: "2026-11-20",
      usedDefaultFrom: false,
    });
  });
});
