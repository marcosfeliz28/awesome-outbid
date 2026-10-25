import { describe, expect, it } from "vitest";
import { closeCashAssistant } from "../apps/web/src/cash-close-assistant";

describe("N-09 · ayuda antes del cierre ciego", () => {
  it("no inventa una causa ni muestra el esperado a una cajera", () => {
    const result = closeCashAssistant("cash", 0);
    expect(result.lines).toHaveLength(3);
    expect(result.lines.join(" ")).toContain("no permite saber la causa");
    expect(result.lines.join(" ")).not.toMatch(/esperado|RD\$/i);
    expect(result.note).toContain("pendiente de comprobar");
  });

  it("propone sincronizar pendientes antes de cerrar", () => {
    const result = closeCashAssistant("pending", 2);
    expect(result.lines[0]).toContain("2 ventas");
    expect(result.note).toBeNull();
  });
});
