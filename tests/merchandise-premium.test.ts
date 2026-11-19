import { receiptDocumentLabel } from "../apps/web/src/receiptDocumentLanguage";
import { merchandiseText } from "../apps/web/src/merchandiseLanguage";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = readFileSync("apps/web/src/Merchandise.tsx", "utf8");
const css = readFileSync("apps/web/src/merchandisePremium.css", "utf8");
const ledger = JSON.parse(readFileSync("tests/merchandise-premium.ledger.json", "utf8"));
describe("Mercancía high4K: presentation-only contract", () => {
  it("preserves the entire original workflow byte-for-byte after reversing decorative edits", () => {
    // Base histórica de producto 8ef351e6: se conserva el selector
    // accesible y toda la revisión fiscal, además del flujo anterior.
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

it("localizes product search labels while preserving merchandise handlers", () => {
  for (const key of ["searchProduct", "searchPlaceholder", "searchResults", "inStock", "expiredStock"] as const) {
    expect(source).toContain(`t("${key}")`);
    expect(merchandiseText[key].en).not.toBe(merchandiseText[key].es);
  }
});
it("reverses ReceiptHistory display-only edits exactly with permissions and queries intact", () => {
  let original = readFileSync("apps/web/src/Purchases.tsx", "utf8");
  const ledger = JSON.parse(readFileSync("tests/receipt-history-language.ledger.json", "utf8"));
  expect(original).toContain('timeZone: "America/Santo_Domingo"');
  expect(original).toContain('english ? "No receipts yet."');
  expect(original).toContain('english ? "en-US" : "es-DO"');
  for (const edit of [...ledger.edits].reverse()) {
    expect(original.split(edit.after).length - 1).toBe(1);
    original = original.replace(edit.after, edit.before);
  }
  expect(createHash("sha256").update(original).digest("hex")).toBe(ledger.sha256);
  // En 8ef351e6 el cuerpo del documento pasó a un módulo propio y se añadió
  // una propuesta de compra. Ambos módulos también quedan anclados.
  for (const [path, hash] of Object.entries(ledger.protected_helpers)) {
    expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(hash);
  }
});

it("translates document labels without translating unknown identifiers or stored enums", () => {
  expect(receiptDocumentLabel("Condición de pago", true)).toBe("Payment terms");
  expect(receiptDocumentLabel("Para la contable; no cambia el costo.", true)).toBe("For the accountant; does not change the cost.");
  expect(receiptDocumentLabel("Crédito", false)).toBe("Crédito");
  expect(receiptDocumentLabel("B0100000123", true)).toBe("B0100000123");
  expect(receiptDocumentLabel("cash", true)).toBe("cash");
  const purchases = readFileSync("apps/web/src/Purchases.tsx", "utf8");
  expect(purchases).toContain('closeLabel={t("Cerrar")}');
  expect(purchases).toContain('<option value="credit">{t("Crédito")}</option>');
  expect(purchases).toContain('body: JSON.stringify(documentPayload(doc!, true))');
});

it("localizes merchandise summaries and queue controls but keeps queue data and replay intact", () => {
  for (const key of ["productCount", "unitCount", "noProducts", "unresolvedCount", "missingCosts", "labels", "needsReview", "pending", "retry", "review", "loadQueuedReview", "entryRegistered", "exitRegistered"] as const) {
    expect(source).toContain(`t("${key}")`);
    expect(merchandiseText[key].en).not.toBe(merchandiseText[key].es);
  }
  expect(source).toContain('row.message ?? when(row.createdAt)');
  expect(source).toContain('operationId.current = row.id;');
  expect(source).toContain('status: "pending",');
  expect(source).toContain('await syncMerchandise();');
});

it("preserves the exact Spanish queued entry text required after offline reload", () => {
  expect(`${merchandiseText.pending.es} · ${merchandiseText.queuedEntry.es}`).toBe("Pendiente · Entrada");
  expect(`${merchandiseText.pending.es} · ${merchandiseText.queuedExit.es}`).toBe("Pendiente · Salida");
  expect(merchandiseText.entry.es).toBe("ENTRADA");
  expect(source).toContain('row.input.direction === "entry" ? t("queuedEntry") : t("queuedExit")');
});
