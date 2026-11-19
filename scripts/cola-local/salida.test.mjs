import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { resolverSalida, revisarSensible, evaluarSalida } from "./salida.mjs";

const REPO = resolve("/repo");

test("0 opciones: la salida sigue siendo solo docs/ (comportamiento anterior)", () => {
  assert.equal(resolverSalida("docs/ayuda/x.md", undefined, REPO), "docs/ayuda/x.md");
  assert.throws(() => resolverSalida("apps/x.md", undefined, REPO), /no permitida/i);
});

test("1 carpeta externa: guarda fuera del repositorio con el nombre del archivo", () => {
  const r = resolverSalida("docs/ayuda/x.md", resolve("/datos/privado"), REPO);
  assert.equal(r, resolve("/datos/privado/x.md"));
});

test("rechaza carpetas con .. y carpetas dentro del repositorio", () => {
  assert.throws(() => resolverSalida("docs/x.md", "/datos/../repo/out", REPO), /\.\./);
  assert.throws(() => resolverSalida("docs/x.md", "../afuera/../repo", REPO), /\.\./);
  assert.throws(() => resolverSalida("docs/x.md", "/repo/docs/out", REPO), /dentro del repositorio/);
  assert.throws(() => resolverSalida("docs/x.md", "", REPO), /vac/i);
});

test("el nombre de la tarea no puede escapar de la carpeta externa", () => {
  assert.throws(() => resolverSalida("docs/../../x.md", "/datos/privado", REPO), /\.\./);
});

test("revisión: detecta teléfonos, correos, claves y cifras de dinero", () => {
  assert.ok(revisarSensible("Llame al 809-555-1234").length > 0);
  assert.ok(revisarSensible("escribe a ana@correo.com").length > 0);
  assert.ok(revisarSensible("clave sk-ant-api03-abcdefghijklmnop").length > 0);
  assert.ok(revisarSensible("password: hunter2").length > 0);
  assert.ok(revisarSensible("Costo RD$ 1,250.00").length > 0);
  assert.ok(revisarSensible("Precio $450").length > 0);
});

test("revisión: texto limpio pasa", () => {
  assert.deepEqual(revisarSensible("Apodos: Arroz Selecto, Aceite Girasol 1L"), []);
});

test("orden 122: cédula dominicana y teléfono de 10 dígitos seguidos", () => {
  assert.deepEqual(revisarSensible("Cédula 001-1234567-8"), ["cédula"]);
  assert.deepEqual(revisarSensible("Whatsapp 8095551234"), ["teléfono"]);
  assert.deepEqual(revisarSensible("Whatsapp 8295551234 y 8495551234"), ["teléfono"]);
  assert.deepEqual(revisarSensible("Código 18095551234567 y lote 7095551234"), []);
});

test("orden 122: evaluarSalida revisa siempre; el dinero solo avisa si va a docs/", () => {
  const aDocs = evaluarSalida("Muestra RD$ 0.00 en caja", false);
  assert.deepEqual(aDocs, { bloquear: [], avisar: ["dinero"] });
  assert.deepEqual(evaluarSalida("Muestra RD$ 0.00 en caja", true), { bloquear: ["dinero"], avisar: [] });
  assert.deepEqual(evaluarSalida("Llame al 809-555-1234 o RD$ 5", false), { bloquear: ["teléfono"], avisar: ["dinero"] });
  assert.deepEqual(evaluarSalida("Cédula 001-1234567-8", false).bloquear, ["cédula"]);
  assert.deepEqual(evaluarSalida("Abra la caja y toque Cobrar", false), { bloquear: [], avisar: [] });
});
