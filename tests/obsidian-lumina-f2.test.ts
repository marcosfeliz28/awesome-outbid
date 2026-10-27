import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Card, Field, TableFrame } from "../packages/ui/src";
import {
  dailyBriefQuestion,
  dashboardQuestion,
} from "../apps/web/src/dashboardQuestions";

const webRequire = createRequire(resolve("apps/web/package.json"));
const { createElement } = webRequire("react") as typeof import("react");
const { renderToStaticMarkup } = webRequire(
  "react-dom/server",
) as typeof import("react-dom/server");
// api.ts lee localStorage al cargarse; el entorno de pruebas es Node.
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
let ExecutiveMetrics: typeof import("../apps/web/src/ExecutiveDashboard").ExecutiveMetrics;
let profitOf: typeof import("../apps/web/src/ExecutiveDashboard").profitOf;
beforeAll(async () => {
  ({ ExecutiveMetrics, profitOf } =
    await import("../apps/web/src/ExecutiveDashboard"));
});
const read = (path: string) => readFileSync(path, "utf8");

describe("Obsidian Lumina f2 · primitivas de accesibilidad", () => {
  it("Card nombra su región con el título", () => {
    const out = renderToStaticMarkup(
      createElement(Card, { title: "Resumen" }, "cuerpo"),
    );
    expect(out).toMatch(
      /<section class="panel" aria-labelledby="(.+?)"><h2 id="\1">Resumen<\/h2>/,
    );
  });
  it("Field enlaza etiqueta, ayuda y error con el campo", () => {
    const out = renderToStaticMarkup(
      createElement(Field, {
        label: "Nombre",
        hint: "Como en el RNC",
        error: "Obligatorio",
        id: "n",
      }),
    );
    expect(out).toContain('<label for="n">Nombre</label>');
    expect(out).toContain('aria-invalid="true"');
    expect(out).toContain('aria-describedby="n-hint n-error"');
    expect(out).toContain('<small id="n-hint">Como en el RNC</small>');
    expect(out).toContain('id="n-error"');
  });
  it("Field sin ayuda ni error no inventa descripciones", () => {
    const out = renderToStaticMarkup(
      createElement(Field, { label: "A", id: "a" }),
    );
    expect(out).not.toContain("aria-describedby");
    expect(out).not.toContain("aria-invalid");
  });
  it("TableFrame es una región con nombre y alcanzable con el teclado", () => {
    const out = renderToStaticMarkup(
      createElement(TableFrame, { label: "Ventas" }, "x"),
    );
    expect(out).toContain('class="table-wrap"');
    expect(out).toContain('role="region"');
    expect(out).toContain('aria-label="Ventas"');
    expect(out).toContain('tabindex="0"');
  });
  it("Modal devuelve el foco a quien lo abrió", () => {
    const ui = read("packages/ui/src/index.tsx");
    expect(ui).toContain("onCloseAutoFocus");
    expect(ui).toContain("returnFocus.current.focus()");
  });
});

describe("Obsidian Lumina f2 · marco accesible", () => {
  const app = read("apps/web/src/App.tsx");
  it("saltar al contenido, nav con nombre, aria-controls y main enfocable", () => {
    expect(app).toContain('href="#main-content"');
    expect(app).toContain('<nav aria-label="Navegación del negocio">');
    expect(app).toContain('aria-controls="admin-navigation"');
    expect(app).toContain('id="admin-navigation"');
    expect(app).toMatch(/id="main-content"\s+tabIndex=\{-1\}/);
  });
  it("la caja conserva sus clases y selectores", () => {
    expect(app).toContain(
      'main-content ${safePage === "pos" ? "pos-content" : ""}',
    );
    expect(app).toContain('app-shell ${safePage === "pos" ? "pos-shell" : ""}');
  });
  it("el tablero ejecutivo tiene condición propia, sin el hook de B", () => {
    expect(app).toMatch(/executiveDashboard =\s+PRODUCT_TENANCY_REQUIRED &&/);
    expect(app).toContain('"reports:read"');
    expect(app).not.toContain("useAdminAppearance");
    expect(app).toContain("executive={executiveDashboard}");
  });
});

describe("Obsidian Lumina · movimiento de marca", () => {
  const app = read("apps/web/src/App.tsx");
  const css = read("apps/web/src/styles.css");

  it("anima los activos decorativos sin convertirlos en contenido anunciado", () => {
    expect(app).toContain('className="login-brand-mark" aria-hidden="true"');
    expect(app).toContain('className="login-prism-frame" aria-hidden="true"');
    expect(app).not.toMatch(/<video[^>]+autoplay/i);
  });

  it("da protagonismo a la marca y condensa las funciones en tres grupos", () => {
    expect(app).toContain('src="/nexora-prisma-mark.webp"');
    expect(app.match(/title: "(Vende|Controla|Decide)"/g)).toHaveLength(3);
    expect(app).toContain("Vende. Controla. Crece.");
    expect(app).toMatch(/PRODUCT_TENANCY_REQUIRED\s*\?[\s\S]*LOGIN_GROUPS\.map[\s\S]*:\s*<section[\s\S]*LOGIN_CUBE\.map/);
  });

  it("elimina todas las animaciones de marca cuando se reduce movimiento", () => {
    const reduced = css.match(
      /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/,
    )?.[1];
    expect(reduced).toContain(".login-brand-mark");
    expect(reduced).toContain(".login-brand-mark::after");
    expect(reduced).toContain(".login-prism-frame img");
    expect(reduced).toContain(".login-prism-scan");
    expect(reduced).toMatch(/animation:\s*none/);
  });
});

