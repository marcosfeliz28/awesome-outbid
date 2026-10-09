Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-reader-acl-" + [Guid]::NewGuid().ToString("N"))
$reader = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $file = Join-Path $root "FitStore_reader.dump"
  [IO.File]::WriteAllText($file, "fixture")
  $script:BackupReaderSid = $reader
  Protect-FitStoreBackupFile -Path $file
  $rules = @((Get-Acl -LiteralPath $file).Access | Where-Object { $_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $reader })
  if ($rules.Count -ne 1 -or ($rules[0].FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write) -ne 0) { throw "A5: usuario normal tiene escritura en respaldo." }
  if ([IO.File]::ReadAllText($file) -ne "fixture") { throw "A5: usuario de OneDrive no puede leer copia." }
  Write-Host "PASS A5: SID real de usuario con lectura, sin escritura ni grupos publicos."
} finally {
  if ([IO.Directory]::Exists($root)) {
    foreach ($entry in Get-ChildItem -LiteralPath $root -File) {
      $acl = [IO.File]::GetAccessControl($entry.FullName, [Security.AccessControl.AccessControlSections]::Access)
      $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), "FullControl", "Allow"))
      [IO.File]::SetAccessControl($entry.FullName, $acl)
    }
    [IO.Directory]::Delete($root, $true)
  }
}
