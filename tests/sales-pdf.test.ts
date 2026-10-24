import { PassThrough } from "node:stream";
import { once } from "node:events";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SalesController } from "../apps/api/src/sales";
import { formatReceiptMoney } from "../apps/api/src/receipt-pdf";

const actor = {
  id: "6c814d24-93b8-43fa-b846-fdca676f37d7",
  name: "Administración",
  email: "admin@example.test",
  role: "administrator",
  permissions: ["sale:write", "sale:manage"],
  branchId: "main",
} as any;

async function capturePdf(
  write: (response: any) => Promise<void>,
): Promise<{ buffer: Buffer; headers: Record<string, string> }> {
  const response = new PassThrough() as PassThrough & {
    setHeader(name: string, value: string): void;
  };
  const headers: Record<string, string> = {};
  response.setHeader = (name, value) => {
    headers[name.toLowerCase()] = String(value);
  };
  const chunks: Buffer[] = [];
  response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
  const ended = once(response, "end");
  await write(response);
  await ended;
  return { buffer: Buffer.concat(chunks), headers };
}

// PDFKit guarda el texto como cadenas hexadecimales dentro de los streams de
// contenido. Inflarlas y decodificarlas prueba el PDF binario realmente
// emitido por el controlador, sin confundirlo con una aserción sobre el fuente.
function pdfText(pdf: Buffer) {
  const raw = pdf.toString("latin1");
  const text: string[] = [];
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of raw.matchAll(streams)) {
    const dictionary = raw.slice(Math.max(0, match.index! - 250), match.index);
    let content = Buffer.from(match[1], "latin1");
    if (dictionary.includes("/FlateDecode")) {
      try {
        content = inflateSync(content);
      } catch {
        continue;
      }
    }
    const source = content.toString("latin1");
    for (const hex of source.matchAll(/<([0-9a-f]+)>/gi))
      text.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return text.join("");
}

