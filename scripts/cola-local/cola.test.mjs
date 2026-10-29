import { test } from "node:test";
import assert from "node:assert/strict";
import { siguienteTarea, construirEncargo, registrar } from "./cola.mjs";

const cola = { tareas: [
  { id: "a", salida: "docs/a.md" },
  { id: "b", salida: "docs/b.md" },
  { id: "c", salida: "docs/c.md" },
] };

test("toma la primera tarea sin estado", () => {
  assert.equal(siguienteTarea(cola, {}).id, "a");
});

test("salta las tareas hechas", () => {
  assert.equal(siguienteTarea(cola, { a: { estado: "hecha" } }).id, "b");
});

test("retoma una tarea que quedó en curso tras un corte", () => {
  assert.equal(siguienteTarea(cola, { a: { estado: "hecha" }, b: { estado: "en curso" } }).id, "b");
});

test("reintenta un error hasta dos veces y luego la salta", () => {
  assert.equal(siguienteTarea(cola, { a: { estado: "error", intentos: 1 } }).id, "a");
  assert.equal(siguienteTarea(cola, { a: { estado: "error", intentos: 2 }, b: { estado: "hecha" } }).id, "c");
});

test("devuelve null cuando no queda nada", () => {
  const estado = { a: { estado: "hecha" }, b: { estado: "hecha" }, c: { estado: "hecha" } };
  assert.equal(siguienteTarea(cola, estado), null);
});

test("arma el encargo con el contenido de los archivos de entrada", () => {
  const archivos = { "x.md": "uno", "y.md": "dos" };
  const enc = construirEncargo({ instrucciones: "Resume.", entradas: ["x.md", "y.md"] }, (r) => archivos[r]);
  assert.match(enc, /Resume\./);
  assert.match(enc, /### Archivo: x\.md[\s\S]*uno/);
  assert.match(enc, /### Archivo: y\.md[\s\S]*dos/);
});

test("recorta archivos muy largos y lo indica", () => {
  const enc = construirEncargo({ instrucciones: "", entradas: ["g.md"] }, () => "z".repeat(10000));
  assert.match(enc, /\[\.\.\.recortado\]/);
  assert.ok(enc.length < 7000);
});

test("registrar conserva los campos previos y añade los nuevos", () => {
  const e = registrar({ a: { estado: "error", intentos: 1 } }, "a", { estado: "hecha" });
  assert.equal(e.a.estado, "hecha");
  assert.equal(e.a.intentos, 1);
});
