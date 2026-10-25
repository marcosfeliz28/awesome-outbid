import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ProductSalesPage } from "../apps/web/src/ProductSalesPage";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");

const renderPage = () => renderToStaticMarkup(createElement(ProductSalesPage));

function relativeLuminance(hex: string) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(foreground: string, background: string) {
  const values = [
    relativeLuminance(foreground),
    relativeLuminance(background),
  ].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("página pública de Nexora POS", () => {
  it("publica los cuatro planes y el anual equivalente a diez meses", () => {
    const html = renderPage();

    expect(html.match(/data-plan=/g)).toHaveLength(4);
    expect(html).toContain("Autoservicio");
    expect(html).toContain("RD$1,250");
    expect(html).toContain("RD$12,500");
    expect(html).toContain("Básico");
    expect(html).toContain("RD$2,000");
    expect(html).toContain("RD$20,000");
    expect(html).toContain("Pro");
    expect(html).toContain("RD$4,000");
    expect(html).toContain("RD$40,000");
    expect(html).toContain("Premium");
    expect(html).toContain("RD$7,000");
    expect(html).toContain("RD$70,000");
    expect(html).toContain("2 meses gratis");
  });

  it("muestra únicamente los límites acordados de cada plan", () => {
    const html = renderPage();
    const planCards = Object.fromEntries(
      [
        ...html.matchAll(
          /<article class="sales-plan-card[^"]*" data-plan="([^"]+)">([\s\S]*?)<\/article>/g,
        ),
      ].map(([, plan, card]) => [plan, card]),
    );

    expect(planCards.autoservicio).toContain("1 sucursal");
    expect(planCards.autoservicio).toContain("1 caja");
    expect(planCards.autoservicio).toContain("2 usuarios");
    expect(planCards.autoservicio).toContain("100 preguntas de IA al mes");

    expect(planCards.básico).toContain("1 sucursal");
    expect(planCards.básico).toContain("2 cajas");
    expect(planCards.básico).toContain("3 usuarios");
    expect(planCards.básico).toContain("250 preguntas de IA al mes");

    expect(planCards.pro).toContain("2 sucursales");
    expect(planCards.pro).toContain("6 cajas");
    expect(planCards.pro).toContain("10 usuarios");
    expect(planCards.pro).toContain("600 preguntas de IA al mes");

    expect(planCards.premium).toContain("5 sucursales");
    expect(planCards.premium).toContain("20 cajas");
    expect(planCards.premium).toContain("30 usuarios");
    expect(planCards.premium).toContain("1,500 preguntas de IA al mes");
  });

  it("explica el cobro manual, el piloto cerrado y los paquetes de IA sin inventar una cuenta", () => {
    const html = renderPage();

    expect(html).toContain("Transferencia o efectivo");
    expect(html).toContain(
      "no procesa tarjetas ni utiliza una pasarela de pago",
    );
    expect(html).toContain("registro público aún está cerrado");
    expect(html).toContain("piloto por invitación");
    expect(html).toContain("100 preguntas");
    expect(html).toContain("RD$399");
    expect(html).toContain("300 preguntas");
    expect(html).toContain("RD$999");
    expect(html).toContain("solo se pausa la IA");
    expect(html).not.toMatch(
      /número de cuenta|titular|banreservas|bhd|popular/i,
    );
    expect(html).not.toContain("/registro");
  });

  it("ofrece acceso honesto y una estructura navegable con teclado", () => {
    const html = renderPage();

    expect(html).toContain('href="/entrar"');
    expect(html).toContain('href="#proceso-piloto"');
    expect(html).toContain('href="#planes"');
    expect(html).toContain("Entrar si ya fui invitado");
    expect(html).toContain("Espera la invitación");
    expect(html).not.toMatch(/<form|<input|<button/i);
  });

  it("mantiene contrato móvil, blancos de 44 px, foco visible y movimiento reducido", () => {
    const css = readFileSync("apps/web/src/productSalesPage.css", "utf8");

    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("min-width: 0");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("@media (min-width: 30rem)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).not.toMatch(/min-width:\s*(?:3[2-9]\d|[4-9]\d\d|\d{4,})px/);

    const textPairs = [
      ["#f7fbff", "#07111f"],
      ["#b8c7d9", "#0d1d30"],
      ["#45e0c1", "#07111f"],
      ["#03211b", "#45e0c1"],
      ["#151006", "#ffd166"],
    ];
    for (const [foreground, background] of textPairs) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
