// Avisos de facturas por Telegram: renderizado puro (sin base de datos).
// La integración con un Telegram falso está en tests/telegram.test.ts.
import { describe, expect, it } from "vitest";
import {
  backoffSeconds,
  cleanText,
  escapeHtml,
  formatDate,
  MAX_ATTEMPTS,
  notify,
  renderCashClose,
  renderCollection,
  renderReturn,
  renderSale,
  renderTest,
  renderVoid,
  sanitizeError,
  telegramSettings,
  type SaleView,
} from "../apps/api/src/notifications";

const TOKEN = "123456789:AAH-fake_token_for_tests_only_000000";
const CEDULA = "001-1234567-8";
const PHONE = "809-555-1234";

const base: SaleView = {
  number: "F-000123",
  // 19:05 UTC = 3:05 p. m. en Santo Domingo (UTC-4).
  createdAt: new Date("2026-10-09T19:05:00Z"),
  register: "4012 · GPRO STORE RD",
  cashier: "María <Caja>",
  customer: "Ana & Luis",
  payments: [{ method: "cash", amount: 1500, status: "ok" }],
  items: [
    { name: "Camiseta <b>Dry</b>", qty: 2 },
    { name: "Short", qty: 1 },
    { name: "Gorra", qty: 1 },
    { name: "Medias", qty: 3 },
    { name: "Botella", qty: 1 },
  ],
  total: 1500,
  taxTotal: 228.81,
  taxIncluded: true,
  creditBalance: 0,
};

// Las etiquetas que Telegram admite con parse_mode HTML y que usamos.
const ALLOWED_TAGS = /<\/?b>/g;
const strayTags = (text: string) =>
  text.replace(ALLOWED_TAGS, "").match(/[<>]/g);

