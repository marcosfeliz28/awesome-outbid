Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-backup-acl-" + [Guid]::NewGuid().ToString("N"))
$file = Join-Path $root "fixture.dump"
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  [IO.File]::WriteAllText($file, "local-fixture-original")
  $acl = Get-Acl -LiteralPath $file
  $everyone = [Security.Principal.SecurityIdentifier]::new("S-1-1-0")
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, "Read", "Allow"))
  Set-Acl -LiteralPath $file -AclObject $acl
  if (Get-Command Protect-FitStoreBackupFile -ErrorAction SilentlyContinue) {
    Protect-FitStoreBackupFile -Path $file
  } else {
    Protect-FitStoreFile -Path $file
  }
  $actual = Get-Acl -LiteralPath $file
  if (-not $actual.AreAccessRulesProtected) { throw "W2: el respaldo hereda permisos publicos." }
  $creator = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $allowed = @("S-1-5-18", "S-1-5-32-544", $creator)
  foreach ($rule in $actual.Access) {
    $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    if ($sid -notin $allowed) { throw "W2: permiso ajeno al respaldo: $sid" }
  }
  if ([IO.File]::ReadAllText($file) -cne "local-fixture-original") { throw "W2: contenido modificado." }
  Write-Host "PASS W2: ACL real sin Everyone/Users, sin herencia y contenido intacto."
  Protect-FitStoreBackupDirectory -Path $root
  $private = Join-Path $root "new.dump"
  New-FitStoreBackupFile -Path $private
  [IO.File]::WriteAllText($private, "new-local-fixture")
  if (-not (Get-Acl -LiteralPath $private).AreAccessRulesProtected) { throw "W2: archivo nuevo sin ACL protegida." }
  $duplicateRejected = $false
  try { New-FitStoreBackupFile -Path $private } catch { $duplicateRejected = $true }
  if (-not $duplicateRejected -or [IO.File]::ReadAllText($private) -cne "new-local-fixture") { throw "W2: sobrescribio una copia existente." }
  Write-Host "PASS W2: archivo nuevo privado y rechazo de sobrescritura."
  $creation = (Get-Command New-FitStoreBackupFile).Definition
  if ($creation -notmatch '\[IO.File\]::Create\(.*\$acl' -or $creation -match 'Protect-FitStoreBackupFile') { throw "A4: archivo creado antes de aplicar su ACL." }
  $old = Join-Path $root "legacy"
  $target = Join-Path $root "private"
  [IO.Directory]::CreateDirectory($old) | Out-Null
  [IO.Directory]::CreateDirectory($target) | Out-Null
  $legacy = Join-Path $old "FitStore_old.dump"
  [IO.File]::WriteAllText($legacy, "original-old-copy")
  $acl = Get-Acl $legacy
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($everyone, "FullControl", "Allow"))
  Set-Acl -LiteralPath $legacy -AclObject $acl
  $state = [pscustomobject]@{ backupPath=$old }
  $paths = [pscustomobject]@{ LocalBackups=$target }
  $chosen = Initialize-FitStoreBackupStorage -Paths $paths -State $state
  if ($chosen -ne $target -or $state.backupPath -ne $target) { throw "A4: destino antiguo permanece activo." }
  if ([IO.File]::ReadAllText($legacy) -cne "original-old-copy") { throw "A4: respaldo antiguo alterado." }
  foreach ($rule in (Get-Acl $legacy).Access) {
    if ($rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed) { throw "A4: respaldo antiguo sigue publico." }
  }
  Write-Host "PASS A4: destino privado migrado, copia antigua intacta y reprotegida."
} finally {
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
