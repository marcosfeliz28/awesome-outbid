import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import prettier from "prettier";
import { describe, expect, it } from "vitest";
import baseline from "./operational-aux-baseline.json";
import languageLedger from "./operational-aux-language-ledger.json";
import moneyLedger from "./operational-aux-money-ledger.json";
import {
  operationalAuxCopy,
  operationalAuxText,
} from "../apps/web/src/operationalAuxLanguage";
const source = (name: string) => readFileSync(`apps/web/src/${name}`, "utf8");
describe("presentación operativa 4K sin alterar el negocio", () => {
  for (const [name, hash] of Object.entries(baseline)) {
    it(`${name}: permisos, handlers, datos y confirmaciones idénticos a la base`, async () => {
      let translated = source(`${name}.tsx`);
      for (const edit of moneyLedger[name as keyof typeof moneyLedger]) {
        expect(translated.split(edit.after).length - 1).toBe(1);
        translated = translated.replace(edit.after, edit.before);
      }
      expect(translated.match(/usePremiumWorkspace\(\);/g)).toHaveLength(1);
      expect(translated.indexOf("usePremiumWorkspace();")).toBeLessThan(
        translated.indexOf("const user ="),
      );
      translated = translated
        .replace(
          'import { usePremiumWorkspace } from "./PremiumWorkspace";\n',
          "",
        )
        .replace("  usePremiumWorkspace();\n", "");
      for (const edit of languageLedger[name as keyof typeof languageLedger]) {
        expect(translated.split(edit.after).length - 1).toBe(1);
        translated = translated.replace(edit.after, edit.before);
      }
      const restored = translated
        .replace(
          /^import \{ (ClipboardX|ArrowRightLeft|Truck) \} from "lucide-react";\n/,
          "",
        )
        .replace('import "./operationalAux.css";\n', "")
        .replace(
          / operational-aux operational-aux-(void|transfer|courier) norexos-premium-workspace/g,
          "",
        )
        .replace(
          /\s*<span className="operational-aux-emblem" aria-hidden="true">\s*<(ClipboardX|ArrowRightLeft|Truck) size=\{34\} strokeWidth=\{1\.6\} \/>\s*<\/span>/,
          "",
        );
      const normalized = await prettier.format(restored, {
        parser: "typescript",
      });
      expect(createHash("sha256").update(normalized).digest("hex")).toBe(hash);
    });
  }
  it("tiene apariencia clara/oscura/azul y movimiento reducido sin tocar estilos globales", () => {
    const css = source("operationalAux.css");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-accent="blue"]');
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(".operational-aux .button.primary");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(":focus-visible");
    expect(css).not.toMatch(/position:\s*fixed/);
  });
});

describe("idioma operativo", () => {
  it("ES intacto y EN para todos los textos declarados", () => {
    for (const [es, en] of Object.entries(operationalAuxCopy)) {
      expect(operationalAuxText(false, es)).toBe(es);
      expect(operationalAuxText(true, es)).toBe(en);
      expect(en.length).toBeGreaterThan(0);
    }
  });
  it("no traduce valores desconocidos del servidor", () => {
    expect(operationalAuxText(true, "Saldo insuficiente del servidor")).toBe(
      "Saldo insuficiente del servidor",
    );
  });
  it("conserva advertencias de caja y verificación manual", () => {
    expect(
      operationalAuxText(
        true,
        "Consulta cuánto se debe y registra los envíos pagados. Este registro no mueve la caja.",
      ),
    ).toContain("does not move money");
    expect(
      operationalAuxText(
        true,
        "Compara cada factura con el banco antes de verificarla. El total ayuda a revisar; no verifica pagos por sí solo.",
      ),
    ).toContain("does not verify payments on its own");
  });
});

describe("contraste base de la presentación", () => {
  function luminance(hex: string) {
    const rgb = hex
      .replace("#", "")
      .match(/../g)!
      .map((value) => {
        const v = parseInt(value, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  function contrast(a: string, b: string) {
    const x = luminance(a),
      y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  it("texto y bordes claros/oscuros mantienen umbral AA básico", () => {
    const css = source("operationalAux.css");
    const values = (token: string) =>
      [...css.matchAll(new RegExp(`--oa-${token}: (#[0-9a-f]{6});`, "g"))].map(
        (m) => m[1],
      );
    const ink = values("ink"),
      surface = values("surface"),
      line = values("line");
    for (let i = 0; i < 2; i++) {
      expect(contrast(ink[i], surface[i])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(line[i], surface[i])).toBeGreaterThanOrEqual(3);
    }
    expect(contrast("#302308", "#ddb34f")).toBeGreaterThanOrEqual(4.5);
  });
});

it("solo importes tienen nowrap; cifras excepcionales permiten desplazamiento", () => {
  const css = source("operationalAux.css");
  const block = css.match(
    /\.operational-aux \.operational-aux-money \{([^}]+)\}/,
  )![1];
  expect(block).toContain("white-space: nowrap");
  expect(block).toContain("overflow-wrap: normal");
  expect(block).toContain("overflow-x: auto");
  expect(block).toContain("font-variant-numeric: tabular-nums");
  expect(block).not.toContain("hidden");
  for (const name of Object.keys(baseline))
    expect(source(`${name}.tsx`)).toContain(
      'className="operational-aux-money"',
    );
});

it("Mensajeros permite bajar el importe completo a la línea siguiente en móvil", () => {
  const css = source("operationalAux.css");
  const block = css.match(
    /@media \(max-width: 480px\) \{\s*\.operational-aux-courier\s+\.reconciliation-row\s*\.reconciliation-details\s*> strong\s*\{([^}]+)\}/,
  )?.[1];
  expect(block).toContain("display: flex");
  expect(block).toContain("flex-wrap: wrap");
  expect(block).not.toContain("white-space");
});
