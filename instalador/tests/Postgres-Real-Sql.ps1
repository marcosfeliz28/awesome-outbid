param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55618)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$root=Join-Path $env:TEMP ('nexora-real-sql-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster'
$password=[guid]::NewGuid().ToString('N')
$sql='CREATE TABLE "Sale" ("createdAt" timestamp); INSERT INTO "Sale" VALUES (TIMESTAMP ''2000-01-01''); SELECT count(*) FROM "Sale";'
$arguments=@('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','postgres','-t','-A','-v','ON_ERROR_STOP=1')
try{
 New-Item -ItemType Directory -Path $root|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 if(Get-Command Invoke-FitStorePgSql -ErrorAction SilentlyContinue){
  $output=@(Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Arguments $arguments -Password $password -Sql $sql)
 }else{
  $output=@(Invoke-FitStorePg -Tool (Join-Path $PgBin 'psql.exe') -Arguments @($arguments + "--command=$sql") -Password $password)
 }
 if($output -notcontains '1'){throw '3j3: SQL real no devuelve fila Sale'}
 $existSql="SELECT count(*) FROM information_schema.tables WHERE table_name='Sale';"
 if(Get-Command Invoke-FitStorePgSql -ErrorAction SilentlyContinue){$exists=@(Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Arguments $arguments -Password $password -Sql $existSql)}
 else{$exists=@(Invoke-FitStorePg -Tool (Join-Path $PgBin 'psql.exe') -Arguments @($arguments+"--command=$existSql") -Password $password)}
 if($exists -notcontains '1'){throw '3j3: tabla Sale exacta no existe; SQL real perdio comillas dobles'}
 Write-Host 'PASS 3j3 Windows PowerShell real: InvokeFitStorePg preserva tabla "Sale" y devuelve count=1.'
 $before=@(Get-ChildItem -LiteralPath $env:TEMP -Filter 'nexora-private-sql-*.sql' -File | ForEach-Object FullName)
 $failed=$false;try{Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Arguments $arguments -Password $password -Sql 'SELECT FROM;'|Out-Null}catch{$failed=$true}
 if(-not $failed){throw 'SQL invalido no rechazo'}
 $after=@(Get-ChildItem -LiteralPath $env:TEMP -Filter 'nexora-private-sql-*.sql' -File | ForEach-Object FullName)
 if(@(Compare-Object $before $after).Count){throw 'SQL temporal no limpiado'}
 Write-Host 'PASS 3j3: archivo SQL privado retirado tambien ante error real psql.'
}finally{
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
