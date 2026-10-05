import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import {
  decodeCsv,
  extractAnthropic,
  matchInvoiceLines,
  nameConfidence,
  parseExtraction,
  parseInvoiceNumber,
  parseModelJson,
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

describe("Auditoría ronda 4 · respuesta del modelo con Markdown o texto extra", () => {
  it("extrae el JSON entre el primer { o [ y el último } o ]", () => {
    const body = { total: 25, lines: [{ code: "A", qty: 1 }] };
    expect(
      parseModelJson("```json\n" + JSON.stringify(body) + "\n```"),
    ).toEqual(body);
    expect(
      parseModelJson(
        "Aquí está la factura:\n" + JSON.stringify(body) + "\nRevísala.",
      ),
    ).toEqual(body);
    expect(parseModelJson("Lista: [1, 2, 3] fin")).toEqual([1, 2, 3]);
    expect(parseModelJson("sin datos")).toBeNull();
    expect(parseModelJson("{ roto")).toBeNull();
  });
  it("la extracción completa acepta la respuesta envuelta en ```json", async () => {
    const payload = {
      total: 30,
      lines: [
        {
          code: "W1",
          description: "Whey chocolate 2 lb",
          qty: 2,
          unitCost: 15,
          lotNumber: "",
          expiryDate: "",
        },
      ],
    };
    const fenced = new Response(
      JSON.stringify({
        id: "msg_md",
        type: "message",
        role: "assistant",
        model: "claude-opus-5-5",
        content: [
          {
            type: "text",
            text:
              "Claro, aquí tienes:\n```json\n" +
              JSON.stringify(payload) +
              "\n```",
          },
        ],
        stop_reason: "end_turn",
        stop_sequence: null,
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
    const result = await extractAnthropic(
      { buffer: Buffer.from("img"), mimetype: "image/jpeg" },
      "fake",
      { fetch: vi.fn().mockResolvedValue(fenced) as any },
    );
    expect(result.lines[0]).toMatchObject({ code: "W1", qty: 2, unitCost: 15 });
    expect(result.total).toBe(30);
  });
});

// Auditoría R4 (ChatGPT) · R4-07: una variante única no se elige si la factura
// declara atributos incompatibles.
describe("emparejamiento · variante única y atributos en conflicto", () => {
  const product = { id: "p-whey", name: "Proteína Whey", sku: "WHEY" };
  const only = {
    id: "vainilla-2lb",
    sku: "WHEY-V2",
    barcode: "999",
    product,
    attributes: { sabor: "Vainilla", tamaño: "2 lb" },
  };
  const line = (description: string, code?: string) => ({
    code,
    description,
    qty: 1,
    unitCost: 50,
  });
  it("SKU del producto + chocolate 5 lb frente a la única vainilla 2 lb: resolución manual", () => {
    const [r] = matchInvoiceLines(
      [line("Proteína Whey chocolate 5 lb", "WHEY")],
      [only],
    );
    expect(r.variantId).toBeNull();
    expect(r.productId).toBe("p-whey");
    expect(r.note).toMatch(/Vainilla/);
    expect(r.note).toMatch(/2 lb/);
  });
  it("la misma contradicción sin código (por nombre) tampoco se asigna", () => {
    const [r] = matchInvoiceLines([line("Proteína Whey chocolate")], [only]);
    expect(r.variantId).toBeNull();
    expect(r.note).toMatch(/Vainilla/);
  });
  it("variante única compatible o sin atributos en la factura: se asigna", () => {
    for (const d of [
      "Proteína Whey vainilla 2 lb",
      "Proteina whey 2lb",
      "Proteína Whey",
    ]) {
      const [r] = matchInvoiceLines([line(d, "WHEY")], [only]);
      expect(r.variantId, d).toBe("vainilla-2lb");
    }
  });
  it("talla o color incompatibles con la única variante de ropa", () => {
    const legging = { id: "p-leg", name: "Leggings Sculpt", sku: "LEG" };
    const catalog = [
      {
        id: "leg-negro-s",
        sku: "LEG-N-S",
        barcode: "111",
        product: legging,
        attributes: { color: "Negro", talla: "S" },
      },
      // Otro producto aporta "M" al vocabulario de tallas del catálogo.
      {
        id: "top-m",
        sku: "TOP-M",
        barcode: "112",
        product: { id: "p-top", name: "Top deportivo", sku: "TOP" },
        attributes: { color: "Negro", talla: "M" },
      },
    ];
    expect(
      matchInvoiceLines([line("Leggings Sculpt azul S", "LEG")], catalog)[0]
        .variantId,
    ).toBeNull();
    expect(
      matchInvoiceLines([line("Leggings Sculpt negro M", "LEG")], catalog)[0]
        .variantId,
    ).toBeNull();
    expect(
      matchInvoiceLines([line("Leggings Sculpt negro S", "LEG")], catalog)[0]
        .variantId,
    ).toBe("leg-negro-s");
  });
  it("varias variantes: elige sólo la combinación exacta y compatible", () => {
    const catalog = [
      only,
      {
        id: "choc-5lb",
        sku: "WHEY-C5",
        barcode: "998",
        product,
        attributes: { sabor: "Chocolate", tamaño: "5 lb" },
      },
      {
        id: "choc-2lb",
        sku: "WHEY-C2",
        barcode: "997",
        product,
        attributes: { sabor: "Chocolate", tamaño: "2 lb" },
      },
    ];
    expect(
      matchInvoiceLines([line("Whey chocolate 5 lb", "WHEY")], catalog)[0]
        .variantId,
    ).toBe("choc-5lb");
    expect(
      matchInvoiceLines([line("Whey chocolate", "WHEY")], catalog)[0].variantId,
    ).toBeNull();
  });
  it("el código exacto de una variante (SKU o barras) manda sobre la descripción", () => {
    const [bySku] = matchInvoiceLines(
      [line("Proteína Whey chocolate 5 lb", "WHEY-V2")],
      [only],
    );
    const [byBarcode] = matchInvoiceLines(
      [line("Proteína Whey chocolate 5 lb", "999")],
      [only],
    );
    expect(bySku.variantId).toBe("vainilla-2lb");
    expect(byBarcode.variantId).toBe("vainilla-2lb");
  });
});

// Auditoría R6 (ChatGPT) · R6-02: la talla se reconoce aunque el catálogo no
// tenga otras tallas. Fixture aislado: un solo producto con talla M.
describe("emparejamiento · talla explícita sin vocabulario del catálogo", () => {
  const catalog = [
    {
      id: "legging-m",
      sku: "LEG-M-N",
      barcode: "500",
      product: { id: "p-leg", name: "Leggings Sculpt", sku: "LEG" },
      attributes: { talla: "M", color: "Negro" },
    },
  ];
  const line = (description: string, code?: string) => ({
    code,
    description,
    qty: 1,
    unitCost: 900,
  });
  it("S y L frente a la única M: sin variante, con SKU de producto y por nombre", () => {
    for (const d of [
      "Leggings Sculpt talla S negro",
      "Leggings Sculpt talla L negro",
    ]) {
      const [byCode] = matchInvoiceLines([line(d, "LEG")], catalog);
      const [byName] = matchInvoiceLines([line(d)], catalog);
      for (const r of [byCode, byName]) {
        expect(r.variantId, d).toBeNull();
        expect(r.productId, d).toBe("p-leg");
        expect(r.note, d).toMatch(/\bM\b/);
      }
    }
  });
  it("M sigue seleccionándose, con SKU de producto y por nombre", () => {
    for (const code of ["LEG", undefined])
      expect(
        matchInvoiceLines(
          [line("Leggings Sculpt talla M negro", code)],
          catalog,
        )[0].variantId,
      ).toBe("legging-m");
  });
  it("tallas compuestas, alias y medidas no se confunden", () => {
    const faja = [
      {
        id: "faja-2xs",
        sku: "FAJA-2XS",
        barcode: "600",
        product: { id: "p-faja", name: "Cinturilla tipo corset", sku: "CIN" },
        attributes: { talla: "2XS" },
      },
    ];
    const pick = (d: string) =>
      matchInvoiceLines([line(d, "CIN")], faja)[0].variantId;
    expect(pick("Cinturilla tipo corset 2XS")).toBe("faja-2xs");
    expect(pick("Cinturilla tipo corset 3XS")).toBeNull();
    expect(pick("Cinturilla tipo corset XS")).toBeNull();
    expect(pick("Cinturilla tipo corset talla Large")).toBeNull();
    // "Women's" no es talla S; "1 l" es una medida, no talla L.
    expect(
      matchInvoiceLines(
        [line("Leggings Sculpt Women's M negro", "LEG")],
        catalog,
      )[0].variantId,
    ).toBe("legging-m");
    expect(
      matchInvoiceLines([line("Leggings Sculpt negro 1 l", "LEG")], catalog)[0]
        .variantId,
    ).toBe("legging-m");
  });
  it("el código exacto de la variante sigue mandando", () => {
    expect(
      matchInvoiceLines(
        [line("Leggings Sculpt talla S negro", "LEG-M-N")],
        catalog,
      )[0].variantId,
    ).toBe("legging-m");
  });
});

// Revisión adversarial de la ronda 7: tallas con los nombres reales de las
// fajas de la tienda (un producto por talla; la talla sólo está en el nombre,
// como los crea scripts/import-inventario.ts).
describe("emparejamiento · tallas en el nombre del producto (fajas reales)", () => {
  const fajas: { id: string; name: string }[] = (
    createRequire(import.meta.url)("./fixtures/catalogo-tienda.json") as {
      id: string;
      name: string;
      categoria: string;
    }[]
  ).filter((p) => p.categoria === "Fajas");
  const catalog = fajas.map((f) => ({
    id: "v-" + f.id,
    sku: f.id,
    barcode: f.id,
    attributes: {},
    product: { id: "p-" + f.id, name: f.name, sku: "INV-" + f.id },
  }));
  const nameOf = (productId: string | null) =>
    fajas.find((f) => "p-" + f.id === productId)?.name ?? null;
  const match = (description: string, code?: string) =>
    matchInvoiceLines(
      [{ code, description, qty: 1, unitCost: 500 }],
      catalog,
    )[0];
  it("elige el producto de la talla declarada, incluidas 2XL/XXL", () => {
    const cases: [string, string][] = [
      ["Short Broche M Negro", "Short Broche M Negro"],
      ["Cinturilla tipo corset XXL", "Cinturilla tipo corset 2XL"],
      ["Cinturilla tipo corset 2XS", "Cinturilla tipo corset 2XS"],
      ["Cinturilla tipo corset XXS", "Cinturilla tipo corset 2XS"],
      ["Faja tipo chaleco X-Large", "Faja tipo chaleco XL"],
      ["Broche Crema Medium", "Broche Crema M"],
    ];
    for (const [invoice, expected] of cases) {
      const r = match(invoice);
      expect(nameOf(r.productId), invoice).toBe(expected);
      expect(r.variantId, invoice).not.toBeNull();
    }
  });
  it("una talla que la tienda no tiene no se asigna a otra talla", () => {
    for (const invoice of [
      "Short Broche L Negro",
      "Short Broche 3XL Negro",
      "Panty Negro 2XL",
      "Chaleco con Brasier M",
      "Cinturilla tipo corset 4XL",
    ]) {
      const r = match(invoice);
      expect(r.variantId, invoice).toBeNull();
      expect(r.note, invoice).toMatch(/talla/);
    }
  });
  it("con el SKU del producto y otra talla: sin variante y con nota", () => {
    const shortS = fajas.find((f) => f.name === "Short Broche S Negro")!;
    const r = match("Short Broche L Negro", "INV-" + shortS.id);
    expect(r.productId).toBe("p-" + shortS.id);
    expect(r.variantId).toBeNull();
    expect(r.note).toMatch(/talla L.*; este producto es talla S/);
  });
});

describe("emparejamiento · casos de tallas de la revisión adversarial", () => {
  const product = { id: "p-leg", name: "Leggings Sculpt", sku: "LEG" };
  const variant = (id: string, talla: string) => ({
    id,
    sku: "LEG-" + id,
    barcode: "B-" + id,
    product,
    attributes: { talla, color: "Negro" },
  });
  const pick = (catalog: any[], description: string, code = "LEG") =>
    matchInvoiceLines(
      [{ code, description, qty: 1, unitCost: 900 }],
      catalog,
    )[0].variantId;
  it("XL no pasa por 2XL/3XL ni XS por 2XS", () => {
    expect(pick([variant("xl", "XL")], "Leggings Sculpt 2XL negro")).toBeNull();
    expect(pick([variant("xl", "XL")], "Leggings Sculpt 3XL negro")).toBeNull();
    expect(pick([variant("xs", "XS")], "Leggings Sculpt 2XS negro")).toBeNull();
    expect(
      pick(
        [variant("l", "L"), variant("xl", "XL")],
        "Leggings Sculpt 2XL negro",
      ),
    ).toBeNull();
    expect(
      pick(
        [variant("l", "L"), variant("xl", "XL")],
        "Leggings Sculpt XL negro",
      ),
    ).toBe("xl");
    expect(pick([variant("2xl", "2XL")], "Leggings Sculpt XXL negro")).toBe(
      "2xl",
    );
  });
  it("tallas no estándar (32, One Size) chocan con una talla declarada", () => {
    expect(pick([variant("32", "32")], "Leggings Sculpt XL negro")).toBeNull();
    expect(pick([variant("32", "32")], "Leggings Sculpt talla 32 negro")).toBe(
      "32",
    );
  });
  it("X-Large / Extra Large / XX-Large / X-Small", () => {
    expect(pick([variant("xl", "XL")], "Leggings Sculpt X-Large negro")).toBe(
      "xl",
    );
    expect(pick([variant("xl", "XL")], "Leggings Sculpt Extra Large")).toBe(
      "xl",
    );
    expect(
      pick([variant("l", "L")], "Leggings Sculpt X-Large negro"),
    ).toBeNull();
    expect(pick([variant("2xl", "2XL")], "Leggings Sculpt XX-Large")).toBe(
      "2xl",
    );
    expect(pick([variant("xs", "XS")], "Leggings Sculpt X-Small")).toBe("xs");
  });
  it("un número antes de la talla no la oculta; un litro no es talla L", () => {
    expect(pick([variant("l", "L")], "Leggings Sculpt 7/8 M negro")).toBeNull();
    expect(pick([variant("m", "M")], "Leggings Sculpt 7/8 L negro")).toBe("m");
    expect(pick([variant("m", "M")], "Ref 1055 S Leggings Sculpt")).toBeNull();
    expect(pick([variant("m", "M")], "Leggings Sculpt negro 1 l")).toBe("m");
  });
  it("posesivos con cualquier apóstrofo no son talla S", () => {
    for (const apostrophe of ["'", "’", "´", "`"])
      expect(
        pick([variant("m", "M")], `Leggings Sculpt Women${apostrophe}s negro`),
      ).toBe("m");
  });
});

// Segunda revisión adversarial de la ronda 7: catálogo real completo (616
// nombres, un producto por fila, como lo crea el importador).
describe("emparejamiento · catálogo real de la tienda", () => {
  const products: { id: string; name: string }[] = createRequire(
    import.meta.url,
  )("./fixtures/catalogo-tienda.json");
  const catalog = products.map((p) => ({
    id: "v-" + p.id,
    sku: p.id,
    barcode: p.id,
    attributes: {},
    product: { id: "p-" + p.id, name: p.name, sku: "INV-" + p.id },
  }));
  const match = (description: string) =>
    matchInvoiceLines([{ description, qty: 1, unitCost: 1 }], catalog)[0];
  const idOf = (name: string) => products.find((p) => p.name === name)!.id;
  const picks = (description: string, id: string) => {
    const r = match(description);
    expect(r.productId, description).toBe("p-" + id);
    expect(r.variantId, description).toBe("v-" + id);
  };
  const flags = (description: string, note: RegExp) => {
    const r = match(description);
    expect(r.variantId, description).toBeNull();
    expect(r.note, description).toMatch(note);
  };
  it(
    "cada producto se encuentra por su propio nombre",
    { timeout: 60000 },
    () => {
      const res = matchInvoiceLines(
        products.map((p) => ({ description: p.name, qty: 1, unitCost: 1 })),
        catalog,
      );
      const misses = res
        .map((r, i) =>
          r.variantId === "v-" + products[i].id ? null : r.description,
        )
        .filter(Boolean);
      expect(misses).toEqual([]);
    },
  );
  it("tamaños con decimales y miles: el bote correcto, nunca otro tamaño", () => {
    picks("ISO100 Hydrolyzed Dymatize Strawberry 1.3 lb", "1162");
    picks(
      "Optimum Nutrition Gold Standard 100% Whey Vanilla Ice Cream 1.5 lb",
      "1181",
    );
    picks(
      "Optimum Nutrition Gold Standard 100% Whey Vanilla Ice Cream 5 lb",
      "1177",
    );
    picks("Carnivor Mass Chocolate Fudge 5.8 lb", "1182");
    picks("Redken All Soft Conditioner 1000ml", "1538");
    picks("XTEND Original BCAA Knockout Fruit Punch 30 servings 420g", "1104");
    // La tienda no tiene Isopure Low Carb Dutch Chocolate de 5 lb.
    flags("Isopure Low Carb Dutch Chocolate 5 lb", /tamaño/);
    // Sabor en español frente al nombre en inglés; falta "Hydrolyzed": se
    // sugiere el bote correcto y alguien lo confirma.
    const fresa = match("Dymatize ISO 100 Fresa 1.3 libras");
    expect(fresa.productId).toBe("p-1162");
    expect(fresa.variantId).toBeNull();
  });
  it("tallas 2X-Large, Mediana, 'talla XL' y referencias", () => {
    picks("Cinturilla tipo corset 2X-Large", "1604");
    flags("Cinturilla tipo corset 3X-Large", /talla/);
    picks("Faja tipo chaleco Mediana", idOf("Faja tipo chaleco M"));
    picks(
      "Cinturilla tipo corset M&D talla XL",
      idOf("Cinturilla tipo corset XL"),
    );
    picks("Faja tipo chaleco Ref 1201 XL", idOf("Faja tipo chaleco XL"));
  });
  it("sin talla en la factura no se elige una presentación al azar", () => {
    flags("Cinturilla tipo corset", /no indica cuál/);
    flags("Short Broche Negro", /no indica cuál/);
  });
  it("colores en español frente a nombres en inglés; un color que no hay se avisa", () => {
    picks("Navi Eyeliner Pencil Marron Claro", "1367");
    // "Esmeralda"/"Oceano" no son "Emerald"/"Ocean": se sugiere sin elegir.
    for (const [d, id] of [
      ["Navi Eyeliner Pencil Verde Esmeralda", "1369"],
      ["Navi Eyeliner Pencil Azul Oceano", "1371"],
    ]) {
      const r = match(d);
      expect(r.productId, d).toBe("p-" + id);
      expect(r.variantId, d).toBeNull();
    }
    picks("Navi Eyeliner Pencil Emerald Green", "1369");
    picks("Navi Eyeliner Pencil Dorado", "1366");
    flags("Navi Eyeliner Pencil Black", /color/);
  });
  it("la propuesta con otra presentación es la que menos difiere", () => {
    const r = match("Broche Beige M");
    expect(r.variantId).toBeNull();
    expect(r.productId).toBe("p-" + idOf("Broche Crema M"));
  });
  it("nombres cortos con color siguen encontrándose", () => {
    picks("Shaker negro", "1153");
    picks("Shaker Negro 700ml", "1153");
  });
});

// Tercera revisión adversarial: sólo se deja elegido un producto cuando la
// factura nombra todo lo que lo identifica (la marca es opcional); si no, se
// sugiere y alguien confirma. Nunca otra marca u otra línea preelegida.
describe("emparejamiento · conservador con el catálogo real", () => {
  const products: { id: string; name: string }[] = createRequire(
    import.meta.url,
  )("./fixtures/catalogo-tienda.json");
  const catalog = products.map((p) => ({
    id: "v-" + p.id,
    sku: p.id,
    barcode: p.id,
    attributes: {},
    product: { id: "p-" + p.id, name: p.name, sku: "INV-" + p.id },
  }));
  const match = (description: string) =>
    matchInvoiceLines([{ description, qty: 1, unitCost: 1 }], catalog)[0];
  const nameOf = (id: string | null) =>
    products.find((p) => "p-" + p.id === id)?.name ?? null;
  it("otra marca u otra línea nunca queda elegida", () => {
    for (const d of [
      "Gold Standard Whey Chocolate 2 lb",
      "Gold Standard Casein Vanilla 2 lb",
      "Animal Whey Cookies & Cream 2 lb",
      "Muscle Milk Light Vanilla 2 lb",
      "Nitro-Tech MuscleTech Fruit Punch 5 lb",
      "Optimum Nutrition Gold Standard 100% Whey Double Rich Chocolate 5 lbs",
      "Davines Alchemic Conditioner Silver 250 ml",
      "IsoWhey MuscleTech Vanilla 4.4 lb",
      "Isoflex ALLMAX Vanilla 4.4 lb",
      "Shaker Clear 700 ml",
      "Shaker 700 ml",
      "Shaker",
      "Short Broche Café M",
      "Panty Café M",
      "Broche Cafe L",
      "Cinturilla tipo corset 7XL",
    ])
      expect(match(d).variantId, d).toBeNull();
  });
  it("tamaños con guion, 1.02 lb exacto y miles europeos", () => {
    const fiveLb = match("Gold Standard 100% Whey Double Rich Chocolate 5-Lb");
    expect(fiveLb.variantId).toBeNull();
    expect(fiveLb.note).toMatch(/tamaño 2 lb/);
    expect(
      match("Super Mass Gainer Dymatize Rich Chocolate 12-lb").note,
    ).toMatch(/tamaño 6 lb/);
    expect(
      nameOf(match("Isopure Zero Carb Creamy Vanilla 1.02 lb").productId),
    ).toMatch(/1\.02 lb/);
    expect(
      match("Isopure Zero Carb Creamy Vanilla 1.02 lb").variantId,
    ).not.toBeNull();
    expect(
      nameOf(match("Isopure Zero Carb Creamy Vanilla 1 lb").productId),
    ).toBe("Isopure Zero Carb - Creamy Vanilla / 1 lb");
    expect(match("Redken All Soft Conditioner 1.000 ml").variantId).toBe(
      "v-1538",
    );
  });
  it("lo que la factura sí identifica se elige", () => {
    for (const [d, id] of [
      ["Gold Standard 100% Whey Double Rich Chocolate 2 lb", "1180"],
      ["Vitamin K2+D3 Bronson Basics Envase Oscuro", "1059"],
      ["Shaker transparente", "1154"],
      ["Navi Eyeliner Pencil Cafe", "1367"],
    ])
      expect(match(d).variantId, d).toBe("v-" + id);
    // "Natural" es la creatina sin sabor ("unflavored").
    const creatine = match("Creatine Monohydrate Nutrex Natural 60 servicios");
    expect(nameOf(creatine.productId)).toMatch(/Creatine Monohydrate - Nutrex/);
    expect(creatine.variantId).not.toBeNull();
  });
  it("talla L-XL tras 'talla' cuenta las dos", () => {
    const r = match("Faja tipo chaleco Talla L-XL");
    expect(r.variantId).toBeNull();
    expect(r.note).toMatch(/no indica cuál/);
  });
});
