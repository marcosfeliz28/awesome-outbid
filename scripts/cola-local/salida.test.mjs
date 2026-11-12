import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { resolverSalida, revisarSensible } from "./salida.mjs";

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
