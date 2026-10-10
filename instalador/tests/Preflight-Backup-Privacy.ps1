Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-preflight-private-" + [Guid]::NewGuid().ToString("N"))
$reader = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$state = [pscustomobject]@{ backupReaderSid = $reader }
$paths = [pscustomobject]@{ LocalBackups = (Join-Path $root 'private'); Install = $root }
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $backup = Join-Path $root "FitStore_old.dump"
  [IO.File]::WriteAllText($backup, 'old-backup-fixture')
  $fixtureHash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant()
  foreach ($file in @($backup, "$backup.sha256", "$backup.json")) {
    $fixtureContent = if ($file -eq "$backup.sha256") { "$fixtureHash *FitStore_old.dump" } else { 'old-backup-fixture' }
    [IO.File]::WriteAllText($file, $fixtureContent)
    $acl = [IO.File]::GetAccessControl($file, [Security.AccessControl.AccessControlSections]::Access)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new("S-1-1-0"), "Read", "Allow"))
    [IO.File]::SetAccessControl($file, $acl)
  }
  $source = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\Preflight-FitStore.ps1") -Raw
  $start = $source.IndexOf('$backup = $output | Select-Object -Last 1')
  $end = $source.IndexOf('$backupHash =', $start)
  $output = @($backup)
  & ([scriptblock]::Create($source.Substring($start, $end - $start)))
  foreach ($file in @($backup, "$backup.sha256", "$backup.json")) {
    $acl = [IO.File]::GetAccessControl($file, [Security.AccessControl.AccessControlSections]::Access)
    if (-not $acl.AreAccessRulesProtected) { throw "3h6: respaldo previo hereda permisos publicos." }
    foreach ($rule in $acl.Access) {
      $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
      if ($sid -notin @("S-1-5-18", "S-1-5-32-544", $reader)) { throw "3h6: respaldo previo publico: $sid" }
    }
    $expectedContent = if ($file -eq "$backup.sha256") { "$fixtureHash *FitStore_old.dump" } else { 'old-backup-fixture' }
    if ([IO.File]::ReadAllText($file) -cne $expectedContent) { throw "3h6: contenido de copia alterado." }
  }
  Write-Host "PASS 3h6: dump, SHA256 y JSON del respaldo previo privados e intactos antes del hash."
} finally {
  if ([IO.Directory]::Exists($root)) {
    foreach ($file in Get-ChildItem -LiteralPath $root -File) {
      $acl = [IO.File]::GetAccessControl($file.FullName, [Security.AccessControl.AccessControlSections]::Access)
      $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), "FullControl", "Allow"))
      [IO.File]::SetAccessControl($file.FullName, $acl)
    }
    [IO.Directory]::Delete($root, $true)
  }
}
