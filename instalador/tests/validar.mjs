import assert from "node:assert/strict";
import console from "node:console";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const installerDir = path.resolve(testDir, "..");
const root = path.resolve(installerDir, "..");

const required = [
  "VERSION",
  "README.md",
  "THIRD_PARTY_NOTICES.txt",
  "dependencias.lock.json",
  "build.ps1",
  "assets/icon.svg",
  "assets/fitstore.ico",
  "installer/FitStore.nsi",
  "runtime/web-server.mjs",
  "scripts/FitStore.Common.ps1",
  "scripts/Install-FitStore.ps1",
  "scripts/Preflight-FitStore.ps1",
  "scripts/Rollback-FitStoreUpdate.ps1",
  "scripts/Configure-Network.ps1",
  "scripts/Backup-FitStore.ps1",
  "scripts/Restore-FitStore.ps1",
  "scripts/Repair-FitStoreLogin.ps1",
  "scripts/Uninstall-FitStore.ps1",
  "scripts/Verify-FitStore.ps1",
  "service/FitStoreAPI.xml.template",
  "service/FitStoreWeb.xml.template",
  "tests/Windows-Smoke.ps1",
  "tests/PowerShell-Parse.ps1",
  "tests/Transaction-FaultInjection.ps1",
  "tests/Restore-FaultInjection.ps1",
  "tests/fixtures/restore-fault/FitStore.Common.ps1",
  "tests/fixtures/restore-fault/Backup-FitStore.ps1",
];

for (const relative of required) {
  const info = await stat(path.join(installerDir, relative));
  assert.ok(info.isFile() && info.size > 0, `Falta ${relative}`);
}
assert.ok((await stat(path.join(root, "docs", "INSTALADOR.md"))).size > 1000);

const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
for (const name of [
  "instalador:validar",
  "instalador:preparar",
  "instalador:compilar",
]) {
  assert.equal(typeof pkg.scripts[name], "string", `Falta script ${name}`);
}

const lock = JSON.parse(
  await readFile(path.join(installerDir, "dependencias.lock.json"), "utf8"),
);
for (const dependency of [
  lock.node,
  lock.winsw,
  lock.vcRuntime,
  lock.postgresql,
]) {
  assert.match(dependency.version, /^\d+(?:\.\d+)+(?:-\d+)?$/);
  assert.match(dependency.url, /^https:\/\//);
  assert.match(dependency.sha256, /^[a-f0-9]{64}$/);
}
assert.equal(lock.postgresql.version, "18.6-5");

async function allFiles(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await allFiles(full)));
    else output.push(full);
  }
  return output;
}

