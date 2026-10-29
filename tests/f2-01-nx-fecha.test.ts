import { describe, it, expect } from "vitest";
import { fechaCorta } from "../packages/ui/src/nx-fecha";

describe("nx-fecha", () => {
  it("usa la fecha de República Dominicana (UTC-4), no la del equipo", () => {
    expect(fechaCorta("2026-10-29T02:30:00Z", "es")).toBe("28/10/2026");
    expect(fechaCorta("2026-10-29T12:00:00Z", "es")).toBe("29/10/2026");
  });

  it("formatea en inglés como MM/DD/YYYY", () => {
    expect(fechaCorta("2026-10-29T02:30:00Z", "en")).toBe("10/28/2026");
    expect(fechaCorta("2026-10-29T12:00:00Z", "en")).toBe("10/29/2026");
  });

  it("devuelve una raya cuando la fecha no es válida", () => {
    expect(fechaCorta("no-es-fecha", "es")).toBe("—");
    expect(fechaCorta("no-es-fecha", "en")).toBe("—");
  });
});
