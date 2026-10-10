param([string]$PreflightPath)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\FitStore.Common.ps1')
if (-not $PreflightPath) { $PreflightPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\Preflight-FitStore.ps1' }
$root = Join-Path ([IO.Path]::GetTempPath()) ('nexora-fallback-' + [Guid]::NewGuid().ToString('N'))
$reader = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$state = [pscustomobject]@{ backupReaderSid = $reader }
$paths = [pscustomobject]@{ LocalBackups = (Join-Path $root 'private'); Install = $root }
$realProtect = ${function:Protect-FitStoreBackupFile}
$realCreate = ${function:New-FitStoreBackupFile}
$principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
$elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
function Write-FitStoreLog { param($InstallDir, $Level, $Message) Write-Host "$Level $Message" }
function Protect-FitStoreBackupFile {
  param([string]$Path)
  if ($Path.StartsWith($root + '\FitStore_old')) { throw 'fixture: USB sin soporte ACL' }
  & $realProtect -Path $Path
}
function New-FitStoreBackupFile {
  param([string]$Path)
  if ($elevated) { & $realCreate -Path $Path; return }
  # Token reducido: fixture solo concede Write temporal al creador; nunca al
  # lector persistido ni a Users/Everyone. El camino elevado usa File.Create real.
  $directory = Split-Path -Parent $Path
  $folderAcl = [IO.Directory]::GetAccessControl($directory, [Security.AccessControl.AccessControlSections]::Access)
  $folderAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), 'Write', 'Allow'))
  [IO.Directory]::SetAccessControl($directory, $folderAcl)
  [IO.File]::WriteAllText($Path, '')
  & $realProtect -Path $Path
  $acl = [IO.File]::GetAccessControl($Path)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), 'Write', 'Allow'))
  [IO.File]::SetAccessControl($Path, $acl)
}
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $original = Join-Path $root 'FitStore_old.dump'
  foreach ($suffix in @('', '.sha256', '.json')) { [IO.File]::WriteAllText($original + $suffix, 'fixture-backup' + $suffix) }
  $output = @($original)
  $source = Get-Content -LiteralPath $PreflightPath -Raw
  $start = $source.IndexOf('$backup = $output | Select-Object -Last 1')
  $end = $source.IndexOf('$backupHash =', $start)
  . ([scriptblock]::Create($source.Substring($start, $end - $start)))
  if ($backup -eq $original -or -not $backup.StartsWith($paths.LocalBackups + '\')) { throw '3i5: no usa copia privada.' }
  if ($script:BackupReaderSid -cne $state.backupReaderSid) { throw '3i5: no cargo SID real desde state.' }
  foreach ($suffix in @('', '.sha256', '.json')) {
    $file = $backup + $suffix
    if ([IO.File]::ReadAllText($file) -cne [IO.File]::ReadAllText($original + $suffix)) { throw '3i5: contenido cambiado.' }
    if (-not $elevated) { & $realProtect -Path $file }
    $acl = [IO.File]::GetAccessControl($file)
    if (-not $acl.AreAccessRulesProtected) { throw '3i5: hereda ACL.' }
    foreach ($rule in $acl.Access) {
      $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
      if ($sid -notin @('S-1-5-18', 'S-1-5-32-544', $reader)) { throw '3i5: ACL publica.' }
      if ($sid -eq $reader -and ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write)) { throw '3i5: lector puede escribir.' }
    }
  }
  Write-Host "PASS 3i5: USB sin ACL usa copia privada intacta; SID cargado desde state. File.Create elevado=$elevated"
} finally {
  if (Test-Path -LiteralPath $root) {
    foreach ($item in Get-ChildItem -LiteralPath $root -Recurse -Force) {
      $acl = if ($item.PSIsContainer) { [IO.Directory]::GetAccessControl($item.FullName, [Security.AccessControl.AccessControlSections]::Access) } else { [IO.File]::GetAccessControl($item.FullName, [Security.AccessControl.AccessControlSections]::Access) }
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), 'FullControl', 'Allow'))
      if ($item.PSIsContainer) { [IO.Directory]::SetAccessControl($item.FullName, $acl) } else { [IO.File]::SetAccessControl($item.FullName, $acl) }
    }
    Remove-Item -LiteralPath $root -Recurse -Force
  }
}
