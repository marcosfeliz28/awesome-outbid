import { test } from "node:test";
import assert from "node:assert/strict";
import { validarSalida, quitarRazonamiento, ejecutar } from "./tarea.mjs";

test("solo permite salidas dentro de docs/", () => {
  assert.throws(() => validarSalida("apps/web/src/App.tsx"), /no permitida/);
  assert.throws(() => validarSalida("docs/../apps/x.ts"), /no permitida/);
  assert.equal(validarSalida("docs/salida/a.md"), "docs/salida/a.md");
});

test("quita el bloque de razonamiento de la respuesta", () => {
  assert.equal(quitarRazonamiento("<think>pensando</think>\n# Guía"), "# Guía");
});

test("ejecutar devuelve el texto del modelo sin razonamiento", async () => {
  const fetchFake = async () => ({ ok: true, json: async () => ({ response: "<think>x</think>hola", total_duration: 2e9 }) });
  const r = await ejecutar({ encargo: "x", maxTokens: 10, fetchFn: fetchFake });
  assert.equal(r.texto, "hola");
  assert.equal(r.segundos, 2);
});
