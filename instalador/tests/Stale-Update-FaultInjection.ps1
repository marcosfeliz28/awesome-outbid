param([switch]$DisableSessionGuardForMutation)
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\Rollback-FitStoreUpdate.ps1"
$source = Get-Content -LiteralPath $scriptPath -Raw
$start = $source.IndexOf("Assert-FitStoreAdministrator`r`n")
if ($start -lt 0) { $start = $source.IndexOf("Assert-FitStoreAdministrator`n") }
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw "A7: rollback no parsea." }
foreach ($fn in $ast.FindAll({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] }, $false)) {
  . ([scriptblock]::Create($fn.Extent.Text))
}
$body = $source.Substring($start)
if ($DisableSessionGuardForMutation) {
  $guard = $ast.FindAll({ param($n) $n -is [Management.Automation.Language.IfStatementAst] -and $n.Extent.Text.Contains('installerSession') -and $n.Extent.Text.Contains('ya fue verificada') }, $true) | Select-Object -First 1
  if (-not $guard) { throw "A7: guarda no encontrada." }
  $body = $body.Replace($guard.Extent.Text, '')
}
$rollback = [scriptblock]::Create($body)
function Assert-FitStoreAdministrator { }
function Get-FitStorePaths { return $script:fixturePaths }
function Get-FitStoreUpdateMarker { return $script:marker }
function Assert-FitStoreSafeUpdatePath { param($Paths, $Path) return $Path }
function Get-FitStoreUpdateRecoveryAction { return "restore-snapshot" }
function Assert-UpdateManifest { }
function Stop-FitStoreApplication { $script:effects++ }
function Stop-FitStoreService { $script:effects++ }
function Start-FitStoreService { }
function Wait-FitStorePostgres { }
function Set-FitStoreUpdatePhase { }
function Ensure-RestoredApplicationService { return "LocalSystem" }
function Start-FitStoreApplication { }
function Wait-FitStoreHttp { }
function Write-FitStoreLog { }
function Invoke-FitStorePg {
  param($Tool, $Password, $Arguments, $FailureMessage)
  $leaf = [IO.Path]::GetFileName($Tool)
  $script:pgCalls += $leaf
  # El flujo destructivo realmente altera las ventas de la fixture si alcanza
  # psql o pg_restore; el control positivo demuestra que no es un archivo ajeno.
  if ($leaf -eq "psql.exe" -or ($leaf -eq "pg_restore.exe" -and $Arguments -notcontains "--list")) {
    [IO.File]::WriteAllText($script:sales, "overwritten-by-rollback")
  }
}
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-stale-update-" + [Guid]::NewGuid().ToString("N"))
$oldProgramFiles = $env:ProgramFiles
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $env:ProgramFiles = $root
  $script:marker = Join-Path $root "marker.json"
  $script:sales = Join-Path $root "sales-after-update.fixture"
  $script:fixturePaths = [pscustomobject]@{ Install=(Join-Path $root "FitStore POS"); PgBin=$root; Secrets=(Join-Path $root "secrets.fixture.json") }
  [IO.File]::WriteAllText($script:fixturePaths.Secrets, '{"databasePassword":"","postgresPassword":""}')
  $archive = Join-Path $root "prior.dump.fixture"
  [IO.File]::WriteAllText($archive, "synthetic-backup")
  $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
  $InstallDir = $script:fixturePaths.Install
  $InstallerSession = "current-run"
  foreach ($case in @("stale", "verified", "current")) {
    $transactionPath = Join-Path $root ("transaction-" + $case)
    $snapshot = Join-Path $transactionPath "snapshot"
    [IO.Directory]::CreateDirectory($snapshot) | Out-Null
    [IO.Directory]::CreateDirectory($InstallDir) | Out-Null
    [IO.File]::WriteAllText((Join-Path $snapshot "prior-version.fixture"), "old-version")
    [IO.File]::WriteAllText($script:sales, "new-sale-unchanged")
    $script:pgCalls = @(); $script:effects = 0
    $transaction = @{ installerSession="current-run"; phase="migrating"; installDir=$InstallDir; transactionPath=$transactionPath; snapshotPath=$snapshot; manifestPath="fixture-manifest"; manifestSha256="fixture-hash"; backup=$archive; backupSha256=$hash }
    if ($case -eq "stale") { $transaction.installerSession = "old-run" }
    if ($case -eq "verified") { $transaction.phase = "verified" }
    [IO.File]::WriteAllText($script:marker, ($transaction | ConvertTo-Json))
    $failure = $null
    try { & $rollback } catch { $failure = $_ }
    if ($case -ne "current") {
      if (-not $failure -or $failure.Exception.Message -notmatch "no pertenece") { throw "A7: $case no rechazo por sesion/fase antes de restaurar." }
      if ($script:effects -ne 0 -or $script:pgCalls.Count -ne 0 -or [IO.File]::ReadAllText($script:sales) -cne "new-sale-unchanged") { throw "A7: $case alcanzo servicios/PostgreSQL y piso ventas." }
      Write-Host "PASS A7: $case rechazado; cero servicios/psql/pg_restore y ventas intactas."
    } else {
      if ($failure) { throw $failure }
      if ($script:pgCalls.Count -ne 3 -or $script:pgCalls -notcontains "psql.exe" -or [IO.File]::ReadAllText($script:sales) -cne "overwritten-by-rollback") { throw "A7: control positivo no alcanzo restore completo con mock destructivo." }
      Write-Host "PASS A7: sesion actual ejecuto rollback completo; psql y pg_restore cambiaron fixture de ventas."
    }
  }
} finally {
  $env:ProgramFiles = $oldProgramFiles
  # Directorio temporal concreto creado arriba, nunca una instalacion real.
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
