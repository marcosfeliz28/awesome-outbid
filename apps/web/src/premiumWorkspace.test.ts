import { reportLabel } from "./reportPresentationCopy";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");
describe("premium reporting presentation boundaries", () => {
 it("keeps inactive dark navigation icons above 4.5 contrast", () => {
  const luminance = (hex: string) => {
   const channels = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
   return channels[0]*.2126 + channels[1]*.7152 + channels[2]*.0722;
  };
  for (const [foreground,background] of [["#73e4bc","#0b211c"],["#8bcbff","#11283d"]]) {
   expect((luminance(foreground)+.05)/(luminance(background)+.05)).toBeGreaterThanOrEqual(4.5);
   expect(read("./premiumWorkspace.css")).toContain(`color: ${foreground}`);
  }
 });
 it("translates labels without modifying unknown server content", () => {
  expect(reportLabel("Ventas detalladas", true)).toBe("Detailed sales");
  expect(reportLabel("Ventas detalladas", false)).toBe("Ventas detalladas");
  expect(reportLabel("Customer-provided value", true)).toBe("Customer-provided value");
 });
 it("keeps scoped materials, reduced motion and accessible focus", () => {
  const css = read("./premiumWorkspace.css");
  expect(css).toContain(".norexos-premium-workspace");
  expect(css).toContain("prefers-reduced-motion: reduce");
  expect(css).toContain(":focus-visible");
  expect(css).toContain('data-overview-surface="black"');
  expect(css).not.toContain('data-surface="black"');
  expect(css).toContain("min-height: 44px");
  expect(css).toContain("overflow-wrap: anywhere");
  expect(css).toContain("flex-shrink: 0");
  expect(css).toContain("--primary-soft:");
  expect(css).toContain("#f6d687) !important");
  expect(css).not.toMatch(/display:\s*none|pointer-events:\s*none/);
 });
 it("does not create requests or own sensitive data in the shared layer", () => {
  const wrapper = read("./PremiumWorkspace.tsx");
  expect(wrapper).not.toMatch(/fetch\(|api\(|localStorage|dangerouslySetInnerHTML/);
 });
 it("retains report permission, export lock, paging and underlying request", () => {
  const source = read("./Management.tsx").split("export function Reports()")[1].split("export function Alerts")[0];
  expect(source).toContain('can(user?.permissions ?? [], "reports:read")');
  expect(source).toContain('can(user?.permissions ?? [], "profit:read")');
  expect(source).toContain('disabled={busy !== null}');
  expect(source).toContain('api(`/reports/${report}?from=${from}&to=${to}&page=${page}`)');
  expect(source).toContain('disabled={page >= pages || query.isFetching}');
  expect(source).toContain('setPage(1)');
 });
 it("keeps monthly money cards wide and route title accurate", () => {
  expect(read("./premiumWorkspace.css")).toContain('.kpi-grid { grid-template-columns: minmax(0,1fr); }');
  expect(read("./premiumWorkspace.css")).toContain('.heading-actions .button.primary');
  expect(read("./MonthReport.tsx")).not.toContain("ventas de hoy");
  expect(read("./App.tsx")).toContain('page.split("?")[0] === "month-report"');
 });
 it("retains monthly profit guards and date boundaries", () => {
  const source = read("./MonthReport.tsx");
  expect(source).toContain('can(user.permissions, "profit:read")');
  expect(source).toContain('showProfit &&');
  expect(source).toContain('disabled={nextDisabled}');
  expect(source).toContain('refetchInterval: 60000');
  expect(source).toContain('"/dashboard/breakdown?from="');
 });
});

it("Reportes explicitly translates the Heading eyebrow instead of using its Spanish default", () => {
 const reports=read("./Management.tsx").split("export function Reports()")[1].split("export function Alerts")[0];
 expect(reports).toContain('eyebrow={en ? "YOUR BUSINESS, WITH CLARITY" : "TU NEGOCIO, CON CLARIDAD"}');
});
