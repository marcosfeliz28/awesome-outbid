param(
  [string]$InstallDir,
  [string]$Respaldo,
  [switch]$Confirmar
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

function Select-BackupFile {
  Add-Type -AssemblyName System.Windows.Forms
  $dialog = New-Object System.Windows.Forms.OpenFileDialog
  $dialog.Title = "Selecciona un respaldo de FitStore POS"
  $dialog.Filter = "Respaldos FitStore (*.dump)|*.dump|Todos los archivos (*.*)|*.*"
  $dialog.CheckFileExists = $true
  if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return $null }
  return $dialog.FileName
}

function Assert-BackupIntegrity {
  param([string]$Archive, [string]$PgRestore)
  if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { throw "No existe el respaldo seleccionado." }
  $hashFile = "$Archive.sha256"
  if (Test-Path -LiteralPath $hashFile) {
    $expected = ((Get-Content -LiteralPath $hashFile -Raw).Trim() -split "\s+")[0].ToLowerInvariant()
    $actual = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($expected -ne $actual) { throw "El SHA-256 no coincide. El respaldo puede estar dañado o incompleto." }
  }
  $stdout = [IO.Path]::GetTempFileName()
  $stderr = [IO.Path]::GetTempFileName()
  try {
    $process = Start-Process -FilePath $PgRestore -ArgumentList @("--list", "`"$Archive`"") -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if ($process.ExitCode -ne 0 -or (Get-Item -LiteralPath $stdout).Length -eq 0) {
      throw "PostgreSQL no reconoce el archivo como un respaldo válido."
    }
  } finally {
    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
  }
}

function Close-FitStoreDatabaseConnections {
  param($Paths, $Secrets, [string]$Database = "fitstore")
  Invoke-FitStorePg `
    -Tool (Join-Path $Paths.PgBin "psql.exe") `
    -Password ([string]$Secrets.postgresPassword) `
    -Arguments @(
      "--host=127.0.0.1",
      "--port=5434",
      "--username=postgres",
      "--dbname=postgres",
      "--no-password",
      "--command=SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$Database' AND pid <> pg_backend_pid();"
    ) `
    -FailureMessage "No se pudieron cerrar las conexiones a $Database"
}

function Restore-ArchiveAtomically {
  param($Paths, $Secrets, [string]$Archive)
  Close-FitStoreDatabaseConnections -Paths $Paths -Secrets $Secrets -Database "fitstore"
  Invoke-FitStorePg `
    -Tool (Join-Path $Paths.PgBin "pg_restore.exe") `
    -Password ([string]$Secrets.databasePassword) `
    -Arguments @(
      "--host=127.0.0.1",
      "--port=5434",
      "--username=fitstore",
      "--dbname=fitstore",
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--single-transaction",
      "--exit-on-error",
      $Archive
    ) `
    -FailureMessage "No se pudo reemplazar la base dentro de una transacción"
}

function Test-FitStoreRestoredDatabase {
  param($Paths, $Secrets, [string]$Database)
  foreach ($table in @("_prisma_migrations", "User", "Product")) {
    Invoke-FitStorePg `
      -Tool (Join-Path $Paths.PgBin "psql.exe") `
      -Password ([string]$Secrets.databasePassword) `
      -Arguments @(
        "--host=127.0.0.1",
        "--port=5434",
        "--username=fitstore",
        "--dbname=$Database",
        "--no-password",
        "--command=SELECT count(*) FROM `"$table`";"
      ) `
      -FailureMessage "La base restaurada no contiene la tabla requerida $table"
  }
}

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$secrets = Read-FitStoreJson -Path $paths.Secrets
if (-not $Respaldo) { $Respaldo = Select-BackupFile }
if (-not $Respaldo) { Write-Host "Restauración cancelada."; exit 0 }
$Respaldo = [IO.Path]::GetFullPath($Respaldo)
$pgRestore = Join-Path $paths.PgBin "pg_restore.exe"
Assert-BackupIntegrity -Archive $Respaldo -PgRestore $pgRestore

if (-not $Confirmar) {
  Write-Host ""
  Write-Host "Esta operación reemplazará la base activa por:"
  Write-Host $Respaldo
  Write-Host "Antes se creará un respaldo de seguridad."
  $answer = Read-Host "Escribe RESTAURAR para continuar"
  if ($answer -cne "RESTAURAR") { Write-Host "Restauración cancelada."; exit 0 }
}

$backupScript = Join-Path $paths.Scripts "Backup-FitStore.ps1"
Stop-FitStoreApplication
$applicationStopped = $true
try {
  Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
  Wait-FitStorePostgres -Paths $paths -TimeoutSeconds 90
  $safetyOutput = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $backupScript -InstallDir $paths.Install -Motivo "antes-de-restaurar")
  if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el respaldo de seguridad. No se modificó la base." }
  $safetyBackup = $safetyOutput | Select-Object -Last 1
  if (-not $safetyBackup -or -not (Test-Path -LiteralPath $safetyBackup -PathType Leaf)) {
    throw "No se pudo comprobar el respaldo de seguridad. No se modificó la base."
  }
} catch {
  try { Start-FitStoreApplication } catch {}
  throw
}

$restoreRoot = Join-Path $paths.Work "restore"
$restoreTransaction = Join-Path $restoreRoot ([Guid]::NewGuid().ToString("N"))
New-FitStoreDirectory -Path $restoreTransaction
$validatedArchive = Join-Path $restoreTransaction "validated.dump"
$tempDatabase = "fitstore_restore_" + [Guid]::NewGuid().ToString("N").Substring(0, 12)
$createdb = Join-Path $paths.PgBin "createdb.exe"
$dropdb = Join-Path $paths.PgBin "dropdb.exe"
$pgDump = Join-Path $paths.PgBin "pg_dump.exe"
$activeReplaced = $false
try {
  Invoke-FitStorePg `
    -Tool $createdb `
    -Password ([string]$secrets.postgresPassword) `
    -Arguments @("--host=127.0.0.1", "--port=5434", "--username=postgres", "--owner=fitstore", $tempDatabase) `
    -FailureMessage "No se pudo crear la base temporal de validación"
  Invoke-FitStorePg `
    -Tool $pgRestore `
    -Password ([string]$secrets.databasePassword) `
    -Arguments @(
      "--host=127.0.0.1",
      "--port=5434",
      "--username=fitstore",
      "--dbname=$tempDatabase",
      "--no-owner",
      "--no-privileges",
      "--single-transaction",
      "--exit-on-error",
      $Respaldo
    ) `
    -FailureMessage "No se pudo restaurar el contenido en la base temporal"
  Invoke-FitStoreMigrations -Paths $paths -Secrets $secrets -Database $tempDatabase
  Test-FitStoreRestoredDatabase -Paths $paths -Secrets $secrets -Database $tempDatabase
  Invoke-FitStorePg `
    -Tool $pgDump `
    -Password ([string]$secrets.databasePassword) `
    -Arguments @(
      "--host=127.0.0.1",
      "--port=5434",
      "--username=fitstore",
      "--dbname=$tempDatabase",
      "--format=custom",
      "--compress=6",
      "--no-password",
      "--file=$validatedArchive"
    ) `
    -FailureMessage "No se pudo preparar la copia validada"
  Assert-BackupIntegrity -Archive $validatedArchive -PgRestore $pgRestore

  Restore-ArchiveAtomically -Paths $paths -Secrets $secrets -Archive $validatedArchive
  $activeReplaced = $true
  Start-FitStoreApplication
  Wait-FitStoreHttp -Url "http://127.0.0.1:3001/api/health" -TimeoutSeconds 90
  Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 90
  Write-FitStoreLog -InstallDir $paths.Install -Message "Restauración verificada desde $Respaldo. Respaldo previo: $safetyBackup"
  Write-Host ""
  Write-Host "Restauración terminada correctamente."
  Write-Host "Respaldo previo conservado en: $safetyBackup"
} catch {
  $originalError = $_.Exception.Message
  try { Stop-FitStoreApplication } catch {}
  if ($activeReplaced) {
    $recovered = $false
    $recoveryError = ""
    try {
      Restore-ArchiveAtomically -Paths $paths -Secrets $secrets -Archive $safetyBackup
      Invoke-FitStoreMigrations -Paths $paths -Secrets $secrets
      Start-FitStoreApplication
      Wait-FitStoreHttp -Url "http://127.0.0.1:3001/api/health" -TimeoutSeconds 90
      Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 90
      $recovered = $true
    } catch {
      $recoveryError = $_.Exception.Message
    }
    if ($recovered) {
      Write-FitStoreLog -InstallDir $paths.Install -Level "ERROR" -Message ("La restauración solicitada falló después del reemplazo, pero la base anterior fue recuperada y verificada. " + $originalError)
      throw "La restauración solicitada falló, pero FitStore volvió automáticamente a la base anterior y está operativo. $originalError"
    }
    try { Stop-FitStoreApplication } catch {}
    Write-FitStoreLog -InstallDir $paths.Install -Level "ERROR" -Message ("Fallaron la restauración y su recuperación automática. Respaldo previo: $safetyBackup. Error original: $originalError. Error de recuperación: " + $recoveryError)
    throw "La restauración y la recuperación automática fallaron. FitStore quedó detenido. Conserva: $safetyBackup. $originalError"
  }
  try {
    Start-FitStoreApplication
    Wait-FitStoreHttp -Url "http://127.0.0.1:3001/api/health" -TimeoutSeconds 90
    Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 90
  } catch {
    Write-FitStoreLog -InstallDir $paths.Install -Level "ERROR" -Message ("La copia seleccionada falló antes de reemplazar la base activa, pero no se pudo reabrir la aplicación. " + $_.Exception.Message)
    throw "La base activa no fue reemplazada, pero FitStore no pudo reiniciarse. $originalError"
  }
  Write-FitStoreLog -InstallDir $paths.Install -Level "ERROR" -Message ("La copia seleccionada falló durante la validación aislada. La base activa no fue modificada y FitStore volvió a abrir. " + $originalError)
  throw "La restauración fue rechazada durante su validación aislada. La base activa no cambió y FitStore está operativo. $originalError"
} finally {
  try {
    Invoke-FitStorePg `
      -Tool $dropdb `
      -Password ([string]$secrets.postgresPassword) `
      -Arguments @("--host=127.0.0.1", "--port=5434", "--username=postgres", "--force", "--if-exists", $tempDatabase) `
      -FailureMessage "No se pudo retirar la base temporal $tempDatabase"
  } catch {
    Write-FitStoreLog -InstallDir $paths.Install -Level "AVISO" -Message $_.Exception.Message
  }
  $safeRestoreRoot = [IO.Path]::GetFullPath($restoreRoot).TrimEnd("\")
  $safeTransaction = [IO.Path]::GetFullPath($restoreTransaction).TrimEnd("\")
  if ($safeTransaction.StartsWith($safeRestoreRoot + "\", [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $safeTransaction)) {
    Remove-Item -LiteralPath $safeTransaction -Recurse -Force -ErrorAction SilentlyContinue
  }
}
