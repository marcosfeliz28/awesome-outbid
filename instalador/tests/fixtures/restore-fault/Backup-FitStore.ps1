param(
  [string]$InstallDir,
  [string]$Motivo
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$archive = Join-Path $env:FITSTORE_RESTORE_FIXTURE_ROOT "safety.dump"
[IO.File]::WriteAllText($archive, "active database safety backup", [Text.UTF8Encoding]::new($false))
[IO.File]::AppendAllText(
  $env:FITSTORE_RESTORE_FIXTURE_LOG,
  "safety-backup" + [Environment]::NewLine,
  [Text.UTF8Encoding]::new($false)
)
Write-Output $archive
