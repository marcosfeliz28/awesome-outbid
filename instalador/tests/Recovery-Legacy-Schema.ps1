param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55619,[string]$RecoverySource)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
if(-not $RecoverySource){$RecoverySource=Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'}
. $RecoverySource -DefinitionsOnly
$root=Join-Path $env:TEMP ('nexora-legacy-schema-'+[guid]::NewGuid().ToString('N'));$cluster=Join-Path $root 'cluster'
$password=[guid]::NewGuid().ToString('N');$psql=Join-Path $PgBin 'psql.exe'
$arguments=@('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','fitstore','-t','-A','-v','ON_ERROR_STOP=1')
$realSql=(Get-Command Invoke-FitStorePgSql).ScriptBlock
$script:sqlCalls=0
function Invoke-FitStorePgSql {
 param($Tool,$Arguments,$Password,$Sql,$FailureMessage='Fallo una consulta PostgreSQL.')
 $script:sqlCalls++
 & $realSql -Tool $Tool -Arguments $Arguments -Password $Password -Sql $Sql -FailureMessage $FailureMessage
}
function Sql([string]$query){Invoke-FitStorePgSql -Tool $psql -Arguments $arguments -Password $password -Sql $query}
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{StartMode='Disabled';State='Stopped'}}
function Start-FitStoreService {param($Name,$TimeoutSeconds)}
function Read-FitStoreJson {param($Path) [pscustomobject]@{databasePassword=$password;postgresPassword=$password}}
try{
 New-Item -ItemType Directory -Path $root|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 Invoke-FitStorePgSql -Tool $psql -Arguments @('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','postgres') -Password $password -Sql 'CREATE ROLE fitstore LOGIN; CREATE DATABASE fitstore OWNER fitstore;'|Out-Null
 $core=@{Sale=@('createdAt','updatedAt');AuditLog=@('createdAt');Payment=@('createdAt');SaleReturn=@('createdAt');CashMovement=@('createdAt');CashSession=@('openedAt','closedAt');InventoryMovement=@('createdAt')}
 foreach($table in $core.Keys){Sql ('CREATE TABLE "'+$table+'" ('+(@($core[$table]|ForEach-Object{'"'+$_+'" timestamp'})-join ',')+'); GRANT SELECT ON "'+$table+'" TO fitstore;')|Out-Null}
 $backup=Join-Path $root 'old.dump'
 Invoke-FitStorePg -Tool (Join-Path $PgBin 'pg_dump.exe') -Arguments @('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','fitstore','-Fc',"--file=$backup") -Password $password|Out-Null
 $tx=[pscustomobject]@{transactionPath=$root;backupCutoffAt=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o');applicationAutostartDisabled=$true;backup=$backup;backupSha256=(Get-FileHash $backup).Hash;snapshotPath=$root;phase='prepared-copy-pending'}
 $paths=[pscustomobject]@{PgBin=$PgBin;Install=$root;Secrets='unused';Database=$cluster}
 if(-not(Get-Command Get-FitStoreDatabaseActivitySql -ErrorAction SilentlyContinue)){
  # Ejecutar el mapa antiguo con transporte SQL REAL ya corregido: distingue
  # el fallo de esquema legado del fallo de comillas de 3j3, sin stub SQL.
  $map=Get-FitStoreRecoveryActivityColumns
  $queries=foreach($table in $map.Keys){'SELECT count(*) FROM "'+$table+'" WHERE "'+$map[$table][0]+'" >= TIMESTAMP ''2000-01-01'''}
  Sql ($queries -join ' UNION ALL ')|Out-Null
  throw 'El mapa antiguo no fue rechazado sobre esquema previo'
 }
 $script:sqlCalls=0
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port
 if($script:sqlCalls -gt 2){throw "Metadata no agrupada: $($script:sqlCalls) procesos SQL reales para una comprobacion"}
 Write-Host 'PASS 3j4: esquema antiguo real con solo nucleo y dump antiguo permite recuperar antes de migrating.'
 Sql 'DROP TABLE "Payment";'|Out-Null
 $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$_.Exception.Message -match 'nucleo obligatorio'}
 if(-not $rejected){throw 'Nucleo ausente aceptado'}
 Write-Host 'PASS 3j4: falta de tabla nucleo rechaza.'
 Sql 'CREATE TABLE "Payment" ("createdAt" timestamp); GRANT SELECT ON "Payment" TO fitstore; CREATE TABLE "Quote" ("createdAt" timestamp,"updatedAt" timestamp); GRANT SELECT ON "Quote" TO fitstore;'|Out-Null
 Remove-Item -LiteralPath $backup
 Invoke-FitStorePg -Tool (Join-Path $PgBin 'pg_dump.exe') -Arguments @('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','fitstore','-Fc',"--file=$backup") -Password $password|Out-Null
 $tx.backupSha256=(Get-FileHash $backup).Hash
 Sql 'DROP TABLE "Quote";'|Out-Null
 $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$_.Exception.Message -match 'Tabla del respaldo ausente'}
 if(-not $rejected){throw 'Tabla del dump ausente en vivo aceptada'}
 Write-Host 'PASS 3j4: tabla opcional presente en dump pero ausente en vivo rechaza.'
 Sql 'CREATE TABLE "Quote" ("createdAt" timestamp,"updatedAt" timestamp); GRANT SELECT ON "Quote" TO fitstore; INSERT INTO "Quote" VALUES (now() AT TIME ZONE ''UTC'',now() AT TIME ZONE ''UTC'');'|Out-Null
 $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$_.Exception.Message -match 'ventas posteriores'}
 if(-not $rejected){throw 'Quote posterior sin auditoria aceptada'}
 Write-Host 'PASS 3j4: Quote nueva presente rechaza actividad posterior.'
}finally{
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
