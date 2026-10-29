import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import * as assistant from "../apps/api/src/assistant";
import { finishAssistantQuery } from "../apps/api/src/assistant-usage";
import { renderMarkdown } from "../apps/web/src/assistant-markdown";

// Auditoría en vivo del 25-oct (129 preguntas): cada caso reproduce una falla.
const { askAssistant, executeAssistantTool } = assistant;
const today = "2026-10-25";
const ctx = { today, canSeeCost: true };
const parse = (result: string) =>
  JSON.parse(
    result.replace(/^<datos_no_confiables>\n|\n<\/datos_no_confiables>$/g, ""),
  );
const routes = (table: Record<string, unknown>) =>
  vi.fn(async (path: string) => {
    const key = Object.keys(table).find(
      (prefix) => path === prefix || path.startsWith(prefix + "?"),
    );
    if (!key) return { status: 404, body: "{}" };
    const value = table[key];
    if (typeof value === "number")
      return { status: value, body: '{"message":"no"}' };
    return { status: 200, body: JSON.stringify(value) };
  });
const cuadre = (opts: {
  cashier: string;
  opening: number;
  cash: number;
  card: number;
  transfer: number;
  credit: number;
  manager: boolean;
  counted?: number;
  closed?: boolean;
}) => ({
  cashier: { name: opts.cashier },
  register: { name: "Equipo " + opts.cashier },
  salesByMethod: {
    cash: opts.cash,
    card: opts.card,
    transfer: opts.transfer,
    credit: opts.credit,
    cod: 0,
    credit_note: 0,
  },
  cashSalesDetail: { total: opts.cash },
  receipts: { total: 0 },
  lines: [
    { key: "cash", value: opts.counted ?? null },
    { key: "tickets", value: 13 },
    { key: "voidedTickets", value: 0 },
    {
      key: "total",
      value: opts.cash + opts.card + opts.transfer + opts.credit,
    },
    { key: "discounts", value: 0 },
    { key: "openingAmount", value: opts.opening },
    ...(opts.manager
      ? [
          {
            key: "differenceDop",
            value: opts.closed
              ? (opts.counted ?? 0) - opts.opening - opts.cash
              : null,
          },
        ]
      : []),
  ],
  descuadre:
    opts.closed && opts.manager
      ? { cash: -50, card: 0, transfer: 0, reason: "Error al dar cambio" }
      : null,
});
const sessions = [
  {
    id: "ramon",
    userName: "Ramón Díaz",
    openedAt: "2026-10-25T21:36:00Z",
    closedAt: null,
    openingAmount: 2000,
  },
  {
    id: "yoka",
    userName: "Yokasta Pérez",
    openedAt: "2026-10-25T21:30:00Z",
    closedAt: "2026-10-25T21:50:00Z",
    openingAmount: 2000,
  },
];

