import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
const read = (path: string) => readFileSync(path, "utf8");
describe("Operaciones high4K: presentación sin cambio de negocio", () => {
  it("revierte la decoración y conserva Management completo exactamente", () => {
    const ledger = JSON.parse(read("docs/diseno/operaciones-4k/PRESERVACION.json"));
    let source = read("apps/web/src/Management.tsx");
    for (const edit of [...ledger.changes].reverse()) {
      expect(source.split(edit.after).length).toBe(2);
      source = source.replace(edit.after, edit.before);
    }
    expect(createHash("sha256").update(source).digest("hex")).toBe(ledger.base_sha256);
  });
  it("el contenedor no realiza operaciones ni fabrica cifras", () => {
    const source = read("apps/web/src/OperationsPresentation.tsx");
    expect(source).not.toMatch(/\b(api|fetch|post|mutate|download|setCart)\s*\(/);
    expect(source).not.toMatch(/DEMO|RD\$|totalSpent|monthlyBudget/);
    expect(source).toContain("{content}");
    expect(source).toContain("aria-hidden=\"true\"");
  });
  it("incluye foco, relieve reversible, movimiento reducido y temas", () => {
    const source = read("apps/web/src/operationsPresentation.css");
    for (const required of [":focus-visible", "prefers-reduced-motion:reduce", "forced-colors:active", "data-accent=\"blue\"", "data-theme=\"dark\"", "data-overview-surface=\"black\"", "max-width:600px", "min-height:44px", "button:not(:disabled):active"]) expect(source).toContain(required);
    expect(source).not.toMatch(/background-image:\s*url|content:\s*["'](?:RD|\d)/);
  });
  it("mantiene privacidad de clientes y la idempotencia de pagos/gastos", () => {
    const source = read("apps/web/src/Management.tsx");
    for (const required of ['seesCustomerPii(user.permissions)', 'customerEditValue(editing.phone, fullCustomer)', 'can(user.permissions, "customers:erase")', 'operationId: paySupplier.operationId', 'operationId: create', 'post("/supplier-payments",', 'can(useStore.getState().user!.permissions, "sale:manage")']) expect(source).toContain(required);
  });
});

it("restores the shared shell on direct routes and releases its flag", () => {
 const wrapper=read("apps/web/src/PremiumWorkspace.tsx");
 expect(wrapper).toContain("useInventoryAppearance();");
 expect(wrapper).toContain("owners += 1");
 expect(wrapper).toContain("owners -= 1");
 expect(wrapper).toContain("delete root.dataset.premiumWorkspace");
 for(const name of ["OperationsPresentation","Merchandise","VoidRequests","TransferReconciliation","CourierPayouts"]) expect(read(`apps/web/src/${name}.tsx`)).toContain("usePremiumWorkspace();");
});

it("gold active tabs override legacy global important backgrounds within this scope", () => {
  const css=read("apps/web/src/operationsPresentation.css");
  expect(css).toMatch(/\.operations-premium \.tabs button\.active\s*\{[^}]*background:\s*linear-gradient\([^;]+\)\s*!important/);
});

it("styles the mobile merchandise shell shortcut only while premium is active without changing layout", () => {
  const css=read("apps/web/src/operationsPresentation.css");
  const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(match=>match[1].includes(".goods-mobile-bar"));
  expect(rules.length).toBeGreaterThan(5);
  for(const rule of rules) {
    expect(rule[1]).toContain(':root[data-premium-workspace="true"]');
    expect(rule[2]).not.toMatch(/(?:position|display|width|height|padding|bottom|z-index)\s*:/);
    expect(rule[2]).not.toMatch(/#7c3aed|#6d28d9/);
  }
  expect(rules.some(rule=>rule[1].includes(".button.primary") && rule[2].includes("linear-gradient"))).toBe(true);
  expect(rules.some(rule=>rule[1].includes('data-accent="blue"'))).toBe(true);
  expect(rules.some(rule=>rule[1].includes('data-overview-surface="black"'))).toBe(true);
});
