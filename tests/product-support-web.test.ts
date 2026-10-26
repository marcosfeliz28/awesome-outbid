import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  HELP_ARTICLES,
  HelpArticle,
  SupportContent,
  supportMessage,
} from "../apps/web/src/SupportHelp";
import { SupportAccessCard } from "../apps/web/src/SupportAccess";
import { QueryClient, QueryClientProvider } from "../apps/web/node_modules/@tanstack/react-query/build/modern/index.js";

vi.mock("../apps/web/src/api", () => ({ api: vi.fn(), download: vi.fn() }));
vi.mock("../apps/web/src/helpers", () => ({ toast: vi.fn() }));

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");
const info = {
  whatsapp: "18095551234",
  email: "soporte@nexorapos.net",
  hours: "Lunes a sábado, 9:00 a 6:00",
  company: { name: "Salón Bella", slug: "salon-bella" },
};

describe("botón Ayuda", () => {
  it("arma WhatsApp y correo con empresa, usuario y pantalla, y enlaza las 8 guías", () => {
    const html = renderToStaticMarkup(
      createElement(SupportContent, {
        info,
        userName: "Ana",
        screen: "Caja",
        onArticle: () => undefined,
      }),
    );
    const text = encodeURIComponent(supportMessage(info, "Ana", "Caja"));
    expect(supportMessage(info, "Ana", "Caja")).toBe(
      "Hola, soy Ana de Salón Bella (código salon-bella). Estoy en la pantalla «Caja» de Nexora POS y necesito ayuda con: ",
    );
    expect(html).toContain(`href="https://wa.me/18095551234?text=${text}"`);
    expect(html).toContain("mailto:soporte@nexorapos.net?subject=");
    expect(html).toContain("Horario de soporte: Lunes a sábado, 9:00 a 6:00");
    expect(html).not.toContain("Descargar todos mis datos");
    expect(HELP_ARTICLES).toHaveLength(8);
    for (const [slug, title] of HELP_ARTICLES) {
      expect(html).toContain(`href="/ayuda/${slug}.md"`);
      expect(html).toContain(title);
      const file = resolve("apps/web/public/ayuda", `${slug}.md`);
      expect(existsSync(file), slug).toBe(true);
      expect(readFileSync(file, "utf8")).toMatch(/^# /);
    }
  });

  it("sin contacto configurado no muestra enlaces vacíos; administración ve la descarga", () => {
    const html = renderToStaticMarkup(
      createElement(SupportContent, {
        info: { whatsapp: null, email: null, hours: null, company: null },
        userName: "Ana",
        screen: "Caja",
        onArticle: () => undefined,
        onExport: () => undefined,
      }),
    );
    expect(html).not.toContain("wa.me");
    expect(html).not.toContain("mailto:");
    expect(html).toContain("Descargar todos mis datos (Excel)");
  });

  it("las guías se ven como texto con formato (sin # ni **) y las teclas F son de computadora", () => {
    for (const [slug] of HELP_ARTICLES) {
      const text = readFileSync(resolve("apps/web/public/ayuda", `${slug}.md`), "utf8");
      const html = renderToStaticMarkup(createElement(HelpArticle, { text }));
      expect(html, slug).not.toMatch(/(^|>)#|\*\*/);
      for (const key of text.match(/[^.\n]*\bF\d{1,2}\b[^.\n]*/g) ?? [])
        expect(key, slug).toMatch(/en computadora/i);
    }
    const html = renderToStaticMarkup(createElement(HelpArticle, { text: "# Título\n\n1. Uno **fuerte**\n2. Dos\n\n- Viñeta" }));
    expect(html).toBe('<div class="help-article"><h3>Título</h3><ol><li>Uno <strong>fuerte</strong></li><li>Dos</li></ol><ul><li>Viñeta</li></ul></div>');
  });
});

describe("SOP-03 · consentimiento de soporte", () => {
  it("explica finalidad, alcance, duración y bitácora antes de permitir", () => {
    const cache = new QueryClient();
    cache.setQueryData(["nexora-support-access"], { enabled: false, expiresAt: null });
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client: cache }, createElement(SupportAccessCard)));
    for (const text of ["Para qué", "productos, precios, existencias", "clientes, ventas, caja, reportes, costos ni márgenes",
      "24 horas o 7 días", "quién abrió la sesión y por qué", "Leí lo que soporte podrá ver"])
      expect(html).toContain(text);
    // El botón espera la confirmación explícita.
    expect(html).toMatch(/<button type="button" disabled=""[^>]*>Permitir soporte de Nexora/);
  });
});