describe("IA · caja: todas las cajas del día y cierre ciego", () => {
  it("suma efectivo, tarjeta, transferencia y crédito de TODAS las cajas (antes leía solo la primera)", async () => {
    const get = routes({
      "/api/cash-sessions": sessions,
      "/api/cash-sessions/ramon/cuadre": cuadre({
        cashier: "Ramón Díaz",
        opening: 2000,
        cash: 3095,
        card: 952,
        transfer: 245,
        credit: 1850,
        manager: true,
      }),
      "/api/cash-sessions/yoka/cuadre": cuadre({
        cashier: "Yokasta Pérez",
        opening: 2000,
        cash: 2935,
        card: 1465,
        transfer: 956,
        credit: 2130,
        manager: true,
        counted: 4885,
        closed: true,
      }),
    });
    const out = parse(
      await executeAssistantTool("cuadre_caja", { fecha: today }, get, ctx),
    );
    expect(out.cajas).toHaveLength(2);
    expect(out.totalDelDia.ventas).toMatchObject({
      efectivo: 6030,
      tarjeta: 2417,
      transferencia: 1201,
      credito: 3980,
    });
    expect(out.totalDelDia.abiertas).toBe(1);
    const ramon = out.cajas.find((row: any) => row.cajera === "Ramón Díaz");
    expect(ramon).toMatchObject({ estado: "abierta", efectivoEsperado: 5095 });
    const yokasta = out.cajas.find(
      (row: any) => row.cajera === "Yokasta Pérez",
    );
    expect(yokasta).toMatchObject({
      estado: "cerrada",
      efectivoEsperado: 4935,
      efectivoContado: 4885,
      diferenciaEfectivo: -50,
    });
    // Desglose por cajera con el filtro.
    const only = parse(
      await executeAssistantTool(
        "cuadre_caja",
        { fecha: today, cajera: "ramon" },
        get,
        ctx,
      ),
    );
    expect(only.cajas.map((row: any) => row.cajera)).toEqual(["Ramón Díaz"]);
  });

  it("una cajera nunca recibe el efectivo esperado de una caja abierta", async () => {
    const get = routes({
      "/api/cash-sessions": [sessions[0]],
      // La API responde 400 «Cierra la caja para consultar el cuadre».
      "/api/cash-sessions/ramon/cuadre": 400,
    });
    const result = await executeAssistantTool(
      "cuadre_caja",
      { fecha: today },
      get,
      { today },
    );
    expect(result).not.toMatch(/esperado"|5095|3095/);
    expect(parse(result).cajas[0]).toMatchObject({
      estado: "abierta",
      aviso: expect.stringContaining("al cerrarla"),
    });
    // Cerrada, la vista de cajera (sin diferencias) tampoco trae esperado.
    const closed = routes({
      "/api/cash-sessions": [sessions[1]],
      "/api/cash-sessions/yoka/cuadre": cuadre({
        cashier: "Yokasta Pérez",
        opening: 2000,
        cash: 2935,
        card: 0,
        transfer: 0,
        credit: 0,
        manager: false,
        closed: true,
      }),
    });
    const own = parse(
      await executeAssistantTool("cuadre_caja", { fecha: today }, closed, {
        today,
      }),
    );
    expect(own.cajas[0]).not.toHaveProperty("efectivoEsperado");
    expect(own.totalDelDia).not.toHaveProperty("efectivoEsperado");
  });
});

const stockRows = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: "v" + i,
    sku: "SKU" + String(i).padStart(4, "0"),
    barcode: "746" + i,
    price: 100 + i,
    costAvg: 70,
    stock: i === n - 1 ? 0 : i >= n - 3 ? 2 : 40,
    homeStock: "0",
    totalStock: String(i === n - 1 ? 0 : i >= n - 3 ? 2 : 40),
    sellableStock: String(i === n - 1 ? 0 : i >= n - 3 ? 2 : 40),
    lots: [{ lotNumber: "L" + i, expiryDate: "2027-01-01", qty: 40 }],
    warehouseStocks: [
      { qty: 40, warehouse: { name: "Tienda", kind: "store" } },
    ],
    product: {
      name: "Producto de prueba con nombre largo número " + i,
      minStock: 5,
      category: { name: i % 2 ? "Bebidas" : "Alimentos" },
    },
  }));

describe("IA · inventario sin cortes", () => {
  it("con 600 productos no pierde los bajo mínimo del final y valora todo el inventario", async () => {
    const get = routes({ "/api/inventory/stock": stockRows(600) });
    const result = await executeAssistantTool(
      "inventario_resumen",
      {},
      get,
      ctx,
    );
    expect(result.length).toBeLessThan(20_100);
    const out = parse(result);
    expect(out.productos).toBe(600);
    expect(out.bajoMinimo.map((row: any) => row.nombre)).toEqual([
      "Producto de prueba con nombre largo número 599",
      "Producto de prueba con nombre largo número 597",
      "Producto de prueba con nombre largo número 598",
    ]);
    expect(out.agotados).toEqual([
      "Producto de prueba con nombre largo número 599",
    ]);
    expect(out.valorAlCosto).toBe(money(597 * 40 * 70 + 2 * 2 * 70));
  });

  it("la lista de existencias es JSON válido, paginada, y nunca corta una fila", async () => {
    const get = routes({ "/api/inventory/stock": stockRows(600) });
    const page = parse(
      await executeAssistantTool("existencias", { pagina: 15 }, get, ctx),
    );
    expect(page).toMatchObject({ productos: 600, pagina: 15, paginas: 15 });
    expect(page.lista.at(-1).sku).toBe("SKU0599");
    expect(page.lista[0]).not.toHaveProperty("lots");
  });

  it("recorta listas enteras y avisa en vez de cortar el texto", () => {
    const text = assistant.fitJson({
      filas: Array.from({ length: 2000 }, (_, i) => ({
        n: i,
        texto: "x".repeat(40),
      })),
    });
    const out = JSON.parse(text);
    expect(text.length).toBeLessThanOrEqual(20_000);
    expect(out.recorte).toMatch(/Se omitieron \d+ filas/);
  });
});

