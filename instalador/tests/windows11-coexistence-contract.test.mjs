import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const script = readFileSync(
  join(import.meta.dirname, "Windows11-Coexistence.ps1"),
  "utf8",
);

test("PC-22 exige una VM Windows 11 desechable y un inicio limpio", () => {
  assert.match(script, /\[switch\]\$ConfirmDisposableVm/);
  assert.match(script, /build -ge 22000/);
  assert.match(script, /VM reconocida/);
  assert.match(
    script,
    /No se permite ejecutar esta prueba destructiva en la PC de la tienda/,
  );
  assert.match(script, /Assert-CleanStart/);
});

test("PC-22 instala Tienda antes de Local y comprueba aislamiento completo", () => {
  const storeInstall = script.indexOf('$phase = "instalar-tienda"');
  const localInstall = script.indexOf('$phase = "instalar-local"');
  const localUninstall = script.indexOf('$phase = "desinstalar-local"');
  assert.ok(storeInstall > 0 && storeInstall < localInstall);
  assert.ok(localInstall < localUninstall);

  for (const expected of [
    "FitStorePostgreSQL",
    "FitStoreAPI",
    "FitStoreWeb",
    "NexoraLocalPostgreSQL",
    "NexoraLocalAPI",
    "NexoraLocalWeb",
    "FitStore POS",
    "Nexora POS Local",
    '-Database "fitstore" -User "fitstore"',
    '-Database "nexoralocal" -User "nexoralocal"',
  ]) {
    assert.ok(
      script.includes(expected),
      `Falta contrato de coexistencia: ${expected}`,
    );
  }
  for (const port of [5434, 3001, 4173, 5544, 4301, 4473]) {
    assert.match(script, new RegExp(`\\b${port}\\b`));
  }
  assert.match(script, /Sin dueña ajena en/);
  assert.match(script, /Secretos Tienda sin sobrescritura/);
});

test("PC-22 desinstala solo Local, conserva datos y vuelve a probar la Tienda", () => {
  assert.match(script, /Uninstall\.exe/);
  assert.match(script, /-Arguments "\/S"/);
  assert.match(script, /Desinstalación Local conserva datos/);
  assert.match(script, /PostgreSQL\\data\\PG_VERSION/);
  assert.match(script, /Tienda tras desinstalar Local/);
  assert.match(script, /Secretos Tienda sin cambios finales/);
  assert.match(script, /resultado\.json/);
  assert.doesNotMatch(script, /-PurgeData/);
});

test("PC-22 usa credenciales efímeras y no registra secretos en la evidencia", () => {
  assert.match(script, /RandomNumberGenerator/);
  assert.match(script, /example\.invalid/);
  assert.match(script, /Remove-Item -LiteralPath \$answer/);
  assert.doesNotMatch(script, /OwnerPassword=(?!\$password)/);
  assert.doesNotMatch(script, /OwnerPin=(?!\$pin)/);
  assert.doesNotMatch(script, /postgresPassword\s*=/);
  assert.doesNotMatch(script, /databasePassword\s*=/);
});

test("PC-22 queda expuesto como script instalador y contrato obligatorio", () => {
  const packageJson = JSON.parse(
    readFileSync(join(root, "package.json"), "utf8"),
  );
  assert.equal(
    packageJson.scripts["instalador:pc22-windows11"],
    "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/tests/Windows11-Coexistence.ps1",
  );
  const validation = readFileSync(
    join(import.meta.dirname, "run-validation.mjs"),
    "utf8",
  );
  assert.match(validation, /windows11-coexistence-contract\.test\.mjs/);
});
