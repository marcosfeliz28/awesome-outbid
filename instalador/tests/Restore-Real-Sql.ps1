param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin', [int]$Port=55619)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '../scripts/Restore-FitStore.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Restore script did not parse'}
$definition=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-FitStoreRestoredDatabase'},$true)
if(-not $definition){throw 'Missing restored-database validator'}
# Change only the connection port to isolate this test; SQL and helpers are real.
Invoke-Expression ($definition.Extent.Text.Replace('--port=5434',"--port=$Port"))
$root=Join-Path $env:TEMP ('nexora-restore-sql-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster'
$password=[guid]::NewGuid().ToString('N')
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U fitstore -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 $arguments=@('--host=127.0.0.1',"--port=$Port",'--username=fitstore','--dbname=postgres','--no-password','--set=ON_ERROR_STOP=1')
 Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Arguments $arguments -Password $password -Sql 'CREATE TABLE "_prisma_migrations" (id text); CREATE TABLE "User" (id text); CREATE TABLE "Product" (id text);'|Out-Null
 Test-FitStoreRestoredDatabase -Paths @{PgBin=$PgBin} -Secrets @{databasePassword=$password} -Database postgres|Out-Null
 Write-Host 'PASS 3l A2: real Windows PowerShell/PostgreSQL validates quoted _prisma_migrations, User and Product.'
 Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Arguments $arguments -Password $password -Sql 'DROP TABLE "Product";'|Out-Null
 $rejected=$false; try {Test-FitStoreRestoredDatabase -Paths @{PgBin=$PgBin} -Secrets @{databasePassword=$password} -Database postgres|Out-Null}catch{$rejected=$true}
 if(-not $rejected){throw 'Missing Product was accepted'}
 Write-Host 'PASS 3l A2: missing required table is rejected by real psql.'
} finally {
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')) {Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
