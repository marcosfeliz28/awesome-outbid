param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55614,[string]$RecoverySource)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
$source=if($RecoverySource){$RecoverySource}else{Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'}
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$t,[ref]$e)
foreach($f in $ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)){Invoke-Expression $f.Extent.Text}
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-activity-'+[guid]::NewGuid().ToString('N'));$cluster=Join-Path $root 'cluster'
$script:ApiService='FitStoreAPI';$script:WebService='FitStoreWeb';$script:PostgresService='FixturePostgres'
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{StartMode='Disabled';State='Stopped'}}
function Start-FitStoreService {param($Name,$TimeoutSeconds)}
function Read-FitStoreJson {param($Path) [pscustomobject]@{databasePassword=[guid]::NewGuid().ToString('N')}}
function Sql([string]$Query){Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Password ([guid]::NewGuid().ToString('N')) -Arguments @('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','fitstore','-t','-A','-v','ON_ERROR_STOP=1') -Sql $Query -FailureMessage 'Fixture SQL failed'}
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'Fixture initdb failed'}
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -c 'CREATE ROLE fitstore LOGIN;'|Out-Null
 & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -c 'CREATE DATABASE fitstore OWNER fitstore;'|Out-Null
 $schema=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../apps/api/prisma/schema.prisma') -Raw
 $activityFields=[ordered]@{}
 foreach($model in [regex]::Matches($schema,'(?ms)^model\s+(\w+)\s*\{(.*?)^\}')){
  $columns=@([regex]::Matches($model.Groups[2].Value,'(?m)^\s+(createdAt|updatedAt|openedAt|closedAt)\s+DateTime\??\b')|ForEach-Object{$_.Groups[1].Value})
  if($columns.Count){$activityFields[$model.Groups[1].Value]=$columns}
 }
 foreach($table in $activityFields.Keys){
  $definition=(@($activityFields[$table]|ForEach-Object{'"'+$_+'" timestamp'}) -join ',')
  Sql ('CREATE TABLE "'+$table+'" ('+$definition+'); GRANT SELECT ON "'+$table+'" TO fitstore;')|Out-Null
 }
 $tables=@('Sale','AuditLog','Payment','SaleReturn','CashMovement','InventoryMovement')
 $backup=Join-Path $root 'backup.dump'
 & (Join-Path $PgBin 'pg_dump.exe') -h 127.0.0.1 -p $Port -U postgres -d fitstore -Fc -f $backup
 if($LASTEXITCODE -ne 0){throw 'Fixture dump real fallo'}
 $paths=[pscustomobject]@{PgBin=$PgBin;Secrets=(Join-Path $root 'fixture');Install=$root}
 $tx=[pscustomobject]@{backupCutoffAt=[DateTimeOffset]::UtcNow.AddHours(-1).ToString('o');applicationAutostartDisabled=$true;backup=$backup;backupSha256=(Get-FileHash $backup).Hash;snapshotPath=$root;phase='snapshot-ready'}
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port
 Write-Host 'PASS 3j3: Common real permite base sin actividad antes de probar rechazos.'
 $old=[DateTime]::UtcNow.AddHours(-2).ToString('o');$new=[DateTime]::UtcNow.ToString('o')
 Sql ('INSERT INTO "Sale" ("createdAt","updatedAt") VALUES (TIMESTAMP '''+$old+''',TIMESTAMP '''+$new+''');')|Out-Null
 $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$true}
 if(-not $rejected){throw '3i4: Sale.updatedAt posterior sin AuditLog autoriza restauracion.'}
 Write-Host 'PASS 3i4: Sale antigua actualizada despues sin AuditLog rechaza.'
 Sql 'TRUNCATE "Sale";'|Out-Null
 Sql ('INSERT INTO "Sale" ("createdAt") VALUES (TIMESTAMP '''+$old+'''); INSERT INTO "AuditLog" VALUES (TIMESTAMP '''+$new+''');')|Out-Null
 $rejected=$false
 try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$true}
 if(-not $rejected){throw '3h3: venta offline capturada antes y auditada ahora autoriza restauracion destructiva.'}
 Write-Host 'PASS 3h3: venta offline anterior con AuditLog del servidor posterior rechaza.'
 $truncate='TRUNCATE '+(@($activityFields.Keys|ForEach-Object{ '"'+$_+'"' }) -join ',')+';'
 foreach($table in $tables){
  Sql $truncate|Out-Null;Sql ('INSERT INTO "'+$table+'" ("createdAt") VALUES (TIMESTAMP '''+$new+''');')|Out-Null
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
 foreach($table in $activityFields.Keys){foreach($column in $activityFields[$table]){
  Sql $truncate|Out-Null;Sql ('INSERT INTO "'+$table+'" ("'+$column+'") VALUES (TIMESTAMP '''+$new+''');')|Out-Null
  $rejected=$false;try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port}catch{$rejected=$true}
  if(-not $rejected){throw "3i4: escritura no auditada permitida $table.$column"}
 }}
 Write-Host ('PASS 3i4: todos los '+$activityFields.Count+' modelos con marcas de actividad rechazan escritura posterior sin AuditLog.')
 Sql $truncate|Out-Null;Sql ('INSERT INTO "Sale" ("createdAt","updatedAt") VALUES (TIMESTAMP '''+$old+''',TIMESTAMP '''+$old+''');')|Out-Null
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port
 Write-Host 'PASS 3h3: actividad exclusivamente anterior permite recuperacion.'
} finally {
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