describe("IA · búsqueda de productos como en el POS", () => {
  const catalog = [
    {
      sku: "AUD001",
      price: 110,
      costAvg: 65,
      stock: 42,
      totalStock: "42",
      product: {
        name: "Refresco Coca-Cola 2L",
        minStock: 10,
        category: { name: "Bebidas" },
      },
    },
    {
      sku: "AUD006",
      price: 365,
      costAvg: 260,
      stock: 12,
      totalStock: "12",
      product: {
        name: "Café Santo Domingo 1lb",
        minStock: 6,
        category: { name: "Alimentos" },
      },
    },
    {
      sku: "AUD011",
      price: 140,
      costAvg: 95,
      stock: 1,
      totalStock: "1",
      product: {
        name: "Pan Bimbo grande",
        minStock: 5,
        category: { name: "Alimentos" },
      },
    },
  ];
  it.each([
    ["Coca-Cola 2 litros", "Refresco Coca-Cola 2L"],
    ["coca cola 2L", "Refresco Coca-Cola 2L"],
    ["cafe santo domingo", "Café Santo Domingo 1lb"],
    ["PAN BIMBO", "Pan Bimbo grande"],
    ["bimbo", "Pan Bimbo grande"],
  ])("«%s» encuentra «%s»", async (term, name) => {
    const get = routes({ "/api/inventory/stock": catalog });
    const out = parse(
      await executeAssistantTool("existencias", { producto: term }, get, ctx),
    );
    expect(out.lista.map((row: any) => row.nombre)).toEqual([name]);
  });
  it("sin coincidencia exacta ofrece los más parecidos en vez de decir que no existe", async () => {
    const get = routes({ "/api/inventory/stock": catalog });
    const out = parse(
      await executeAssistantTool(
        "existencias",
        { producto: "coca cola light 2 litros" },
        get,
        ctx,
      ),
    );
    expect(out.aviso).toMatch(/parecidos/);
    expect(out.lista[0].nombre).toBe("Refresco Coca-Cola 2L");
  });
});

const summary = {
  revenue: 13628,
  invoices: 26,
  ticketAverage: 524.15,
  tax: 2078.85,
  netSales: 11549.15,
  costTotal: 9049,
  fees: 60.43,
  expenses: 0,
  payments: [
    { name: "cash", amount: 6030 },
    { name: "card", amount: 2417 },
    { name: "transfer", amount: 1201 },
    { name: "credit", amount: 3980 },
  ],
  sellers: [
    { name: "Yokasta Pérez", total: 7486 },
    { name: "Ramón Díaz", total: 6142 },
  ],
  top: [
    {
      name: "Cerveza Presidente 650ml",
      category: "Bebidas",
      units: 28,
      revenue: 4200,
    },
  ],
  peakHours: [{ day: 7, hour: 17, invoices: 26, total: 13628 }],
};
const breakdown = {
  categories: [
    {
      name: "Alimentos",
      revenue: 6108,
      units: 40,
      cost: 4300,
      profit: 1808,
      margin: 29.6,
    },
  ],
  top: [
    {
      name: "Cerveza Presidente 650ml",
      sku: "AUD003",
      units: 28,
      revenue: 4200,
      cost: 2660,
      profit: 1540,
      margin: 36.67,
    },
    {
      name: "Galletas Guarina",
      sku: "AUD017",
      units: 9,
      revenue: 315,
      cost: 180,
      profit: 135,
      margin: 42.86,
    },
  ],
};

