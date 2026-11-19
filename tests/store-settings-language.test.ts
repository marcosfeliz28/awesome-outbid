import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { describe, it, expect } from "vitest";
import { STORE_SETTINGS_EN, storeSettingsText } from "../apps/web/src/storeSettingsLanguage";
import { reverseIt003 } from "./it003-preservation";
const source = readFileSync("apps/web/src/Tienda.tsx", "utf8");
const ledger = JSON.parse(readFileSync("docs/diseno/operaciones-4k/STORE_SETTINGS_IDIOMA.json", "utf8"));
const before = ledger.changes[1].before as string;
const after = source.slice(source.indexOf("export function StoreSettings()"));
function protectedNodes(text: string) {
 const file = ts.createSourceFile("view.tsx",text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const found: string[] = [];
 function walk(node: ts.Node) {
  if(ts.isCallExpression(node) && ["api", "mutate", "useQuery", "client.invalidateQueries", "body.append", "optionalNumber"].includes(node.expression.getText(file))) found.push(node.getText(file));
  if(ts.isJsxAttribute(node) && ["onSubmit", "onClose", "onChange", "onClick", "initial", "accept", "type"].includes(node.name.getText(file))) found.push(node.getText(file));
  ts.forEachChild(node,walk);
 }
 walk(file);return found;
}
describe("Store settings ES/EN", () => {
 it("covers every display string, preserving Spanish and unknown data", () => {
  expect(after).toContain('useLanguage() === "en"');
  for(const [,key] of after.matchAll(/st\("([^"]+)"\)/g)) {
   expect(STORE_SETTINGS_EN[key],key).toBeTruthy();
   expect(storeSettingsText(false,key)).toBe(key);
   expect(storeSettingsText(true,key)).toBe(STORE_SETTINGS_EN[key]);
  }
  expect(storeSettingsText(true,"Store-owned register name")).toBe("Store-owned register name");
  expect(after.match(/english=\{english\}/g)).toHaveLength(2);
 });
 it("retains API, query keys, payloads, form state, handlers and allowed files", () => {
  expect(protectedNodes(after)).toEqual(protectedNodes(before));
  expect(after).toContain("file.size > 200 * 1024");
  expect(after).toContain("toast(e.message, true)");
  expect(after).toContain(".filter((t) => !t.revokedAt)");
 });
 it("changes only StoreSettings and its imports, reversible to base hash", () => {
  let original = reverseIt003(source, "Tienda");
  for(const edit of [...ledger.changes].reverse()) {
   expect(original.split(edit.after)).toHaveLength(2);
   original = original.replace(edit.after,edit.before);
  }
  expect(createHash("sha256").update(original).digest("hex")).toBe(ledger.base_sha256);
 });
});