const textFiles = (await allFiles(installerDir)).filter((file) =>
  /\.(?:md|mjs|nsi|ps1|template|txt|json)$/.test(file),
);
const scannedFiles = textFiles.filter(
  (file) => file !== fileURLToPath(import.meta.url),
);
const combined = (
  await Promise.all(scannedFiles.map((file) => readFile(file, "utf8")))
).join("\n");
assert.doesNotMatch(combined, /FitStore-Demo-2026!/);
assert.doesNotMatch(combined, /fitstore_local/);
assert.doesNotMatch(combined, /postgresPassword\s*[=:]\s*["'][^"'$]/i);
assert.doesNotMatch(combined, /databasePassword\s*[=:]\s*["'][^"'$]/i);
assert.match(combined, /New-FitStoreSecret/);
assert.match(combined, /LocalSubnet/);
assert.match(combined, /--list/);
assert.match(combined, /migrate["', ]+deploy/);
assert.match(combined, /PurgeData/);
assert.match(combined, /ExpectedPostgresMajor/);
assert.match(combined, /--single-transaction/);
assert.match(combined, /\.onInstFailed/);
assert.match(combined, /MUI_CUSTOMFUNCTION_ABORT TryRollbackUpdate/);
assert.match(combined, /ROLLBACK CORRECTO/);

const nsis = await readFile(
  path.join(installerDir, "installer", "FitStore.nsi"),
  "utf8",
);
assert.match(nsis, /CreateMutexW[^\r\n]+Global\\FitStorePOSInstaller/);
assert.match(nsis, /\$0 == 183/);
assert.match(
  nsis,
  /Function TryRollbackUpdate[\s\S]+\$InstallerOwnsMutex == "1"[\s\S]+\$UpdateMode == "actualizar"/,
);

function assertOrdered(source, labels, description) {
  let cursor = -1;
  for (const label of labels) {
    const next = source.indexOf(label, cursor + 1);
    assert.ok(
      next > cursor,
      `${description}: falta o está fuera de orden ${label}`,
    );
    cursor = next;
  }
}

const preflight = await readFile(
  path.join(installerDir, "scripts", "Preflight-FitStore.ps1"),
  "utf8",
);
assert.match(
  preflight,
  /Program Files y ProgramData estén en el mismo volumen/,
);
assertOrdered(
  preflight,
  [
    "Stop-FitStoreApplication",
    "$output = @(&",
    'Set-FitStoreServiceStartMode -Name $script:WebService -Mode "disabled"',
    'Set-FitStoreServiceStartMode -Name $script:ApiService -Mode "disabled"',
    "Stop-FitStoreService -Name $script:PostgresService",
    "Move-Item -LiteralPath $actualInstall -Destination $snapshotPath",
  ],
  "La actualización debe cerrar ventas, respaldar, detener PostgreSQL y sólo entonces apartar la versión anterior",
);
for (const phase of ["prepared-copy-pending", "snapshot-ready"])
  assert.match(preflight, new RegExp(`phase[^\\r\\n]+${phase}`));

const rollbackScript = await readFile(
  path.join(installerDir, "scripts", "Rollback-FitStoreUpdate.ps1"),
  "utf8",
);
assertOrdered(
  rollbackScript,
  [
    'Set-FitStoreUpdatePhase -Paths $paths -Phase "rollback-files-moving"',
    "Move-Item -LiteralPath $actualInstall -Destination $failedInstall",
    "Move-Item -LiteralPath $snapshotPath -Destination $actualInstall",
    'Set-FitStoreUpdatePhase -Paths $paths -Phase "rollback-files-restored"',
    "foreach ($service in @($script:ApiService, $script:WebService))",
    "Ensure-RestoredApplicationService -Paths $paths -Name $service -KeepDisabled:$RecoverInterrupted",
    "Start-FitStoreApplication",
  ],
  "El rollback debe persistir el movimiento de archivos y volver a registrar ambos servicios antes de iniciarlos",
);
// El loop debe registrar ambas identidades y conservar disabled durante la
// recuperacion interrumpida; no basta con encontrar un nombre en un comentario.
const assertRollbackServices = (source) => {
  assert.match(
    source,
    /foreach \(\$service in @\(\$script:ApiService, \$script:WebService\)\) \{\s*\$account = Ensure-RestoredApplicationService -Paths \$paths -Name \$service -KeepDisabled:\$RecoverInterrupted/,
    "Ambos servicios deben pasar por el registro real con KeepDisabled",
  );
  assert.match(
    source,
    /\$mode = if \(\$KeepDisabled\) \{ 'disabled' \} else \{ 'delayed-auto' \}\s*Set-FitStoreServiceStartMode -Name \$Name -Mode \$mode/,
    "La funcion de registro debe aplicar el modo disabled, no ignorar el switch",
  );
  assertOrdered(
    source,
    [
      "Ensure-RestoredApplicationService -Paths $paths -Name $service -KeepDisabled:$RecoverInterrupted",
      "Set-FitStoreServiceStartMode -Name $script:ApiService -Mode 'delayed-auto'",
      "Set-FitStoreServiceStartMode -Name $script:WebService -Mode 'delayed-auto'",
      "Start-FitStoreApplication",
    ],
    "Ambas cuentas deben estar registradas antes de habilitar/iniciar servicios",
  );
};
assertRollbackServices(rollbackScript);
for (const mutant of [
  rollbackScript.replace(
    "@($script:ApiService, $script:WebService)",
    "@($script:ApiService)",
  ),
  rollbackScript.replace("-KeepDisabled:$RecoverInterrupted", ""),
  rollbackScript.replace("{ 'disabled' }", "{ 'delayed-auto' }"),
]) {
  assert.throws(
    () => assertRollbackServices(mutant),
    "El contrato no debe aceptar omitir Web o KeepDisabled",
  );
}
assert.match(rollbackScript, /\$Paths\.WinSW/);

const restoreScript = await readFile(
  path.join(installerDir, "scripts", "Restore-FitStore.ps1"),
  "utf8",
);
assertOrdered(
  restoreScript,
  [
    "Stop-FitStoreApplication",
    "$safetyOutput = @(&",
    "$tempDatabase =",
    "--dbname=$tempDatabase",
    "Test-FitStoreRestoredDatabase",
    "Restore-ArchiveAtomically",
  ],
  "La restauración debe cerrar ventas, respaldar, validar en una base aislada y reemplazar al final",
);
assert.doesNotMatch(
  restoreScript,
  /-Arguments\s+@\([^\r\n]+"--force",\s*"--if-exists",\s*"fitstore"\)/,
);
assert.doesNotMatch(
  restoreScript,
  /ALTER\s+DATABASE[\s\S]*?RENAME\s+TO\s+fitstore/i,
  "La restauracion no debe dejar una ventana sin base activa mediante DROP seguido de RENAME",
);
assert.match(
  restoreScript,
  /function Restore-ArchiveAtomically[\s\S]*?--clean[\s\S]*?--if-exists[\s\S]*?--single-transaction[\s\S]*?--exit-on-error/,
  "El reemplazo activo debe permanecer dentro de una sola transaccion de pg_restore",
);

const uninstallScript = await readFile(
  path.join(installerDir, "scripts", "Uninstall-FitStore.ps1"),
  "utf8",
);
assertOrdered(
  uninstallScript,
  ["Stop-FitStoreApplication", "$backupOutput = @(&"],
  "La desinstalación debe cerrar ventas antes del respaldo final",
);
assert.match(
  uninstallScript,
  /No se puede borrar la base porque falta el servicio PostgreSQL o la herramienta de respaldo/,
);

const configureNetwork = await readFile(
  path.join(installerDir, "scripts", "Configure-Network.ps1"),
  "utf8",
);
assert.doesNotMatch(
  configureNetwork,
  /throw "La computadora no tiene una dirección IPv4 privada activa/,
);
assert.match(configureNetwork, /La instalación local sigue siendo válida/);

const verifyScript = await readFile(
  path.join(installerDir, "scripts", "Verify-FitStore.ps1"),
  "utf8",
);
assert.match(verifyScript, /Perfil de red para las cajas[^\r\n]+\$false/);
assert.match(verifyScript, /\$_.required -and -not \$_.ok/);

const installScript = await readFile(
  path.join(installerDir, "scripts", "Install-FitStore.ps1"),
  "utf8",
);
for (const phase of [
  "configuring",
  "migrating",
  "services",
  "verifying",
  "verified",
]) {
  assert.match(
    installScript,
    new RegExp(`Set-FitStoreUpdatePhase[^\\r\\n]+${phase}`),
  );
}
assert.match(installScript, /Complete-FitStoreUpdate/);
assert.match(installScript, /SERVICE_START_MODE[^\r\n]+"Manual"/);
assertOrdered(
  installScript,
  [
    'Set-FitStoreUpdatePhase -Paths $paths -Phase "verifying"',
    'Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health"',
    'Set-FitStoreServiceStartMode -Name $script:ApiService -Mode "delayed-auto"',
    'Set-FitStoreServiceStartMode -Name $script:WebService -Mode "delayed-auto"',
    'Set-FitStoreUpdatePhase -Paths $paths -Phase "verified"',
    "Complete-FitStoreUpdate -Paths $paths",
  ],
  "La actualización debe usar servicios manuales hasta verificar salud y sólo entonces reactivar el autoarranque",
);
assert.doesNotMatch(installScript, /Test-FitStoreHasUsers/);
assert.match(
  installScript,
  /if \(-not \$ownerCreated\)\s*\{\s*New-OwnerAccount/s,
);

const createAdmin = await readFile(
  path.join(root, "apps", "api", "scripts", "create-admin.ts"),
  "utf8",
);
assert.match(createAdmin, /findMany\([\s\S]*mode: "insensitive"/);
assert.match(createAdmin, /authVersion: \{ increment: 1 \}/);
assert.match(createAdmin, /compare\(input\.password, verified\.passwordHash\)/);
assert.match(createAdmin, /compare\(input\.pin, verified\.pinHash\)/);
assert.match(createAdmin, /input\.mode === "repair"/);
assert.match(createAdmin, /tx\.user\.count\(\)/);
assert.match(createAdmin, /system:recovery/);

const repairLogin = await readFile(
  path.join(installerDir, "scripts", "Repair-FitStoreLogin.ps1"),
  "utf8",
);
assert.match(repairLogin, /\$apiPath = \$paths\.Api/);
assert.match(repairLogin, /\$env:ADMIN_MODE = "repair"/);
assert.doesNotMatch(repairLogin, /\$env:ADMIN_NAME\s*=/);
assert.match(repairLogin, /Parameter\(Mandatory = \$true\).*CredentialFile/);
assert.match(repairLogin, /GetByteCount\(\$password\) -gt 72/);

assert.match(installScript, /antes-de-reanudar-propietario/);
assert.match(installScript, /\$resumeBackupExitCode -ne 0/);

for (const file of textFiles.filter((entry) => entry.endsWith(".ps1"))) {
  assert.doesNotMatch(
    await readFile(file, "utf8"),
    /\$(?:HOME|home|CODEX_HOME)\b/,
    `Variable HOME prohibida en ${file}`,
  );
}

const apiTemplate = await readFile(
  path.join(installerDir, "service", "FitStoreAPI.xml.template"),
  "utf8",
);
const webTemplate = await readFile(
  path.join(installerDir, "service", "FitStoreWeb.xml.template"),
  "utf8",
);
for (const placeholder of [
  "NODE_EXE",
  "API_MAIN",
  "API_WORKDIR",
  "LOG_DIR",
  "SERVICE_START_MODE",
  "DELAYED_AUTO_START",
])
  assert.match(apiTemplate, new RegExp(`{{${placeholder}}}`));
for (const placeholder of [
  "NODE_EXE",
  "WEB_SERVER",
  "SERVER_CONFIG",
  "INSTALL_DIR",
  "LOG_DIR",
  "SERVICE_START_MODE",
  "DELAYED_AUTO_START",
])
  assert.match(webTemplate, new RegExp(`{{${placeholder}}}`));

const icon = await readFile(path.join(installerDir, "assets", "fitstore.ico"));
assert.equal(icon[0], 0);
assert.equal(icon[1], 0);
assert.equal(icon[2], 1);
assert.equal(icon[3], 0);

console.log(
  `Validación del instalador correcta: ${required.length} archivos requeridos y controles de seguridad.`,
);
