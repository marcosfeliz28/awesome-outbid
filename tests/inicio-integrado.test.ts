import { chartSalesLabel } from "../apps/web/src/chartSalesLabel";
import {
  readLanguagePreference,
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

const dashboardSource = readFileSync("apps/web/src/Dashboard.tsx", "utf8");
// El tablero de producto tiene un componente ejecutivo propio. La guarda de
// tienda conserva su base y sus inversiones históricas; el producto usa su
// propia base aprobada, no el hash del resultado de este ajuste.
const productDashboard = dashboardSource.includes(
  '} from "./ExecutiveDashboard";',
);
const productLayout =
  '<div className={executive ? undefined : "fusion-inicio-integrado"} lang="es">';
describe("Inicio integrado: preservación", () => {
  it("limita preferencias a Inicio y conserva el diálogo legal existente", () => {
    const source = readFileSync("apps/web/src/App.tsx", "utf8");
    expect(source).toContain(
      '{page === "dashboard" && <div className="fusion-preferences"',
    );
    expect(source).toContain('title="Acerca de Norexos"');
    const css = readFileSync(
      "apps/web/src/fusion-inicio-integrado.css",
      "utf8",
    );
    expect(css).toMatch(/@media \(max-width: 360px\)/);
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("overflow-wrap: anywhere");
  });

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
    expect(dashboardSource).toContain(
      productDashboard
        ? productLayout
        : 'className="fusion-inicio-integrado" lang={language}',
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
    if (productDashboard) {
      expect(shell).toContain(
        "English covers these controls and main navigation. Overview content is in Spanish.",
      );
      expect(shell).not.toContain("English covers Overview and main navigation.");
      const baseCss = readFileSync(
        "apps/web/src/fusion-inicio-integrado.css",
        "utf8",
      );
      const detailCss = readFileSync("apps/web/src/fusion-higgsfield.css", "utf8");
      expect(baseCss).not.toMatch(/^\.fusion-(?:appearance|accent-)/m);
      expect(detailCss).not.toMatch(/^\.fi-theme-options\s*\{/m);
      expect(detailCss).toContain(":where(.fusion-preferences) .fi-theme-options");
    }
  });
  it("conserva byte a byte el Dashboard base salvo wrapper y pintura", () => {
    let source = dashboardSource;
    if (productDashboard) {
      const productReversible = [
        {
          before: "",
          after: 'import "./fusion-inicio-integrado.css";\n',
        },
        {
          before: "",
          after: 'import "./fusion-higgsfield.css";\n',
        },
        {
          before: "    <>\n      <div className=\"page-heading\">",
          after: `    ${productLayout}\n      <div className="page-heading">`,
        },
        {
          before: "      </QueryState>\n    </>\n  );\n}",
          after: "      </QueryState>\n    </div>\n  );\n}",
        },
      ];
      for (const edit of [...productReversible].reverse()) {
        expect(source.split(edit.after)).toHaveLength(2);
        source = source.replace(edit.after, edit.before);
      }
      // Dashboard exacto en f26b7353, antes del wrapper y la pintura.
      expect(createHash("sha256").update(source).digest("hex")).toBe(
        "4e45662d3fda543e384ad67a3c63091c9aec88b39400b9785b494afaae3da1a9",
      );
      return;
    }
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
it("permite crecer a la bienvenida móvil para no ocultar la acción de reportes", () => {
  const css = readFileSync("apps/web/src/fusion-inicio-integrado.css", "utf8");
  expect(css).toMatch(
    /@media \(max-width: 560px\)\s*\{\s*\.fusion-inicio-integrado \.welcome-banner\s*\{\s*height: auto;\s*min-height: 187px;/,
  );
  expect(css).toMatch(
    /\.welcome-banner button\s*\{\s*min-height: 44px;\s*white-space: normal;/,
  );
});
it("Fusión 02 añade atajos con los mismos permisos que navegación, sin escrituras", async () => {
  const { overviewShortcuts } =
    await import("../apps/web/src/QuickAccessOverview");
  const { can } = await import("../packages/shared/src/index");
  expect(
    overviewShortcuts.map(({ page, permission }) => ({ page, permission })),
  ).toEqual([
    { page: "pos", permission: "sale:write" },
    { page: "inventory", permission: "inventory:write" },
    { page: "reports", permission: "reports:read" },
  ]);
  expect(overviewShortcuts.filter((s) => can([], s.permission))).toHaveLength(
    0,
  );
  expect(
    overviewShortcuts
      .filter((s) => can(["reports:read"], s.permission))
      .map((s) => s.page),
  ).toEqual(["reports"]);
  const source = readFileSync("apps/web/src/QuickAccessOverview.tsx", "utf8");
  expect(source).toContain("can(permissions, item.permission)");
  expect(source).not.toMatch(/\b(fetch|post|api)\s*\(/);
});
it("Fusión 02 limita el acabado negro a Inicio y respeta movimiento reducido", () => {
  const css = readFileSync("apps/web/src/fusion-higgsfield.css", "utf8");
  expect(css.replace(/\s+/g, " ")).toContain(
    '[data-overview-surface="black"] .app-shell:has(.fusion-inicio-integrado)',
  );
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain("forced-colors: active");
  expect(css).toContain("minmax(0, 1fr)");
  const source = readFileSync("apps/web/src/AppearanceControls.tsx", "utf8");
  expect(source).toContain(
    "delete document.documentElement.dataset.overviewSurface",
  );
  expect(source).toContain('["light", "dark", "black"]');
});

it("migra idioma legado a Norexos sin pisar preferencia actual ni fallar sin storage", () => {
  const values = new Map<string, string>([["noxeros-overview-language", "en"]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  expect(readLanguagePreference(storage)).toBe("en");
  expect(values.get("norexos-overview-language")).toBe("en");
  values.set("norexos-overview-language", "es");
  expect(readLanguagePreference(storage)).toBe("es");
  expect(
    readLanguagePreference({
      getItem: () => {
        throw new Error("disabled");
      },
      setItem: () => {},
    }),
  ).toBe("es");
  expect(
    readLanguagePreference({
      getItem: (key) => (key === "noxeros-overview-language" ? "en" : null),
      setItem: () => {
        throw new Error("readonly");
      },
    }),
  ).toBe("en");
});

describe("Inicio: acabado premium sin alterar geometría", () => {
  const css = readFileSync("apps/web/src/fusion-higgsfield.css", "utf8");
  it("unifica los medallones con suficiente especificidad sobre los tonos heredados", () => {
    expect(css).toContain(
      ":root[data-theme] .app-shell .fusion-inicio-integrado .metric-icon",
    );
    expect(css).toContain("/* Acabado premium 18-nov");
  });
  it("mantiene el acabado decorativo fuera del flujo y sin bloquear clics", () => {
    const finish = css.split("/* Acabado premium 18-nov")[1] || "";
    expect(finish).toContain("pointer-events: none");
    expect(finish).toContain("position: absolute");
    expect(finish).not.toMatch(
      /\b(?:width|height|min-height|padding|font-size):/,
    );
  });
});
