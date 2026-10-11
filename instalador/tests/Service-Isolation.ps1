param([string]$InstallerRoot = (Split-Path -Parent $PSScriptRoot))
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $InstallerRoot 'scripts\FitStore.Common.ps1')
$serviceSids=@{}
foreach ($name in @('FitStoreAPI','FitStoreWeb')) {
  $reported = & "$env:SystemRoot\System32\sc.exe" showsid $name
  if ($LASTEXITCODE -ne 0 -or ($reported -join ' ') -notmatch 'S-1-5-80-[0-9-]+') { throw "B8: Windows no resolvio el SID: $name." }
  $serviceSids[$name]=$Matches[0]
}
$apiSid=$serviceSids.FitStoreAPI
$webSid=$serviceSids.FitStoreWeb
$root = Join-Path $env:TEMP ('nexora-b8-' + [guid]::NewGuid().ToString('N'))
$paths = [pscustomobject]@{ Data=$root; Work=(Join-Path $root 'work'); Pki=(Join-Path $root 'pki'); Logs=(Join-Path $root 'logs'); Install=(Join-Path $root 'install'); ServerConfig=(Join-Path $root 'server.json') }
function Assert-Readers {
  param([string]$Path, [string[]]$Expected)
  $rules = (Get-Acl -LiteralPath $Path).GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])
  $managed = @('S-1-5-19',$apiSid,$webSid)
  $actual = @($rules | Where-Object { $_.IdentityReference.Value -in $managed } | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
  if (($actual -join ',') -ne (($Expected | Sort-Object -Unique) -join ',')) { throw "B8: lectores incorrectos: $Path." }
  if (@($rules | Where-Object { $_.IdentityReference.Value -in $managed -and ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write) -ne 0 }).Count) { throw "B8: configuracion modificable: $Path." }
}
try {
  foreach ($dir in @($paths.Data,$paths.Work,$paths.Pki,$paths.Logs,$paths.Install,(Join-Path $paths.Work 'app\api'))) { New-FitStoreDirectory -Path $dir }
  foreach ($file in @('work\.env','server.json','pki\FitStore-server.pfx','pki\FitStore-CA.pfx','secrets.json')) {
    $path=Join-Path $root $file
    [IO.File]::WriteAllText($path,'fixture')
    Protect-FitStoreFile -Path $path
  }
  # Migracion real desde ACL compartida anterior.
  $localIdentity=[Security.Principal.SecurityIdentifier]::new('S-1-5-19')
  foreach ($file in @('work\.env','server.json','pki\FitStore-server.pfx')) {
    $path=Join-Path $root $file
    $acl=[IO.File]::GetAccessControl($path,[Security.AccessControl.AccessControlSections]::Access)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($localIdentity,'Read','Allow'))
    [IO.File]::SetAccessControl($path,$acl)
  }
  Grant-FitStoreApplicationAccess -Paths $paths
  Assert-Readers -Path (Join-Path $paths.Work '.env') -Expected @($apiSid)
  Assert-Readers -Path $paths.ServerConfig -Expected @($webSid)
  Assert-Readers -Path (Join-Path $paths.Pki 'FitStore-server.pfx') -Expected @($webSid)
  foreach ($file in @('secrets.json','pki\FitStore-CA.pfx')) { Assert-Readers -Path (Join-Path $root $file) -Expected @() }
  foreach ($name in @('FitStoreAPI','FitStoreWeb')) {
    if ((Get-FitStoreServiceSid -Name $name) -ne $serviceSids[$name]) { throw "B8: SID distinto del calculado por Windows: $name." }
    [xml]$xml=Get-Content -LiteralPath (Join-Path $InstallerRoot "service\$name.xml.template") -Raw
    if ($xml.service.serviceaccount.domain -ne 'NT SERVICE' -or $xml.service.serviceaccount.user -ne $name) { throw "B8: cuenta virtual incorrecta: $name." }
  }
  Write-Host 'PASS B8: SID calculados coinciden con sc showsid; ACL reales separan .env de TLS y retiran LocalService.'
  # Rollback a versiones LocalService y SYSTEM conserva sus accesos efectivos.
  Grant-FitStoreApplicationAccess -Paths $paths -ApiAccount 'NT AUTHORITY\LocalService' -WebAccount LocalSystem
  Assert-Readers -Path (Join-Path $paths.Work '.env') -Expected @('S-1-5-19')
  Assert-Readers -Path $paths.ServerConfig -Expected @()
  Grant-FitStoreApplicationAccess -Paths $paths -ApiAccount LocalSystem -WebAccount LocalSystem
  foreach ($file in @('work\.env','server.json','pki\FitStore-server.pfx')) { Assert-Readers -Path (Join-Path $root $file) -Expected @() }
  Write-Host 'PASS B8: rollback mixto y SYSTEM elimina SID nuevos y recupera permisos antiguos.'
  $legacy=New-FitStoreSecret
  $secrets=[pscustomobject]@{ pfxPassword=$legacy }
  if (-not (Initialize-FitStorePfxSecrets -Secrets $secrets)) { throw 'B8: no migro claves antiguas.' }
  if ($secrets.caPfxPassword -cne $legacy -or $secrets.pfxPassword -cne $legacy -or $secrets.serverPfxPassword -ceq $legacy) { throw 'B8: migracion altera CA o comparte clave del servidor.' }
  $server=$secrets.serverPfxPassword
  if ((Initialize-FitStorePfxSecrets -Secrets $secrets) -or $secrets.serverPfxPassword -cne $server) { throw 'B8: migracion no idempotente.' }
  Write-Host 'PASS B8: claves aleatorias distintas, CA antigua preservada y migracion idempotente.'
} finally { if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root,$true) } }
