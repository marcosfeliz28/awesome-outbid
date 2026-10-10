// Auditoría 03 (textos que ve el cliente) y 05-A1/M8: el recibo térmico de la
// caja. Render real del componente, sin navegador.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  InvoicePrint,
  NON_FISCAL_LEGEND,
  privacyNoticeText,
  returnPolicyText,
  taxLabel,
} from "../apps/web/src/Prints";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");
const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");

const sale = {
  number: "V-000123",
  createdAt: "2026-10-09T12:00:00Z",
  cashierName: "Cajera de prueba",
  snapshot: [
    { sku: "QA", name: "Faja · M", qty: 1, unitPrice: 1180, discount: 0 },
  ],
  total: 1180,
  taxTotal: 180,
  creditBalance: 1000,
  payments: [{ method: "cash", amount: 180 }],
  change: 0,
};
const config = {
  name: "Tienda de prueba",
  phone: "809-555-0100",
  returnDays: 30,
  taxIncluded: true,
};
const render = (props: any) =>
  text(renderToStaticMarkup(createElement(InvoicePrint, props)));

describe("05-A1 · el recibo identifica al cliente", () => {
  it("imprime el nombre del cliente del recibo; «Consumidor final» sólo sin cliente", () => {
    const named = render({
      sale,
      config,
      customer: {
        name: "Ana Herrera",
        phone: "8095550199",
        legalId: "00112345678",
      },
    });
    expect(named).toContain("Vendido a: Ana Herrera");
    expect(named).not.toContain("Consumidor final");
    // 03-B3: sin teléfono y sin cédula si no se pidió comprobante.
    expect(named).not.toContain("8095550199");
    expect(named).not.toContain("00112345678");
    expect(render({ sale, config })).toContain("Vendido a: Consumidor final");
    expect(
      render({
        sale: { ...sale, ncfType: "B01" },
        config,
        customer: { name: "Ana Herrera", legalId: "00112345678" },
      }),
    ).toContain("RNC 00112345678");
  });
  it("POS guarda el cliente en el recibo antes de vaciar el carrito", () => {
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    const finish = pos.slice(pos.indexOf("setReceipt({"));
    expect(finish.indexOf("customer: customers.find")).toBeGreaterThan(0);
    expect(finish.indexOf("customer: customers.find")).toBeLessThan(
      finish.indexOf("clearCart()"),
    );
    expect(pos).toContain("const customer = receipt.customer;");
  });
});

describe("03 · textos del recibo no fiscal", () => {
  it("M1: leyenda no fiscal idéntica en el ticket, en WhatsApp/correo y en el PDF", () => {
    expect(NON_FISCAL_LEGEND).toBe(
      "DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL",
    );
    expect(render({ sale, config })).toContain(NON_FISCAL_LEGEND);
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(pos).toMatch(/const text = `[^`]*\$\{NON_FISCAL_LEGEND\}/);
    expect(pos).not.toContain("Documento interno, no fiscal.");
    const api = readFileSync("apps/api/src/sales.ts", "utf8");
    const pdf = api.slice(api.indexOf('@Get("sales/:id/receipt.pdf")'));
    expect(pdf).toContain(NON_FISCAL_LEGEND);
  });
  it("M1: ningún botón ni título de la venta llama «factura» al recibo", () => {
    const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
    expect(pos).not.toMatch(/>\s*(Imprimir factura|Factura PDF)\s*</);
    expect(pos).toContain("Imprimir recibo");
    expect(pos).toContain("Recibo PDF");
    const management = readFileSync("apps/web/src/Management.tsx", "utf8");
    for (const label of [
      '"Buscar número de factura"',
      'label: "Factura"',
      '"Sí, anular factura"',
      '"Factura anulada."',
      '"Imprimir la factura automáticamente al cobrar"',
    ])
      expect(management).not.toContain(label);
    const dashboard = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
    expect(dashboard).not.toContain("Facturas emitidas");
  });
  it("B4: un NCF suelto (restauración o migración) no convierte el ticket en «COMPROBANTE FISCAL»", () => {
    const html = renderToStaticMarkup(
      createElement(InvoicePrint, {
        sale: { ...sale, ncf: "B0200000001" },
        config: { ...config, ncfMode: "prepared" },
      }),
    );
    expect(html).not.toContain('<h3 class="tp-center">COMPROBANTE FISCAL</h3>');
    expect(html).not.toContain("B0200000001");
    expect(html).toContain(NON_FISCAL_LEGEND);
  });
  it("M2: el ITBIS dice si está incluido o se suma", () => {
    expect(render({ sale, config })).toContain("ITBIS incluido RD$ 180.00");
    expect(
      render({ sale, config: { ...config, taxIncluded: false } }),
    ).toContain("ITBIS adicional RD$ 180.00");
    expect(taxLabel({ taxIncluded: false }, config)).toBe("ITBIS adicional");
    expect(taxLabel({}, {})).toBe("ITBIS incluido");
  });
  it("M3: la política de devoluciones usa los días de Ajustes o un texto genérico", () => {
    expect(render({ sale, config })).toContain(
      "Devoluciones: hasta 30 días con este recibo",
    );
    expect(returnPolicyText({ returnDays: 0 })).toMatch(
      /^Devoluciones: según la política de la tienda/,
    );
    expect(returnPolicyText(undefined)).toMatch(/conserve este recibo/);
  });
  // V2-01: el recibo no promete una «garantía de ley» que la API no permite
  // atender. Mientras sales.ts rechace TODA devolución fuera de plazo sin una
  // excepción por producto defectuoso o vencido, la frase no puede aparecer;
  // si algún día la API añade esa excepción (con «defect» o «garant» junto al
  // control de plazo), la prueba obliga a que el recibo la anuncie.
  it("V2-01: la frase de garantía sólo aparece si la API realmente la atiende", () => {
    const api = readFileSync("apps/api/src/sales.ts", "utf8");
    const guard = api.indexOf("La venta excede el plazo de devolución");
    expect(guard).toBeGreaterThan(0);
    const around = api.slice(Math.max(0, guard - 1500), guard + 300);
    const apiHonorsDefects = /defect|garant[ií]a|vencid/i.test(around);
    const printed = [{ returnDays: 30 }, { returnDays: 0 }, undefined]
      .map(returnPolicyText)
      .join(" ");
    expect(/garant[ií]a/i.test(printed)).toBe(apiHonorsDefects);
    expect(render({ sale, config })).not.toMatch(/garant[ií]a de ley/);
  });
  it("A1: aviso corto de privacidad en el pie, con el teléfono de la tienda", () => {
    expect(render({ sale, config })).toContain(
      "Privacidad: usamos sus datos sólo para esta venta",
    );
    expect(privacyNoticeText(config)).toContain("o al 809-555-0100");
    expect(privacyNoticeText({})).not.toContain(" o al ");
  });
});

