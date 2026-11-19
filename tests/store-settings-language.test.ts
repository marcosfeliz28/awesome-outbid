import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { describe, it, expect } from "vitest";
import { STORE_SETTINGS_EN, storeSettingsText } from "../apps/web/src/storeSettingsLanguage";
const source = readFileSync("apps/web/src/Tienda.tsx", "utf8");
// El producto expone un modo de solo logo sin consultas de cajas ni usuarios.
const ledger = JSON.parse(readFileSync("docs/diseno/operaciones-4k/STORE_SETTINGS_IDIOMA.json", "utf8")).producto;
const before = ledger.changes[1].before as string;
const start = source.indexOf("export function StoreSettings(");
const after = source.slice(start);
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
  expect(start).toBeGreaterThanOrEqual(0);
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
 it("el modo solo logo no consulta ni muestra cajas o cajeros", () => {
  expect(after).toMatch(/queryKey: \["terminals"\],[\s\S]*?enabled: !logoOnly/);
  expect(after).toMatch(/queryKey: \["users"\],[\s\S]*?enabled: !logoOnly/);
  expect(after).toMatch(/\{!logoOnly && <>[\s\S]*?Cajas \(número y nombre en el cuadre\)[\s\S]*?Cajeros \(número en el cuadre y los reportes\)[\s\S]*?<\/>\}/);
 });
 it("changes only StoreSettings and its imports, reversible to base hash", () => {
  let original = source;
  for(const edit of [...ledger.changes].reverse()) {
   expect(original.split(edit.after)).toHaveLength(2);
   original = original.replace(edit.after,edit.before);
  }
  expect(createHash("sha256").update(original).digest("hex")).toBe(ledger.base_sha256);
 });
});
