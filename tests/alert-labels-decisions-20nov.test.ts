import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Decisiones 20-nov · etiquetas de avisos", () => {
  const source = readFileSync("apps/web/src/Management.tsx", "utf8");

  it.each([
    ["offline_zero_cost_sale", "Venta sin costo sincronizada"],
    ["low_margin_discount", "Margen menor a 15 %"],
    ["terminal_auto_limit", "Equipos de más"],
  ])("muestra %s con un nombre claro en español", (type, label) => {
    expect(source).toContain(`${type}: "${label}"`);
  });

  it.each([
    ["offline_zero_cost_sale", "Synced sale without cost"],
    ["low_margin_discount", "Margin below 15%"],
    ["terminal_auto_limit", "Too many devices"],
  ])("traduce %s al usar la interfaz en inglés", (type, label) => {
    expect(source).toContain(`${type}: "${label}"`);
  });
});
