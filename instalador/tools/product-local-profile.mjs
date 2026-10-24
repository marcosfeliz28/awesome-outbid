import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

const replacements = [
  [/FitStore POS/g, "Nexora POS Local"],
  [/Nexora POS(?! Local)/g, "Nexora POS Local"],
  [/Certificado FitStore/g, "Certificado Nexora Local"],
  [/FitStore - acceso/g, "Nexora Local - acceso"],
  [/FitStorePOS/g, "NexoraPOSLocal"],
  [/FitStorePostgreSQL/g, "NexoraLocalPostgreSQL"],
  [/FitStoreAPI/g, "NexoraLocalAPI"],
  [/FitStoreWeb/g, "NexoraLocalWeb"],
  [/FitStore_/g, "NexoraLocal_"],
  [/FitStore-/g, "NexoraLocal-"],
  [/fitstore/g, "nexoralocal"],
  [/(?<!\d)5434(?!\d)/g, "5544"],
  [/(?<!\d)3001(?!\d)/g, "4301"],
  [/(?<!\d)4173(?!\d)/g, "4473"],
];

function transform(content) {
  return replacements.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), content)
    .replaceAll('!define PRODUCT_NAME "Nexora POS"', '!define PRODUCT_NAME "Nexora POS Local"')
    .replaceAll("Nexora-POS-Setup-", "Nexora-POS-Local-Setup-");
}

function profileFile(source, target) {
  mkdirSync(join(target, ".."), { recursive: true });
  let content = readFileSync(source, "utf8");
  if (basename(source) === "Install-FitStore.ps1") {
    content = content.replace(
      '  Remove-Item -LiteralPath (Join-Path $desktop "FitStore POS.lnk") -Force -ErrorAction SilentlyContinue',
      '  # El producto local conserva los accesos de otras instalaciones.',
    );
    const envAnchor = '  $encoding = [Text.UTF8Encoding]::new($false)';
    if (!content.includes(envAnchor)) throw new Error("Falta el punto de configuración local de la API.");
    content = content.replace(envAnchor, `  $localKey = [IO.File]::ReadAllText((Join-Path $Paths.Install "runtime\\license-public-key.pem")).Trim().Replace("\x60r", "").Replace("\x60n", "\\n")
  $localState = Read-FitStoreJson -Path $Paths.State
  $lines += @(
    "PRODUCT_LOCAL_LICENSE=required",
    "PRODUCT_LOCAL_INSTALLATION_ID=$([string]$localState.installationId)",
    "PRODUCT_LOCAL_LICENSE_DIR=$(Join-Path $Paths.Data 'license')",
    "PRODUCT_LOCAL_LICENSE_PUBLIC_KEY=$localKey",
    "PRODUCT_LOCAL_LICENSE_RENEW_URL=$(Get-ExistingEnvValue -Path $Paths.Env -Name 'PRODUCT_LOCAL_LICENSE_RENEW_URL')",
    "PRODUCT_LOCAL_LICENSE_RENEW_TOKEN=$(Get-ExistingEnvValue -Path $Paths.Env -Name 'PRODUCT_LOCAL_LICENSE_RENEW_TOKEN')"
  )
${envAnchor}`);
    const stateAnchor = 'Write-EnvironmentFile -Paths $paths -Secrets $secrets';
    if (!content.includes(stateAnchor)) throw new Error("Falta el punto de instalación de la licencia local.");
    content = content.replace(stateAnchor, `if (-not ($state.PSObject.Properties.Name -contains 'installationId')) {
  $state | Add-Member -NotePropertyName installationId -NotePropertyValue ([Guid]::NewGuid().ToString('N')) -Force
  Write-FitStoreJson -Path $paths.State -Value $state -Protect
}
New-FitStoreDirectory -Path (Join-Path $paths.Data 'license')
${stateAnchor}`);
  }
  if (basename(source) === "FitStore.Common.ps1") {
    const aclAnchor = '    $logDir = Join-Path $Paths.Logs $account[0]';
    if (!content.includes(aclAnchor)) throw new Error("Falta el punto ACL del servicio de API.");
    content = content.replace(aclAnchor, `    if ($account[0] -eq 'FitStoreAPI') {
      $licenseDir = Join-Path $Paths.Data 'license'
      New-FitStoreDirectory -Path $licenseDir
      $licenseAcl = [IO.Directory]::GetAccessControl($licenseDir, [Security.AccessControl.AccessControlSections]::Access)
      $licenseAcl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, 'Modify', 'ContainerInherit, ObjectInherit', 'None', 'Allow'))
      [IO.Directory]::SetAccessControl($licenseDir, $licenseAcl)
    }
${aclAnchor}`);
  }
  if (basename(source) === "FitStore.nsi") {
    const initAnchor = "Function .onInit\n";
    if (!content.includes(initAnchor))
      throw new Error("Falta .onInit para proteger la carpeta local.");
    content = content.replace(
      initAnchor,
      `${initAnchor}  \${If} $INSTDIR != "$PROGRAMFILES64\\Nexora POS Local"
    MessageBox MB_ICONSTOP "El producto local solo puede instalarse en C:\\Program Files\\Nexora POS Local. Se rechazó la carpeta elegida para proteger la instalación de la tienda." /SD IDOK
    SetErrorLevel 4
    Abort
  \${EndIf}
`,
    );
  }
  writeFileSync(target, transform(content), "utf8");
}

export function applyProductLocalProfile({ source, target, nsi, nsiOut = join(target, "FitStore.nsi") }) {
  for (const [directory, extension] of [["scripts", ".ps1"], ["service", ".template"], ["runtime", ".mjs"], ["tests", ".ps1"]]) {
    const from = join(source, directory);
    if (!existsSync(from)) throw new Error(`Falta ${from}`);
    for (const entry of readdirSync(from, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(extension)) continue;
      if (directory === "tests" && entry.name !== "Windows-Smoke.ps1") continue;
      const outputName = directory === "service" ? entry.name.replaceAll("FitStoreAPI", "NexoraLocalAPI").replaceAll("FitStoreWeb", "NexoraLocalWeb") : entry.name;
      profileFile(join(from, entry.name), join(target, directory, outputName));
      if (source === target && outputName !== entry.name) unlinkSync(join(target, directory, entry.name));
    }
  }
  const icon = join(source, "assets", "fitstore.ico");
  if (!existsSync(icon)) throw new Error(`Falta ${icon}`);
  mkdirSync(join(target, "assets"), { recursive: true });
  copyFileSync(icon, join(target, "assets", "nexoralocal.ico"));
  profileFile(nsi, nsiOut);
  const script = readFileSync(nsiOut, "utf8");
  if (script.includes("FitStore POS") || script.includes("FitStorePOS")) {
    throw new Error(`La identidad anterior permanece en ${basename(nsiOut)}`);
  }
  return nsiOut;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [source, target, nsi, nsiOut] = process.argv.slice(2);
  if (!source || !target || !nsi || !nsiOut) throw new Error("Uso: product-local-profile.mjs origen destino nsi nsiSalida");
  applyProductLocalProfile({ source, target, nsi, nsiOut });
}
