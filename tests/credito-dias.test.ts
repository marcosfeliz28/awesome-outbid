import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as shared from "../packages/shared/src/index";

// Orden de la dueña (19-oct-2026): créditos y contraentregas sin fecha de
// vencimiento, pero con una casilla que diga el día de la venta y cuente los
// días que lleva sin cerrarse.
const daysSince = (shared as any).daysSince as (
  from: Date | string,
  to?: Date | string,
) => number;

describe("Créditos / contraentregas · días que llevan sin cerrarse", () => {
  it("cuenta días de calendario de Santo Domingo, no bloques de 24 horas", () => {
    // Vendida anoche 9:00 p. m. (RD) y mirada hoy 8:00 a. m.: ya lleva 1 día.
    const sale = "2026-10-19T01:00:00.000Z";
    expect(daysSince(sale, "2026-10-19T12:00:00.000Z")).toBe(1);
    // Mismo día en RD aunque en UTC ya sea otro: 0 días.
    expect(
      daysSince("2026-10-19T10:00:00.000Z", "2026-10-20T03:00:00.000Z"),
    ).toBe(0);
    expect(daysSince(sale, "2026-10-29T12:00:00.000Z")).toBe(11);
    // Nunca negativo (reloj desfasado).
    expect(
      daysSince("2026-10-20T12:00:00.000Z", "2026-10-19T12:00:00.000Z"),
    ).toBe(0);
  });

  it("la API usa ese conteo y, si ya se cerró, cuenta hasta el cierre", () => {
    const api = readFileSync("apps/api/src/sales.ts", "utf8");
    expect(api).toContain(
      "ageDays: daysSince(s.createdAt, s.creditClosedAt ?? now)",
    );
    expect(api).toContain(
      "oldestDays: g._min.createdAt ? daysSince(g._min.createdAt) : 0",
    );
  });

  it("la lista muestra la casilla con el día de la venta y los días, sin vencimiento", () => {
    const web = readFileSync("apps/web/src/Tienda.tsx", "utf8");
    expect(web).toContain('className="cod-age"');
    expect(web).toContain("Día de la venta:");
    expect(web).toContain("sin cobrar");
    expect(web).toContain("Se cobró en");
    expect(web).not.toMatch(/creditDueDate|Vence el/);
  });
});
