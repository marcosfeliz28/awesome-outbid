param([string]$InstallDir, [switch]$DefinitionsOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-FitStoreRecoveryWorkingDirectory {
  param([Parameter(Mandatory)][string]$InstallDir)
  $location = Get-Location
  if ($location.Provider.Name -ne 'FileSystem') { throw 'Ejecute recuperacion desde un directorio actual del sistema de archivos fuera de la instalacion.' }
  $installation = [IO.Path]::GetFullPath($InstallDir).TrimEnd('\','/')
  $current = [IO.Path]::GetFullPath($location.ProviderPath).TrimEnd('\','/')
  if ($current.Equals($installation, [StringComparison]::OrdinalIgnoreCase) -or
      $current.StartsWith($installation + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'El directorio actual esta dentro de la instalacion que debe reemplazarse. Abra PowerShell en una carpeta externa (por ejemplo TEMP) y ejecute el paquete nuevo de recuperacion desde alli. No se restauraron datos.'
  }
}

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
  param($Paths, $Transaction, [ValidateRange(1024,65535)][int]$DatabasePort = 5434, [switch]$ExclusiveAccess, [string]$VerifiedPgBin)
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
  if ($VerifiedPgBin) { $psql = Join-Path $VerifiedPgBin 'psql.exe' }
  if ($VerifiedPgBin -and -not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'La copia verificada no contiene psql; recuperacion cancelada.' }
  if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) {
    # Preflight puede haber apartado Program Files antes del corte.
    $relative = $Paths.PgBin.Substring($Paths.Install.TrimEnd('\').Length).TrimStart('\')
    $psql = Join-Path (Join-Path $Transaction.snapshotPath $relative) 'psql.exe'
  }
  if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'Falta psql para comprobar ventas. Requiere recuperacion asistida; no se restauraron datos.' }
  $secrets = Read-FitStoreJson -Path $Paths.Secrets
  $timestamp = $cutoff.UtcDateTime.ToString('yyyy-MM-dd HH:mm:ss.fffffff', [Globalization.CultureInfo]::InvariantCulture)
  # Literal generado desde una fecha parseada, nunca desde texto libre.
  # La hora capturada offline puede preceder al respaldo. AuditLog usa la
  # hora del servidor; incluir tambien cobros, devoluciones, caja e inventario.
  # Una tabla/columna ausente provoca error y rechazo, nunca un cero inventado.
  $sql = @"
SELECT SUM(activity)::bigint FROM (
  SELECT count(*) AS activity FROM "Sale" WHERE "createdAt" >= TIMESTAMP '$timestamp'
  UNION ALL SELECT count(*) FROM "AuditLog" WHERE "createdAt" >= TIMESTAMP '$timestamp'
  UNION ALL SELECT count(*) FROM "Payment" WHERE "createdAt" >= TIMESTAMP '$timestamp'
  UNION ALL SELECT count(*) FROM "SaleReturn" WHERE "createdAt" >= TIMESTAMP '$timestamp'
  UNION ALL SELECT count(*) FROM "CashMovement" WHERE "createdAt" >= TIMESTAMP '$timestamp'
  UNION ALL SELECT count(*) FROM "InventoryMovement" WHERE "createdAt" >= TIMESTAMP '$timestamp'
  UNION ALL SELECT count(*) FROM "CashSession" WHERE "openedAt" >= TIMESTAMP '$timestamp' OR "closedAt" >= TIMESTAMP '$timestamp'
) AS recent_activity;
"@
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
    if ($ExclusiveAccess) { Enable-FitStoreRecoveryIsolation -Transaction $Transaction -Psql $psql -Secrets $secrets -DatabasePort $DatabasePort -MarkerPath (Get-FitStoreUpdateMarker -Paths $Paths) }
    $user = if ($ExclusiveAccess) { 'postgres' } else { 'fitstore' }
    $password = if ($ExclusiveAccess) { [string]$secrets.postgresPassword } else { [string]$secrets.databasePassword }
    $output = @(Invoke-FitStorePg -Tool $psql -Password $password -Arguments @('--host=127.0.0.1',"--port=$DatabasePort","--username=$user",'--dbname=fitstore','--no-password','--no-psqlrc','--tuples-only','--no-align','--set=ON_ERROR_STOP=1',"--command=$sql") -FailureMessage 'No se pudieron comprobar las ventas posteriores al respaldo')
    if ($output.Count -ne 1 -or ([string]$output[0]).Trim() -cne '0') { throw 'Hay ventas posteriores al respaldo o no se pudo verificarlas. No se restauraron datos; requiere recuperacion asistida.' }
    foreach ($name in @($script:ApiService, $script:WebService)) {
      $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$name'" -ErrorAction Stop
      if (-not $service -or $service.StartMode -ne 'Disabled' -or $service.State -ne 'Stopped') { throw 'Los servicios cambiaron durante la comprobacion. No se restauraron datos.' }
    }
  } catch {
    # Una negativa anterior a restaurar no deja usuarios bloqueados.
    if ($ExclusiveAccess) { Disable-FitStoreRecoveryIsolation -Transaction $Transaction -Psql $psql -Secrets $secrets -DatabasePort $DatabasePort }
    throw
  } finally {
    if ($temporaryPostgres) { Invoke-FitStoreRecoveryPgCtl -Tool $pgCtl -Database $Paths.Database -Arguments @('-D',$Paths.Database,'-m','fast','-w','stop') }
  }
}

function Invoke-FitStoreRecoverySql {
  param([string]$Psql, $Secrets, [int]$DatabasePort, [string]$Sql)
  Invoke-FitStorePg -Tool $Psql -Password ([string]$Secrets.postgresPassword) -Arguments @('--host=127.0.0.1',"--port=$DatabasePort",'--username=postgres','--dbname=postgres','--no-password','--no-psqlrc','--tuples-only','--no-align','--set=ON_ERROR_STOP=1',"--command=$Sql") -FailureMessage 'No se pudo controlar el acceso exclusivo de recuperacion'
}

function Enable-FitStoreRecoveryIsolation {
  param($Transaction, [string]$Psql, $Secrets, [int]$DatabasePort=5434, [string]$MarkerPath)
  $statePath = Join-Path $Transaction.transactionPath 'recovery-login-state.json'
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) {
    if ($Transaction.PSObject.Properties.Name -contains 'recoveryLoginRoles') {
      # Reanudar con el plan del marcador, no con roles ya bloqueados por NOLOGIN.
      $original = @{ originalLoginRoles=@($Transaction.recoveryLoginRoles) }
    } else {
    $json = @(Invoke-FitStoreRecoverySql -Psql $Psql -Secrets $Secrets -DatabasePort $DatabasePort -Sql "SELECT json_build_object('originalLoginRoles', COALESCE(json_agg(rolname), '[]'::json)) FROM pg_roles WHERE rolcanlogin AND rolname <> 'postgres';")
    if ($json.Count -ne 1) { throw 'No se pudieron registrar los accesos originales; no se bloquearon cuentas.' }
    $original = ([string]$json[0]).Trim() | ConvertFrom-Json
    }
    # Persistir ANTES de NOLOGIN: un corte permite reanudar usando postgres.
    Write-FitStoreJson -Path $statePath -Value $original -Protect
  }
  $original = Read-FitStoreJson -Path $statePath
  $Transaction | Add-Member -NotePropertyName recoveryLoginRoles -NotePropertyValue @($original.originalLoginRoles) -Force
  # Segunda copia protegida antes de NOLOGIN: el auxiliar puede perderse.
  if ($MarkerPath) { Write-FitStoreJson -Path $MarkerPath -Value $Transaction -Protect }
  $sql = @'
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT rolname FROM pg_roles WHERE rolcanlogin AND rolname <> 'postgres' LOOP
    EXECUTE format('ALTER ROLE %I NOLOGIN', r.rolname);
  END LOOP;
END $$;
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND backend_type = 'client backend';
'@
  Invoke-FitStoreRecoverySql -Psql $Psql -Secrets $Secrets -DatabasePort $DatabasePort -Sql $sql | Out-Null
}

function Disable-FitStoreRecoveryIsolation {
  param($Transaction, [string]$Psql, $Secrets, [int]$DatabasePort=5434)
  $statePath = Join-Path $Transaction.transactionPath 'recovery-login-state.json'
  $roles = @('fitstore')
  if (Test-Path -LiteralPath $statePath -PathType Leaf) { $state = Read-FitStoreJson -Path $statePath; $roles += @($state.originalLoginRoles) }
  if ($Transaction.PSObject.Properties.Name -contains 'recoveryLoginRoles') { $roles += @($Transaction.recoveryLoginRoles) }
  foreach ($role in @($roles | Select-Object -Unique)) {
    $literal = ([string]$role).Replace("'", "''")
    # Si el rol desaparecio en una intervencion administrativa, no recrearlo.
    $sql = "DO `$`$ BEGIN IF EXISTS (SELECT FROM pg_roles WHERE rolname = '$literal') THEN EXECUTE format('ALTER ROLE %I LOGIN', '$literal'); END IF; END `$`$;"
    Invoke-FitStoreRecoverySql -Psql $Psql -Secrets $Secrets -DatabasePort $DatabasePort -Sql $sql | Out-Null
  }
  # Borrar al FINAL: una interrupcion conserva el plan idempotente de restitucion.
  if (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath -Force }
  Write-Host 'Si la recuperacion se interrumpe, soporte puede restituir acceso con: ALTER ROLE fitstore LOGIN; usando la cuenta administrativa postgres. No restaure respaldos ni borre el marcador sin revision.'
}
if ($DefinitionsOnly) { return }
. (Join-Path $PSScriptRoot 'FitStore.Common.ps1')
Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
Assert-FitStoreRecoveryWorkingDirectory -InstallDir $paths.Install
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