describe("Telegram · renderizado de avisos", () => {
  it("venta en efectivo: título, fecha local, caja, cajera, pago, ITBIS y total", () => {
    const text = renderSale(base);
    const lines = text.split("\n");
    expect(lines[0]).toBe("🧾 <b>Venta cobrada</b> · Factura F-000123");
    expect(text).toContain("Fecha: 09/10/2026 3:05 p. m.");
    expect(text).toContain(
      "Caja: 4012 · GPRO STORE RD · Cajera: María &lt;Caja&gt;",
    );
    expect(text).toContain("Cliente: Ana &amp; Luis");
    expect(text).toContain("Pago: Efectivo RD$ 1,500.00");
    expect(text).toContain("ITBIS (incluido): RD$ 228.81");
    expect(text).toContain("<b>Total: RD$ 1,500.00</b>");
    expect(text).not.toContain("Por cobrar");
    // Título + 5 a 8 líneas.
    expect(lines.length - 1).toBeGreaterThanOrEqual(5);
    expect(lines.length - 1).toBeLessThanOrEqual(8);
  });

  it("artículos: cantidad total, 3 primeros nombres escapados y «+N más»", () => {
    const text = renderSale(base);
    expect(text).toContain(
      "Artículos (8): Camiseta &lt;b&gt;Dry&lt;/b&gt;, Short, Gorra +2 más",
    );
    expect(text).not.toContain("Medias");
    expect(strayTags(text)).toBeNull();
  });

  it("escapa <, > y & en todo el contenido variable", () => {
    expect(escapeHtml("<a href='x'>&</a>")).toBe(
      "&lt;a href='x'&gt;&amp;&lt;/a&gt;",
    );
    const text = renderSale({
      ...base,
      number: "F-<1>",
      customer: "<script>alert(1)</script>",
      register: "Caja <i>1</i>",
    });
    expect(text).toContain("F-&lt;1&gt;");
    expect(text).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(strayTags(text)).toBeNull();
  });

  it("contraentrega: etiqueta «CONTRAENTREGA — POR COBRAR» y saldo por cobrar", () => {
    const text = renderSale({
      ...base,
      payments: [
        { method: "cash", amount: 500 },
        { method: "cod", amount: 1000, status: "pending" },
      ],
      creditBalance: 1000,
    });
    expect(text.split("\n")[0]).toBe(
      "📦 <b>CONTRAENTREGA — POR COBRAR</b> · Factura F-000123",
    );
    expect(text).toContain(
      "Pago: Efectivo RD$ 500.00 · Contraentrega RD$ 1,000.00",
    );
    expect(text).toContain("Por cobrar: RD$ 1,000.00");
  });

  it("crédito: etiqueta «A CRÉDITO»", () => {
    const text = renderSale({
      ...base,
      payments: [{ method: "credit", amount: 1500, status: "pending" }],
      creditBalance: 1500,
    });
    expect(text.split("\n")[0]).toBe(
      "📝 <b>Venta A CRÉDITO</b> · Factura F-000123",
    );
    expect(text).toContain("Pago: Crédito RD$ 1,500.00");
    expect(text).toContain("Por cobrar: RD$ 1,500.00");
  });

  it("tarjeta, transferencia por verificar y nota de crédito", () => {
    const text = renderSale({
      ...base,
      payments: [
        { method: "card", amount: 500, status: "ok" },
        { method: "transfer", amount: 700, status: "pending_verification" },
        { method: "credit_note", amount: 300, status: "ok" },
      ],
      taxTotal: 0,
    });
    expect(text).toContain(
      "Pago: Tarjeta RD$ 500.00 · Transferencia (por verificar) RD$ 700.00 · Nota de crédito RD$ 300.00",
    );
    expect(text).not.toContain("ITBIS");
  });

  it("anulada: motivo, quién anuló y total anulado", () => {
    const text = renderVoid({
      ...base,
      voidedAt: new Date("2026-10-09T20:00:00Z"),
      voidedBy: "Dueña",
      reason: "Cliente se arrepintió <no>",
    });
    expect(text.split("\n")[0]).toBe(
      "❌ <b>Venta ANULADA</b> · Factura F-000123",
    );
    expect(text).toContain("Anulada: 09/10/2026 4:00 p. m. · por: Dueña");
    expect(text).toContain("Motivo: Cliente se arrepintió &lt;no&gt;");
    expect(text).toContain("<b>Total anulado: RD$ 1,500.00</b>");
    expect(strayTags(text)).toBeNull();
  });

  it("devolución: monto, medio de reembolso y factura", () => {
    const text = renderReturn({
      number: "NC-000045",
      saleNumber: "F-000123",
      createdAt: new Date("2026-10-09T19:05:00Z"),
      register: "Caja 1",
      attendedBy: "Gerente",
      customer: "Ana",
      reason: "Talla incorrecta",
      refundMethod: "cash",
      refundAmount: 500,
      total: 500,
      taxTotal: 76.27,
      items: [{ name: "Short", qty: 1 }],
    });
    expect(text.split("\n")[0]).toBe(
      "↩️ <b>Devolución</b> NC-000045 · Factura F-000123",
    );
    expect(text).toContain("Reembolso: Efectivo RD$ 500.00");
    expect(text).toContain("Artículos devueltos (1): Short");
    expect(text).toContain("Motivo: Talla incorrecta");
    expect(text).toContain("<b>Total devuelto: RD$ 500.00</b>");
    expect(
      renderReturn({
        number: "NC-1",
        saleNumber: "F-1",
        createdAt: new Date(),
        register: "Caja",
        attendedBy: "X",
        reason: "r",
        refundMethod: "credit_note",
        refundAmount: 10,
        total: 10,
        taxTotal: 0,
        items: [],
      }),
    ).toContain("Reembolso: Nota de crédito RD$ 10.00");
  });

  it("cobro de contraentrega y abono a crédito", () => {
    const cod = renderCollection({
      kind: "cod",
      saleNumber: "F-000200",
      createdAt: new Date("2026-10-09T19:05:00Z"),
      register: "Caja 1",
      cashier: "María",
      customer: "Ana",
      method: "transfer",
      amount: 1000,
      status: "pending_verification",
      balance: 1000,
      saleTotal: 1500,
    });
    expect(cod.split("\n")[0]).toBe(
      "💵 <b>Cobro de contraentrega</b> · Factura F-000200",
    );
    expect(cod).toContain(
      "Forma de pago: Transferencia (por verificar) RD$ 1,000.00",
    );
    expect(cod).toContain("Saldo pendiente: RD$ 1,000.00");
    const credit = renderCollection({
      kind: "credit",
      saleNumber: "F-000201",
      createdAt: new Date(),
      register: "Caja 1",
      cashier: "María",
      method: "cash",
      amount: 300,
      balance: 200,
      saleTotal: 500,
    });
    expect(credit.split("\n")[0]).toBe(
      "💵 <b>Abono a crédito</b> · Factura F-000201",
    );
    expect(credit).not.toContain("Cliente:");
  });

  it("cierre de caja: esperado, contado y diferencia sólo aquí", () => {
    const text = renderCashClose({
      register: "Caja 1",
      cashier: "María",
      openedAt: new Date("2026-10-09T12:00:00Z"),
      closedAt: new Date("2026-10-09T22:00:00Z"),
      salesCount: 12,
      salesTotal: 25000,
      lines: [
        { label: "Efectivo", expected: 10000, counted: 9950, difference: -50 },
        { label: "Tarjeta", expected: 5000, counted: 5000, difference: 0 },
        { label: "Transferencia", expected: 0, counted: 0, difference: 0 },
      ],
      difference: -50,
    });
    expect(text.split("\n")[0]).toBe("🔒 <b>Cierre de caja</b> · Caja 1");
    expect(text).toContain("Ventas del turno: 12 · RD$ 25,000.00");
    expect(text).toContain(
      "Efectivo: esperado RD$ 10,000.00 · contado RD$ 9,950.00 · diferencia RD$ -50.00",
    );
    expect(text).toContain("<b>Diferencia total: RD$ -50.00 (faltante)</b>");
    // Ningún otro aviso habla de esperado/contado.
    for (const other of [renderSale(base), renderTest(new Date(), "Admin")])
      expect(other).not.toMatch(/esperado|contado|diferencia/i);
  });

  it("sin PII: oculta cédula, teléfono y correo escritos en nombres o motivos", () => {
    expect(cleanText(`Juan ${CEDULA}`)).toBe("Juan [oculto]");
    expect(cleanText(`Tel ${PHONE} juan@correo.com`)).toBe(
      "Tel [oculto] [oculto]",
    );
    expect(cleanText("00112345678")).toBe("[oculto]");
    const text = renderVoid({
      ...base,
      customer: `Pedro ${CEDULA}`,
      voidedAt: new Date(),
      voidedBy: "Admin",
      reason: `Llamar al ${PHONE}`,
    });
    expect(text).not.toContain(CEDULA);
    expect(text).not.toContain("1234567");
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain("555-1234");
    // Sin costos ni márgenes.
    expect(renderSale(base)).not.toMatch(/costo|margen|utilidad/i);
  });

  it("fecha en America/Santo_Domingo aunque el servidor esté en UTC", () => {
    expect(formatDate(new Date("2026-10-10T03:30:00Z"))).toBe(
      "09/10/2026 11:30 p. m.",
    );
  });

  it("prueba de conexión", () => {
    expect(renderTest(new Date(), "Admin <x>")).toMatch(
      /^✅ <b>Prueba de Nexora<\/b>\n.*\nEnviado: .* · por: Admin &lt;x&gt;$/,
    );
  });
});

