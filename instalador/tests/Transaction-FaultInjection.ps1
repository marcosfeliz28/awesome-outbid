Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")

function Assert-Equal([string]$Expected, [string]$Actual, [string]$Scenario) {
  if ($Expected -cne $Actual) { throw "$Scenario esperaba '$Expected' y recibió '$Actual'." }
}

$root = Join-Path ([IO.Path]::GetTempPath()) ("fitstore-update-faults-" + [Guid]::NewGuid().ToString("N"))
$active = Join-Path $root "active"
$snapshot = Join-Path $root "snapshot"
$failed = Join-Path $root "failed-install"
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  [IO.Directory]::CreateDirectory($active) | Out-Null
  Assert-Equal "restart-previous" (Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "prepared-copy-pending") "fallo antes del staging"

  [IO.Directory]::CreateDirectory($snapshot) | Out-Null
  Assert-Equal "restore-snapshot" (Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "snapshot-ready") "fallo durante la extracción"
  $verifiedRejected = $false
  try { Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "verified" } catch { $verifiedRejected = $true }
  if (-not $verifiedRejected) { throw "Una version verificada autoriza restaurar una base antigua." }

  [IO.Directory]::Move($active, $failed)
  Assert-Equal "restore-snapshot" (Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "rollback-files-moving") "corte después de preservar la instalación fallida"

  [IO.Directory]::Move($snapshot, $active)
  Assert-Equal "resume-rollback" (Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "rollback-files-moving") "corte después de restaurar archivos y antes de persistir la fase"

  $rejected = $false
  try { [void](Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "migrating") } catch { $rejected = $true }
  if (-not $rejected) { throw "La ausencia de snapshot durante migrating no fue rechazada." }

  Assert-Equal "resume-rollback" (Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "rollback-files-restored") "fallo durante rollback"
  $verifiedRejected = $false
  try { Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "verified" } catch { $verifiedRejected = $true }
  if (-not $verifiedRejected) { throw "La limpieza incompleta autoriza rollback destructivo." }

  [IO.Directory]::Delete($active, $true)
  $missingBothRejected = $false
  try { [void](Get-FitStoreUpdateRecoveryAction -InstallPath $active -SnapshotPath $snapshot -Phase "snapshot-ready") } catch { $missingBothRejected = $true }
  if (-not $missingBothRejected) { throw "La pérdida simultánea de instalación y snapshot no fue rechazada." }
} finally {
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}

Write-Host "Inyeccion de fallos correcta: 9 estados de actualizacion protegidos."
