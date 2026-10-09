Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$installer = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\Install-FitStore.ps1"
$source = Get-Content -LiteralPath $installer -Raw
$start = $source.IndexOf("Assert-FitStoreAdministrator`r`n")
if ($start -lt 0) { $start = $source.IndexOf("Assert-FitStoreAdministrator`n") }
$end = $source.IndexOf('$requiredFiles = @(', $start)
if ($start -lt 0 -or $end -lt 0) { throw "No se encontró el arranque del instalador." }
$bootstrap = [scriptblock]::Create($source.Substring($start, $end - $start))
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
function Assert-FitStoreAdministrator { }
function Read-SetupIni { return @{} }
function Get-FitStorePaths { return $script:fixturePaths }
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-fresh-fault-" + [Guid]::NewGuid().ToString("N"))
$InstallDir = $root
$RespuestaPath = Join-Path $root "answer.ini"
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $script:fixturePaths = [pscustomobject]@{
    State = Join-Path $root "state.json"
    Secrets = Join-Path $root "secrets.json"
    Database = Join-Path $root "database"
  }
  foreach ($scenario in @("secret-without-state", "cluster-without-state", "partial-cluster-without-state")) {
    if (Test-Path -LiteralPath $script:fixturePaths.Secrets) { [IO.File]::Delete($script:fixturePaths.Secrets) }
    if (Test-Path -LiteralPath $script:fixturePaths.Database) { [IO.Directory]::Delete($script:fixturePaths.Database, $true) }
    if ($scenario -eq "secret-without-state") {
      [IO.File]::WriteAllText($script:fixturePaths.Secrets, '{"marker":"original-local-fixture"}')
    } else {
      [IO.Directory]::CreateDirectory($script:fixturePaths.Database) | Out-Null
      $file = if ($scenario -eq "cluster-without-state") { "PG_VERSION" } else { "postgresql.conf" }
      [IO.File]::WriteAllText((Join-Path $script:fixturePaths.Database $file), "original-local-fixture")
    }
    $rejected = $false
    try { & $bootstrap } catch {
      if ($_.Exception.Message -notlike "*Se encontraron datos anteriores*") { throw }
      $rejected = $true
    }
    if (-not $rejected) { throw "W1: $scenario permite una instalación nueva sobre datos existentes." }
    if ($scenario -eq "secret-without-state" -and [IO.File]::ReadAllText($script:fixturePaths.Secrets) -cne '{"marker":"original-local-fixture"}') { throw "W1: se modificó el secreto original." }
    if ($scenario -ne "secret-without-state" -and [IO.File]::ReadAllText((Join-Path $script:fixturePaths.Database $file)) -cne "original-local-fixture") { throw "W1: se modificó el archivo original de PostgreSQL." }
    Write-Host "PASS W1: $scenario rechazado sin modificar datos."
  }
  [IO.Directory]::Delete($script:fixturePaths.Database, $true)
  [IO.Directory]::CreateDirectory($script:fixturePaths.Database) | Out-Null
  & $bootstrap
  Write-Host "PASS W1: carpeta vacía permite instalación nueva."
} finally {
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