describe("IA · herramientas para lo que antes era «no tengo el dato»", () => {
  it("ventas_resumen: período por nombre en hora de Santo Domingo, formas de pago, top, categoría, hora pico y margen de la dueña", async () => {
    const get = routes({
      "/api/dashboard/summary": summary,
      "/api/dashboard/breakdown": breakdown,
    });
    const out = parse(
      await executeAssistantTool(
        "ventas_resumen",
        { periodo: "hoy" },
        get,
        ctx,
      ),
    );
    expect(get).toHaveBeenCalledWith(
      "/api/dashboard/summary?from=2026-10-25&to=2026-10-25",
    );
    expect(out).toMatchObject({
      totalVendido: 13628,
      facturas: 26,
      itbis: 2078.85,
      formasDePago: {
        efectivo: 6030,
        tarjeta: 2417,
        transferencia: 1201,
        credito: 3980,
      },
      horasPico: [{ hora: "17:00", facturas: 26, monto: 13628 }],
      costoDeLoVendido: 9049,
      ganancia: 4579,
      margen: 33.6,
      comisionesTarjeta: 60.43,
    });
    expect(out.masVendidosPorUnidades[0]).toMatchObject({
      nombre: "Cerveza Presidente 650ml",
      unidades: 28,
    });
    expect(out.porCategoria[0]).toMatchObject({
      nombre: "Alimentos",
      monto: 6108,
    });
  });

  it.each([
    ["ayer", "2026-10-24", "2026-10-24"],
    ["semana", "2026-10-19", "2026-10-25"],
    ["semana_pasada", "2026-10-12", "2026-10-18"],
    ["mes", "2026-10-01", "2026-10-25"],
    ["mes_pasado", "2026-09-01", "2026-09-30"],
  ] as const)("periodo %s = %s a %s", (name, from, to) => {
    expect(assistant.periodRange(name, today)).toEqual({
      desde: from,
      hasta: to,
    });
  });

  it("permite rangos de hasta un año para ventas (la pregunta del 1-ene al 25-oct agotaba los pasos)", async () => {
    const get = routes({
      "/api/dashboard/summary": summary,
      "/api/dashboard/breakdown": breakdown,
    });
    const out = parse(
      await executeAssistantTool(
        "ventas_resumen",
        { desde: "2026-01-01", hasta: today },
        get,
        ctx,
      ),
    );
    expect(out.periodo).toEqual({ desde: "2026-01-01", hasta: today });
  });

  it("productos_vendidos: ranking completo, un producto sin ventas responde 0 y lista lo no vendido", async () => {
    const get = routes({
      "/api/dashboard/breakdown": breakdown,
      "/api/inventory/stock": [
        {
          sku: "AUD003",
          price: 150,
          stock: 32,
          product: { name: "Cerveza Presidente 650ml", minStock: 24 },
        },
        {
          sku: "AUD016",
          price: 95,
          stock: 0,
          product: { name: "Sardinas Pica Pica", minStock: 6 },
        },
      ],
    });
    const all = parse(
      await executeAssistantTool(
        "productos_vendidos",
        { periodo: "hoy" },
        get,
        ctx,
      ),
    );
    expect(get).toHaveBeenCalledWith(
      "/api/dashboard/breakdown?from=2026-10-25&to=2026-10-25&top=500",
    );
    expect(all.productos[0]).toMatchObject({
      nombre: "Cerveza Presidente 650ml",
      unidades: 28,
    });
    expect(all.sinVentas).toEqual(["Sardinas Pica Pica"]);
    const sardines = parse(
      await executeAssistantTool(
        "productos_vendidos",
        { periodo: "hoy", producto: "sardinas" },
        get,
        ctx,
      ),
    );
    expect(sardines.resultado).toMatch(/0 unidades/);
    expect(sardines.enCatalogo).toEqual([
      { nombre: "Sardinas Pica Pica", existencia: 0 },
    ]);
    const presidente = parse(
      await executeAssistantTool(
        "productos_vendidos",
        { periodo: "hoy", producto: "presidente" },
        get,
        ctx,
      ),
    );
    expect(presidente.ventas).toEqual([
      expect.objectContaining({ unidades: 28, monto: 4200 }),
    ]);
  });

  it("margen_productos usa (precio − costo)/precio sin ITBIS y marca los de menos de 15 %", async () => {
    const get = routes({
      "/api/inventory/stock": [
        {
          sku: "A",
          price: 560,
          costAvg: 420,
          stock: 9,
          product: { name: "Arroz Selecto 10lb" },
        },
        {
          sku: "B",
          price: 150,
          costAvg: 95,
          stock: 32,
          product: { name: "Cerveza Presidente 650ml" },
        },
        {
          sku: "C",
          price: 100,
          costAvg: 90,
          stock: 3,
          product: { name: "Producto flojo" },
        },
      ],
    });
    const out = parse(
      await executeAssistantTool("margen_productos", {}, get, ctx),
    );
    expect(
      out.deMenorAMayorMargen.map((row: any) => [row.nombre, row.margen]),
    ).toEqual([
      ["Producto flojo", 10],
      ["Arroz Selecto 10lb", 25],
      ["Cerveza Presidente 650ml", 36.67],
    ]);
    expect(out.bajoDe15).toEqual(["Producto flojo"]);
  });

  it("cuentas_por_cobrar separa crédito de contraentrega y trae el vencimiento", async () => {
    const get = routes({
      "/api/reports/creditos-por-antiguedad": {
        rows: [
          { Tramo: "0-15 días", Factura: "Resumen", Facturas: 4, Saldo: 3980 },
          {
            Factura: "FS-0000022",
            Tipo: "Crédito",
            Cliente: "Doña Carmen Rodríguez",
            Fecha: "2026-10-25",
            Vence: "2026-11-09",
            Días: 0,
            Saldo: 330,
          },
          {
            Factura: "FS-0000025",
            Tipo: "Crédito",
            Cliente: "Doña Carmen Rodríguez",
            Fecha: "2026-10-25",
            Vence: "2026-11-09",
            Días: 0,
            Saldo: 730,
          },
          {
            Factura: "FS-0000023",
            Tipo: "Contraentrega",
            Cliente: "Colmado El Primo (Juan)",
            Fecha: "2026-10-25",
            Vence: null,
            Días: 0,
            Saldo: 2920,
          },
        ],
      },
    });
    const out = parse(
      await executeAssistantTool("cuentas_por_cobrar", {}, get, ctx),
    );
    expect(out.totalPorCobrar).toBe(3980);
    expect(out.clientes[0]).toMatchObject({
      cliente: "Colmado El Primo (Juan)",
      debe: 2920,
    });
    const carmen = parse(
      await executeAssistantTool(
        "cuentas_por_cobrar",
        { cliente: "dona carmen" },
        get,
        ctx,
      ),
    );
    expect(carmen.clientes).toHaveLength(1);
    expect(carmen.clientes[0].facturas[0]).toMatchObject({
      tipo: "Crédito",
      vence: "2026-11-09",
    });
  });

  it("incentivos: gerencia ve todas; si la API niega, la cajera ve solo los suyos", async () => {
    const get = routes({
      "/api/incentives": 403,
      "/api/incentives/me": {
        month: "2026-10",
        row: { name: "Yokasta", net: 350 },
      },
    });
    const out = parse(
      await executeAssistantTool("incentivos", { mes: "2026-10" }, get, ctx),
    );
    expect(out.incentivos.row).toMatchObject({ net: 350 });
  });
});

