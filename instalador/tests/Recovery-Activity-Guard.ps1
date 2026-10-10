param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55614,[string]$RecoverySource)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source=if($RecoverySource){$RecoverySource}else{Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'}
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$t,[ref]$e)
foreach($f in $ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)){Invoke-Expression $f.Extent.Text}
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-activity-'+[guid]::NewGuid().ToString('N'));$cluster=Join-Path $root 'cluster'
$script:ApiService='FitStoreAPI';$script:WebService='FitStoreWeb';$script:PostgresService='FixturePostgres'
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{StartMode='Disabled';State='Stopped'}}
function Start-FitStoreService {param($Name,$TimeoutSeconds)}
function Read-FitStoreJson {param($Path) [pscustomobject]@{databasePassword=[guid]::NewGuid().ToString('N')}}
function Invoke-FitStorePg {param($Tool,$Password,$Arguments,$FailureMessage) & $Tool @Arguments; if($LASTEXITCODE -ne 0){throw $FailureMessage}}
function Sql([string]$Query){& (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d fitstore -t -A -v ON_ERROR_STOP=1 -c $Query; if($LASTEXITCODE -ne 0){throw 'Fixture SQL failed'}}
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'Fixture initdb failed'}
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -c 'CREATE ROLE fitstore LOGIN;'|Out-Null
 & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -c 'CREATE DATABASE fitstore OWNER fitstore;'|Out-Null
 $tables=@('Sale','AuditLog','Payment','SaleReturn','CashMovement','InventoryMovement')
 foreach($table in $tables){Sql ('CREATE TABLE "'+$table+'" ("createdAt" timestamp NOT NULL); GRANT SELECT ON "'+$table+'" TO fitstore;')|Out-Null}
 Sql 'CREATE TABLE "CashSession" ("openedAt" timestamp NOT NULL, "closedAt" timestamp); GRANT SELECT ON "CashSession" TO fitstore;'|Out-Null
 $backup=Join-Path $root 'backup.dump';[IO.File]::WriteAllText($backup,'isolated hash fixture')
 $paths=[pscustomobject]@{PgBin=$PgBin;Secrets=(Join-Path $root 'fixture');Install=$root}
 $tx=[pscustomobject]@{backupCutoffAt=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o');applicationAutostartDisabled=$true;backup=$backup;backupSha256=(Get-FileHash $backup).Hash;snapshotPath=$root;phase='snapshot-ready'}
 $old=[DateTime]::UtcNow.AddHours(-2).ToString('o');$new=[DateTime]::UtcNow.ToString('o')
 Sql ('INSERT INTO "Sale" VALUES (TIMESTAMP '''+$old+'''); INSERT INTO "AuditLog" VALUES (TIMESTAMP '''+$new+''');')|Out-Null
 $rejected=$false
 try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$true}
 if(-not $rejected){throw '3h3: venta offline capturada antes y auditada ahora autoriza restauracion destructiva.'}
 Write-Host 'PASS 3h3: venta offline anterior con AuditLog del servidor posterior rechaza.'
 $truncate='TRUNCATE '+(@($tables+'CashSession'|ForEach-Object{ '"'+$_+'"' }) -join ',')+';'
 foreach($table in $tables){
  Sql $truncate|Out-Null;Sql ('INSERT INTO "'+$table+'" VALUES (TIMESTAMP '''+$new+''');')|Out-Null
  $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$true}
  if(-not $rejected){throw "3h3: actividad posterior permitida: $table"}
  if(([string](Sql ('SELECT count(*) FROM "'+$table+'";'))).Trim() -ne '1'){throw 'Data changed during rejection'}
  Write-Host "PASS 3h3: $table posterior rechaza y conserva fila."
 }
 foreach($column in @('openedAt','closedAt')){
  Sql $truncate|Out-Null
  $opened=if($column -eq 'openedAt'){$new}else{$old};$closed=if($column -eq 'closedAt'){"TIMESTAMP '$new'"}else{'NULL'}
  Sql ('INSERT INTO "CashSession" VALUES (TIMESTAMP '''+$opened+''','+$closed+');')|Out-Null
  $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$true}
  if(-not $rejected){throw "3h3: CashSession $column posterior permitido"}
  Write-Host "PASS 3h3: CashSession $column posterior rechaza."
 }
 Sql $truncate|Out-Null;Sql ('INSERT INTO "Sale" VALUES (TIMESTAMP '''+$old+''');')|Out-Null
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port
 Write-Host 'PASS 3h3: actividad exclusivamente anterior permite recuperacion.'
} finally {
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
