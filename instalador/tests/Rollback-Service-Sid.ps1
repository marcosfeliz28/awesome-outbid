$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\scripts\FitStore.Common.ps1')
if (-not (Get-Command Remove-FitStoreLocalServiceAccess -ErrorAction SilentlyContinue)) { throw '3h8: rollback conserva permisos LocalService al volver a SYSTEM.' }
if ((Resolve-FitStoreServiceAccountSid -Account 'LocalSystem') -ne 'S-1-5-18') { throw 'SYSTEM incorrecto.' }
$local = [Security.Principal.SecurityIdentifier]::new('S-1-5-19').Translate([Security.Principal.NTAccount]).Value
if ((Resolve-FitStoreServiceAccountSid -Account $local) -ne 'S-1-5-19') { throw 'Cuenta localizada incorrecta.' }
Write-Host 'PASS 3h8: cuenta localizada resuelta por SID.'
$root = Join-Path $env:TEMP ('nexora-service-acl-' + [guid]::NewGuid().ToString('N'))
$paths = [pscustomobject]@{ Data=$root; Work=(Join-Path $root 'work'); Pki=(Join-Path $root 'pki'); Install=(Join-Path $root 'install'); Logs=(Join-Path $root 'logs'); ServerConfig=(Join-Path $root 'server.json') }
try {
  foreach ($dir in @($paths.Data,$paths.Work,$paths.Pki,$paths.Install,$paths.Logs,(Join-Path $paths.Work 'app\api'))) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  foreach ($file in @((Join-Path $paths.Work '.env'),$paths.ServerConfig,(Join-Path $paths.Pki 'FitStore-server.pfx'))) { [IO.File]::WriteAllText($file,'fixture') }
  Grant-FitStoreApplicationAccess -Paths $paths
  Remove-FitStoreLocalServiceAccess -Paths $paths
  foreach ($item in @(Get-Item -LiteralPath $root) + @(Get-ChildItem -LiteralPath $root -Recurse)) {
    $rules = (Get-Acl -LiteralPath $item.FullName).GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])
    if (@($rules | Where-Object { $_.IdentityReference.Value -eq 'S-1-5-19' }).Count) { throw "LocalService conserva acceso: $($item.Name)" }
  }
  Write-Host 'PASS 3h8: ACL NTFS reales sin LocalService en archivos ni carpetas tras volver a SYSTEM.'
} finally { if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force } }
