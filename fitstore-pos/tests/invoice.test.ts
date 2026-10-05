import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import {
  decodeCsv,
  extractAnthropic,
  matchInvoiceLines,
  nameConfidence,
  parseExtraction,
  parseInvoiceNumber,
  readInvoiceTable,
} from "../apps/api/src/invoice";
// exceljs es dependencia de la API; se resuelve desde su paquete.
const ExcelJS = createRequire(
  new URL("../apps/api/package.json", import.meta.url),
)("exceljs");

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
// Respuesta simulada de la API de mensajes con salida estructurada (JSON en texto).
function claudeResponse(
  body: unknown,
  stop_reason = "end_turn",
  status = 200,
): Response {
  return new Response(
    JSON.stringify(
      status === 200
        ? {
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-opus-5-5",
            content:
              stop_reason === "refusal"
                ? []
                : [{ type: "text", text: JSON.stringify(body) }],
            stop_reason,
            stop_sequence: null,
            usage: { input_tokens: 10, output_tokens: 10 },
          }
        : {
            type: "error",
            error: { type: "invalid_request_error", message: "x" },
          },
    ),
    { status, headers: { "content-type": "application/json" } },
  );
}

describe("Factura proveedor · Claude simulado (sin llamadas reales)", () => {
  it("usa el SDK oficial, el modelo actual y salida estructurada sin forzar herramientas", async () => {
    const fake = vi.fn().mockResolvedValue(
      claudeResponse({
        total: 25,
        lines: [{ ...extracted.lines[0] }],
      }),
    );
    const result = await extractAnthropic(
      { buffer: Buffer.from("mock PDF"), mimetype: "application/pdf" },
      "fake-test-key",
      { fetch: fake as any },
    );
    expect(result).toEqual({ ...extracted, skipped: 0 });
    expect(fake).toHaveBeenCalledTimes(1);
    const [url, init] = fake.mock.calls[0];
    expect(String(url)).toContain("/v1/messages");
    const req = JSON.parse(init.body);
    expect(req.model).toBe("claude-opus-5-5");
    expect(req.tool_choice).toBeUndefined();
    expect(req.tools).toBeUndefined();
    expect(req.output_config.format.type).toBe("json_schema");
    expect(req.fallbacks).toBe("default");
    expect(new Headers(init.headers).get("anthropic-beta")).toContain(
      "server-side-fallback-2026-07-01",
    );
    expect(req.messages[0].content[0].type).toBe("document");
    expect(req.messages[0].content[0].source.media_type).toBe(
      "application/pdf",
    );
  });
  it("las fotos van como imagen, omite líneas ilegibles y normaliza vacíos", async () => {
    const fake = vi.fn().mockResolvedValue(
      claudeResponse({
        total: 0,
        lines: [
          {
            code: " 0071 ",
            description: "Shaker lila",
            qty: 3,
            unitCost: 150,
            lotNumber: "",
            expiryDate: "",
          },
          {
            code: "",
            description: "borroso",
            qty: 0,
            unitCost: 0,
            lotNumber: "",
            expiryDate: "",
          },
        ],
      }),
    );
    const result = await extractAnthropic(
      { buffer: Buffer.from("png"), mimetype: "image/png" },
      "fake",
      { fetch: fake as any },
    );
    expect(result.skipped).toBe(1);
    expect(result.total).toBeNull();
    expect(result.lines).toEqual([
      {
        code: "0071",
        description: "Shaker lila",
        qty: 3,
        unitCost: 150,
        lotNumber: null,
        expiryDate: null,
      },
    ]);
    const req = JSON.parse(fake.mock.calls[0][1].body);
    expect(req.messages[0].content[0].type).toBe("image");
  });
  it("rechazo, error de la API y salida inválida dan mensajes en español", async () => {
    await expect(
      extractAnthropic(
        { buffer: Buffer.from("x"), mimetype: "image/png" },
        "k",
        {
          fetch: vi
            .fn()
            .mockResolvedValue(claudeResponse({}, "refusal")) as any,
        },
      ),
    ).rejects.toThrow("Usa Excel/CSV");
    await expect(
      extractAnthropic(
        { buffer: Buffer.from("x"), mimetype: "image/png" },
        "k",
        {
          fetch: vi
            .fn()
            .mockResolvedValue(claudeResponse({}, "end_turn", 400)) as any,
        },
      ),
    ).rejects.toThrow("no se pudo procesar");
    expect(() =>
      parseExtraction({ lines: [{ description: "X", qty: -1, unitCost: 1 }] }),
    ).toThrow();
  });
});

