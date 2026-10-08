param([string]$InstallDir)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$common = Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1"
. $common

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$secrets = Read-FitStoreJson -Path $paths.Secrets
$backupScript = Join-Path $paths.Scripts "Backup-FitStore.ps1"
$output = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $backupScript -InstallDir $paths.Install -Destino $paths.LocalBackups -Motivo "prueba-restauracion")
if ($LASTEXITCODE -ne 0) { throw "Falló la creación del respaldo de prueba." }
$archive = $output | Select-Object -Last 1
$testDatabase = "fitstore_restore_test_" + [Guid]::NewGuid().ToString("N").Substring(0, 10)
$createdb = Join-Path $paths.PgBin "createdb.exe"
$dropdb = Join-Path $paths.PgBin "dropdb.exe"
$pgRestore = Join-Path $paths.PgBin "pg_restore.exe"
$psql = Join-Path $paths.PgBin "psql.exe"

try {
  Invoke-FitStorePg -Tool $createdb -Password ([string]$secrets.postgresPassword) -Arguments @("--host=127.0.0.1", "--port=5434", "--username=postgres", "--owner=fitstore", $testDatabase) -FailureMessage "No se pudo crear la base aislada de prueba"
  Invoke-FitStorePg -Tool $pgRestore -Password ([string]$secrets.databasePassword) -Arguments @("--host=127.0.0.1", "--port=5434", "--username=fitstore", "--dbname=$testDatabase", "--no-owner", "--no-privileges", "--exit-on-error", $archive) -FailureMessage "No se pudo restaurar la base aislada"
  $query = "SELECT (SELECT count(*) FROM `"User`")::text || '|' || (SELECT count(*) FROM `"Sale`")::text || '|' || (SELECT count(*) FROM _prisma_migrations)::text;"
  $previous = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = [string]$secrets.databasePassword
    $production = (& $psql "--host=127.0.0.1" "--port=5434" "--username=fitstore" "--dbname=fitstore" "--tuples-only" "--no-align" "--command=$query").Trim()
    if ($LASTEXITCODE -ne 0) { throw "No se pudo leer la base activa para comparar." }
    $restored = (& $psql "--host=127.0.0.1" "--port=5434" "--username=fitstore" "--dbname=$testDatabase" "--tuples-only" "--no-align" "--command=$query").Trim()
    if ($LASTEXITCODE -ne 0) { throw "No se pudo leer la base restaurada para comparar." }
  } finally {
    if ($null -eq $previous) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previous }
  }
  if ($production -ne $restored) { throw "Los conteos de usuarios, ventas o migraciones no coinciden: activa=$production restaurada=$restored" }
  & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File (Join-Path $paths.Scripts "Verify-FitStore.ps1") -InstallDir $paths.Install
  if ($LASTEXITCODE -ne 0) { throw "La verificación operativa no pasó." }
  Write-Host "PRUEBA WINDOWS CORRECTA: respaldo, restauración aislada, conteos, servicios, HTTPS y firewall."
} finally {
  Invoke-FitStorePg -Tool $dropdb -Password ([string]$secrets.postgresPassword) -Arguments @("--host=127.0.0.1", "--port=5434", "--username=postgres", "--force", "--if-exists", $testDatabase) -FailureMessage "No se pudo retirar la base aislada de prueba"
}
