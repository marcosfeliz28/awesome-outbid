// Orden 124: las guías de docs/ayuda/local deben coincidir con el código (informe de ChatGPT nube).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../docs/ayuda/local");
const guia = (n) => readFileSync(join(dir, `cajera-${n}.md`), "utf8");

test("s1: PIN de seis números; fondo menor pide nota, no PIN", () => {
  const t = guia("s1");
  assert.match(t, /PIN nuevo de seis números/);
  assert.doesNotMatch(t, /cinco reglas/);
  assert.doesNotMatch(t, /pide al gerente su PIN/);
  assert.match(t, /nota/i);
  assert.doesNotMatch(t, /solo para consultar/);
});

test("s2: sin «escáname» ni prohibición de cambiar cliente/producto", () => {
  const t = guia("s2");
  assert.doesNotMatch(t, /escáname/);
  assert.doesNotMatch(t, /No cambies el cliente o producto/i);
});

test("s4: sin obligación de guardar comprobante", () => {
  assert.doesNotMatch(guia("s4"), /conserva el comprobante/i);
});

test("s6: gira en torno a «Solicitar anulación», sin nombrar personas", () => {
  const t = guia("s6");
  assert.match(t, /Solicitar anulación/);
  assert.doesNotMatch(t, /Marcos|Génesis/);
  assert.doesNotMatch(t, /No intentes anular/i);
  assert.match(t, /Devolver/);
  assert.match(t, /abono/i);
});

test("s8: venta local depende de la configuración; cierre bloqueado con pendientes", () => {
  const t = guia("s8");
  assert.match(t, /Si tu tienda lo permite/);
  assert.match(t, /cierre.*(bloque|no se puede)|No cierres caja/i);
});
