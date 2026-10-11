Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [Parameter(Mandatory = $true)][string]$Message)
  if (-not $Condition) { throw $Message }
}

function Find-EventIndex {
  param([string[]]$Events, [string]$Prefix, [int]$After = -1)
  for ($index = $After + 1; $index -lt $Events.Count; $index++) {
    if ($Events[$index].StartsWith($Prefix, [StringComparison]::Ordinal)) { return $index }
  }
  return -1
}

$installerRoot = Split-Path -Parent $PSScriptRoot
$productionRestore = Join-Path $installerRoot "scripts\Restore-FitStore.ps1"
$fixtureSource = Join-Path $PSScriptRoot "fixtures\restore-fault"
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ("fitstore-restore-fault-" + [Guid]::NewGuid().ToString("N"))
$fixtureScripts = Join-Path $testRoot "scripts"
$log = Join-Path $testRoot "events.log"
$activeDatabase = Join-Path $testRoot "active-database"
$activeSentinel = Join-Path $activeDatabase "ACTIVE-SENTINEL.txt"
$requestedBackup = Join-Path $testRoot "requested.dump"
$previousRoot = $env:FITSTORE_RESTORE_FIXTURE_ROOT
$previousLog = $env:FITSTORE_RESTORE_FIXTURE_LOG

try {
  [IO.Directory]::CreateDirectory($fixtureScripts) | Out-Null
  [IO.Directory]::CreateDirectory($activeDatabase) | Out-Null
  Copy-Item -LiteralPath $productionRestore -Destination (Join-Path $fixtureScripts "Restore-FitStore.ps1")
  Copy-Item -LiteralPath (Join-Path $fixtureSource "FitStore.Common.ps1") -Destination $fixtureScripts
  # Simulate only the process boundary; use the production password/SQL helpers.
  $tokens = $null; $parseErrors = $null
  $commonAst = [Management.Automation.Language.Parser]::ParseFile((Join-Path $installerRoot 'scripts/FitStore.Common.ps1'), [ref]$tokens, [ref]$parseErrors)
  if ($parseErrors.Count) { throw 'Production Common did not parse.' }
  foreach ($name in @('Invoke-FitStorePg', 'Invoke-FitStorePgSql')) {
    $definition = $commonAst.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if (-not $definition) { throw "Missing real helper $name" }
    [IO.File]::AppendAllText((Join-Path $fixtureScripts 'FitStore.Common.ps1'), "`r`n" + $definition.Extent.Text, [Text.UTF8Encoding]::new($false))
  }
  Copy-Item -LiteralPath (Join-Path $fixtureSource "Backup-FitStore.ps1") -Destination $fixtureScripts
  [IO.File]::WriteAllText($activeSentinel, "ACTIVE DATABASE MUST REMAIN UNCHANGED", [Text.UTF8Encoding]::new($false))
  [IO.File]::WriteAllText($requestedBackup, "requested fixture dump", [Text.UTF8Encoding]::new($false))
  $sentinelBytes = [Convert]::ToBase64String([IO.File]::ReadAllBytes($activeSentinel))

  $env:FITSTORE_RESTORE_FIXTURE_ROOT = $testRoot
  $env:FITSTORE_RESTORE_FIXTURE_LOG = $log
  $powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $savedErrorPreference = $ErrorActionPreference
  try {
    $ErrorActionPreference = "Continue"
    $childOutput = @(& $powerShell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File (Join-Path $fixtureScripts "Restore-FitStore.ps1") -InstallDir (Join-Path $testRoot "install") -Respaldo $requestedBackup -Confirmar 2>&1)
    $childExitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $savedErrorPreference
  }

  Assert-True ($childExitCode -ne 0) "El fallo inyectado no hizo fallar la restauración."
  Assert-True (($childOutput -join "`n") -match "La base activa no cambió") "La restauración no confirmó que la base activa quedó intacta."
  Assert-True ([Convert]::ToBase64String([IO.File]::ReadAllBytes($activeSentinel)) -eq $sentinelBytes) "La base activa simulada fue modificada."

  $events = @(Get-Content -LiteralPath $log -Encoding UTF8)
  $cursor = -1
  foreach ($prefix in @(
      "stop-application",
      "safety-backup",
      "create-temp:",
      "restore-temp:",
      "migrate-temp:",
      "validate-temp:",
      "validate-temp:",
      "validate-temp:",
      "dump-validated:",
      "terminate-active",
      "active-restore-attempt",
      "start-application",
      "drop-temp:"
    )) {
    $cursor = Find-EventIndex -Events $events -Prefix $prefix -After $cursor
    Assert-True ($cursor -ge 0) "Falta o está fuera de orden el evento de restauración: $prefix"
  }
  Assert-True (-not ($events -contains "active-restore-committed")) "La restauración activa simulada llegó a commit."
  Assert-True (@(Get-ChildItem -LiteralPath $testRoot -Filter "temp-db-*.marker" -File -ErrorAction SilentlyContinue).Count -eq 0) "La base temporal simulada no fue eliminada."
  $restoreRoot = Join-Path $testRoot "work\restore"
  Assert-True (-not (Test-Path -LiteralPath $restoreRoot) -or @(Get-ChildItem -LiteralPath $restoreRoot -Force).Count -eq 0) "El directorio temporal de restauración no quedó limpio."

  Write-Host "Fault injection de restauración correcta: base activa intacta y temporales eliminados."
} finally {
  if ($null -eq $previousRoot) { Remove-Item Env:FITSTORE_RESTORE_FIXTURE_ROOT -ErrorAction SilentlyContinue } else { $env:FITSTORE_RESTORE_FIXTURE_ROOT = $previousRoot }
  if ($null -eq $previousLog) { Remove-Item Env:FITSTORE_RESTORE_FIXTURE_LOG -ErrorAction SilentlyContinue } else { $env:FITSTORE_RESTORE_FIXTURE_LOG = $previousLog }
  if ([IO.Directory]::Exists($testRoot)) { Remove-Item -LiteralPath $testRoot -Recurse -Force }
}
