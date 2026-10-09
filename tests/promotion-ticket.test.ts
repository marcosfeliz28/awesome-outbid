// G15 · El ticket térmico y el recibo PDF nombran la promoción automática de
// cada línea (SaleItem.promotionName). La prueba con la API real está en
// tests/promotion-name.test.ts.
import { PassThrough } from "node:stream";
import { once } from "node:events";
import { inflateSync } from "node:zlib";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InvoicePrint } from "../apps/web/src/Prints";
import { SalesController } from "../apps/api/src/sales";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

function pdfText(pdf: Buffer) {
  const raw = pdf.toString("latin1");
  const text: string[] = [];
  for (const match of raw.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    const dictionary = raw.slice(Math.max(0, match.index! - 250), match.index);
    let content = Buffer.from(match[1], "latin1");
    if (dictionary.includes("/FlateDecode")) {
      try {
        content = inflateSync(content);
      } catch {
        continue;
      }
    }
    for (const hex of content.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      text.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return text.join("");
}

describe("G15 · nombre de la promoción en ticket y PDF", () => {
  it("el ticket nombra la promoción de la línea que la tuvo", () => {
    const ticket = renderToStaticMarkup(
      createElement(InvoicePrint, {
        config: { name: "Negocio de prueba" },
        sale: {
          number: "QA-G15",
          createdAt: "2026-10-09T12:00:00Z",
          cashierName: "Cajera",
          total: 1800,
          taxTotal: 0,
          snapshot: [
            {
              name: "Legging",
              sku: "L-1",
              qty: 1,
              unitPrice: 1000,
              discount: 200,
              lineTotal: 800,
              promotionName: "Semana fit",
            },
            {
              name: "Shaker",
              sku: "S-1",
              qty: 1,
              unitPrice: 1000,
              discount: 0,
              lineTotal: 1000,
            },
          ],
        },
      }),
    );
    expect(ticket).toContain("Promoción: Semana fit");
    expect(ticket.match(/Promoción:/g)).toHaveLength(1);
  });

  it("el recibo PDF nombra la promoción debajo de su línea", async () => {
    const sale = {
      id: "ee2ed38c-fd20-4e93-8780-24049da3f566",
      number: "FS-0000043",
      status: "completed",
      sellerId: "6c814d24-93b8-43fa-b846-fdca676f37d7",
      customerId: null,
      createdAt: new Date("2026-10-08T16:34:00.000Z"),
      taxIncluded: true,
      taxTotal: 0,
      total: 800,
      creditBalance: 0,
      discountTotal: 200,
      ncfType: null,
      items: [
        {
          qty: 1,
          unitPrice: 1000,
          lineTotal: 800,
          promotionName: "Semana fit",
          variant: { sku: "L-1", product: { name: "Legging" } },
        },
      ],
      payments: [{ method: "cash", tendered: 800, amount: 800, change: 0 }],
    };
    const db = {
      sale: { findFirstOrThrow: async () => sale },
      settings: { findUnique: async () => ({ data: { name: "Negocio" } }) },
      customer: { findUnique: async () => null },
      user: { findUnique: async () => ({ name: "Cajera" }) },
    };
    const response = new PassThrough() as PassThrough & {
      setHeader(name: string, value: string): void;
    };
    response.setHeader = () => undefined;
    const chunks: Buffer[] = [];
    response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    const ended = once(response, "end");
    await new SalesController(db as any).receipt(
      sale.id,
      {
        id: sale.sellerId,
        permissions: ["sale:write", "sale:manage"],
        branchId: "main",
      } as any,
      response as any,
    );
    await ended;
    expect(pdfText(Buffer.concat(chunks))).toContain("Promoción: Semana fit");
  });
});
