Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$installerRoot = Split-Path -Parent $PSScriptRoot
foreach ($name in @("FitStoreAPI", "FitStoreWeb")) {
  [xml]$xml = Get-Content -LiteralPath (Join-Path $installerRoot "service\$name.xml.template") -Raw
  $account = $xml.SelectSingleNode("/service/serviceaccount/user")
  if (-not $account -or $account.InnerText -ne "LocalService") { throw "W3: $name no declara LocalService." }
  if ($xml.SelectSingleNode("/service/serviceaccount/password")) { throw "W3: credencial innecesaria en $name." }
  Write-Host "PASS W3: $name usa LocalService sin clave."
}
. (Join-Path $installerRoot "scripts\FitStore.Common.ps1")
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-service-acl-" + [Guid]::NewGuid().ToString("N"))
try {
  foreach ($dir in @("", "work", "work\app", "work\app\api", "pki", "logs", "install")) { [IO.Directory]::CreateDirectory((Join-Path $root $dir)) | Out-Null }
  foreach ($file in @("work\.env", "server.json", "pki\FitStore-server.pfx", "secrets.json", "pki\FitStore-CA.pfx")) {
    [IO.File]::WriteAllText((Join-Path $root $file), "local-fixture")
    Protect-FitStoreBackupFile -Path (Join-Path $root $file)
  }
  $paths = [pscustomobject]@{ Data=$root; Work=(Join-Path $root "work"); Pki=(Join-Path $root "pki"); Logs=(Join-Path $root "logs"); Install=(Join-Path $root "install"); ServerConfig=(Join-Path $root "server.json") }
  Grant-FitStoreApplicationAccess -Paths $paths
  foreach ($file in @("work\.env", "server.json", "pki\FitStore-server.pfx")) {
    $rules = (Get-Acl -LiteralPath (Join-Path $root $file)).Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq "S-1-5-19" }
    if (-not $rules -or @($rules | Where-Object { ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write) -ne 0 }).Count) { throw "W3: permiso de lectura incorrecto para $file." }
  }
  foreach ($file in @("secrets.json", "pki\FitStore-CA.pfx")) {
    $rules = (Get-Acl -LiteralPath (Join-Path $root $file)).Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq "S-1-5-19" }
    if ($rules) { throw "W3: LocalService accede a $file." }
  }
  Write-Host "PASS W3: configuracion/TLS solo lectura; secretos administrativos/CA excluidos."
  # Rollback restaura y vuelve a proteger archivos: eso elimina el permiso de servicio.
  $rollback = Get-Content -LiteralPath (Join-Path $installerRoot "scripts\Rollback-FitStoreUpdate.ps1") -Raw
  $grant = $rollback.IndexOf('Grant-FitStoreApplicationAccess -Paths $paths')
  $restart = $rollback.IndexOf('Ensure-RestoredApplicationService -Paths $paths -Name $script:ApiService')
  if ($grant -lt 0 -or $grant -gt $restart) { throw "W3-R: rollback no restablece permisos antes de iniciar LocalService." }
  foreach ($file in @("work\.env", "server.json", "pki\FitStore-server.pfx")) {
    $path = Join-Path $root $file
    $acl = [IO.File]::GetAccessControl($path, [Security.AccessControl.AccessControlSections]::Access)
    $acl.PurgeAccessRules([Security.Principal.SecurityIdentifier]::new("S-1-5-19"))
    [IO.File]::SetAccessControl($path, $acl)
  }
  Grant-FitStoreApplicationAccess -Paths $paths
  foreach ($file in @("work\.env", "server.json", "pki\FitStore-server.pfx")) {
    $rules = (Get-Acl -LiteralPath (Join-Path $root $file)).Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq "S-1-5-19" }
    if (-not $rules) { throw "W3-R: rollback dejó inaccesible $file." }
  }
  Write-Host "PASS W3-R: rollback reaplica lectura antes del reinicio y conserva secretos administrativos privados."
} finally { if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) } }