describe("Telegram · configuración, errores y reintentos", () => {
  it("sólo se activa con token y chat", () => {
    expect(telegramSettings({}).enabled).toBe(false);
    expect(telegramSettings({ TELEGRAM_BOT_TOKEN: TOKEN }).enabled).toBe(false);
    expect(telegramSettings({ TELEGRAM_CHAT_ID: "-100123" }).enabled).toBe(
      false,
    );
    const on = telegramSettings({
      TELEGRAM_BOT_TOKEN: TOKEN,
      TELEGRAM_CHAT_ID: "-100123",
    });
    expect(on.enabled).toBe(true);
    expect(on.apiBase).toBe("https://api.telegram.org");
    expect(
      telegramSettings({
        TELEGRAM_BOT_TOKEN: TOKEN,
        TELEGRAM_CHAT_ID: "1",
        TELEGRAM_API_BASE: "http://127.0.0.1:9/",
      }).apiBase,
    ).toBe("http://127.0.0.1:9");
  });

  it("el error guardado nunca lleva el token ni la URL", () => {
    const raw = `request to https://api.telegram.org/bot${TOKEN}/sendMessage failed, token ${TOKEN}`;
    const clean = sanitizeError(raw, TOKEN);
    expect(clean).not.toContain(TOKEN);
    expect(clean).not.toContain("AAH-fake");
    expect(clean).not.toContain("api.telegram.org");
    expect(sanitizeError(`bot${TOKEN}`, "")).toBe("bot***");
    expect(sanitizeError("x".repeat(1000)).length).toBeLessThanOrEqual(300);
  });

  it("espera creciente: 30 s, 1, 2, 5, 15 min… y máximo de intentos", () => {
    expect([1, 2, 3, 4, 5].map(backoffSeconds)).toEqual([
      30, 60, 120, 300, 900,
    ]);
    expect(backoffSeconds(11)).toBe(3600);
    expect(MAX_ATTEMPTS).toBe(12);
  });

  it("desactivado: notify no toca la base de datos ni lanza", () => {
    const saved = {
      token: process.env.TELEGRAM_BOT_TOKEN,
      chat: process.env.TELEGRAM_CHAT_ID,
    };
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    try {
      const db = new Proxy(
        {},
        {
          get() {
            throw new Error("no debe usarse la base de datos");
          },
        },
      );
      expect(() => notify(db as any, "sale", "x")).not.toThrow();
    } finally {
      if (saved.token !== undefined)
        process.env.TELEGRAM_BOT_TOKEN = saved.token;
      if (saved.chat !== undefined) process.env.TELEGRAM_CHAT_ID = saved.chat;
    }
  });
});
