import { test } from "node:test";
import assert from "node:assert/strict";
import { validarSalida, planear, ejecutar } from "./cola.mjs";

test("rechaza salidas fuera de docs/", () => {
  assert.throws(() => validarSalida("apps/web/src/App.tsx"), /no permitida/);
  assert.throws(() => validarSalida("docs/../apps/x.ts"), /no permitida/);
  assert.equal(validarSalida("docs/salida/a.md"), "docs/salida/a.md");
});

test("respeta el tope de bloques y de tokens", () => {
  const bloques = [
    { id: "1", max_tokens: 100, salida: "docs/a.md" },
    { id: "2", max_tokens: 100, salida: "docs/b.md" },
    { id: "3", max_tokens: 100, salida: "docs/c.md" },
  ];
  assert.equal(planear(bloques, { maxBloques: 5, maxTokens: 200 }).plan.length, 2);
  assert.equal(planear(bloques, { maxBloques: 1, maxTokens: 999 }).plan.length, 1);
});

test("ejecutar escribe solo en docs/ con la respuesta del modelo", async () => {
  const escritos = [];
  const fetchFake = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: "hola" } }], usage: { total_tokens: 7 } }) });
  const res = await ejecutar([{ id: "1", prompt: "x", max_tokens: 10, salida: "docs/o.md" }], {
    apiKey: "k", baseUrl: "http://fake", modelo: "m", fetchFn: fetchFake,
    escribir: (r, t) => escritos.push([r, t]),
  });
  assert.deepEqual(escritos, [["docs/o.md", "hola"]]);
  assert.equal(res[0].tokens, 7);
});
