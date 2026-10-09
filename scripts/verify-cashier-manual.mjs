import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
const previous = process.argv.includes("--before");
const read = (path) => previous
  ? execFileSync("git", ["show", "f2600e7:" + path], { encoding: "utf8", cwd: new URL("..", import.meta.url) })
  : readFileSync(new URL("../" + path, import.meta.url), "utf8");
const manual = read("docs/MANUAL-CAJERO.md");
const captures = read("docs/CAPTURAS_MANUAL.md");
const sales = read("apps/api/src/sales.ts");
assert.equal(manual.includes("La anulación no requiere abrir caja"), false, "A2: afirmación absoluta falsa");
assert.match(manual, /caja original ya cerró y la venta tuvo efectivo/);
assert.match(manual, /propia caja abierta, con efectivo suficiente/);
assert.match(sales, /originalCash\?\.closedAt && cashCollected\(saleRef.payments\) > 0/);
assert.match(sales, /No hay suficiente efectivo en tu caja para este reembolso/);
assert.match(captures, /con caja propia sin saldo \(rechazo\)/);
assert.equal((manual.match(/^## [1-8]\./gm) || []).length, 8);
assert.equal((manual.match(/manual-page-break/g) || []).length, 7);
console.log("PASS A2: condición de caja cerrada + efectivo, caja propia y saldo; ocho tareas y siete saltos. Revisión documental, no integración.");
