import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  buildReportExportPath,
  reportExportFilename,
} from "../apps/web/src/report-export-utils";

describe("Pieza 1 · exportación de reportes", () => {
  it("conserva el período visible en la ruta PDF/XLSX nueva", () => {
    expect(buildReportExportPath("sales", "pdf", "2026-11-01", "2026-11-30")).toBe(
      "/reports/sales/export?format=pdf&from=2026-11-01&to=2026-11-30",
    );
    expect(buildReportExportPath("inventory", "xlsx", "2026-11-01", "2026-11-30")).toBe(
      "/reports/inventory/export?format=xlsx&from=2026-11-01&to=2026-11-30",
    );
  });

  it("nombra la descarga con reporte y período, sin caracteres de ruta", () => {
    expect(reportExportFilename("Ventas / día", "pdf", "2026-11-01", "2026-11-30")).toBe(
      "ventas-dia-2026-11-01-a-2026-11-30.pdf",
    );
  });

  it("da la misma acción accesible a los tres tipos de informe", () => {
    for (const file of ["Management.tsx", "FormalReports.tsx", "MonthReport.tsx"]) {
      const source = readFileSync(`apps/web/src/${file}`, "utf8");
      expect(source, file).toContain("ReportExportActions");
    }
    const actions = readFileSync("apps/web/src/ReportExportActions.tsx", "utf8");
    expect(actions).toContain('aria-live="polite"');
    expect(actions).toContain("No hay datos para exportar con estos filtros.");
  });
});
