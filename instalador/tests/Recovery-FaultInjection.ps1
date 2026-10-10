param([string]$PgBin, [int]$Port=55611, [string]$RecoverySource)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if (-not $PgBin) { $PgBin = $env:PGBIN }
if ($env:CI -and -not $PgBin) { throw '3h1: CI requiere PgBin/PGBIN para ejecutar PostgreSQL real; no se permite omitirlo.' }
if ($PgBin) {
 foreach ($tool in @('initdb.exe','pg_ctl.exe','psql.exe','pg_dump.exe','pg_restore.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PgBin $tool) -PathType Leaf)) { throw "3h1: falta herramienta PostgreSQL real: $tool" }
 }
}
$recover = Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'
if ($RecoverySource) { $recover=$RecoverySource }
if (-not (Test-Path -LiteralPath $recover)) { throw 'A3: falta recuperacion explicita tras corte de luz.' }
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($recover,[ref]$tokens,[ref]$errors)
$rollbackSource=Get-Content -LiteralPath (Join-Path (Split-Path -Parent $recover) 'Rollback-FitStoreUpdate.ps1') -Raw
$gate=$rollbackSource.IndexOf('if ($RecoverInterrupted)')
$manifest=$rollbackSource.IndexOf('Assert-UpdateManifest -Manifest', $gate)
$eligibility=$rollbackSource.IndexOf('Assert-FitStoreInterruptedRecovery -Paths', $gate)
if($manifest -lt 0 -or $manifest -gt $eligibility){throw 'A3: snapshot binaries execute before manifest verification.'}
if($rollbackSource.IndexOf('-VerifiedPgBin $verifiedPgBin',$gate) -lt 0){throw 'A3: eligibility may execute unverified active binaries.'}
Write-Host 'PASS A3: manifiesto verificado antes de ejecutar binarios, usando exclusivamente runtime verificado.'
$function=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-FitStoreInterruptedRecovery'},$true)
Invoke-Expression $function.Extent.Text
foreach($name in @('Enable-FitStoreTemporaryPostgresAccess','Restore-FitStoreTemporaryPostgresAccess')){
 $definition=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
 if(-not $definition){throw "3i2: falta helper real $name"}
 Invoke-Expression $definition.Extent.Text
}
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-a3-'+[guid]::NewGuid().ToString('N'))
$script:ApiService='FitStoreAPI'; $script:WebService='FitStoreWeb'; $script:PostgresService='FitStorePostgres'
$script:count='0'; $script:mode='Disabled'; $script:state='Stopped'
function Get-CimInstance { param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{StartMode=$script:mode;State=$script:state} }
function Start-FitStoreService { param($Name,$TimeoutSeconds) if($Name -ne 'FitStorePostgres'){throw 'Application must not start during guard'} }
function Read-FitStoreJson { param($Path) if($Path -like '*recovery-login-state.json'){return Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json}; [pscustomobject]@{databasePassword=[guid]::NewGuid().ToString('N');postgresPassword=[guid]::NewGuid().ToString('N')} }
function Write-FitStoreJson { param($Path,$Value,[switch]$Protect) [IO.File]::WriteAllText($Path,($Value|ConvertTo-Json -Depth 10)) }
function Invoke-FitStorePg { param($Tool,$Password,$Arguments,$FailureMessage) if(($Arguments -join ' ') -notmatch 'SELECT count'){throw 'Only read query allowed'}; return $script:count }
function Get-Service { param($Name,$ErrorAction) [pscustomobject]@{Status='Stopped'} }
function Get-FitStoreUpdateMarker { param($Paths) return (Join-Path $root 'update-marker.fixture.json') }
$script:pgOperations=@()
function Invoke-FitStoreRecoveryPgCtl { param($Tool,$Arguments,$Database) $script:pgOperations+=($Arguments -join ' ') }
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 [IO.File]::WriteAllText((Join-Path $root 'backup.dump'),'isolated backup fixture')
 [IO.File]::WriteAllText((Join-Path $root 'psql.exe'),'not executed')
 $paths=[pscustomobject]@{PgBin=$root;Secrets=(Join-Path $root 'secrets.json');Install=$root}
 $tx=[pscustomobject]@{backup=(Join-Path $root 'backup.dump');backupSha256=(Get-FileHash (Join-Path $root 'backup.dump')).Hash;backupCutoffAt='2026-10-09T10:00:00.0000000Z';applicationAutostartDisabled=$true;phase='snapshot-ready';snapshotPath=$root}
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx
 Write-Host 'PASS A3: corte de luz, servicios deshabilitados y sin ventas permite recuperacion.'
 foreach($case in @('sales','enabled','running','invalid-query','tampered-backup','legacy')) {
  $script:count='0';$script:mode='Disabled';$script:state='Stopped';$tx.applicationAutostartDisabled=$true
  switch($case){'sales'{$script:count='1'} 'enabled'{$script:mode='Auto'} 'running'{$script:state='Running'} 'invalid-query'{$script:count='ERROR'} 'tampered-backup'{$tx.backupSha256='bad'} 'legacy'{$tx.applicationAutostartDisabled=$false}}
  $denied=$false
  try {Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx}catch{$denied=$true}
  if(-not $denied){throw "A3: unsafe recovery allowed: $case"}
  $tx.backupSha256=(Get-FileHash (Join-Path $root 'backup.dump')).Hash
  Write-Host "PASS A3: $case rechaza sin restaurar datos."
 }
 $script:count='0';$script:mode='Disabled';$script:state='Stopped';$tx.applicationAutostartDisabled=$true
 $paths.PgBin=Join-Path $root 'missing-install\bin'
 $paths.Install=Join-Path $root 'missing-install'
 $paths|Add-Member Database (Join-Path $root 'isolated-cluster')
 [IO.Directory]::CreateDirectory($paths.Database)|Out-Null
 [IO.Directory]::CreateDirectory((Join-Path $root 'bin'))|Out-Null
 [IO.File]::WriteAllText((Join-Path $root 'bin\psql.exe'),'not executed')
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx
 if($script:pgOperations.Count -ne 2 -or $script:pgOperations[0] -notmatch 'start$' -or $script:pgOperations[1] -notmatch 'stop$'){throw 'A3: snapshot PostgreSQL start/stop unbalanced'}
 Write-Host 'PASS A3: instalacion apartada usa PostgreSQL de snapshot y lo detiene tras consulta.'
 if($PgBin) {
  $cluster=Join-Path $root 'real-pg'
  & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale | Out-Null
  if($LASTEXITCODE -ne 0){throw 'initdb fixture failed'}
  $control=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-FitStoreRecoveryPgCtl'},$true)
  Invoke-Expression $control.Extent.Text
  try {
   Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE ROLE fitstore LOGIN;' | Out-Null
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE fitstore OWNER fitstore;' | Out-Null
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -v ON_ERROR_STOP=1 -c 'CREATE TABLE "Sale" ("createdAt" timestamp NOT NULL);' | Out-Null
   if($LASTEXITCODE -ne 0){throw 'fixture schema failed'}
   foreach ($table in @('AuditLog','Payment','SaleReturn','CashMovement','InventoryMovement')) {
    $schema = 'CREATE TABLE "' + $table + '" ("createdAt" timestamp NOT NULL);'
    & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -v ON_ERROR_STOP=1 -c $schema | Out-Null
    if($LASTEXITCODE -ne 0){throw "fixture activity schema failed: $table"}
   }
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -v ON_ERROR_STOP=1 -c 'CREATE TABLE "CashSession" ("openedAt" timestamp NOT NULL, "closedAt" timestamp);' | Out-Null
   if($LASTEXITCODE -ne 0){throw 'fixture CashSession schema failed'}
   function Invoke-FitStorePg {param($Tool,$Password,$Arguments,$FailureMessage) $localArgs=@($Arguments|ForEach-Object{if($_ -eq '--port=5434'){"--port=$Port"}else{$_}}); & $Tool @localArgs; if($LASTEXITCODE -ne 0){throw $FailureMessage}}
   $paths.PgBin=$PgBin
   Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port
   Write-Host 'PASS A3 PostgreSQL real: sin ventas posteriores autoriza.'
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -v ON_ERROR_STOP=1 -c 'INSERT INTO "Sale" VALUES (TIMESTAMP ''2026-10-09 10:00:01'');' | Out-Null
   $denied=$false
   try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$denied=$true}
   if(-not $denied){throw 'A3 PostgreSQL real: sale permitted destructive restore'}
   $count=& (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -t -A -c 'SELECT count(*) FROM "Sale";'
   if(([string]$count).Trim() -ne '1'){throw 'A3: sale changed'}
   Write-Host 'PASS A3 PostgreSQL real: venta posterior rechaza y permanece intacta (count=1).'
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d fitstore -c 'TRUNCATE "Sale";' | Out-Null
   $archive=Join-Path $root 'verified-empty.dump'
   & (Join-Path $PgBin 'pg_dump.exe') -h 127.0.0.1 -p $Port -U postgres -d fitstore -Fc -f $archive
   if($LASTEXITCODE -ne 0){throw 'Real recovery dump fixture failed'}
   $tx|Add-Member transactionPath $root -Force
   foreach($name in @('Invoke-FitStoreRecoverySql','Enable-FitStoreRecoveryIsolation','Disable-FitStoreRecoveryIsolation')){
    $def=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
    if(-not $def){throw "3h1: falta funcion obligatoria de aislamiento: $name"}
    Invoke-Expression $def.Extent.Text
   }
   Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port -ExclusiveAccess
   $ErrorActionPreference='Continue'
   try { & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -c 'INSERT INTO "Sale" VALUES (TIMESTAMP ''2026-10-09 10:00:01'');' 2>$null | Out-Null } finally { $ErrorActionPreference='Stop' }
   if($LASTEXITCODE -eq 0){throw 'A3 exclusive: SQL writer admitted AFTER eligibility SELECT; restore can overwrite sale.'}
   Write-Host 'PASS A3 exclusive: escritor fitstore posterior al SELECT recibe NOLOGIN.'
   # Corte despues de NOLOGIN: reejecutar sin perder lista original.
   Enable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port
   Disable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -c 'SELECT 1;' | Out-Null
   if($LASTEXITCODE -ne 0){throw 'LOGIN not recovered after interrupted isolation'}
   Write-Host 'PASS A3 exclusive: corte tras NOLOGIN reanuda y restituye LOGIN original.'
   # Corte antes de NOLOGIN: estado guardado, roles aun habilitados.
   $saved=Get-Command Write-FitStoreJson
   function Write-FitStoreJson {param($Path,$Value,[switch]$Protect) [IO.File]::WriteAllText($Path,($Value|ConvertTo-Json -Depth 10)); throw 'injected-power-loss-after-state'}
   try{Enable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port; throw 'expected injected cut'}catch{if($_.Exception.Message -ne 'injected-power-loss-after-state'){throw}}
   Set-Item Function:Write-FitStoreJson $saved.ScriptBlock
   Enable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port
   # Corte tras SELECT: el bloqueo sobrevive a un reinicio real de PostgreSQL.
   Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')
   Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
   $login=& (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -t -A -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';"
   if(([string]$login).Trim() -ne 'f'){throw 'Isolation lost on PostgreSQL restart'}
   $rollback=Join-Path $PSScriptRoot '../scripts/Rollback-FitStoreUpdate.ps1'
   $rt=$null;$re=$null;$ra=[Management.Automation.Language.Parser]::ParseFile($rollback,[ref]$rt,[ref]$re)
   $restore=$ra.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Restore-DatabaseFromUpdateBackup'},$true)
   Invoke-Expression $restore.Extent.Text
   function Wait-FitStorePostgres {param($Paths,$TimeoutSeconds)}
   Restore-DatabaseFromUpdateBackup -Paths $paths -Secrets (Read-FitStoreJson 'fixture') -Archive $archive -ExpectedHash (Get-FileHash -LiteralPath $archive).Hash -ExclusiveRecovery | Out-Null
   $login=& (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -t -A -c "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';"
   if(([string]$login).Trim() -ne 'f'){throw 'Restore reopened login before explicit cleanup'}
   if(-not(Test-Path -LiteralPath (Join-Path $root 'recovery-login-state.json'))){throw 'Restore discarded recovery login plan'}
   Write-Host 'PASS A3 exclusive: pg_restore real conserva NOLOGIN y estado para corte posterior a restaurar.'
   Disable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port
   Write-Host 'PASS A3 exclusive: cortes antes de NOLOGIN y tras SELECT/reinicio mantienen plan recuperable.'
   # Corte al restituir, antes de borrar estado: repetir es idempotente.
   [IO.File]::WriteAllText((Join-Path $root 'recovery-login-state.json'),'{"originalLoginRoles":["fitstore"]}')
   Disable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port
   if(Test-Path -LiteralPath (Join-Path $root 'recovery-login-state.json')){throw 'State not cleaned after successful restoration'}
   Write-Host 'PASS A3 exclusive: corte antes de borrar estado permite restitucion idempotente.'
   # Venta posterior existente: rechazo restituye LOGIN, sin modificar venta.
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -c 'INSERT INTO "Sale" VALUES (TIMESTAMP ''2026-10-09 10:00:01'');' | Out-Null
   if($LASTEXITCODE -ne 0){throw 'Restored table ownership prevents POS sale'}
   $denied=$false
   try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port -ExclusiveAccess}catch{$denied=$true}
   if(-not $denied){throw 'Existing new sale accepted'}
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -c 'SELECT 1;' | Out-Null
   if($LASTEXITCODE -ne 0){throw 'Rejected recovery left LOGIN blocked'}
   Write-Host 'PASS A3 exclusive: rechazo por venta posterior restituye LOGIN sin restaurar datos.'
  } finally {Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 }
} finally {if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}}
