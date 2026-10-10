Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-legacy-unavailable-" + [Guid]::NewGuid().ToString("N"))
$reader = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$script:originalProtect = (Get-Command Protect-FitStoreBackupFile).ScriptBlock
$script:notes = @()
function Write-FitStoreLog { param($InstallDir, $Level, $Message) $script:notes += [pscustomobject]@{ Level=$Level; Message=$Message } }
function Protect-FitStoreBackupFile {
  param([string]$Path)
  if ($Path.StartsWith($script:old, [StringComparison]::OrdinalIgnoreCase)) { throw "USB desconectado o red sin permiso" }
  if ($script:failLocal) { throw "ACL local no disponible" }
  & $script:originalProtect -Path $Path
}
try {
  $script:old = Join-Path $root "legacy"
  $local = Join-Path $root "private"
  [IO.Directory]::CreateDirectory($script:old) | Out-Null
  [IO.Directory]::CreateDirectory($local) | Out-Null
  [IO.File]::WriteAllText((Join-Path $script:old "FitStore_old.dump"), "old-content")
  [IO.File]::WriteAllText((Join-Path $local "FitStore_local.dump"), "local-content")
  $script:failLocal = $false
  $state = [pscustomobject]@{ backupPath=$script:old; backupReaderSid=$reader }
  $paths = [pscustomobject]@{ LocalBackups=$local; Install=$root }
  $result = Initialize-FitStoreBackupStorage -Paths $paths -State $state
  if ($result -ne $local -or $state.backupPath -ne $local) { throw "3h7: destino anterior bloquea migracion privada." }
  if ($script:notes.Count -ne 1 -or $script:notes[0].Level -ne "AVISO") { throw "3h7: problema del destino anterior no informado." }
  if (-not ([IO.File]::GetAccessControl((Join-Path $local "FitStore_local.dump"), [Security.AccessControl.AccessControlSections]::Access)).AreAccessRulesProtected) { throw "3h7: archivo local pierde proteccion." }
  if ([IO.File]::ReadAllText((Join-Path $script:old "FitStore_old.dump")) -ne "old-content") { throw "3h7: copia anterior modificada." }
  Write-Host "PASS 3h7: USB/red fallida avisa y permite migracion al destino local protegido."
  $state.backupPath = Join-Path $root "usb-not-mounted"
  Initialize-FitStoreBackupStorage -Paths $paths -State $state | Out-Null
  if ($state.backupPath -ne $local -or $script:notes.Count -ne 2) { throw "3h7: destino desconectado bloqueado o sin aviso." }
  Write-Host "PASS 3h7: destino ausente se migra con aviso, sin inventar reproteccion."
  $script:failLocal = $true
  $failed = $false
  try { Initialize-FitStoreBackupStorage -Paths $paths -State $state | Out-Null } catch { $failed = $_.Exception.Message -eq "ACL local no disponible" }
  if (-not $failed) { throw "3h7: se oculto el fallo de ACL del destino local." }
  Write-Host "PASS 3h7: fallo del destino local sigue bloqueando la operacion."
} finally {
  if ([IO.Directory]::Exists($root)) {
    foreach ($file in Get-ChildItem -LiteralPath $root -File -Recurse) {
      $acl = [IO.File]::GetAccessControl($file.FullName, [Security.AccessControl.AccessControlSections]::Access)
      $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), "FullControl", "Allow"))
      [IO.File]::SetAccessControl($file.FullName, $acl)
    }
    foreach ($directory in Get-ChildItem -LiteralPath $root -Directory -Recurse) {
      $acl = [IO.Directory]::GetAccessControl($directory.FullName, [Security.AccessControl.AccessControlSections]::Access)
      $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), "FullControl", "ContainerInherit, ObjectInherit", "None", "Allow"))
      [IO.Directory]::SetAccessControl($directory.FullName, $acl)
    }
    [IO.Directory]::Delete($root, $true)
  }
}