describe("03-A1 · aviso de privacidad en la web", () => {
  it("el formulario de cliente (caja y Clientes) muestra el aviso con el enlace «Privacidad»", () => {
    const helpers = readFileSync("apps/web/src/helpers.tsx", "utf8");
    const notice = helpers.slice(
      helpers.indexOf("export function CustomerPrivacyNotice"),
      helpers.indexOf("export function FormModal"),
    );
    expect(notice).toContain("son opcionales");
    expect(notice).toContain('href="/privacidad.html"');
    expect(notice).toMatch(/>\s*Privacidad\s*</);
    expect(readFileSync("apps/web/src/POS.tsx", "utf8")).toContain(
      "<CustomerPrivacyNotice />",
    );
    const management = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(
      management.match(/notice=\{<CustomerPrivacyNotice \/>\}/g),
    ).toHaveLength(2);
  });
  it("«Acerca de» enlaza el aviso, que existe como página estática", () => {
    const app = readFileSync("apps/web/src/App.tsx", "utf8");
    const about = app.slice(app.indexOf("function About("));
    expect(about).toContain("<h3>Privacidad</h3>");
    expect(about).toContain('href="/privacidad.html"');
    const page = readFileSync("apps/web/public/privacidad.html", "utf8");
    expect(page).toContain("<h1>Aviso de privacidad</h1>");
    expect(page).toContain("opcionales");
    expect(page).not.toMatch(/\[[A-ZÁÉÍÓÚ ]{3,}\]/);
  });
});

describe("05-A3/M1 · carrito en curso y cierre por inactividad", () => {
  const app = readFileSync("apps/web/src/App.tsx", "utf8");
  const draft = readFileSync("apps/web/src/cartDraft.ts", "utf8");
  it("la inactividad no cierra la sesión con carrito o ventas pendientes en la cola", () => {
    const check = app.slice(app.indexOf("const holdsWork"));
    expect(check).toContain("useStore.getState().cart.length > 0");
    expect(check).toContain('sale.status === "pending"');
    // Se pregunta antes de avisar o cerrar.
    expect(check.indexOf("if (await holdsWork())")).toBeLessThan(
      check.indexOf("await endSession()"),
    );
  });
  it("el borrador va en la tabla que cerrar sesión borra (G9) y sin el costo", () => {
    expect(draft).toContain('"cart-draft:" + userId');
    expect(draft).toContain(
      "localDB.cache.put({ key: draftKey(userId), data })",
    );
    expect(draft).toMatch(/costAvg: removed/);
    expect(readFileSync("apps/web/src/main.tsx", "utf8")).toContain(
      "keepCartDraft();",
    );
    // Cambiar de vendedor ya no vacía el carrito de quien sale.
    const pin = app.slice(app.indexOf('post("/auth/pin"'));
    expect(pin.slice(0, 400)).not.toContain("clearCart()");
  });
});

describe("05-M8 y B3 · ticket con variante y textos sin nombres propios", () => {
  const pos = readFileSync("apps/web/src/POS.tsx", "utf8");
  it("la línea del ticket lleva la variante, como la venta en espera", () => {
    const snapshot = pos.slice(pos.indexOf("const snapshot = cart.map"));
    expect(snapshot.slice(0, 200)).toContain("name: lineName(i)");
    expect(pos).toContain(
      'label === "Única" ? i.product.name : i.product.name + " · " + label',
    );
  });
  it("el cobro no nombra personas fijas", () => {
    expect(pos).not.toMatch(/Marcos o Genesis/);
    expect(pos).toContain("Sólo la administración podrá registrar después");
  });
});

describe("05-B2, B11 y B13 · textos y avisos baratos", () => {
  it("B2: los tipos de alerta se muestran en español", () => {
    const management = readFileSync("apps/web/src/Management.tsx", "utf8");
    expect(management).toContain('offline_conflict: "Venta sin conexión"');
    expect(management).toContain('low_stock: "Stock bajo"');
    expect(management).toContain("{alertTypeLabel(a.type)}");
    expect(management).not.toContain('{a.type.replaceAll("_", " ")}');
  });
  it("B11: el ejemplo del usuario no parece una cuenta real; B13: sin conexión se avisa", () => {
    const app = readFileSync("apps/web/src/App.tsx", "utf8");
    expect(app).not.toContain('placeholder="mfeliz"');
    expect(app).toContain("Necesitas conexión para cambiar de vendedor.");
  });
});