describe("Factura proveedor · números y archivos", () => {
  it("entiende los formatos de número de las facturas", () => {
    const cases: [unknown, number][] = [
      ["1,200.00", 1200],
      ["RD$ 450", 450],
      ["RD$1,250.50", 1250.5],
      ["US$ 12.5", 12.5],
      ["1.200,50", 1200.5],
      ["0,75", 0.75],
      ["1,5", 1.5],
      ["1,200", 1200],
      ["1.200.000", 1200000],
      [15, 15],
      ["  3 ", 3],
    ];
    for (const [raw, expected] of cases)
      expect(parseInvoiceNumber(raw)).toBe(expected);
    expect(parseInvoiceNumber("abc")).toBeNaN();
    expect(parseInvoiceNumber("")).toBeNaN();
  });
  it("CSV con comillas y mapeo personalizado", async () => {
    const map = {
      code: "Código",
      description: "Detalle",
      qty: "Unidades",
      unitCost: "Precio",
    };
    const table = await readInvoiceTable(
      Buffer.from(
        'Código,Detalle,Unidades,Precio\nSKU,"Artículo, azul",2,10\n',
      ),
      "csv",
      map,
    );
    expect(table.lines[0]).toMatchObject({
      code: "SKU",
      description: "Artículo, azul",
      qty: 2,
      unitCost: 10,
    });
  });
  it("CSV de Excel en español: punto y coma, Windows-1252, membrete, totales y ceros iniciales", async () => {
    const text =
      "Distribuidora Ejemplo SRL;;;\r\n" +
      "RNC 1-01-00000-0;;;\r\n" +
      "Código;Descripción;Cant.;Precio Unit.\r\n" +
      '0071234;Proteína Whey chocolate 2lb;2;"1.250,00"\r\n' +
      "SUPLEMENTOS;;;\r\n" +
      '0071235;Creatina 300 g;1;"RD$ 900"\r\n' +
      ';Subtotal;;"3.400,00"\r\n' +
      ";TOTAL;;3.400,00\r\n";
    const buffer = Buffer.from(
      new Uint8Array([...text].map((c) => c.charCodeAt(0))),
    ); // latin-1 = Windows-1252 para estos caracteres
    expect(decodeCsv(buffer).delimiter).toBe(";");
    const table = await readInvoiceTable(buffer, "csv", {
      code: "codigo",
      description: "descripcion",
      qty: "cantidad",
      unitCost: "costo",
    });
    expect(table.lines).toEqual([
      {
        code: "0071234",
        description: "Proteína Whey chocolate 2lb",
        qty: 2,
        unitCost: 1250,
      },
      { code: "0071235", description: "Creatina 300 g", qty: 1, unitCost: 900 },
    ]);
  });
  it("errores indican la fila y la columna faltante", async () => {
    const map = {
      code: "codigo",
      description: "descripcion",
      qty: "cantidad",
      unitCost: "costo",
    };
    await expect(
      readInvoiceTable(
        Buffer.from(
          "codigo,descripcion,cantidad,costo\nA,X,-2,10\nB,Y,1,abc\n",
        ),
        "csv",
        map,
      ),
    ).rejects.toThrow(/Fila 2: la cantidad «-2».*Fila 3: el costo «abc»/);
    await expect(
      readInvoiceTable(
        Buffer.from("ref,articulo,importe\nA,X,10\n"),
        "csv",
        map,
      ),
    ).rejects.toThrow(/Columnas del archivo: ref, articulo, importe/);
  });
  it("Excel con números reales, fórmulas y texto con formato", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Factura");
    ws.addRow(["Codigo", "Descripcion", "Cantidad", "Costo"]);
    ws.addRow(["0012", "Legging Essential M negro", 3, 450]);
    ws.addRow([
      "0013",
      "Top Flex S",
      { formula: "1+1", result: 2 },
      "1,100.00",
    ]);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const table = await readInvoiceTable(buffer, "xlsx", {
      code: "codigo",
      description: "descripcion",
      qty: "cantidad",
      unitCost: "costo",
    });
    expect(table.lines).toEqual([
      {
        code: "0012",
        description: "Legging Essential M negro",
        qty: 3,
        unitCost: 450,
      },
      { code: "0013", description: "Top Flex S", qty: 2, unitCost: 1100 },
    ]);
  });
});

