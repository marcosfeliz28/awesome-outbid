import { chartSalesLabel } from "../apps/web/src/chartSalesLabel";
import {
  english,
  translate,
  setLanguage,
  money,
  monthLabel,
  invoiceLabel,
  dateLabel,
} from "../apps/web/src/inicioLanguage";
import { resolveAccent } from "../apps/web/src/AppearanceControls";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
describe("Inicio integrado: preservación", () => {
  it("fecha vacía, inválida o inexistente no lanza ni inventa otra fecha", () => {
    for (const value of [
      "",
      "no-date",
      "2026-02-30",
      "2026-13-01",
      "2026-00-01",
    ]) {
      expect(() => dateLabel(value)).not.toThrow();
      expect(dateLabel(value)).toBe("—");
    }
    expect(dateLabel("2024-02-29")).not.toBe("—");
    const dashboard = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
    expect(dashboard).toContain(
      'className="fusion-inicio-integrado" lang={language}',
    );
    const shell = readFileSync("apps/web/src/App.tsx", "utf8");
    for (const region of ["topbar", "app-footer", "fusion-preferences"])
      expect(shell).toContain(`className="${region}" lang={language}`);
    expect(shell).toMatch(/<aside\s+lang=\{language\}/);
    expect(shell).not.toMatch(/<main[^>]*lang=\{language\}/);
  });
  it("traduce texto de interfaz sin traducir datos desconocidos ni convertir moneda", () => {
    for (const [es, en] of Object.entries(english)) {
      expect(translate(es, "en")).toBe(en);
      expect(translate(es, "es")).toBe(es);
    }
    expect(translate("SKU ABC / Faja Invisible", "en")).toBe(
      "SKU ABC / Faja Invisible",
    );
    try {
      setLanguage("en");
      expect(money(2250)).toBe(
        new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "DOP",
        }).format(2250),
      );
      expect(monthLabel(1)).toBe("January");
      expect(invoiceLabel(1)).toBe("1 invoice");
      expect(invoiceLabel(2)).toBe("2 invoices");
      expect(dateLabel("2026-11-16")).toBe("11/16/2026");
      expect(chartSalesLabel({ value: [0, 75] }, money, "en")).toBe(
        "Sales: DOP 75.00",
      );
      expect(chartSalesLabel({}, money, "en")).toBe("Sales: data unavailable");
    } finally {
      setLanguage("es");
    }
    expect(monthLabel(1)).toBe("enero");
    expect(invoiceLabel(1)).toBe("1 factura");
  });
  it("limita el acento a verde/azul y anuncia cobertura sin alterar negocio", () => {
    expect(resolveAccent("blue")).toBe("blue");
    for (const value of [null, "green", "red", "", "BLUE"])
      expect(resolveAccent(value)).toBe("green");
    const source = readFileSync("apps/web/src/AppearanceControls.tsx", "utf8");
    for (const text of [
      "Esmeralda",
      "Zafiro",
      "Emerald",
      "Sapphire",
      "aria-pressed",
      "setAccent(color)",
    ])
      expect(source).toContain(text);
    expect(source).not.toMatch(/\b(fetch|post|api)\s*\(/);
    const shell = readFileSync("apps/web/src/App.tsx", "utf8");
    expect(shell).toContain(
      "Other pages, store data and server messages retain their original language.",
    );
    expect(shell).toContain(
      'page === "dashboard" && <AppearanceControls language={language} />',
    );
  });
  it("conserva byte a byte el Dashboard base salvo wrapper y pintura", () => {
    let source = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
    const reversible: { before: string; after: string }[] = JSON.parse(
      readFileSync("docs/diseno/inicio-integrado/I18N_REVERSIBLE.json", "utf8"),
    );
    for (const edit of [...reversible].reverse()) {
      expect(source).toContain(edit.after);
      source = source.replace(edit.after, edit.before);
    }
    let s = source
      .replace('import "./fusion-inicio-integrado.css";\n', "")
      .replace('import { chartSalesLabel } from "./chartSalesLabel";\n', "")
      .replace('<div className="fusion-inicio-integrado">', "<>");
    const i = s.lastIndexOf("    </div>");
    s = s.slice(0, i) + s.slice(i).replace("    </div>", "    </>");
    s = s.replaceAll("var(--fi-accent, #8b5cf6)", "#8b5cf6");
    s = s.replace(
      '<article className="kpi-card" key={m.label} tabIndex={0}>',
      '<article className="kpi-card" key={m.label}>',
    );
    s = s.replace(/ {20}dot=\{\(point:[\s\S]*? {20}\)\}\n/, "");
    const digest = readFileSync(
      "docs/diseno/inicio-integrado/PRESERVACION.txt",
      "utf8",
    )
      .split("Base SHA256:")[1]
      .trim();
    expect(createHash("sha256").update(s).digest("hex")).toBe(digest);
  });
  it("contiene movimiento reducido, foco y tema real", () => {
    const css = readFileSync(
      "apps/web/src/fusion-inicio-integrado.css",
      "utf8",
    );
    for (const rule of [
      "prefers-reduced-motion",
      ":focus-visible",
      '[data-theme="dark"]',
      "max-width: 560px",
    ])
      expect(css).toContain(rule);
    expect(css).not.toMatch(/display:\s*none/);
  });
  it("asigna nombre explícito a cada botón de navegación real", () => {
    const source = readFileSync("apps/web/src/App.tsx", "utf8");
    expect(source).toMatch(/key=\{n.id\}[\s\S]*?aria-label=\{t\(n.label\)\}/);
  });
  it("no anuncia NaN en los puntos de Recharts", () => {
    const money = (v: number) => "RD$" + v;
    expect(
      chartSalesLabel({ payload: { total: 150 }, value: [0, 150] }, money),
    ).toBe("Ventas: RD$150");
    expect(chartSalesLabel({ value: [0, 75] }, money)).toBe("Ventas: RD$75");
    expect(chartSalesLabel({ value: 0 }, money)).toBe("Ventas: RD$0");
    for (const value of [undefined, null, NaN, Infinity, "", [undefined]])
      expect(chartSalesLabel({ value }, money)).toBe(
        "Ventas: dato no disponible",
      );
  });
});
