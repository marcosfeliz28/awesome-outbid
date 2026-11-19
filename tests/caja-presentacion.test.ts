import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, it, expect } from "vitest";
import { reverseProductoServicio } from "./producto-servicio-preservation";

describe("Caja Fusión: pintura reversible", () => {
  it("preserva byte por byte POS, incluyendo handlers, cálculos, stock y carrito", () => {
    const record = JSON.parse(
      readFileSync(
        "docs/diseno/caja-higgsfield/PRESENTACION_REVERSIBLE.json",
        "utf8",
      ),
    );
    let source = reverseProductoServicio(
      readFileSync("apps/web/src/POS.tsx", "utf8"),
    );
    for (const edit of [...record.changes].reverse()) {
      expect(source).toContain(edit.after);
      source = source.replace(edit.after, edit.before);
    }
    expect(createHash("sha256").update(source).digest("hex")).toBe(
      record.base_sha256,
    );
  });
  it("mobile actions preserve labels and count singular without changing handlers", () => {
    const source = readFileSync("apps/web/src/POS.tsx", "utf8");
    const css = readFileSync("apps/web/src/fusion-caja-higgsfield.css", "utf8");
    expect(source).toContain('units === 1 ? "artículo" : "artículos"');
    expect(source).toContain('units === 1 ? "item" : "items"');
    expect(source).toContain('onClick={clearWithUndo}');
    expect(source).toContain('onClick={() => saveHeld()}');
    expect(source).toContain('onClick={() => saveHeld("quote")}');
    expect(css).toContain('grid-template-columns: repeat(3,minmax(0,1fr))');
    expect(css).toContain('min-width: 0; min-height: 44px; padding: 8px 4px');
  });
  it("receipt portal and active shell override violet only during checkout", () => {
    const css = readFileSync("apps/web/src/fusion-caja-higgsfield.css", "utf8");
    expect(css).toContain('body:has(.pos-layout.fusion-caja-integrada) .modal:has(.sale-success) .button.primary');
    expect(css).toContain('var(--fc-deep)) !important');
    expect(css).toContain('--primary-soft: var(--fc-pressed)');
    expect(css).toContain('background: ButtonFace; color: ButtonText');
  });
  it("preferencias no escriben ni recargan carrito o cobran", () => {
    const source = readFileSync(
      "apps/web/src/CajaVisualPreferences.tsx",
      "utf8",
    );
    expect(source).not.toMatch(
      /\b(fetch|post|put|delete|clearCart|setCart|charge|reload)\s*\(/,
    );
    expect(source).toContain('scope="checkout"');
    expect(source).toContain(
      "payment dialogs and server messages retain their original language",
    );
  });
  it("pintura está aislada y tiene movimiento reducido, foco y móvil", () => {
    const source = readFileSync(
      "apps/web/src/fusion-caja-higgsfield.css",
      "utf8",
    );
    expect(source).toContain(".fusion-caja-integrada");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("forced-colors: active");
    expect(source).toContain(":focus-visible");
    expect(source).toContain("env(safe-area-inset-bottom)");
    expect(source).not.toContain("background-image: url");
  });
});

it("overrides legacy violet active category without losing contrast and scopes the close portal", () => {
 const css=readFileSync("apps/web/src/fusion-caja-higgsfield.css","utf8");
 expect(css).toMatch(/\.category-tabs button\.active\s*\{[^}]*background:[^;]+!important;[^}]*border-color:[^;]+!important;[^}]*color: var\(--fc-ink\)/);
 const scope='body:has(:is(.pos-layout.fusion-caja-integrada,.cash-page.fusion-cash-turnos)) .modal:has(.close-cash)';
 expect(css).toContain(scope+' .button.primary');
 expect(css).toContain(scope+' :is(button,input,textarea):focus-visible');
 const portalRules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(r=>r[1].includes('.modal:has(.close-cash)'));
 for (const rule of portalRules) expect(rule[2]).not.toMatch(/(?:display|position|width|height|overflow|pointer-events|visibility)\s*:/);
 expect(css).toContain('background:Highlight !important;color:HighlightText');
});
