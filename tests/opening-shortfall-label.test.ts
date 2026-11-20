import { describe, expect, it } from "vitest";
import { alertTypeLabel } from "../apps/web/src/alertTypeLabel";

describe("etiquetas de avisos A7", () => {
  it.each([
    ["opening_shortfall", "Fondo de apertura menor", "Opening fund shortfall"],
    ["cash_payments_replaced", "Pagos corregidos en caja", "Register payments corrected"],
    ["cash_after_close", "Caja modificada después del cierre", "Register changed after closing"],
    ["zero_cost_sale", "Venta sin costo sincronizada", "Synced sale without cost"],
    ["offline_zero_cost_sale", "Venta sin costo sincronizada", "Synced sale without cost"],
    ["low_margin_discount", "Margen menor a 15 %", "Margin below 15%"],
    ["terminal_auto_limit", "Equipos de más", "Extra devices"],
  ])("traduce %s en español e inglés", (type, spanish, english) => {
    expect(alertTypeLabel(type, false)).toBe(spanish);
    expect(alertTypeLabel(type, true)).toBe(english);
  });

  it("hace legible un tipo desconocido sin inventar una traducción", () => {
    expect(alertTypeLabel("future_alert_type", false)).toBe(
      "future alert type",
    );
    expect(alertTypeLabel("future_alert_type", true)).toBe(
      "future alert type",
    );
  });
});
