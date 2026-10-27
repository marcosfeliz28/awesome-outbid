import { describe, expect, it, vi } from "vitest";
import { executeAssistantTool } from "../apps/api/src/assistant";

// B-01: con la bandera encendida /api/sales manda total:null, payments:[] y
// hiddenUntilClose; el modelo debe saber que es «oculto», no «sin pagos».
const sale = (extra: object) => JSON.stringify([{
  number: "FS-1", status: "completed", createdAt: "2026-10-24T15:00:00Z",
  items: [{ qty: 1, variant: { product: { name: "Proteína" } } }], ...extra,
}]);
const run = (body: string) =>
  executeAssistantTool("detalle_factura", { numero: "FS-1" },
    vi.fn().mockResolvedValue({ status: 200, body }));

describe("asistente · detalle_factura con caja ciega", () => {
  it("importes ocultos: lo dice y no inventa pagos ni totales", async () => {
    const out = String(await run(sale({
      total: null, subtotal: null, taxTotal: null, discountTotal: null,
      payments: [], hiddenUntilClose: true,
    })));
    expect(out).toContain("se ven al cerrar tu caja");
    expect(out).not.toMatch(/"pagos"|"total"|"subtotal"|"itbis"|"precio"/);
  });

  it("sin la marca, sigue entregando total y pagos", async () => {
    const out = String(await run(sale({
      total: 100, subtotal: 100, payments: [{ method: "cash", amount: 100, status: "ok" }],
    })));
    expect(out).toContain('"total":100');
    expect(out).toContain('"pagos"');
    expect(out).not.toContain("cerrar tu caja");
  });
});
