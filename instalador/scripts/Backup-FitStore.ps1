param(
  [string]$InstallDir,
  [string]$Destino,
  [ValidateRange(1, 3650)][int]$RetencionDias = 30,
  [string]$Motivo = "programado"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

function Resolve-BackupDirectory {
  param($Paths, $State, [string]$Requested)
  if ($Requested) { $State | Add-Member -NotePropertyName backupPath -NotePropertyValue ([IO.Path]::GetFullPath($Requested)) -Force }
  $target = Initialize-FitStoreBackupStorage -Paths $Paths -State $State
  Write-FitStoreJson -Path $Paths.State -Value $State -Protect
  return $target
}

function Test-BackupArchive {
  param([string]$PgRestore, [string]$Archive)
  $stdout = [IO.Path]::GetTempFileName()
  $stderr = [IO.Path]::GetTempFileName()
  try {
    $process = Start-Process -FilePath $PgRestore -ArgumentList @("--list", "`"$Archive`"") -Wait -PassThru -NoNewWindow -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    if ($process.ExitCode -ne 0 -or (Get-Item -LiteralPath $stdout).Length -eq 0) {
      throw "La copia se creó, pero PostgreSQL no pudo verificarla."
    }
  } finally {
    Remove-Item -LiteralPath $stdout, $stderr -Force -ErrorAction SilentlyContinue
  }
}

$paths = Get-FitStorePaths -InstallDir $InstallDir
$state = Read-FitStoreJson -Path $paths.State
$secrets = Read-FitStoreJson -Path $paths.Secrets
Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
Wait-FitStorePostgres -Paths $paths -TimeoutSeconds 90
$target = Resolve-BackupDirectory -Paths $paths -State $state -Requested $Destino
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss_fff"
$fileName = "FitStore_${timestamp}.dump"
$temporary = Join-Path $target ("$fileName.incompleto")
$final = Join-Path $target $fileName
$pgDump = Join-Path $paths.PgBin "pg_dump.exe"
$pgRestore = Join-Path $paths.PgBin "pg_restore.exe"

try {
  New-FitStoreBackupFile -Path $temporary
  Invoke-FitStorePg `
    -Tool $pgDump `
    -Password ([string]$secrets.databasePassword) `
    -Arguments @(
      "--host=127.0.0.1",
      "--port=5434",
      "--username=fitstore",
      "--dbname=fitstore",
      "--format=custom",
      "--compress=6",
      "--no-password",
      "--file=$temporary"
    ) `
    -FailureMessage "No se pudo crear el respaldo"
  Test-BackupArchive -PgRestore $pgRestore -Archive $temporary
  Move-Item -LiteralPath $temporary -Destination $final -Force
  Protect-FitStoreBackupFile -Path $final
  $hash = (Get-FileHash -LiteralPath $final -Algorithm SHA256).Hash.ToLowerInvariant()
  New-FitStoreBackupFile -Path "$final.sha256"
  "$hash *$fileName" | Set-Content -LiteralPath "$final.sha256" -Encoding ASCII
  New-FitStoreBackupFile -Path "$final.json"
  [ordered]@{
    schemaVersion = 1
    createdAt = (Get-Date).ToUniversalTime().ToString("o")
    reason = $Motivo
    computer = $env:COMPUTERNAME
    database = "fitstore"
    postgresqlPort = 5434
    sha256 = $hash
    file = $fileName
  } | ConvertTo-Json | Set-Content -LiteralPath "$final.json" -Encoding UTF8

  $cutoff = (Get-Date).AddDays(-$RetencionDias)
  foreach ($retentionPath in @($target, $Paths.LocalBackups) | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $retentionPath -PathType Container)) { continue }
    Get-ChildItem -LiteralPath $retentionPath -Filter "FitStore_*.dump" -File -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt $cutoff } |
      ForEach-Object {
        Remove-Item -LiteralPath $_.FullName -Force
        Remove-Item -LiteralPath ($_.FullName + ".sha256"), ($_.FullName + ".json") -Force -ErrorAction SilentlyContinue
      }
    Get-ChildItem -LiteralPath $retentionPath -Filter "FitStore_*.incompleto" -File -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-1) } |
      Remove-Item -Force -ErrorAction SilentlyContinue
  }
  Write-FitStoreLog -InstallDir $paths.Install -Message "Respaldo verificado: $final"
  Write-Output $final
} catch {
  Remove-Item -LiteralPath $temporary -Force -ErrorAction SilentlyContinue
  Write-FitStoreLog -InstallDir $paths.Install -Level "ERROR" -Message $_.Exception.Message
  throw
}