describe("IA · rol cajera y costos", () => {
  it("a una vendedora no se le ofrece margen_productos y la herramienta se niega aunque la llame", async () => {
    expect(
      assistant.actorSeesCost({
        name: "Y",
        role: "seller",
        permissions: ["profit:read"],
      }),
    ).toBe(false);
    expect(
      assistant.assistantTools(false).map((tool) => tool.name),
    ).not.toContain("margen_productos");
    const get = vi.fn();
    expect(
      await executeAssistantTool("margen_productos", {}, get, {
        today,
        canSeeCost: false,
      }),
    ).toContain("no tiene permiso");
    expect(get).not.toHaveBeenCalled();
  });
  it("sin costo en la API, inventario y ventas no inventan costo ni ganancia", async () => {
    const get = routes({
      "/api/inventory/stock": [
        { sku: "A", price: 150, stock: 32, product: { name: "Cerveza" } },
      ],
      "/api/dashboard/summary": {
        ...summary,
        costTotal: undefined,
        fees: undefined,
      },
      "/api/dashboard/breakdown": { categories: [], top: [] },
    });
    for (const [tool, input] of [
      ["inventario_resumen", {}],
      ["existencias", {}],
      ["ventas_resumen", { periodo: "hoy" }],
    ] as const) {
      const result = await executeAssistantTool(tool, input, get, { today });
      expect(result, tool).not.toMatch(/costo"|ganancia|valorAlCosto|margen"/);
    }
  });
});

