import { describe, expect, it } from "vitest";
import { exportPath, exportFileName } from "../apps/web/src/reportExport";

describe("descarga de reportes", () => {
  it("arma la URL con nombre, rango y formato", () => {
    expect(
      exportPath("ventas-por-hora", "2026-11-01", "2026-11-30", "pdf"),
    ).toBe(
      "/reports/ventas-por-hora/export?from=2026-11-01&to=2026-11-30&format=pdf",
    );
    expect(exportPath("a b", "x", "y", "xlsx")).toContain(
      "/reports/a%20b/export?",
    );
    expect(exportFileName("ventas-por-hora", "xlsx")).toBe(
      "ventas-por-hora.xlsx",
    );
  });
});
