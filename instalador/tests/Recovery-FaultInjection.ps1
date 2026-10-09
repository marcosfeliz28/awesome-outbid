param([string]$PgBin, [int]$Port=55611)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$recover = Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'
if (-not (Test-Path -LiteralPath $recover)) { throw 'A3: falta recuperacion explicita tras corte de luz.' }
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($recover,[ref]$tokens,[ref]$errors)
$function=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Assert-FitStoreInterruptedRecovery'},$true)
Invoke-Expression $function.Extent.Text
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-a3-'+[guid]::NewGuid().ToString('N'))
$script:ApiService='FitStoreAPI'; $script:WebService='FitStoreWeb'; $script:PostgresService='FitStorePostgres'
$script:count='0'; $script:mode='Disabled'; $script:state='Stopped'
function Get-CimInstance { param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{StartMode=$script:mode;State=$script:state} }
function Start-FitStoreService { param($Name,$TimeoutSeconds) if($Name -ne 'FitStorePostgres'){throw 'Application must not start during guard'} }
function Read-FitStoreJson { param($Path) [pscustomobject]@{databasePassword='fixture-only'} }
function Invoke-FitStorePg { param($Tool,$Password,$Arguments,$FailureMessage) if(($Arguments -join ' ') -notmatch 'SELECT count'){throw 'Only read query allowed'}; return $script:count }
function Get-Service { param($Name,$ErrorAction) [pscustomobject]@{Status='Stopped'} }
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
 [IO.Directory]::CreateDirectory((Join-Path $root 'bin'))|Out-Null
 [IO.File]::WriteAllText((Join-Path $root 'bin\psql.exe'),'not executed')
 Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx
 if($script:pgOperations.Count -ne 2 -or $script:pgOperations[0] -notmatch 'start$' -or $script:pgOperations[1] -notmatch 'stop$'){throw 'A3: snapshot PostgreSQL start/stop unbalanced'}
 Write-Host 'PASS A3: instalacion apartada usa PostgreSQL de snapshot y lo detiene tras consulta.'
 if($PgBin) {
  $cluster=Join-Path $root 'real-pg'
  & (Join-Path $PgBin 'initdb.exe') -D $cluster -U fitstore -A trust --encoding=UTF8 --no-locale | Out-Null
  if($LASTEXITCODE -ne 0){throw 'initdb fixture failed'}
  $control=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Invoke-FitStoreRecoveryPgCtl'},$true)
  Invoke-Expression $control.Extent.Text
  try {
   Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE fitstore;' | Out-Null
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U fitstore -d fitstore -v ON_ERROR_STOP=1 -c 'CREATE TABLE "Sale" ("createdAt" timestamp NOT NULL);' | Out-Null
   if($LASTEXITCODE -ne 0){throw 'fixture schema failed'}
   function Invoke-FitStorePg {param($Tool,$Password,$Arguments,$FailureMessage) & $Tool @Arguments; if($LASTEXITCODE -ne 0){throw $FailureMessage}}
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
  } finally {Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 }
} finally {if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}}
