import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// PC-19: el script de VM (Windows-License-Acl.ps1) y el instalador deben proteger
// los mismos archivos. Verificacion estatica; la prueba real exige una VM Windows.
const root = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(root, p), "utf8");
const script = read("instalador/tests/Windows-License-Acl.ps1");
const common = read("instalador/scripts/FitStore.Common.ps1");
const install = read("instalador/scripts/Install-FitStore.ps1");
const profile = read("instalador/tools/product-local-profile.mjs");
const api = read("apps/api/src/local-license.ts");
const has = (text, fragment, why) => assert.ok(text.includes(fragment), why ?? `falta: ${fragment}`);

test("el script de VM conserva sus guardas y revisa cada archivo", () => {
  has(script, "[switch]$ConfirmDisposableVm");
  assert.match(script, /if \(-not \$ConfirmDisposableVm\)\s*\{\s*throw/);
  has(script, "virtual|vmware|virtualbox|hyper-v", "falta la deteccion de VM");
  has(script, 'Add-Check "VM reconocida"');
  has(script, 'Add-Check "Sin tienda: servicio');
  has(script, "icacls.exe");
  has(script, "Get-Acl");
  // Cada archivo debe estar en la tabla que recorre Assert-Acl (icacls + Get-Acl).
  for (const file of ["license.json", "clock.json", "state.json", ".env", String.raw`work\.env`]) {
    const key = `"${file}"`;
    const at = script.indexOf(key);
    assert.ok(at >= 0 && /^\s*=\s*@\{ path/.test(script.slice(at + key.length)), `el script no revisa ${file}`);
  }
  assert.match(script, /Assert-Acl -Label \$name/); // bucle sobre todos los archivos
  for (const sid of ["S-1-5-18", "S-1-5-32-544", "S-1-5-32-545"]) has(script, sid);
  has(script, String.raw`StartName -ieq "NT SERVICE\$apiService"`);
  has(script, "$apiPort = 4301");
  has(script, "127.0.0.1:$apiPort");
  has(script, "$post.status -eq 423");
  for (const op of ["sobrescribir-license.json", "renombrar-license.json", "borrar-license.json", "reemplazar-license.json", "editar-clock.json"]) {
    has(script, op, `falta caso de manipulacion ${op}`);
  }
});

test("el instalador protege los mismos archivos que revisa el script (sin deriva)", () => {
  for (const name of ["license.json", "clock.json"]) {
    has(api, `"${name}"`, `la API ya no usa ${name}`);
    has(script, name, `el script no revisa ${name}`);
  }
  // Data: sin herencia, solo SYSTEM y Administradores.
  has(install, '$paths.Data "/inheritance:r" "/grant:r" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F"');
  // state.json y los dos .env: Protect-FitStoreFile deja SYSTEM + Administradores.
  assert.match(common, /function Protect-FitStoreFile[\s\S]*?\/inheritance:r[\s\S]*?\*S-1-5-18:\(F\)[\s\S]*?\*S-1-5-32-544:\(F\)/);
  has(install, "Write-FitStoreJson -Path $paths.State -Value $state -Protect");
  has(install, "Protect-FitStoreFile -Path $Paths.Env");
  has(install, "Protect-FitStoreFile -Path $runtimeEnv");
  // Directorio de licencia bajo Data, con Modify solo para la cuenta de la API.
  has(profile, "PRODUCT_LOCAL_LICENSE_DIR=$(Join-Path $Paths.Data 'license')");
  assert.match(profile, /\$account\[0\] -eq 'FitStoreAPI'[\s\S]*?\$licenseDir = Join-Path \$Paths\.Data 'license'[\s\S]*?'Modify'/);
  has(script, 'Join-Path $dataDir "license"', "el script usa otro directorio de licencia");
  // Nombres/puerto del perfil local que el script usa.
  has(profile, '[/FitStoreAPI/g, "NexoraLocalAPI"]');
  has(profile, String.raw`[/(?<!\d)3001(?!\d)/g, "4301"]`);
  has(script, '$apiService = "NexoraLocalAPI"');
});
