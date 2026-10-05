import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractAnthropic,
  nameConfidence,
  parseExtraction,
  readInvoiceTable,
} from "../apps/api/src/merchandise";
afterEach(() => vi.unstubAllGlobals());
describe("Factura proveedor · extracción simulada", () => {
  it("valida JSON de IA y no llama Anthropic real", async () => {
    const extracted = {
      total: 25,
      lines: [
        {
          code: "ABC",
          description: "Proteína",
          qty: 2,
          unitCost: 12.5,
          lotNumber: "L1",
          expiryDate: "2027-01-01",
        },
      ],
    };
    const fake = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            content: [{ type: "tool_use", name: "invoice", input: extracted }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fake);
    const result = await extractAnthropic(
      { buffer: Buffer.from("mock PDF"), mimetype: "application/pdf" },
      "fake-test-key",
    );
    expect(result).toEqual(extracted);
    expect(fake).toHaveBeenCalledTimes(1);
    const req = JSON.parse(fake.mock.calls[0][1].body);
    expect(req.tool_choice).toEqual({ type: "tool", name: "invoice" });
    expect(req.messages[0].content[0].type).toBe("document");
  });
  it("rechaza salida inválida y fallo del servicio", async () => {
    expect(() =>
      parseExtraction({ lines: [{ description: "X", qty: -1, unitCost: 1 }] }),
    ).toThrow();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("error", { status: 503 })),
    );
    await expect(
      extractAnthropic(
        { buffer: Buffer.from("mock"), mimetype: "image/png" },
        "fake",
      ),
    ).rejects.toThrow();
  });
  it("CSV respeta comillas y mapeo y rechaza cantidades inválidas", async () => {
    const map = {
      code: "Código",
      description: "Detalle",
      qty: "Unidades",
      unitCost: "Precio",
    };
    expect(
      (
        await readInvoiceTable(
          Buffer.from(
            'Código,Detalle,Unidades,Precio\nSKU,"Artículo, azul",2,10\n',
          ),
          "csv",
          map,
        )
      ).lines[0],
    ).toMatchObject({
      code: "SKU",
      description: "Artículo, azul",
      qty: 2,
      unitCost: 10,
    });
    await expect(
      readInvoiceTable(
        Buffer.from("Código,Detalle,Unidades,Precio\nSKU,X,-2,10\n"),
        "csv",
        map,
      ),
    ).rejects.toThrow();
  });
  it("nombre normalizado sugiere coincidencia y distingue líneas sin pareja", () => {
    expect(nameConfidence("Proteína vainilla", "proteina vainilla")).toBe(1);
    expect(nameConfidence("Zapato negro", "Proteína vainilla")).toBe(0);
  });
});
