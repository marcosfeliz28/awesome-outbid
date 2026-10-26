import { describe, expect, it, vi } from "vitest";
import { askAssistant, executeAssistantTool } from "../apps/api/src/assistant";

// Auditoría AUD-NUEVO, sección A (IA-01…IA-07).
describe("AUD-NUEVO · IA", () => {
  it("IA-02: un JSON cortado no llega al modelo sin redactar", async () => {
    const get = vi.fn().mockResolvedValue({
      status: 200,
      body: '[{"number":"FS-1","password":"SECRETO_99","token":"TK_77"',
    });
    const result = await executeAssistantTool(
      "transferencias_por_verificar",
      { fecha: "2026-10-24" },
      get,
    );
    expect(result).not.toContain("SECRETO_99");
    expect(result).not.toContain("TK_77");
    expect(result).toContain("no es válida");
  });
});
