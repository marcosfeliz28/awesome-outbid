import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  HELP_ARTICLES,
  SupportContent,
  supportMessage,
} from "../apps/web/src/SupportHelp";

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
});