describe("IA · instrucciones del sistema", () => {
  it("fija RD$, ITBIS, la empresa, la fecha y la hora de Santo Domingo, y crédito ≠ contraentrega", () => {
    const system = assistant.assistantSystemFor({
      company: "Colmado Auditoría",
      now: new Date("2026-10-25T21:40:00Z"),
    });
    expect(system).toContain("RD$");
    expect(system).toMatch(/nunca uses ₡, Q, C\$, \$ solo/);
    expect(system).toMatch(/ITBIS.*nunca digas IVA/);
    expect(system).toContain("«Colmado Auditoría»");
    expect(system).toContain("2026-10-25");
    expect(system).toContain("17:40");
    expect(system).toMatch(/Crédito es venta fiada.*contraentrega/);
    expect(system).toContain("datos no confiables");
  });
  it("el modelo recibe ese sistema y las herramientas según el rol", async () => {
    const model = vi.fn().mockResolvedValue({
      stop_reason: "end_turn",
      usage: {},
      content: [{ type: "text", text: "Hola" }],
    });
    await askAssistant(
      { messages: [{ role: "user", content: "hola" }] },
      "Bearer x",
      {
        name: "Yokasta",
        company: "Colmado Auditoría",
        role: "seller",
        permissions: ["sale:write"],
      },
      { model, now: () => new Date("2026-10-25T21:40:00Z") },
    );
    const [, tools, sent] = model.mock.calls[0];
    expect(sent).toContain("«Colmado Auditoría»");
    expect(tools.map((tool: any) => tool.name)).not.toContain(
      "margen_productos",
    );
  });
});

describe("IA · las respuestas fallidas no se cobran", () => {
  it("max_tokens devuelve el texto parcial y marca incompleta", async () => {
    const model = vi.fn().mockResolvedValue({
      stop_reason: "max_tokens",
      usage: { input_tokens: 5, output_tokens: 2000 },
      content: [{ type: "text", text: "Hoy van RD$ 13,628.00 en" }],
    });
    const result = await askAssistant(
      { messages: [{ role: "user", content: "¿Cómo vamos?" }] },
      "Bearer x",
      { name: "D" },
      { model },
    );
    expect(result.incompleta).toBe(true);
    expect(result.answer).toContain("RD$ 13,628.00");
    expect(result.answer).toMatch(/no se contó/);
  });
  it("demasiados pasos también es incompleta", async () => {
    const model = vi.fn().mockResolvedValue({
      stop_reason: "tool_use",
      usage: {},
      content: [
        {
          type: "tool_use",
          id: "t",
          name: "manual_procedimiento",
          input: { tema: "caja" },
        },
      ],
    });
    const result = await askAssistant(
      { messages: [{ role: "user", content: "x" }] },
      "Bearer x",
      { name: "D" },
      { model },
    );
    expect(result.incompleta).toBe(true);
  });
  it("finishAssistantQuery fallida saca la fila de la cuota (acción distinta de assistant.ask)", async () => {
    const update = vi.fn();
    await finishAssistantQuery(
      { auditLog: { update } },
      "a1",
      { input: 1, output: 1 },
      [],
      "fallida",
    );
    expect(update.mock.calls[0][0].data.action).toBe("assistant.ask.fallida");
    await finishAssistantQuery(
      { auditLog: { update } },
      "a2",
      { input: 1, output: 1 },
      [],
      "completa",
    );
    expect(update.mock.calls[1][0].data.action).toBeUndefined();
  });
});

