import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { InvoicePrint, receiptMoney, receiptWhen } from "../apps/web/src/Prints";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire("react-dom/server") as typeof import("react-dom/server");
const visible = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

const sale = {
  number: "V-001",
  createdAt: "2026-10-10T01:30:00.000Z",
  snapshot: [{ sku: "A", name: "Artículo", qty: 1, unitPrice: 1234.5 }],
  total: 1234.5,
  taxTotal: 0,
  payments: [{ method: "cash", amount: 1234.5 }],
};

describe("N-22 · configuración monetaria histórica del ticket", () => {
  it("usa la zona y moneda fijadas en la venta aun cuando cambie la empresa", () => {
    const printed = visible(renderToStaticMarkup(createElement(InvoicePrint, {
      sale: { ...sale, receiptCurrency: "USD", receiptTimeZone: "America/Los_Angeles" },
      config: { name: "Negocio", tenantLocale: { currency: "EUR", timeZone: "Europe/Madrid" } },
    })));
    expect(printed).toContain("US$ 1,234.50");
    expect(printed).not.toContain("RD$");
    expect(printed).not.toContain("€");
    expect(printed).toContain("09/10/2026");
  });

  it("mantiene DOP y Santo Domingo para documentos históricos sin metadatos", () => {
    const printed = visible(renderToStaticMarkup(createElement(InvoicePrint, {
      sale,
      config: { name: "Negocio", tenantLocale: { currency: "USD", timeZone: "America/Los_Angeles" } },
    })));
    expect(printed).toContain("RD$ 1,234.50");
    expect(printed).toContain("09/10/2026");
  });

  it("valida datos antes de llamar Intl y usa un fallback estable", () => {
    expect(receiptMoney(2, "moneda-invalida")).toBe("RD$ 2.00");
    expect(receiptWhen(sale.createdAt, "Zona/NoExiste")).toContain("09/10/2026");
  });
});
