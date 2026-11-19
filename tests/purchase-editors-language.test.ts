import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, it, expect } from "vitest";
import { PURCHASE_EDITOR_EN, purchaseEditorText } from "../apps/web/src/purchaseEditorLanguage";
const source = readFileSync("apps/web/src/Purchases.tsx", "utf8");
const ledger = JSON.parse(readFileSync("docs/diseno/operaciones-4k/EDITORES_IDIOMA_PRESERVACION.json", "utf8"));
const baseline = ledger.changes[0].before as string;
function nodes(text: string, kind: "business" | "handlers" | "functions") {
 const file = ts.createSourceFile("Purchases.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
 const result: string[] = [];
 const normalize = (text: string) => text.replace(/et\("([^"]+)"\)/g, '"$1"').replace(/\s+/g, " ");
 function walk(node: ts.Node) {
  if(kind === "business" && ts.isCallExpression(node) && ["post", "documentPayload", "crypto.randomUUID", "setError", "client.invalidateQueries"].includes(node.expression.getText(file))) result.push(normalize(node.getText(file)));
  if(kind === "handlers" && ts.isJsxAttribute(node) && ["onChange", "onClick", "onSubmit", "onClose", "disabled", "min", "step", "required"].includes(node.name.getText(file))) result.push(normalize(node.getText(file)));
  if(kind === "functions" && ts.isFunctionDeclaration(node) && !["PurchaseEditor", "ReceiptEditor"].includes(node.name?.text || "")) result.push(node.getText(file));
  ts.forEachChild(node, walk);
 }
 walk(file);return result;
}
describe("Purchase and receipt editors: language without business changes", () => {
 it("all editor labels have English while Spanish and unknown data stay intact", () => {
  expect(source).toContain('const et = (text: string) => purchaseEditorText(english, text)');
  const editor = source.slice(source.indexOf("export function PurchaseEditor"), source.indexOf("const documentLabel"));
  for(const [, key] of editor.matchAll(/et\("([^"]+)"\)/g)) {
   expect(PURCHASE_EDITOR_EN[key], key).toBeTruthy();
   expect(purchaseEditorText(false, key)).toBe(key);
   expect(purchaseEditorText(true, key)).toBe(PURCHASE_EDITOR_EN[key]);
  }
  expect(purchaseEditorText(true,"Supplier commercial name")).toBe("Supplier commercial name");
  expect(editor).toContain("english={english}");
 });
 it("preserves requests, idempotency, error policy, handlers and input constraints", () => {
  expect(nodes(source,"business")).toEqual(nodes(baseline,"business"));
  expect(nodes(source,"handlers")).toEqual(nodes(baseline,"handlers"));
 });
 it("does not modify DocumentFields, ReceiptHistory, ReceiptDetail or other functions", () => {
  expect(nodes(source,"functions")).toEqual(nodes(baseline,"functions"));
 });
 it("translates damage reason labels but retains saved values and payment enums", () => {
  expect(source).toContain('DAMAGE_REASONS.map((r) => ({ label: et(r), value: r }))');
  for(const reason of ["Dañado", "Vencido o por vencer", "Producto equivocado", "Rechazado por calidad"]) expect(purchaseEditorText(true,reason)).not.toBe(reason);
  expect(source).toContain('{ label: et("Contado"), value: "cash" }');
  expect(source).toContain('{ label: et("Crédito"), value: "credit" }');
  expect(source).toContain('"T23:59:59-04:00"');
 });
 it("privacy notice preserves purposes, optionality, rights and original policy link", () => {
  const privacy = readFileSync("apps/web/src/CustomerPrivacyNotice.tsx", "utf8");
  expect(privacy).toContain('useLanguage() === "en"');
  for(const text of ["sales, warranties and credit", "are optional", "view, correct or delete", 'href="/privacidad.html"', 'rel="noopener"', "Privacy (Spanish)", "puede pedir verlos, corregirlos o borrarlos."]) expect(privacy).toContain(text);
  expect(readFileSync("apps/web/src/helpers.tsx", "utf8")).toContain('export { CustomerPrivacyNotice } from "./CustomerPrivacyNotice"');
 });
 it("records exact source changes without editing shared modules outside scope", () => {
  for(const change of ledger.changes) expect(readFileSync(change.file,"utf8")).toBe(change.after);
  const helper = ledger.changes[1];
  const oldStart = helper.before.indexOf("export function CustomerPrivacyNotice()");
  const oldEnd = helper.before.indexOf("export function FormModal",oldStart);
  expect(helper.after).toBe(helper.before.slice(0,oldStart)+'export { CustomerPrivacyNotice } from "./CustomerPrivacyNotice";\n'+helper.before.slice(oldEnd));
 });
});