describe("IA · web: markdown seguro y botón sin tapar la barra", () => {
  const assistant = readFileSync(resolve("apps/web/src/Assistant.tsx"), "utf8");
  const webRequire = createRequire(resolve("apps/web/package.json"));
  const { createElement, Fragment } = webRequire(
    "react",
  ) as typeof import("react");
  const { renderToStaticMarkup } = webRequire(
    "react-dom/server",
  ) as typeof import("react-dom/server");
  const html = (text: string) =>
    renderToStaticMarkup(
      createElement(Fragment, null, ...renderMarkdown(text)),
    );
  it("negritas, listas, tablas y saltos de línea", () => {
    expect(html("Hoy: **RD$ 13,628.00**\nen 26 facturas")).toBe(
      "<p>Hoy: <strong>RD$ 13,628.00</strong><br/>en 26 facturas</p>",
    );
    expect(html("- Efectivo\n- Tarjeta")).toBe(
      "<ul><li>Efectivo</li><li>Tarjeta</li></ul>",
    );
    expect(html("1. Abre\n2. Cuenta")).toBe(
      "<ol><li>Abre</li><li>Cuenta</li></ol>",
    );
    expect(html("| Forma | RD$ |\n|---|---|\n| Efectivo | 6,030 |")).toContain(
      '<th scope="col">Forma</th>',
    );
    expect(html("| Forma | RD$ |\n|---|---|\n| Efectivo | 6,030 |")).toContain(
      "<td>6,030</td>",
    );
  });
  it("nunca interpreta HTML y una fila «|…|» sin separador es texto", () => {
    expect(html("<img src=x onerror=alert(1)> **ok**")).toBe(
      "<p>&lt;img src=x onerror=alert(1)&gt; <strong>ok</strong></p>",
    );
    expect(html("| solo una fila |")).toBe("<p>| solo una fila |</p>");
  });
  it("a 390px el botón queda sobre la barra móvil y el contenido conserva espacio seguro", () => {
    const css = readFileSync(resolve("apps/web/src/Assistant.css"), "utf8");
    const app = readFileSync(resolve("apps/web/src/App.tsx"), "utf8");
    expect(app).toContain("goods-mobile-bar");
    const styles = readFileSync(resolve("apps/web/src/styles.css"), "utf8");
    expect(styles).toMatch(/\.app-shell:has\(\.goods-mobile-bar\) \.main-content \{[\s\S]*padding-bottom: calc\(176px \+ env\(safe-area-inset-bottom\)\)/);
    expect(css).toMatch(
      /@media \(max-width: 900px\)[\s\S]*body:has\(\.goods-mobile-bar, \.pos-mobile-bar[^)]*\)\s+\.assistant-launcher\s*\{\s*bottom: calc\(88px/,
    );
  });
  it("a 390px el lanzador no tapa controles de Mercancía durante el scroll", () => {
    const css = readFileSync(resolve("apps/web/src/Assistant.css"), "utf8");
    const sharedCss = readFileSync(resolve("apps/web/src/styles.css"), "utf8");
    const merchandise = readFileSync(
      resolve("apps/web/src/Merchandise.tsx"),
      "utf8",
    );
    expect(css).toMatch(
      /@media \(max-width: 768px\)[\s\S]*body:has\(\.merchandise\) \.assistant-launcher\s*\{\s*display: none/,
    );
    expect(merchandise).toContain('className="goods-assistant-inline"');
    expect(merchandise).toContain("{assistantAvailable && (");
    expect(merchandise).toContain('new CustomEvent("nexora:abrir-asistente"');
    expect(sharedCss).toMatch(
      /@media \(max-width: 768px\)[\s\S]*\.goods-assistant-inline\s*\{[\s\S]*display: inline-flex !important/,
    );
  });
  it("la cuota deja de anunciar carga cuando falta internet o falla la consulta", () => {
    expect(assistant).toContain("Cuota no disponible sin conexión");
    expect(assistant).toContain("No pudimos consultar tu cuota");
    expect(assistant).toContain("cuota agotada");
    expect(assistant).toContain('aria-label="Cuota de Pregúntale a Norexos"');
  });
});

const money = (n: number) => Math.round(n * 100) / 100;
