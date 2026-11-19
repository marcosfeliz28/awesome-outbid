import { readFileSync } from "node:fs";
import { managementDigest, managementProductLedger, reverseManagement } from "./management-presentation-ledgers";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { OPERACIONES_EN, operacionesText, customerAnonymizationText } from "../apps/web/src/operacionesLanguage";

const source = readFileSync("apps/web/src/Management.tsx", "utf8");
const { operations, catalog, caja } = managementProductLedger;
// Recupera primero la base exacta del producto, preservando la composición de
// capas. Las bases de tienda permanecen en sus registros originales.
const baseline = reverseManagement(reverseManagement(source, catalog), operations);
if (managementDigest(baseline) !== operations.base_sha256)
  throw new Error("Product preservation baseline mismatch");
function declaration(text: string, name: string) {
  const file = ts.createSourceFile("Management.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = file.statements.find((item) => ts.isFunctionDeclaration(item) && item.name?.text === name);
  if (!node) throw new Error("Missing function " + name);
  return node.getText(file);
}
const updates = ["Purchases", "Expenses", "Customers"].map((name) => ({
 name, before: declaration(baseline, name), after: declaration(source, name),
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
      if (edit.name === "Customers") {
        expect(edit.after).toContain('<OperationsPresentation area="customers">');
        expect(edit.after).toContain('title={ot("Clientes")}');
        expect(edit.after).toContain('aria-labelledby="customers-list-title"');
        expect(edit.after).toContain('id="customers-list-title">{ot("Directorio de clientes")}');
        expect(edit.after).toContain('<ConfirmModal english={en}');
        expect(edit.after).toContain('customerAnonymizationText(en, anonymizing.name)');
        expect(edit.after).toContain('anonymizing.debt > 0');
      } else {
        expect(edit.after).toContain('eyebrow={ot("TU NEGOCIO, CON CLARIDAD")}');
      }
      expect(edit.after.match(/className: "operations-money"/g)?.length).toBe(1);
    }
  });
  it("preserva llamadas API, payloads, query keys y guards de permisos", () => {
    for (const edit of updates) {
      expect(calls(edit.after, ["api", "post", "mutate", "can", "seesCustomerPii", "customerPrivateDisplay", "customerEditValue", "useQuery", "useEffect", "client.invalidateQueries", "formatMoney", "crypto.randomUUID"])).toEqual(calls(edit.before, ["api", "post", "mutate", "can", "seesCustomerPii", "customerPrivateDisplay", "customerEditValue", "useQuery", "useEffect", "client.invalidateQueries", "formatMoney", "crypto.randomUUID"]));
    }
  });
  it("mantiene los valores monetarios y la fecha local; sólo cambia locale de presentación", () => {
    for (const edit of updates) {
      // El producto ya localiza estas fechas. No se cambia ni el valor ni el locale.
      const dates = calls(edit.after, ["dateLabel"]);
      expect(dates).toEqual(calls(edit.before, ["dateLabel"]));
      expect(dates.length).toBeGreaterThan(0);
      expect(dates.every((call) => call.endsWith(', en ? "en-US" : "es-DO")'))).toBe(true);
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
  it("conserva los hashes independientes y la composición exacta de las tres capas", () => {
    expect(operations.source_commit).toBe(catalog.source_commit);
    expect(operations.source_commit).toBe(caja.source_commit);
    expect(managementDigest(baseline)).toBe(operations.base_sha256);
    expect(managementDigest(reverseManagement(reverseManagement(source, operations), catalog))).toBe(catalog.base_sha256);
    expect(managementDigest(reverseManagement(baseline, caja))).toBe(caja.base_sha256);
  });
});
