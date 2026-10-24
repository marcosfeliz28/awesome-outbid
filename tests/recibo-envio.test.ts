import { inflateSync } from "node:zlib";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { courierCharge } from "../packages/shared/src/index";
import { drawSaleReceipt } from "../apps/api/src/receipt-pdf";
import { InvoicePrint } from "../apps/web/src/Prints";

// Orden de la dueña (19-oct): «En la factura quiero que agregues el monto
// del envío también para que se vea y el cliente esté de acuerdo».
const webRequire = createRequire(resolve("apps/web/package.json"));
const PDFDocument = createRequire(resolve("apps/api/package.json"))("pdfkit");
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const sale = (extra: object = {}) => ({
  number: "FS-0000999",
  createdAt: "2026-10-19T15:00:00Z",
  subtotal: 2000,
  discountTotal: 0,
  taxTotal: 305.08,
  total: 2000,
  items: [],
  payments: [{ method: "transfer", amount: 2300 }],
  snapshot: [],
  ...extra,
});

async function pdfText(data: any) {
  const doc = new PDFDocument({ size: "A4", margin: 48, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(Buffer.from(c)));
  const done = new Promise((r) => doc.on("end", r));
  drawSaleReceipt(doc, {
    sale: data,
    business: {},
    customer: null,
    seller: null,
  });
  doc.end();
  await done;
  const raw = Buffer.concat(chunks).toString("latin1");
  const text: string[] = [];
  for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)\nendstream/g)) {
    let content = Buffer.from(m[1], "latin1");
    try {
      content = inflateSync(content);
    } catch {
      /* stream sin comprimir */
    }
    for (const hex of content.toString("latin1").matchAll(/<([0-9a-f]+)>/gi))
      text.push(Buffer.from(hex[1], "hex").toString("latin1"));
  }
  return text.join("");
}

describe("Recibo · envío del mensajero visible para el cliente", () => {
  it("calcula el envío aparte y el total pagado; sin envío no hay línea", () => {
    expect(
      courierCharge(sale({ courierFee: "300", courierName: "Addison" })),
    ).toEqual({ fee: 300, name: "Addison", paid: 2300 });
    expect(courierCharge(sale({ courierFee: "0" }))).toBeNull();
    expect(courierCharge(sale())).toBeNull();
    expect(
      courierCharge(sale({ courierFee: 250, courierName: " " }))?.name,
    ).toBe("Addison");
  });

  it("el PDF muestra envío y total pagado sin cambiar el total de la venta", async () => {
    const con = await pdfText(
      sale({ courierFee: "300", courierName: "Pedro" }),
    );
    expect(con).toContain("Envío (mensajero Pedro)");
    expect(con).toContain("Total pagado");
    expect(con).toContain("2,300.00");
    const sin = await pdfText(sale());
    expect(sin).not.toContain("Envío (mensajero");
    expect(sin).not.toContain("Total pagado");
  });

  it("el ticket impreso muestra envío y total pagado solo si hay envío", () => {
    const html = (s: any) =>
      renderToStaticMarkup(
        createElement(InvoicePrint, { sale: s, config: {} } as any),
      );
    const con = html(sale({ courierFee: 300, courierName: "Addison" }));
    expect(con).toContain("Envío (mensajero Addison)");
    expect(con).toContain("Total pagado");
    expect(html(sale())).not.toContain("Total pagado");
  });

  it("WhatsApp lleva el envío y la caja avisa dónde está «Con envío»", () => {
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(pos).toContain("Total pagado: ${formatMoney(envio.paid)}");
    expect(pos).toContain(
      "¿Con envío? Elige Transferencia o Tarjeta y agrega el pago.",
    );
  });
});
