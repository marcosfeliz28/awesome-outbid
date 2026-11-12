import { test } from "node:test";
import assert from "node:assert/strict";
import { validarCambio, MAX_ARCHIVOS } from "./validar.mjs";

test("acepta un cambio pequeño en un archivo permitido", () => {
  const r = validarCambio(["packages/ui/src/nx-plural.ts", "tests/f2-01-nx-plural.test.ts"]);
  assert.equal(r.ok, true);
  assert.deepEqual(r.motivos, []);
});

test("rechaza archivos de dinero, auth, migraciones, CI y configuración protegida", () => {
  const prohibidos = [
    "apps/api/src/cash.ts",
    "apps/api/src/sales.ts",
    "apps/api/src/auth.ts",
    "apps/api/prisma/migrations/202610030001_initial/migration.sql",
    ".github/workflows/ci.yml",
    "render.yaml",
    "CLAUDE.md",
    "AGENTS.md",
    ".env.example",
    "docs/operacion/CIERRE.md",
    "docs/legal/CONTRATO.md",
    "docs/seguridad/PLUGINS.md",
  ];
  for (const f of prohibidos) {
    const r = validarCambio([f]);
    assert.equal(r.ok, false, `debía rechazar ${f}`);
    assert.equal(r.motivos.length, 1);
  }
});

test("rechaza más de 5 archivos", () => {
  const seis = Array.from({ length: MAX_ARCHIVOS + 1 }, (_, i) => `tests/prueba-${i}.test.ts`);
  const r = validarCambio(seis);
  assert.equal(r.ok, false);
  assert.match(r.motivos.join(" "), /más de 5/);
});

test("acepta exactamente 5 archivos", () => {
  const cinco = Array.from({ length: MAX_ARCHIVOS }, (_, i) => `tests/prueba-${i}.test.ts`);
  assert.equal(validarCambio(cinco).ok, true);
});

test("rechaza rutas que salen del repositorio", () => {
  assert.equal(validarCambio(["../fuera.ts"]).ok, false);
  assert.equal(validarCambio(["/etc/passwd"]).ok, false);
});
