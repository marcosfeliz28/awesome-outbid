param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin', [int]$Port=55625)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if ($PSVersionTable.PSVersion.Major -ne 5) { throw 'Run this regression with Windows PowerShell 5.1.' }
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Windows-Smoke.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Windows-Smoke did not parse'}
$statements=@{}
foreach($name in @('query','production','restored')) {
 $assignment=$ast.Find({param($node) $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq ('$'+$name)},$true)
 if(-not $assignment){throw "Missing actual smoke assignment: $name"}
 # Only connection targets change. Execute the actual smoke SQL and helpers.
 $statements[$name]=$assignment.Extent.Text.Replace('--port=5434',"--port=$Port").Replace('--dbname=fitstore','--dbname=postgres')
}
$tempBase=[IO.Path]::GetFullPath($env:TEMP)
$root=Join-Path $tempBase ('nexora-smoke-sql-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster'
$password=[guid]::NewGuid().ToString('N')
$previousPassword=$env:PGPASSWORD
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U fitstore -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 $startArguments=@('-D',('"'+$cluster+'"'),'-l',('"'+(Join-Path $root 'pg.log')+'"'),'-o',('"-p '+$Port+' -h 127.0.0.1"'),'-w','start')
 $startProcess=Start-Process -FilePath (Join-Path $PgBin 'pg_ctl.exe') -ArgumentList $startArguments -WindowStyle Hidden -PassThru
 $startProcess.WaitForExit()
 $startProcess.Refresh()
 if($startProcess.ExitCode -ne 0){throw 'Isolated PostgreSQL startup failed'}
 $startProcess.Dispose()
 $psql=Join-Path $PgBin 'psql.exe'
 $secrets=@{databasePassword=$password}
 $testDatabase='smoke_restore_fixture'
 Invoke-FitStorePg -Tool (Join-Path $PgBin 'createdb.exe') -Password $password -Arguments @('--host=127.0.0.1',"--port=$Port",'--username=fitstore',$testDatabase)
 $fixture='CREATE TABLE "User" (id int); INSERT INTO "User" VALUES (1),(2); CREATE TABLE "Sale" (id int); INSERT INTO "Sale" VALUES (1),(2),(3); CREATE TABLE _prisma_migrations (id int); INSERT INTO _prisma_migrations VALUES (1),(2),(3),(4);'
 foreach($database in @('postgres',$testDatabase)) {
  Invoke-FitStorePgSql -Tool $psql -Arguments @('--host=127.0.0.1',"--port=$Port",'--username=fitstore',"--dbname=$database",'--set=ON_ERROR_STOP=1') -Password $password -Sql $fixture|Out-Null
 }
 $env:PGPASSWORD=$password
 Invoke-Expression $statements.query
 Invoke-Expression $statements.production
 Invoke-Expression $statements.restored
 if($production -ne '2|3|4' -or $restored -ne '2|3|4'){throw "Wrong actual smoke counts: $production / $restored"}
 if($env:PGPASSWORD -ne $password){throw 'SQL helper changed the existing PGPASSWORD'}
 Write-Host 'PASS Windows-Smoke: actual SQL assignments return 2|3|4 for both isolated databases under PowerShell 5.1.'
 Invoke-FitStorePgSql -Tool $psql -Arguments @('--host=127.0.0.1',"--port=$Port",'--username=fitstore',"--dbname=$testDatabase",'--set=ON_ERROR_STOP=1') -Password $password -Sql 'DROP TABLE "Sale";'|Out-Null
 $rejected=$false
 try {Invoke-Expression $statements.restored}catch{$rejected=$true}
 if(-not $rejected){throw 'Missing Sale was accepted by the actual restored-count assignment'}
 if($env:PGPASSWORD -ne $password){throw 'Failed SQL helper changed the existing PGPASSWORD'}
 Write-Host 'PASS Windows-Smoke: actual restored-count assignment rejects a missing Sale table.'
} finally {
 if($null -eq $previousPassword){Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue}else{$env:PGPASSWORD=$previousPassword}
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')) {
  & (Join-Path $PgBin 'pg_ctl.exe') -D $cluster -m fast -w stop|Out-Null
  if($LASTEXITCODE -ne 0){throw 'Isolated PostgreSQL shutdown failed; preserve the fixture'}
 }
 $resolvedRoot=[IO.Path]::GetFullPath($root)
 if(-not $resolvedRoot.StartsWith($tempBase.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase) -or (Split-Path -Leaf $resolvedRoot) -notlike 'nexora-smoke-sql-*'){throw 'Unsafe fixture cleanup target'}
 if(Test-Path -LiteralPath $resolvedRoot){Remove-Item -LiteralPath $resolvedRoot -Recurse -Force}
}
