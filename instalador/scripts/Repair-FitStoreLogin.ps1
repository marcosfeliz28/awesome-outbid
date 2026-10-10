param(
  [string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$CredentialFile,
  [string]$ResultPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir

if (-not (Test-Path -LiteralPath $CredentialFile -PathType Leaf)) {
  throw "No se encontró el archivo privado de credenciales iniciales."
}
$credentialAcl = Get-Acl -LiteralPath $CredentialFile
if (-not $credentialAcl.AreAccessRulesProtected) {
  throw "El archivo de credenciales hereda permisos y no es seguro usarlo."
}
$allowedSids = @(
  [Security.Principal.WindowsIdentity]::GetCurrent().User.Value,
  "S-1-5-18",
  "S-1-5-32-544"
)
foreach ($rule in $credentialAcl.Access) {
  if ($rule.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow) {
    continue
  }
  $sid = $rule.IdentityReference.Translate(
    [Security.Principal.SecurityIdentifier]
  ).Value
  if ($sid -notin $allowedSids) {
    throw "El archivo de credenciales permite acceso a una identidad no autorizada."
  }
}

$credentialLines = @(Get-Content -LiteralPath $CredentialFile)
$emailLine = $credentialLines | Where-Object { $_ -like "Usuario propietario:*" } | Select-Object -First 1
$passwordLine = $credentialLines | Where-Object { $_ -like "Contrase*:*" } | Select-Object -First 1
$pinLine = $credentialLines | Where-Object { $_ -like "PIN:*" } | Select-Object -First 1
if (-not $emailLine -or -not $passwordLine -or -not $pinLine) {
  throw "El archivo privado de credenciales no tiene el formato esperado."
}

$email = ([string]$emailLine).Substring(([string]$emailLine).IndexOf(":") + 1).Trim().ToLowerInvariant()
$password = ([string]$passwordLine).Substring(([string]$passwordLine).IndexOf(":") + 1).Trim()
$pin = ([string]$pinLine).Substring(([string]$pinLine).IndexOf(":") + 1).Trim()
if ($email -notmatch "^[^\s@]+@[^\s@]+\.[^\s@]+$" -or
    $password.Length -lt 12 -or $password.Length -gt 128 -or
    [Text.Encoding]::UTF8.GetByteCount($password) -gt 72 -or
    $pin -notmatch "^\d{6}$") {
  throw "El archivo privado de credenciales contiene valores inválidos."
}

$backupScript = Join-Path $PSScriptRoot "Backup-FitStore.ps1"
$backupOutput = @(& $backupScript -InstallDir $paths.Install -Motivo "antes-de-reparar-login")
$backupPath = $backupOutput | Where-Object {
  $_ -is [string] -and (Test-Path -LiteralPath $_ -PathType Leaf)
} | Select-Object -Last 1
if (-not $backupPath) {
  throw "No se pudo confirmar el respaldo previo a la reparación."
}

$secrets = Read-FitStoreJson -Path $paths.Secrets
$apiPath = $paths.Api
$tsx = Join-Path $apiPath "node_modules\.bin\tsx.cmd"
if (-not (Test-Path -LiteralPath $tsx -PathType Leaf)) {
  throw "No se encontró el ejecutor local de la API."
}

$old = @{
  DATABASE_URL = $env:DATABASE_URL
  ADMIN_EMAIL = $env:ADMIN_EMAIL
  ADMIN_PASSWORD = $env:ADMIN_PASSWORD
  ADMIN_PIN = $env:ADMIN_PIN
  ADMIN_NAME = $env:ADMIN_NAME
  ADMIN_MODE = $env:ADMIN_MODE
}
try {
  $env:DATABASE_URL = Get-FitStoreDatabaseUrl -Secrets $secrets
  $env:ADMIN_EMAIL = $email
  $env:ADMIN_PASSWORD = $password
  $env:ADMIN_PIN = $pin
  $env:ADMIN_MODE = "repair"
  Remove-Item Env:ADMIN_NAME -ErrorAction SilentlyContinue
  Push-Location $apiPath
  try {
    Invoke-FitStoreProcess -FilePath $tsx `
      -Arguments @("scripts\create-admin.ts") `
      -FailureMessage "No se pudo sincronizar la cuenta propietaria"
  }
  finally {
    Pop-Location
  }
}
finally {
  foreach ($name in $old.Keys) {
    if ($null -eq $old[$name]) {
      Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
    else {
      Set-Item "Env:$name" $old[$name]
    }
  }
  $password = $null
  $pin = $null
}

$result = [ordered]@{
  repaired = $true
  email = $email
  backup = $backupPath
  finishedAt = [DateTime]::UtcNow.ToString("o")
}
if ($ResultPath) {
  try {
    [IO.File]::WriteAllText(
      $ResultPath,
      ($result | ConvertTo-Json),
      [Text.UTF8Encoding]::new($false)
    )
  }
  catch {
    Write-Warning "La cuenta se reparó, pero no se pudo escribir el reporte."
  }
}
$result | ConvertTo-Json -Compress
