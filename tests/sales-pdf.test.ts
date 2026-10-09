import { PassThrough } from "node:stream";
import { once } from "node:events";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { SalesController } from "../apps/api/src/sales";

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
    expect(text).toContain("Fecha y hora:");
    expect(text).toContain("12:34");
    expect(text).toContain("ITBIS adicional: RD$ 18");
    expect(text).not.toContain("ITBIS incluido:");
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