describe("G5 · contenido real de PDF", () => {
  it("formatea importes dominicanos con miles y dos decimales, también en valores extremos", () => {
    expect(formatReceiptMoney(43800)).toBe("RD$ 43,800.00");
    expect(formatReceiptMoney(-12.5)).toBe("RD$ -12.50");
    expect(formatReceiptMoney(undefined)).toBe("RD$ 0.00");
    expect(formatReceiptMoney(Number.MAX_SAFE_INTEGER)).toContain(",");
  });

  it("emite un crédito legible y honesto, con montos conciliables y PII enmascarada", async () => {
    const sale = {
      id: "ee2ed38c-fd20-4e93-8780-24049da3f566",
      number: "FS-0000100",
      status: "completed",
      sellerId: actor.id,
      customerId: "582341f6-9abc-4f46-9bdf-62fcae09f006",
      createdAt: new Date("2026-10-08T16:34:00.000Z"),
      taxIncluded: true,
      subtotal: 19500,
      discountTotal: 9000,
      taxTotal: 1606.78,
      total: 10606.78,
      creditBalance: 10606.78,
      creditDueDate: new Date("2026-10-18T16:34:00.000Z"),
      discountReason: "Precio al por mayor",
      discountRule: "manager_pin",
      discountApprovedName: "Autorizador Interno",
      discountApprovedRole: "manager",
      ncfType: null,
      items: [
        {
          qty: 10,
          unitPrice: 1950,
          discount: 9000,
          tax: 1606.78,
          lineTotal: 10606.78,
          variant: {
            sku: "SKU-1",
            product: { name: 'Proteína con ñ, & comillas "Gold"' },
          },
        },
      ],
      payments: [
        {
          method: "cod",
          entryType: "sale",
          status: "pending",
          tendered: 10606.78,
          amount: 10606.78,
          change: 0,
        },
      ],
      returns: [{ refundAmount: 100, reason: "Devolución parcial de prueba" }],
    };
    const db = {
      sale: { findFirstOrThrow: async () => sale },
      settings: {
        findUnique: async () => ({
          data: {
            name: "Grupo Macgen",
            branchName: "Plaza Lope de Vega",
            phone: "809-555-0199",
            logo: null,
          },
        }),
      },
      customer: {
        findUnique: async () => ({
          name: "Alex Roque",
          phone: "8095550101",
          legalId: "00112345678",
        }),
      },
      user: { findUnique: async () => ({ name: "Edgar Soto" }) },
    };
    const rendered = await capturePdf((response) =>
      new SalesController(db as any).receipt(sale.id, actor, response),
    );
    const text = pdfText(rendered.buffer);

    expect(text).toContain("Venta a crédito");
    expect(text).toContain("RD$ 19,500.00");
    expect(text).toContain("RD$ 9,000.00");
    expect(text).toContain("RD$ 10,606.78");
    expect(text).toContain("Pagado hoy: RD$ 0.00");
    expect(text).toContain("Saldo pendiente: RD$ 10,606.78");
    expect(text).toContain("Vencimiento:");
    expect(text).toContain("Alex Roque");
    expect(text).toContain("101");
    expect(text).not.toContain("8095550101");
    expect(text).not.toContain("00112345678");
    expect(text).toContain("Precio al por mayor");
    expect(text).not.toContain("Autorizador Interno");
    expect(text).not.toContain("manager_pin");
    expect(text).not.toMatch(/Recibido|cod:|Autorizó|Cambio/);
    expect(text).toContain("efectivo, tarjeta o transferencia");
    expect(text).toContain("Reconocimiento del cliente");
    expect(text).toContain("Devoluciones registradas");
    expect(text).toContain("RD$ 100.00");
    expect(text).toContain("Documento interno, sin valor fiscal");
    expect(text.match(/Documento interno, sin valor fiscal/g)).toHaveLength(1);
  });

  it("presenta contado, pago mixto y anulada con montos formateados y motivo", async () => {
    const sale = {
      id: "ee2ed38c-fd20-4e93-8780-24049da3f566",
      number: "FS-0000101",
      status: "voided",
      voidedReason: "Error del cajero",
      sellerId: actor.id,
      customerId: null,
      createdAt: new Date("2026-10-08T16:34:00.000Z"),
      taxIncluded: false,
      subtotal: 1000,
      discountTotal: 0,
      taxTotal: 180,
      total: 1180,
      creditBalance: 0,
      discountReason: null,
      ncfType: null,
      items: [
        {
          qty: 1,
          unitPrice: 1000,
          discount: 0,
          tax: 180,
          lineTotal: 1180,
          variant: { sku: "SKU-1", product: { name: "Producto de prueba" } },
        },
      ],
      payments: [
        {
          method: "cash",
          entryType: "sale",
          status: "ok",
          amount: 500,
          tendered: 550,
          change: 50,
        },
        { method: "card", entryType: "sale", status: "ok", amount: 680 },
      ],
      returns: [],
    };
    const db = {
      sale: { findFirstOrThrow: async () => sale },
      settings: {
        findUnique: async () => ({ data: { name: "Grupo Macgen" } }),
      },
      customer: { findUnique: async () => null },
      user: { findUnique: async () => ({ name: "Cajera de prueba" }) },
    };
    const rendered = await capturePdf((response) =>
      new SalesController(db as any).receipt(sale.id, actor, response),
    );
    const text = pdfText(rendered.buffer);

    expect(text).toContain("ANULADA");
    expect(text).toContain("Error del cajero");
    expect(text).not.toContain("Forma de pago:");
    expect(text).not.toContain("Recibido");
    expect(text).toContain("Consumidor final");
    expect(text).toContain("RD$ 1,180.00");
    expect(text).toContain("ITBIS adicional");

    // Una venta anulada no debe parecer una deuda pendiente, aunque la fila
    // conserve un saldo histórico o pagos asociados.
    sale.creditBalance = 1180;
    const voidedCredit = await capturePdf((response) =>
      new SalesController(db as any).receipt(sale.id, actor, response),
    );
    const voidedCreditText = pdfText(voidedCredit.buffer);
    expect(voidedCreditText).toContain("ANULADA");
    expect(voidedCreditText).not.toContain("Saldo pendiente");
    expect(voidedCreditText).not.toContain("Pagado hoy");
    expect(voidedCreditText).not.toContain("Reconocimiento del cliente");

    sale.status = "completed";
    sale.creditBalance = 0;
    const paid = await capturePdf((response) =>
      new SalesController(db as any).receipt(sale.id, actor, response),
    );
    const paidText = pdfText(paid.buffer);
    expect(paidText).toContain("Forma de pago: Efectivo");
    expect(paidText).toContain("Tarjeta");
    expect(paidText).toContain("Recibido RD$ 550.00");
    expect(paidText).toContain("Aplicado RD$ 500.00");
    expect(paidText).toContain("Cambio RD$ 50.00");
  });

  it("maneja 100 productos, texto largo, datos ausentes y varias páginas", async () => {
    const sale = {
      id: "ee2ed38c-fd20-4e93-8780-24049da3f566",
      number: "FS-0000102",
      status: "completed",
      sellerId: actor.id,
      customerId: null,
      createdAt: new Date("2026-10-08T16:34:00.000Z"),
      taxIncluded: true,
      subtotal: 100,
      discountTotal: 0,
      taxTotal: 0,
      total: 100,
      creditBalance: 0,
      ncfType: null,
      items: Array.from({ length: 100 }, (_, index) => ({
        qty: 1,
        unitPrice: 1,
        discount: 0,
        tax: 0,
        lineTotal: 1,
        variant: {
          sku: `SKU-${index}`,
          product: {
            name: `Producto ñ ${index} & descripción muy larga ${"con texto ".repeat(12)}`,
          },
        },
      })),
      payments: [
        { method: "cash", entryType: "sale", status: "ok", amount: 100 },
      ],
      returns: [],
    };
    const db = {
      sale: { findFirstOrThrow: async () => sale },
      settings: {
        findUnique: async () => ({ data: { name: "Grupo Macgen", receiptFooter: "Vuelve pronto a Negocio B" } }),
      },
      customer: { findUnique: async () => null },
      user: { findUnique: async () => null },
    };
    const rendered = await capturePdf((response) =>
      new SalesController(db as any).receipt(sale.id, actor, response),
    );
    const text = pdfText(rendered.buffer);
    const pageCount = (
      rendered.buffer.toString("latin1").match(/\/Type \/Page\b/g) ?? []
    ).length;

    expect(rendered.buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pageCount).toBeGreaterThan(1);
    expect(text).toContain("Producto ñ 99");
    expect(text).toContain("Vuelve pronto a Negocio B");
    expect(text).toMatch(/Página \d+ de \d+/);
    expect(text).toContain("continuación");
  });

  it("mantiene el recibo limitado a la sucursal y a la vendedora autenticada", async () => {
    const saleId = "ee2ed38c-fd20-4e93-8780-24049da3f566";
    let scopedWhere: any;
    const branchSeller = {
      ...actor,
      id: "e8ddc89d-eada-4ba5-9f21-199117dbf49c",
      permissions: ["sale:write"],
      branchId: "branch-private",
    };
    const db = {
      sale: {
        findFirstOrThrow: async ({ where }: any) => {
          scopedWhere = where;
          if (
            where.branchId !== branchSeller.branchId ||
            where.sellerId !== branchSeller.id
          )
            throw new Error("not found");
          return {
            id: saleId,
            number: "FS-PRIVATE-1",
            status: "completed",
            sellerId: branchSeller.id,
            customerId: null,
            createdAt: new Date("2026-10-08T16:34:00.000Z"),
            taxIncluded: true,
            subtotal: 100,
            discountTotal: 0,
            taxTotal: 0,
            total: 100,
            creditBalance: 0,
            items: [],
            payments: [],
            returns: [],
          };
        },
      },
      settings: { findUnique: async () => ({ data: {} }) },
      customer: { findUnique: async () => null },
      user: { findUnique: async () => null },
    };
    await capturePdf((response) =>
      new SalesController(db as any).receipt(saleId, branchSeller, response),
    );
    expect(scopedWhere).toEqual({
      id: saleId,
      branchId: "branch-private",
      sellerId: branchSeller.id,
    });
  });

  it("la venta conserva su taxIncluded aunque Ajustes cambie después", async () => {
    const sale = {
      id: "ee2ed38c-fd20-4e93-8780-24049da3f566",
      number: "FS-0000042",
      status: "completed",
      sellerId: actor.id,
      customerId: "582341f6-9abc-4f46-9bdf-62f7cc5509e6",
      createdAt: new Date("2026-10-08T16:34:00.000Z"),
      taxIncluded: false,
      taxTotal: 18,
      total: 118,
      creditBalance: 0,
      discountTotal: 0,
      ncfType: null,
      items: [
        {
          qty: 1,
          unitPrice: 100,
          lineTotal: 118,
          variant: { sku: "SKU-1", product: { name: "Producto PDF" } },
        },
      ],
      payments: [{ method: "cash", tendered: 118, amount: 118, change: 0 }],
    };
    const db = {
      sale: { findFirstOrThrow: async () => sale },
      // Ajustes ya cambió a incluido; el PDF debe respetar la venta histórica.
      settings: {
        findUnique: async () => ({
          data: {
            name: "Negocio PDF",
            phone: "809-555-0199",
            taxIncluded: true,
          },
        }),
      },
      customer: {
        findUnique: async () => ({ name: "Cliente PDF", phone: "8095550101" }),
      },
      user: { findUnique: async () => ({ name: "Cajera PDF" }) },
    };
    const controller = new SalesController(db as any);
    const rendered = await capturePdf((response) =>
      controller.receipt(sale.id, actor, response),
    );
    const text = pdfText(rendered.buffer);

    expect(rendered.headers["content-type"]).toBe("application/pdf");
    expect(text).toContain("Tel.: 809-555-0199");
    expect(text).toContain("Fecha:");
    expect(text).toContain("12:34");
    expect(text).toContain("ITBIS adicional");
    expect(text).toContain("RD$ 18.00");
    expect(text).not.toContain("ITBIS incluido:");
  });

  // V2-02 (auditoría 03 v2): el PDF sale por WhatsApp o correo.
  it("V2-02: no imprime teléfono ni cédula completa del cliente y lleva política de devolución y aviso de privacidad", async () => {
    const make = (ncfType: string | null) => ({
      id: "ee2ed38c-fd20-4e93-8780-24049da3f566",
      number: "FS-0000043",
      status: "completed",
      sellerId: actor.id,
      customerId: "582341f6-9abc-4f46-9bdf-62f7cc5509e6",
      createdAt: new Date("2026-10-08T16:34:00.000Z"),
      taxIncluded: true,
      taxTotal: 18,
      total: 118,
      creditBalance: 0,
      discountTotal: 0,
      ncfType,
      items: [
        {
          qty: 1,
          unitPrice: 100,
          lineTotal: 118,
          variant: { sku: "SKU-1", product: { name: "Producto PDF" } },
        },
      ],
      payments: [{ method: "cash", tendered: 118, amount: 118, change: 0 }],
    });
    const privileged = { ...actor, role: "admin", permissions: ["*"] };
    const render = async (ncfType: string | null, who = privileged) => {
      const sale = make(ncfType);
      const db = {
        sale: { findFirstOrThrow: async () => sale },
        settings: {
          findUnique: async () => ({
            data: {
              name: "Negocio PDF",
              phone: "809-555-0199",
              returnDays: 15,
            },
          }),
        },
        customer: {
          findUnique: async () => ({
            name: "Ana Herrera",
            phone: "8095550101",
            legalId: "00112345678",
          }),
        },
        user: { findUnique: async () => ({ name: "Cajera PDF" }) },
      };
      const rendered = await capturePdf((response) =>
        new SalesController(db as any).receipt(sale.id, who, response),
      );
      return pdfText(rendered.buffer);
    };
    for (const who of [privileged, actor]) {
      const plain = await render(null, who);
      expect(plain).toContain("Vendido a: Ana Herrera");
      expect(plain).not.toContain("8095550101");
      expect(plain).toContain("Tel.");
      expect(plain).not.toContain("00112345678");
      expect(plain).toContain("RNC/Cédula");
      expect(plain).toContain(
        "Devoluciones: hasta 15 días con este recibo y el empaque original",
      );
      expect(plain).toContain(
        "Privacidad: usamos sus datos sólo para esta venta",
      );
      expect(plain).toContain("o al 809-555-0199");
      expect(plain).not.toMatch(/garant[ií]a de ley/);
      const fiscal = await render("B01", who);
      expect(fiscal).toContain("RNC/Cédula");
      expect(fiscal).toContain("678");
      expect(fiscal).not.toContain("00112345678");
      expect(fiscal).not.toContain("8095550101");
    }
    const fiscal = await render("B01");
    expect(fiscal).toContain("RNC/Cédula");
    expect(fiscal).toContain("678");
  });

  it("la nota de crédito incluye negocio, fecha, devolución y condiciones", async () => {
    const returned = {
      id: "462f4fe6-4718-49d0-b63c-ef8e8bba58f9",
      number: "NC-0000007",
      reason: "Producto devuelto en buen estado",
    };
    const db = {
      saleReturn: { findFirstOrThrow: async () => returned },
      creditNote: {
        findUniqueOrThrow: async () => ({
          createdAt: new Date("2026-10-08T17:45:00.000Z"),
          amount: 750,
          balance: 500,
          redemptionCode: "ABCDEF0123456789ABCDEF0123456789",
        }),
      },
      settings: {
        findUnique: async () => ({
          data: {
            name: "Negocio PDF",
            branchName: "Sucursal PDF",
            address: "Dirección PDF",
            phone: "809-555-0123",
            legalId: "101010101",
          },
        }),
      },
    };
    const controller = new SalesController(db as any);
    const rendered = await capturePdf((response) =>
      controller.creditNotePdf(returned.id, actor, response),
    );
    const text = pdfText(rendered.buffer);

    expect(rendered.headers["content-type"]).toBe("application/pdf");
    expect(text).toContain("Negocio PDF");
    expect(text).toContain("Dirección PDF");
    expect(text).toContain("Tel.: 809-555-0123");
    expect(text).toContain("Fecha:");
    expect(text).toContain("Producto devuelto en buen estado");
    expect(text).toContain("Condiciones de uso:");
    expect(text).toContain("ABCDEF0123456789ABCDEF0123456789");
  });
});
