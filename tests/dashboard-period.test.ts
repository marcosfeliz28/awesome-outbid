import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dashboardSevenDayStart } from "../apps/web/src/dashboardPeriod";

describe("P2 · últimos siete días del Resumen", () => {
  it("incluye siete fechas civiles y no solo desde el lunes", () => {
    expect(dashboardSevenDayStart("2026-11-19")).toBe("2026-11-13");
    expect(dashboardSevenDayStart("2026-11-16")).toBe("2026-11-10");
  });

  it("cruza mes y año sin desplazar la fecha", () => {
    expect(dashboardSevenDayStart("2026-03-03")).toBe("2026-02-25");
    expect(dashboardSevenDayStart("2027-01-03")).toBe("2026-12-28");
  });

  it("conecta el helper al rango que comparten resumen y exportación", () => {
    const dashboard = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
    expect(dashboard).toContain("? dashboardSevenDayStart(to)");
    expect(dashboard).not.toContain("? weekStart()");
  });
});
