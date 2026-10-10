param([string]$RecoverySource = (Join-Path $PSScriptRoot '..\scripts\Recover-FitStoreUpdate.ps1'))
$ErrorActionPreference = 'Stop'
. $RecoverySource -DefinitionsOnly
if (-not (Get-Command Assert-FitStoreRecoveryWorkingDirectory -ErrorAction SilentlyContinue)) { throw '3h4: recuperacion no rechaza directorio actual dentro de instalacion.' }
$fixture = Join-Path $env:TEMP ('nexora-cwd-' + [guid]::NewGuid().ToString('N'))
$install = Join-Path $fixture 'installation'
$inside = Join-Path $install 'scripts'
New-Item -ItemType Directory -Path $inside -Force | Out-Null
$original = Get-Location
try {
  foreach ($path in @($install, $inside)) {
    Set-Location -LiteralPath $path
    $rejected = $false
    try { Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install } catch { $rejected = $_.Exception.Message -like '*directorio actual*' }
    if (-not $rejected) { throw '3h4: directorio instalado no fue rechazado.' }
  }
  Write-Host 'PASS 3h4: raiz y subdirectorio instalados rechazados antes de restaurar.'
  Set-Location -LiteralPath $fixture
  Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install
  $sibling = $install + '-external'
  New-Item -ItemType Directory -Path $sibling | Out-Null
  Set-Location -LiteralPath $sibling
  Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install
  Write-Host 'PASS 3h4: carpeta externa y prefijo hermano permitidos.'
  $source = Get-Content -LiteralPath $RecoverySource -Raw
  if ($source.IndexOf('Assert-FitStoreRecoveryWorkingDirectory -InstallDir $paths.Install') -gt $source.IndexOf('$marker = Get-FitStoreUpdateMarker')) { throw '3h4: comprobacion tardia.' }
  Write-Host 'PASS 3h4: comprobacion anterior a marcador y rollback.'
} finally {
  Set-Location -LiteralPath $original.Path
  Remove-Item -LiteralPath $fixture -Recurse -Force
}
