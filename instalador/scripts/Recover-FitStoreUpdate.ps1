param([string]$InstallDir, [switch]$DefinitionsOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-FitStoreRecoveryPgCtl {
  param([string]$Tool, [string[]]$Arguments, [string]$Database)
  # No -Wait: Windows espera tambien a postgres (hijo persistente). Esperar
  # exclusivamente al pg_ctl; stdout/stderr a archivos del cluster protegido.
  $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' })
  $logId = 'recovery-control-' + [guid]::NewGuid().ToString('N')
  $process = Start-Process -FilePath $Tool -ArgumentList $quoted -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $Database ($logId + '.out')) -RedirectStandardError (Join-Path $Database ($logId + '.err'))
  $processHandle = $process.Handle
  $process.WaitForExit()
  $process.Refresh()
  if ($process.ExitCode -ne 0) { throw "No se pudo controlar PostgreSQL temporal. Codigo: $($process.ExitCode). No se restauraron datos." }
}

function Assert-FitStoreInterruptedRecovery {
  param($Paths, $Transaction, [ValidateRange(1024,65535)][int]$DatabasePort = 5434)
  foreach ($field in @('backupCutoffAt','applicationAutostartDisabled','backup','backupSha256','snapshotPath','phase')) {
    if ($Transaction.PSObject.Properties.Name -notcontains $field) { throw "Transaccion antigua o incompleta: falta $field. Requiere recuperacion asistida; no se restauraron datos." }
  }
  if ($Transaction.applicationAutostartDisabled -ne $true -or $Transaction.phase -eq 'verified') { throw 'La transaccion no acredita servicios deshabilitados antes del corte; no se restauraron datos.' }
  $cutoff = [DateTimeOffset]::ParseExact([string]$Transaction.backupCutoffAt, 'o', [Globalization.CultureInfo]::InvariantCulture)
  if ($cutoff -gt [DateTimeOffset]::UtcNow) { throw 'Fecha del respaldo futura; recuperacion cancelada.' }
  foreach ($name in @($script:ApiService, $script:WebService)) {
    $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$name'" -ErrorAction Stop
    if (-not $service -or $service.StartMode -ne 'Disabled' -or $service.State -ne 'Stopped') { throw "El servicio $name ya no sigue deshabilitado y detenido. No se restauraron datos." }
  }
  if (-not (Test-Path -LiteralPath $Transaction.backup -PathType Leaf) -or
      (Get-FileHash -LiteralPath $Transaction.backup -Algorithm SHA256).Hash -ine $Transaction.backupSha256) { throw 'Respaldo ausente o alterado; recuperacion cancelada.' }
  $psql = Join-Path $Paths.PgBin 'psql.exe'
  if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
    # Preflight puede haber apartado Program Files antes del corte.
    $relative = $Paths.PgBin.Substring($Paths.Install.TrimEnd('\').Length).TrimStart('\')
    $psql = Join-Path (Join-Path $Transaction.snapshotPath $relative) 'psql.exe'
  }
  if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'Falta psql para comprobar ventas. Requiere recuperacion asistida; no se restauraron datos.' }
  $secrets = Read-FitStoreJson -Path $Paths.Secrets
  $timestamp = $cutoff.UtcDateTime.ToString('yyyy-MM-dd HH:mm:ss.fffffff', [Globalization.CultureInfo]::InvariantCulture)
  # Literal generado desde una fecha parseada, nunca desde texto libre.
  $sql = 'SELECT count(*) FROM "Sale" WHERE "createdAt" >= TIMESTAMP ''' + $timestamp + ''';'
  $temporaryPostgres = $false
  try {
    if ($psql -ne (Join-Path $Paths.PgBin 'psql.exe')) {
      # El servicio registrado apunta a Program Files, que puede estar apartado.
      # Usar el binario anterior sobre el mismo cluster; nunca initdb/restore.
      $postgres = Get-Service -Name $script:PostgresService -ErrorAction Stop
      if ($postgres.Status -ne 'Running') {
        $pgCtl = Join-Path (Split-Path -Parent $psql) 'pg_ctl.exe'
        $temporaryPostgres = $true
        Invoke-FitStoreRecoveryPgCtl -Tool $pgCtl -Database $Paths.Database -Arguments @('-D',$Paths.Database,'-l',(Join-Path $Paths.Database 'recovery-postgres.log'),'-o',"-p $DatabasePort",'-w','start')
      }
    } else { Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90 }
    $output = @(Invoke-FitStorePg -Tool $psql -Password ([string]$secrets.databasePassword) -Arguments @('--host=127.0.0.1',"--port=$DatabasePort",'--username=fitstore','--dbname=fitstore','--no-password','--no-psqlrc','--tuples-only','--no-align','--set=ON_ERROR_STOP=1',"--command=$sql") -FailureMessage 'No se pudieron comprobar las ventas posteriores al respaldo')
  } finally {
    if ($temporaryPostgres) { Invoke-FitStoreRecoveryPgCtl -Tool $pgCtl -Database $Paths.Database -Arguments @('-D',$Paths.Database,'-m','fast','-w','stop') }
  }
  if ($output.Count -ne 1 -or ([string]$output[0]).Trim() -cne '0') { throw 'Hay ventas posteriores al respaldo o no se pudo verificarlas. No se restauraron datos; requiere recuperacion asistida.' }
  foreach ($name in @($script:ApiService, $script:WebService)) {
    $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$name'" -ErrorAction Stop
    if (-not $service -or $service.StartMode -ne 'Disabled' -or $service.State -ne 'Stopped') { throw 'Los servicios cambiaron durante la comprobacion. No se restauraron datos.' }
  }
}
if ($DefinitionsOnly) { return }
. (Join-Path $PSScriptRoot 'FitStore.Common.ps1')
Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$marker = Get-FitStoreUpdateMarker -Paths $paths
if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { throw 'No existe una actualizacion interrumpida que recuperar.' }
$transaction = Read-FitStoreJson -Path $marker
if ($transaction.PSObject.Properties.Name -notcontains 'installerSession' -or -not $transaction.installerSession) { throw 'Transaccion anterior sin identificador: requiere recuperacion asistida.' }
# Compartir exclusividad con NSIS; su comprobacion rechaza un mutex existente.
$created = $false
$mutex = [Threading.Mutex]::new($false, 'Global\FitStorePOSInstaller', [ref]$created)
try {
  if (-not $created) { throw 'Ya existe una instalacion o recuperacion activa; no se restauraron datos.' }
  # Rollback revalida los controles; no se genera un permiso reutilizable.
  & (Join-Path $PSScriptRoot 'Rollback-FitStoreUpdate.ps1') -InstallDir $paths.Install -InstallerSession ([string]$transaction.installerSession) -RecoverInterrupted
} finally { $mutex.Dispose() }
