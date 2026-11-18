import { merchandiseText } from "../apps/web/src/merchandiseLanguage";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = readFileSync("apps/web/src/Merchandise.tsx", "utf8");
const css = readFileSync("apps/web/src/merchandisePremium.css", "utf8");
const ledger = JSON.parse(readFileSync("tests/merchandise-premium.ledger.json", "utf8"));
describe("Mercancía high4K: presentation-only contract", () => {
  it("preserves the entire original workflow byte-for-byte after reversing decorative edits", () => {
    let original = source;
    for (const edit of [...ledger.edits].reverse()) {
      expect(original.split(edit.after).length - 1).toBe(1);
      original = original.replace(edit.after, edit.before);
    }
    expect(createHash("sha256").update(original).digest("hex")).toBe(ledger.sha256);
  });
  it("scopes materials, focus, touch size and reduced motion to Mercancía", () => {
    expect(source).toContain('className="merchandise goods-premium norexos-premium-workspace"');
    expect(css).toContain(".merchandise.goods-premium");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain(":focus-visible");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain('data-accent="blue"');
    expect(css).toContain('data-theme="dark"');
  });
  it("does not create a new save/sync state or replace the original fixed mobile confirmation", () => {
    expect(source).not.toContain("Borrador guardado");
    expect(source).not.toContain("En cola sin conexión");
    expect(css).not.toContain("position: static");
    expect(css).not.toContain("overflow: hidden");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
  });
});

it("translates the selected UI copy with complete ES/EN pairs and restores appearance on direct navigation", () => {
  for (const pair of Object.values(merchandiseText)) {
    expect(pair.es.length).toBeGreaterThan(0);
    expect(pair.en.length).toBeGreaterThan(0);
  }
  expect(merchandiseText.unitCost).toEqual({ es: "Costo unitario", en: "Unit cost" });
  expect(merchandiseText.reviewNotice.en).toContain("until you confirm");
  expect(source).toContain("usePremiumWorkspace();");
  expect(source).toContain("const language = useLanguage();");
  expect(source).toContain("{v ? variantName(v) : l.quick ? l.quick.name : l.name}");
});

it("translates quick-create labels without translating the stored variant value", () => {
  const form=source.slice(source.indexOf('{unknown !== null && ('),source.indexOf('onSubmit={async (q)',source.indexOf('{unknown !== null && (')));
  expect(form).toContain('english={language === "en"}');
  for(const key of ['quickCreate','quickName','quickCategory','quickBarcode','quickPrice','quickCost','quickVariant']) expect(form).toContain(`t("${key}")`);
  expect(form).toContain('initial: "Única"');
});

it("translates receipt confirmation and document guidance without changing submit handlers", () => {
  for (const key of ["documentHint", "registering", "confirmEntry", "confirmExit"] as const) {
    expect(source).toContain(`t("${key}")`);
    expect(merchandiseText[key].en).not.toBe(merchandiseText[key].es);
  }
  expect(merchandiseText.documentHint.en).toContain("NCF");
  expect(source).toContain('onClick={confirm}');
  expect(source).toContain('<Button type="submit">{t("addUnit")}</Button>');
  expect(css).toMatch(/\.goods-premium \.goods-scan-actions \.button\.primary\s*\{[^}]*background:\s*linear-gradient/);
});