describe("Factura proveedor · emparejamiento con sabor, tamaño y talla", () => {
  const whey = { id: "p-whey", name: "Proteína Whey Isolate", sku: "FIT-0001" };
  const legging = { id: "p-leg", name: "Legging Essential", sku: "FIT-0013" };
  const shaker = { id: "p-shk", name: "Shaker FitStore", sku: "FIT-0090" };
  const variants = [
    {
      id: "v-vain",
      sku: "FIT-0001-2",
      barcode: "770001",
      attributes: { sabor: "Vainilla", tamaño: "2 lb" },
      product: whey,
    },
    {
      id: "v-choc",
      sku: "FIT-0001-1",
      barcode: "770002",
      attributes: { sabor: "Chocolate", tamaño: "2 lb" },
      product: whey,
    },
    {
      id: "v-s-negro",
      sku: "FIT-0013-1",
      barcode: "770010",
      attributes: { talla: "S", color: "Negro" },
      product: legging,
    },
    {
      id: "v-m-negro",
      sku: "FIT-0013-2",
      barcode: "770011",
      attributes: { talla: "M", color: "Negro" },
      product: legging,
    },
    {
      id: "v-m-azul",
      sku: "FIT-0013-3",
      barcode: "770012",
      attributes: { talla: "M", color: "Azul" },
      product: legging,
    },
    {
      id: "v-shaker",
      sku: "FIT-0090-1",
      barcode: "770090",
      attributes: { variante: "Única" },
      product: shaker,
    },
  ];
  const line = (description: string, code = "") => ({
    code,
    description,
    qty: 1,
    unitCost: 10,
  });
  const match = (description: string, code = "") =>
    matchInvoiceLines([line(description, code)], variants)[0];
  it("elige la variante sólo si sabor/tamaño/talla coinciden", () => {
    expect(match("Proteina Whey Isolate chocolate 2lb").variantId).toBe(
      "v-choc",
    );
    expect(match("LEGGING ESSENTIAL MUJER TALLA M COLOR NEGRO").variantId).toBe(
      "v-m-negro",
    );
    expect(match("Shaker FitStore 600ml").variantId).toBe("v-shaker");
  });
  it("no adivina: tamaño inexistente o variante sin indicar quedan por elegir", () => {
    const fiveLb = match("Proteina Whey Isolate chocolate 5lb");
    expect(fiveLb.variantId).toBeNull();
    expect(fiveLb.productId).toBe("p-whey");
    expect(fiveLb.note).toContain("Elige la variante");
    expect(match("Proteína Whey Isolate").variantId).toBeNull();
    expect(match("Legging Essential talla M").variantId).toBeNull();
    // El SKU del producto (no de la variante) tampoco decide la variante.
    const bySku = match("Whey", "FIT-0001");
    expect(bySku.variantId).toBeNull();
    expect(bySku.productId).toBe("p-whey");
  });
  it("códigos exactos y equivalencias del proveedor ganan con confianza 1", () => {
    expect(match("cualquier texto", "770011")).toMatchObject({
      variantId: "v-m-negro",
      confidence: 1,
    });
    expect(
      matchInvoiceLines([line("x", "PROV-77")], variants, [
        { code: "PROV-77", variantId: "v-vain" },
      ])[0].variantId,
    ).toBe("v-vain");
    expect(match("Zapato de vestir")).toMatchObject({
      variantId: null,
      productId: null,
      confidence: 0,
    });
  });
  it("normaliza acentos y mayúsculas", () => {
    expect(nameConfidence("Proteína vainilla", "proteina vainilla")).toBe(1);
    expect(nameConfidence("Zapato negro", "Proteína vainilla")).toBe(0);
  });
});