describe("Obsidian Lumina f2 · tablero ejecutivo", () => {
  const dash = read("apps/web/src/Dashboard.tsx");
  it("abre en «Hoy» cuando es ejecutivo y en «Mes» si no", () => {
    expect(dash).toContain('useState(executive ? "today" : "month")');
  });
  it("conserva los arreglos de la mezcla 4", () => {
    expect(dash).toContain('typeof m.trend === "number"');
    expect(dash).toContain("sin datos del período anterior");
    expect(dash).toContain("lastDaysStart(7)");
    expect(dash).toContain("<SetupChecklist");
    const assistant = read("apps/web/src/Assistant.tsx");
    expect(assistant).toContain("renderMarkdown(message.content)");
    expect(assistant).toContain('addEventListener("nexora:abrir-asistente"');
  });
  it("los estilos usan solo los tokens de A", () => {
    const css = read("apps/web/src/ExecutiveDashboard.css");
    const base = read("apps/web/src/styles.css");
    expect(css).not.toContain("data-admin-appearance");
    expect(css).not.toContain("--lumina-");
    for (const token of css.match(/var\(--[a-z-]+/g) ?? [])
      expect(base).toContain(`${token.slice(4)}:`);
  });
  it("el tooltip anual usa tinta legible en claro y oscuro", () => {
    const base = read("apps/web/src/styles.css");
    expect(base).toMatch(/:root \{[\s\S]*?--ink: #1b2134;/);
    expect(base).toMatch(
      /:root\[data-theme="dark"\] \{[\s\S]*?--ink: #eef0f8;/,
    );
    expect(base).toMatch(/\.year-pie-tip \{[\s\S]*?color: var\(--ink/);
  });
  it("la ganancia es ventas − costo, sin restar ITBIS", () => {
    // El servidor manda grossProfit con el ITBIS restado; aquí no se usa.
    expect(profitOf({ revenue: 1000, costTotal: 600, grossProfit: 330 })).toBe(
      400,
    );
    expect(profitOf({ revenue: 118, costTotal: 50.1 })).toBe(67.9);
    expect(profitOf({ revenue: 1000 })).toBeUndefined();
    expect(profitOf(undefined)).toBeUndefined();
  });
  it("la tarjeta de ganancia dice «sin restar ITBIS» y muestra ventas − costo", () => {
    const html = renderToStaticMarkup(
      createElement(ExecutiveMetrics, {
        data: {
          revenue: 1180,
          costTotal: 600,
          grossProfit: 400,
          invoices: 3,
          ticketAverage: 393.33,
        },
        showProfit: true,
        from: "2026-10-26",
        to: "2026-10-26",
        onAsk: () => {},
      }),
    );
    expect(html).toContain("sin restar ITBIS");
    expect(html).not.toContain("Después de ITBIS");
    expect(html).toContain("580");
    expect(html).not.toContain("Inventario actual a la venta");
  });
  it("sin permiso de ganancia no se muestra costo ni margen", () => {
    const html = renderToStaticMarkup(
      createElement(ExecutiveMetrics, {
        data: {
          revenue: 1180,
          costTotal: 600,
          grossProfit: 400,
          inventoryRetail: 9000,
        },
        showProfit: false,
        from: "2026-10-26",
        to: "2026-10-26",
        onAsk: () => {},
      }),
    );
    expect(html).not.toContain("Ganancia");
    expect(html).not.toContain("600");
    expect(html).toContain("Inventario actual a la venta");
  });
  it("el resumen con IA solo se pide con el botón y la cuota se explica", () => {
    const src = read("apps/web/src/ExecutiveDashboard.tsx");
    expect(src.match(/void generate\(\)/g)?.length).toBe(1); // solo desde el botón
    expect(src).toContain("onClick={() => void generate()}");
    expect(src).toContain("no gasta");
    expect(src).toContain("renderMarkdown(answer)");
    expect(read("apps/web/src/Assistant.tsx")).toContain(
      "enviarla sí cuenta en tu cuota",
    );
  });
  it("las preguntas de las tarjetas son plantillas cerradas con la misma fórmula", () => {
    expect(dashboardQuestion("profit", "a", "b")).toContain("sin restar ITBIS");
    expect(dashboardQuestion("sales", "2026-10-01", "2026-10-26")).toContain(
      "del 2026-10-01 al 2026-10-26",
    );
    expect(dailyBriefQuestion("2026-10-26")).toContain("2026-10-26");
  });
});
