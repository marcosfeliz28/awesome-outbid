param([string]$InstallDir, [switch]$DefinitionsOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Resolve-FitStoreRecoveryPhysicalDirectory {
  param([Parameter(Mandatory)][string]$Path)
  # Tras mover Program Files al snapshot el destino puede no existir. Resolver
  # fisicamente el ancestro existente (incluye junction/8.3), luego reconstruir
  # solo los componentes inexistentes; no omitir comparaciones de seguridad.
  $localNames=@('localhost','127.0.0.1',$env:COMPUTERNAME) | Where-Object { $_ }
  $localPattern='^\\\\(?:\?\\UNC\\)?('+(($localNames|ForEach-Object{[regex]::Escape($_)})-join '|')+')\\([A-Za-z])\$(\\.*)?$'
  if($Path -match $localPattern){$Path=$Matches[2]+':\'+([string]$Matches[3]).TrimStart('\')}
  $existing=[IO.Path]::GetFullPath($Path).TrimEnd('\','/')
  $missing=[Collections.Generic.List[string]]::new()
  while($true){
    try {$item=Get-Item -LiteralPath $existing -Force -ErrorAction Stop;break}
    catch [System.Management.Automation.ItemNotFoundException] {}
    catch [IO.FileNotFoundException] {}
    catch [IO.DirectoryNotFoundException] {}
    # AccessDenied y errores de red NO significan ausencia. No reconstruirlos.
    $parent=[IO.Path]::GetDirectoryName($existing)
    if([string]::IsNullOrEmpty($parent) -or $parent -eq $existing){throw "No existe un ancestro verificable del directorio: $Path"}
    $missing.Insert(0,[IO.Path]::GetFileName($existing))
    $existing=$parent
  }
  if(-not $item.PSIsContainer){throw "El ancestro no es un directorio: $Path"}
  if (-not ('FitStoreRecoveryDirectoryNative' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class FitStoreRecoveryDirectoryNative {
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
 public static extern uint GetFinalPathNameByHandle(SafeFileHandle handle, StringBuilder path, uint size, uint flags);
}
'@
  }
  $handle=[FitStoreRecoveryDirectoryNative]::CreateFile($existing,0,7,[IntPtr]::Zero,3,0x02000000,[IntPtr]::Zero)
  try {
    if($handle.IsInvalid){throw "No se pudo resolver el directorio real: $Path"}
    $buffer=[Text.StringBuilder]::new(32768)
    $length=[FitStoreRecoveryDirectoryNative]::GetFinalPathNameByHandle($handle,$buffer,32768,0)
    if(-not $length -or $length -ge 32768){throw "No se pudo resolver el directorio real: $Path"}
    $physical=$buffer.ToString().TrimEnd('\','/')
    foreach($component in $missing){$physical=[IO.Path]::Combine($physical,$component)}
    return $physical
  } finally {$handle.Dispose()}
}

function Assert-FitStoreRecoveryWorkingDirectory {
  param([Parameter(Mandatory)][string]$InstallDir,[string]$TransactionPath,[string]$RecoveryScriptDirectory=$PSScriptRoot)
  $location = Get-Location
  if ($location.Provider.Name -ne 'FileSystem') { throw 'Ejecute recuperacion desde un directorio actual del sistema de archivos fuera de la instalacion.' }
  $installation = Resolve-FitStoreRecoveryPhysicalDirectory -Path $InstallDir
  $current = Resolve-FitStoreRecoveryPhysicalDirectory -Path $location.ProviderPath
  $processCurrent=Resolve-FitStoreRecoveryPhysicalDirectory -Path ([Environment]::CurrentDirectory)
  foreach($candidate in @($current,$processCurrent)){
  if ($candidate.Equals($installation, [StringComparison]::OrdinalIgnoreCase) -or
      $candidate.StartsWith($installation + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'El directorio actual esta dentro de la instalacion que debe reemplazarse. Abra PowerShell en una carpeta externa (por ejemplo TEMP) y ejecute el paquete nuevo de recuperacion desde alli. No se restauraron datos.'
  }
  }
  if($TransactionPath){
    $transactionDirectory=Resolve-FitStoreRecoveryPhysicalDirectory -Path $TransactionPath
    foreach($candidate in @($current,$processCurrent,(Resolve-FitStoreRecoveryPhysicalDirectory -Path $RecoveryScriptDirectory))){
      if($candidate.Equals($transactionDirectory,[StringComparison]::OrdinalIgnoreCase) -or $candidate.StartsWith($transactionDirectory+'\',[StringComparison]::OrdinalIgnoreCase)){
        throw 'El directorio actual o el paquete de recuperacion esta dentro de la transaccion que se eliminara. Ejecute el paquete desde una carpeta externa. No se restauraron datos.'
      }
    }
  }
}

function Restore-FitStoreTemporaryPostgresAccess {
  param([object[]]$OriginalAcl,[string]$StatePath)
  $failures=[Collections.Generic.List[string]]::new()
  foreach ($entry in $OriginalAcl) {
    try {
    if (-not (Test-Path -LiteralPath $entry.Path)) { continue }
    $item = Get-Item -LiteralPath $entry.Path -Force
    $acl = if ($item.PSIsContainer) { [Security.AccessControl.DirectorySecurity]::new() } else { [Security.AccessControl.FileSecurity]::new() }
    $acl.SetSecurityDescriptorSddlForm($entry.Sddl, [Security.AccessControl.AccessControlSections]::Access)
    # Restaurar tambien proteccion/herencia. El descriptor Access-only nuevo
    # no marca la proteccion como modificada al persistir en todos los Windows.
    # Primero fijar el DACL exacto sin recalcular ACE heredados desde el padre;
    # luego restituir el estado original de herencia.
    $wasProtected=$acl.AreAccessRulesProtected
    $acl.SetAccessRuleProtection($true,$true)
    $item.SetAccessControl($acl)
    if(-not $wasProtected){
      $acl.SetAccessRuleProtection($false,$false)
      $item.SetAccessControl($acl)
    }
    } catch {$failures.Add($entry.Path+': '+$_.Exception.Message)}
  }
  if($failures.Count){throw ('No se pudieron restaurar todas las DACL originales: '+($failures -join '; '))}
  if($StatePath -and (Test-Path -LiteralPath $StatePath)){Remove-Item -LiteralPath $StatePath -Force}
}

function Restore-FitStorePendingPostgresAccess {
  param([string]$Database,[string]$StatePath)
  if(-not(Test-Path -LiteralPath $StatePath)){return}
  $state=Get-Content -LiteralPath $StatePath -Raw|ConvertFrom-Json
  $base=[IO.Path]::GetFullPath($Database).TrimEnd('\')
  if($state.database -ine $base){throw 'Estado DACL no corresponde a PGDATA; recuperacion cancelada.'}
  foreach($entry in $state.entries){
    $path=[IO.Path]::GetFullPath([string]$entry.Path)
    if($path -ine $base -and -not $path.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Estado DACL contiene ruta fuera de PGDATA.'}
    # PostgreSQL recicla WAL y borra estadisticas entre arranques. Validar
    # primero el limite de PGDATA, aun si la entrada desaparecio. Solo ausencia
    # comprobada se omite: AccessDenied/red/otros errores siguen abortando.
    try {$item=Get-Item -LiteralPath $path -Force -ErrorAction Stop}
    catch [System.Management.Automation.ItemNotFoundException] {continue}
    catch [IO.FileNotFoundException] {continue}
    catch [IO.DirectoryNotFoundException] {continue}
    if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Estado DACL contiene enlace.'}
  }
  Restore-FitStoreTemporaryPostgresAccess -OriginalAcl @($state.entries) -StatePath $StatePath
}

function Enable-FitStoreTemporaryPostgresAccess {
  param([Parameter(Mandatory)][string]$Database,[string]$TransactionPath)
  if(-not $TransactionPath){$TransactionPath=Split-Path -Parent ([IO.Path]::GetFullPath($Database))}
  $statePath=Join-Path $TransactionPath 'recovery-pgdata-acl.json'
  Restore-FitStorePendingPostgresAccess -Database $Database -StatePath $statePath
  $root = Get-Item -LiteralPath $Database -Force
  if (-not $root.PSIsContainer -or ($root.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'PGDATA temporal debe ser un directorio real, no un enlace.' }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $saved = [Collections.Generic.List[object]]::new()
  try {
    # Guardar DACL antes de otorgar: restaurar exactamente, sin borrar una
    # concesion que la cuenta ya tuviera. Administradores deny-only no basta.
    foreach ($item in @($root) + @(Get-ChildItem -LiteralPath $root.FullName -Recurse -Force)) {
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'PGDATA contiene un enlace; acceso temporal cancelado.' }
      $acl = Get-Acl -LiteralPath $item.FullName
      $saved.Add([pscustomobject]@{ Path=$item.FullName; Sddl=$acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) })
    }
    # Persistir ANTES de conceder. File.Create aplica DACL desde creacion;
    # una interrupcion deja el diario privado para el siguiente arranque.
    $privateAcl=[Security.AccessControl.FileSecurity]::new()
    $privateAcl.SetAccessRuleProtection($true,$false)
    foreach($identity in @('S-1-5-18','S-1-5-32-544',$sid.Value)){
      $privateAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($identity),[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow))
    }
    $journal=[IO.File]::Create($statePath,4096,[IO.FileOptions]::WriteThrough,$privateAcl)
    try{
      $bytes=[Text.Encoding]::UTF8.GetBytes((@{database=$root.FullName.TrimEnd('\');entries=$saved.ToArray()}|ConvertTo-Json -Depth 6))
      $journal.Write($bytes,0,$bytes.Length);$journal.Flush($true)
    } finally{$journal.Dispose()}
    foreach ($entry in $saved) {
      $item = Get-Item -LiteralPath $entry.Path -Force
      $acl = if ($item.PSIsContainer) { [Security.AccessControl.DirectorySecurity]::new() } else { [Security.AccessControl.FileSecurity]::new() }
      $acl.SetSecurityDescriptorSddlForm($entry.Sddl, [Security.AccessControl.AccessControlSections]::Access)
      $inheritance = if ($item.PSIsContainer) { [Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit' } else { [Security.AccessControl.InheritanceFlags]::None }
      $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, [Security.AccessControl.FileSystemRights]::Modify, $inheritance, [Security.AccessControl.PropagationFlags]::None, [Security.AccessControl.AccessControlType]::Allow)
      $acl.AddAccessRule($rule)
      $item.SetAccessControl($acl)
    }
    return $saved.ToArray()
  } catch {
    $failure = $_
    try { Restore-FitStoreTemporaryPostgresAccess -OriginalAcl $saved.ToArray() -StatePath $statePath } catch { Write-Warning ('No se pudo retirar todo el acceso temporal a PGDATA: ' + $_.Exception.Message) }
    throw $failure
  }
}

function Invoke-FitStoreRecoveryPgCtl {
  param([string]$Tool, [string[]]$Arguments, [string]$Database)
  # No -Wait: Windows espera tambien a postgres (hijo persistente). Esperar
  # exclusivamente al pg_ctl. PostgreSQL puede heredar los handles de captura:
  # usar TEMP del usuario, nunca dejar stdout/stderr dentro de PGDATA.
  $quoted = @($Arguments | ForEach-Object { '"' + $_.Replace('"','\"') + '"' })
  $logId = 'recovery-control-' + [guid]::NewGuid().ToString('N')
  if (-not (Get-Variable FitStoreRecoveryCaptureDirectories -Scope Script -ErrorAction SilentlyContinue)) { $script:FitStoreRecoveryCaptureDirectories=@{} }
  $key=[IO.Path]::GetFullPath($Database).ToLowerInvariant()
  if (-not $script:FitStoreRecoveryCaptureDirectories.ContainsKey($key)) {
    $script:FitStoreRecoveryCaptureDirectories[$key]=Join-Path ([IO.Path]::GetTempPath()) ('nexora-recovery-control-'+[guid]::NewGuid().ToString('N'))
  }
  $captureDir=$script:FitStoreRecoveryCaptureDirectories[$key]
  [IO.Directory]::CreateDirectory($captureDir) | Out-Null
  if (((Get-Item -LiteralPath $captureDir -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'La carpeta temporal de captura es un punto de reanalisis.' }
  $stdout = Join-Path $captureDir ($logId + '.out')
  $stderr = Join-Path $captureDir ($logId + '.err')
  $process = $null
  $completed = $false
  try {
    $process = Start-Process -FilePath $Tool -ArgumentList $quoted -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $processHandle = $process.Handle
    $process.WaitForExit()
    $process.Refresh()
    if ($process.ExitCode -ne 0) { throw "No se pudo controlar PostgreSQL temporal. Codigo: $($process.ExitCode). No se restauraron datos." }
    $completed = $true
    # Solo al confirmar stop PostgreSQL libero su log. No borrar logs ajenos
    # ni el log activo si el intento de detener el servidor fallo.
    if ($Arguments -contains 'stop') {
      $postgresLog = Join-Path $Database 'recovery-postgres.log'
      if (Test-Path -LiteralPath $postgresLog -PathType Leaf) { Remove-Item -LiteralPath $postgresLog -Force }
      foreach ($legacyCapture in Get-ChildItem -LiteralPath $Database -File) {
        if ($legacyCapture.Name -match '^recovery-control-[0-9a-f]{32}\.(out|err)$') { Remove-Item -LiteralPath $legacyCapture.FullName -Force }
      }
    }
  } finally {
    if ($process -is [Diagnostics.Process]) { $process.Dispose() }
    foreach ($capture in @($stdout,$stderr)) {
      if (Test-Path -LiteralPath $capture -PathType Leaf) {
        try { Remove-Item -LiteralPath $capture -Force }
        catch [IO.IOException] { if ($Arguments -notcontains 'start') { throw } }
      }
    }
    # Tras stop los handles heredados ya cerraron: retirar capturas pendientes
    # exclusivamente de este cluster y con nombres generados por este script.
    if ($Arguments -contains 'stop' -and $completed) {
      foreach ($capture in Get-ChildItem -LiteralPath $captureDir -File) {
        if ($capture.Name -match '^recovery-control-[0-9a-f]{32}\.(out|err)$') { Remove-Item -LiteralPath $capture.FullName -Force }
      }
    }
    if (@(Get-ChildItem -LiteralPath $captureDir -Force).Count -eq 0) {
      [IO.Directory]::Delete($captureDir)
      $script:FitStoreRecoveryCaptureDirectories.Remove($key)
    }
  }
}

function Get-FitStoreRecoveryActivityColumns {
  # Contrato cotejado con schema.prisma: toda marca de alta/modificacion/cierre.
  # No usar fechas comerciales (vencimiento/captura prevista) como actividad.
  return [ordered]@{
    Role=@('updatedAt'); User=@('createdAt','updatedAt'); RefreshToken=@('createdAt')
    Category=@('createdAt','updatedAt'); Supplier=@('createdAt','updatedAt')
    Product=@('createdAt','updatedAt'); Variant=@('createdAt','updatedAt')
    Lot=@('createdAt','updatedAt'); LotIdentityConflict=@('createdAt')
    InventoryMovement=@('createdAt'); Customer=@('createdAt','updatedAt')
    Sale=@('createdAt','updatedAt'); Payment=@('createdAt'); SaleReturn=@('createdAt')
    CreditNote=@('createdAt'); Quote=@('createdAt','updatedAt')
    PurchaseOrder=@('createdAt','updatedAt'); GoodsReceipt=@('createdAt')
    SupplierPayment=@('createdAt'); InventoryCount=@('createdAt')
    CashSession=@('openedAt','closedAt'); CashMovement=@('createdAt')
    Expense=@('createdAt','updatedAt'); Promotion=@('createdAt','updatedAt')
    Alert=@('createdAt','updatedAt'); AlertRule=@('updatedAt')
    AuditLog=@('createdAt'); Settings=@('updatedAt'); Terminal=@('createdAt')
    RealtimeEvent=@('createdAt'); MerchandiseOperation=@('createdAt')
    InvoiceDraft=@('createdAt'); InvoiceAttachment=@('createdAt')
    NotificationOutbox=@('createdAt'); IncentiveRate=@('updatedAt')
    IncentiveEntry=@('createdAt'); IncentivePeriodClose=@('closedAt')
    IncentiveSettlement=@('closedAt')
  }
}

function Get-FitStoreDatabaseActivitySql {
  param([string]$Psql,[string[]]$Arguments,[string]$Password,[string]$Archive,[string]$Timestamp)
  $metadataSql = @'
SELECT json_build_object('tables', (SELECT COALESCE(json_agg(table_name), '[]'::json) FROM information_schema.tables WHERE table_schema='public'), 'columns', COALESCE(json_agg(json_build_object('table', table_name, 'column', column_name)), '[]'::json))::text
FROM information_schema.columns WHERE table_schema='public'
AND data_type IN ('timestamp without time zone','timestamp with time zone')
AND column_name IN ('createdAt','updatedAt','openedAt','closedAt','lastActivityAt','approvedAt','revokedAt','sentAt');
'@
  $json=@(Invoke-FitStorePgSql -Tool $Psql -Arguments $Arguments -Password $Password -Sql $metadataSql -FailureMessage 'No se pudo leer el esquema real de recuperacion')
  if($json.Count -ne 1){throw 'Esquema real no verificable; recuperacion cancelada.'}
  $parsed=([string]$json[0]) | ConvertFrom-Json
  $rows=@($parsed.columns)
  $liveTables=@($parsed.tables)
  $live=[ordered]@{}
  foreach($row in $rows){
    if($row.table -notmatch '^[A-Za-z_][A-Za-z0-9_]*$' -or $row.column -notmatch '^[A-Za-z_][A-Za-z0-9_]*$'){throw 'Identificador de esquema no admitido; recuperacion cancelada.'}
    if(-not $live.Contains([string]$row.table)){$live[[string]$row.table]=@()}
    $live[[string]$row.table]+=[string]$row.column
  }
  $core=@{Sale=@('createdAt','updatedAt');AuditLog=@('createdAt');Payment=@('createdAt');SaleReturn=@('createdAt');CashMovement=@('createdAt');CashSession=@('openedAt','closedAt');InventoryMovement=@('createdAt')}
  foreach($table in $core.Keys){foreach($column in $core[$table]){
    if(-not $live.Contains($table) -or $column -notin $live[$table]){throw "Falta nucleo obligatorio $table.$column; recuperacion cancelada."}
  }}
  $list=@(Invoke-FitStorePg -Tool (Join-Path (Split-Path -Parent $Psql) 'pg_restore.exe') -Arguments @('--list',$Archive) -Password $Password -FailureMessage 'Respaldo no permite comprobar tablas anteriores')
  foreach($line in $list){
    if([string]$line -match '^\d+;\s+\d+\s+\d+\s+TABLE\s+public\s+(\S+)\s+'){
      $table=$Matches[1]
      # Incluso tablas sin marca temporal del respaldo deben seguir existiendo.
      if($table -cnotin $liveTables){throw "Tabla del respaldo ausente en base activa: $table. Recuperacion cancelada."}
    }
  }
  $queries=foreach($table in $live.Keys){
    $conditions=foreach($column in $live[$table]){'"'+$column+'" >= TIMESTAMP '+"'$Timestamp'"}
    'SELECT count(*) AS activity FROM "'+$table+'" WHERE '+($conditions -join ' OR ')
  }
  return 'SELECT SUM(activity)::bigint FROM ('+($queries -join ' UNION ALL ')+') AS recent_activity;'
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
  $temporaryPostgres = $false
  $temporaryAcl = @()
  $guardFailure=$null
  try {
    if ($psql -ne (Join-Path $Paths.PgBin 'psql.exe')) {
      # El servicio registrado apunta a Program Files, que puede estar apartado.
      # Usar el binario anterior sobre el mismo cluster; nunca initdb/restore.
      $postgres = Get-Service -Name $script:PostgresService -ErrorAction Stop
      if ($postgres.Status -ne 'Running') {
        $pgCtl = Join-Path (Split-Path -Parent $psql) 'pg_ctl.exe'
        $temporaryAcl = @(Enable-FitStoreTemporaryPostgresAccess -Database $Paths.Database -TransactionPath $Transaction.transactionPath)
        $temporaryPostgres = $true
        Invoke-FitStoreRecoveryPgCtl -Tool $pgCtl -Database $Paths.Database -Arguments @('-D',$Paths.Database,'-l',(Join-Path $Paths.Database 'recovery-postgres.log'),'-o',"-p $DatabasePort",'-w','start')
      }
    } else { Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90 }
    if ($ExclusiveAccess) { Enable-FitStoreRecoveryIsolation -Transaction $Transaction -Psql $psql -Secrets $secrets -DatabasePort $DatabasePort -MarkerPath (Get-FitStoreUpdateMarker -Paths $Paths) }
    $user = if ($ExclusiveAccess) { 'postgres' } else { 'fitstore' }
    $password = if ($ExclusiveAccess) { [string]$secrets.postgresPassword } else { [string]$secrets.databasePassword }
    $sqlArguments=@('--host=127.0.0.1',"--port=$DatabasePort","--username=$user",'--dbname=fitstore','--no-password','--no-psqlrc','--tuples-only','--no-align','--set=ON_ERROR_STOP=1')
    $sql=Get-FitStoreDatabaseActivitySql -Psql $psql -Arguments $sqlArguments -Password $password -Archive $Transaction.backup -Timestamp $timestamp
    $output = @(Invoke-FitStorePgSql -Tool $psql -Password $password -Arguments $sqlArguments -Sql $sql -FailureMessage 'No se pudieron comprobar las ventas posteriores al respaldo')
    if ($output.Count -ne 1 -or ([string]$output[0]).Trim() -cne '0') { throw 'Hay ventas posteriores al respaldo o no se pudo verificarlas. No se restauraron datos; requiere recuperacion asistida.' }
    foreach ($name in @($script:ApiService, $script:WebService)) {
      $service = Get-CimInstance -ClassName Win32_Service -Filter "Name='$name'" -ErrorAction Stop
      if (-not $service -or $service.StartMode -ne 'Disabled' -or $service.State -ne 'Stopped') { throw 'Los servicios cambiaron durante la comprobacion. No se restauraron datos.' }
    }
  } catch {
    # Una negativa anterior a restaurar no deja usuarios bloqueados.
    $originalFailure=$_
    $guardFailure=$originalFailure
    if ($ExclusiveAccess) {
      try { Disable-FitStoreRecoveryIsolation -Transaction $Transaction -Psql $psql -Secrets $secrets -DatabasePort $DatabasePort }
      catch { Write-Warning ('No se pudo restituir LOGIN automaticamente: '+$_.Exception.Message+'. Soporte debe ejecutar ALTER ROLE fitstore LOGIN; con postgres y revisar recovery-login-state.json antes de retirar el marcador. No restaure respaldos.') }
    }
    throw $originalFailure
  } finally {
    try {
      try {
        if ($temporaryPostgres) { Invoke-FitStoreRecoveryPgCtl -Tool $pgCtl -Database $Paths.Database -Arguments @('-D',$Paths.Database,'-m','fast','-w','stop') }
      } finally {
        if ($temporaryAcl.Count) { Restore-FitStoreTemporaryPostgresAccess -OriginalAcl $temporaryAcl -StatePath (Join-Path $Transaction.transactionPath 'recovery-pgdata-acl.json') }
      }
    } catch {
      if($guardFailure){Write-Warning ('Limpieza de PostgreSQL/DACL pendiente; conserve el diario y reintente recuperacion: '+$_.Exception.Message)}else{throw}
    }
  }
}

function Invoke-FitStoreRecoverySql {
  param([string]$Psql, $Secrets, [int]$DatabasePort, [string]$Sql)
  Invoke-FitStorePgSql -Tool $Psql -Password ([string]$Secrets.postgresPassword) -Arguments @('--host=127.0.0.1',"--port=$DatabasePort",'--username=postgres','--dbname=postgres','--no-password','--no-psqlrc','--tuples-only','--no-align','--set=ON_ERROR_STOP=1') -Sql $Sql -FailureMessage 'No se pudo controlar el acceso exclusivo de recuperacion'
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
Assert-FitStoreRecoveryWorkingDirectory -InstallDir $paths.Install -TransactionPath $transaction.transactionPath -RecoveryScriptDirectory $PSScriptRoot
if ($transaction.PSObject.Properties.Name -notcontains 'installerSession' -or -not $transaction.installerSession) { throw 'Transaccion anterior sin identificador: requiere recuperacion asistida.' }
# Compartir exclusividad con NSIS; su comprobacion rechaza un mutex existente.
$created = $false
$mutex = [Threading.Mutex]::new($false, 'Global\FitStorePOSInstaller', [ref]$created)
try {
  if (-not $created) { throw 'Ya existe una instalacion o recuperacion activa; no se restauraron datos.' }
  # Rollback revalida los controles; no se genera un permiso reutilizable.
  & (Join-Path $PSScriptRoot 'Rollback-FitStoreUpdate.ps1') -InstallDir $paths.Install -InstallerSession ([string]$transaction.installerSession) -RecoverInterrupted
} finally { $mutex.Dispose() }
