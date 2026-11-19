import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { OPERACIONES_EN, operacionesText, customerAnonymizationText } from "../apps/web/src/operacionesLanguage";
import { reverseIt003 } from "./it003-preservation";

const source = readFileSync("apps/web/src/Management.tsx", "utf8");
const ledger = JSON.parse(readFileSync("docs/diseno/operaciones-4k/PRESERVACION.json", "utf8"));
// Recover the complete verified baseline, then select named declarations, never
// ledger positions: composing unrelated views can append arbitrary edit groups.
let baseline = reverseIt003(source, "Management");
for (const edit of [...ledger.changes].reverse()) {
  if (baseline.split(edit.after).length !== 2) throw new Error("Non-unique preservation edit");
  baseline = baseline.replace(edit.after, edit.before);
}
if (createHash("sha256").update(baseline).digest("hex") !== ledger.base_sha256)
  throw new Error("Preservation baseline mismatch");
function declaration(text: string, name: string) {
  const file = ts.createSourceFile("Management.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = file.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name);
  if (!node) throw new Error("Missing function " + name);
  return node.getText(file);
}
const updates = ["Purchases", "Expenses", "Customers"].map((name) => ({
 before: declaration(baseline, name), after: declaration(source, name),
}));
const compact = (value: string) => value.replace(/\s+/g, " ").trim();
function calls(value: string, names: string[]) {
  const file = ts.createSourceFile("view.tsx", value, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: string[] = [];
  function walk(node: ts.Node) {
    if (ts.isCallExpression(node) && names.includes(node.expression.getText(file))) found.push(compact(node.getText(file)));
    ts.forEachChild(node, walk);
  }
  walk(file);
  return found;
}

describe("Operaciones ES/EN: presentación, sin cambiar negocio", () => {
  it("cubre todas las claves usadas, preserva español y no traduce datos desconocidos", () => {
    for (const [, key] of updates.map((edit) => edit.after).join("\n").matchAll(/ot\("([^"]+)"\)/g)) {
      expect(OPERACIONES_EN[key], key).toBeTruthy();
      expect(operacionesText(false, key)).toBe(key);
      expect(operacionesText(true, key)).toBe(OPERACIONES_EN[key]);
    }
    expect(operacionesText(true, "Nombre comercial del proveedor")).toBe("Nombre comercial del proveedor");
  });
  it("las tres vistas responden al selector y traducen tablas, consultas y formularios", () => {
    for (const edit of updates) {
      expect(source).toContain(edit.after);
      expect(edit.after).toContain('const en = useLanguage() === "en";');
      for (const tag of ["DataTable", "QueryState", "FormModal"]) {
        expect(edit.after).toContain(`<${tag} english={en}`);
        expect(edit.after).not.toMatch(new RegExp(`<${tag}(?! english=)`));
      }
      expect(edit.after).toContain('eyebrow={ot("TU NEGOCIO, CON CLARIDAD")}');
      expect(edit.after.match(/className: "operations-money"/g)?.length).toBe(1);
    }
  });
  it("preserva llamadas API, payloads, query keys y guards de permisos", () => {
    for (const edit of updates) {
      expect(calls(edit.after, ["api", "post", "mutate", "can", "seesCustomerPii", "customerPrivateDisplay", "customerEditValue", "useQuery", "formatMoney", "crypto.randomUUID"])).toEqual(calls(edit.before, ["api", "post", "mutate", "can", "seesCustomerPii", "customerPrivateDisplay", "customerEditValue", "useQuery", "formatMoney", "crypto.randomUUID"]));
    }
  });
  it("mantiene los valores monetarios y la fecha local; sólo cambia locale de presentación", () => {
    for (const edit of updates) {
      expect(calls(edit.after, ["dateLabel"]).map((call) => call.replace(', en ? "en-US" : "es-DO"', ""))).toEqual(calls(edit.before, ["dateLabel"]));
    }
    expect(updates[1].after).toContain('date: new Date(data.date + "T12:00:00-04:00").toISOString()');
    expect(updates[1].after).toContain('operationId: create');
    expect(updates[0].after).toContain('operationId: paySupplier.operationId');
  });
  it("la confirmación de anonimización conserva alcance y advertencia irreversible", () => {
    const name = "Cliente <A>";
    const es = customerAnonymizationText(false, name), en = customerAnonymizationText(true, name);
    expect(es).toContain(`Se eliminarán los datos personales de ${name}:`);
    expect(es).toContain("Las ventas y sus montos se conservarán.");
    expect(en).toContain("Sales and their amounts will be retained.");
    expect(en).toContain("Telegram and backups");
    expect(en).toContain("This action cannot be undone.");
    expect(en).toContain(name);
  });
  it("cada registro conserva su hash base y revierte todos los cambios exactamente", () => {
    for (const path of ["docs/diseno/operaciones-4k/PRESERVACION.json", "docs/diseno/productos-higgsfield/PRESENTACION_REVERSIBLE.json", "docs/diseno/caja-turnos/PRESENTACION_REVERSIBLE.json"]) {
      const record = JSON.parse(readFileSync(path, "utf8"));
      let restored = reverseIt003(source, "Management");
      for (const edit of [...record.changes].reverse()) {
        expect(restored).toContain(edit.after);
        restored = restored.replace(edit.after, edit.before);
      }
      expect(createHash("sha256").update(restored).digest("hex")).toBe(record.base_sha256);
    }
  });
});
