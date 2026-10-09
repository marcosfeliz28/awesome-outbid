Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$scriptPath = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\Rollback-FitStoreUpdate.ps1"
$source = Get-Content -LiteralPath $scriptPath -Raw
$start = $source.IndexOf("Assert-FitStoreAdministrator`r`n")
if ($start -lt 0) { $start = $source.IndexOf("Assert-FitStoreAdministrator`n") }
$end = $source.IndexOf('foreach ($property', $start)
$bootstrap = [scriptblock]::Create($source.Substring($start, $end - $start))
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
function Assert-FitStoreAdministrator { }
function Get-FitStorePaths { return $script:fixturePaths }
function Get-FitStoreUpdateMarker { return $script:marker }
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-stale-update-" + [Guid]::NewGuid().ToString("N"))
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $script:marker = Join-Path $root "marker.json"
  $sales = Join-Path $root "sales-after-update.fixture"
  [IO.File]::WriteAllText($sales, "new-sale-unchanged")
  $script:fixturePaths = [pscustomobject]@{ Install=$root }
  $InstallDir = $root
  $InstallerSession = "current-run"
  [IO.File]::WriteAllText($script:marker, '{"installerSession":"old-run","phase":"migrating"}')
  $rejected = $false
  try { & $bootstrap } catch { $rejected = $true }
  if (-not $rejected) { throw "W4: un marcador viejo autoriza rollback sobre ventas posteriores." }
  if ([IO.File]::ReadAllText($sales) -cne "new-sale-unchanged") { throw "W4: ventas posteriores modificadas." }
  Write-Host "PASS W4: marcador de otra ejecucion rechazado y ventas intactas."
  [IO.File]::WriteAllText($script:marker, '{"installerSession":"current-run","phase":"migrating"}')
  & $bootstrap
  Write-Host "PASS W4: transaccion activa de la misma ejecucion autorizada."
  [IO.File]::WriteAllText($script:marker, '{"installerSession":"current-run","phase":"verified"}')
  $rejected = $false
  try { & $bootstrap } catch { $rejected = $true }
  if (-not $rejected) { throw "W4: transaccion verificada autoriza rollback tardio." }
  Write-Host "PASS W4: transaccion completada rechazada sin rollback."
} finally { if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) } }
