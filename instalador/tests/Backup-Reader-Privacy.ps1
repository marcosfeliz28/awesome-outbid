param([switch]$InjectPublicAccess)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-reader-acl-" + [Guid]::NewGuid().ToString("N"))
$reader = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $file = Join-Path $root "FitStore_reader.dump"
  [IO.File]::WriteAllText($file, "fixture")
  # Datos hostiles reales: Users y Everyone explicitos en archivo/carpeta.
  foreach ($publicSid in @("S-1-1-0", "S-1-5-32-545")) {
    $acl = [IO.File]::GetAccessControl($file, [Security.AccessControl.AccessControlSections]::Access)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($publicSid), "FullControl", "Allow"))
    [IO.File]::SetAccessControl($file, $acl)
    $directoryAcl = [IO.Directory]::GetAccessControl($root, [Security.AccessControl.AccessControlSections]::Access)
    $directoryAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($publicSid), "FullControl", "ContainerInherit, ObjectInherit", "None", "Allow"))
    [IO.Directory]::SetAccessControl($root, $directoryAcl)
  }
  $script:BackupReaderSid = $reader
  Protect-FitStoreBackupFile -Path $file
  Protect-FitStoreBackupDirectory -Path $root
  if ($InjectPublicAccess) {
    $acl = [IO.File]::GetAccessControl($file, [Security.AccessControl.AccessControlSections]::Access)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new("S-1-1-0"), "Read", "Allow"))
    [IO.File]::SetAccessControl($file, $acl)
  }
  foreach ($actual in @([IO.File]::GetAccessControl($file, [Security.AccessControl.AccessControlSections]::Access), [IO.Directory]::GetAccessControl($root, [Security.AccessControl.AccessControlSections]::Access))) {
    if (-not $actual.AreAccessRulesProtected) { throw "3h8: respaldo hereda permisos publicos." }
    foreach ($rule in $actual.Access) {
      $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
      if ($sid -notin @("S-1-5-18", "S-1-5-32-544", $reader)) { throw "3h8: Users/Everyone u otra cuenta tiene acceso: $sid" }
    }
  }
  $rules = @((Get-Acl -LiteralPath $file).Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $reader })
  if ($rules.Count -ne 1 -or ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write) -ne 0) { throw "A5: usuario normal tiene escritura en respaldo." }
  if ([IO.File]::ReadAllText($file) -ne "fixture") { throw "A5: usuario de OneDrive no puede leer copia." }
  Write-Host "PASS A5: SID real de usuario con lectura, sin escritura ni grupos publicos."
} finally {
  if ([IO.Directory]::Exists($root)) {
    $directoryAcl = [IO.Directory]::GetAccessControl($root, [Security.AccessControl.AccessControlSections]::Access)
    $directoryAcl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), "FullControl", "ContainerInherit, ObjectInherit", "None", "Allow"))
    [IO.Directory]::SetAccessControl($root, $directoryAcl)
    foreach ($entry in Get-ChildItem -LiteralPath $root -File) {
      $acl = [IO.File]::GetAccessControl($entry.FullName, [Security.AccessControl.AccessControlSections]::Access)
      $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), "FullControl", "Allow"))
      [IO.File]::SetAccessControl($entry.FullName, $acl)
    }
    [IO.Directory]::Delete($root, $true)
  }
}
