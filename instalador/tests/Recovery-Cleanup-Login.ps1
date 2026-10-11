param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55620)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$realControl=(Get-Command Invoke-FitStoreRecoveryPgCtl).ScriptBlock
$root=Join-Path $env:TEMP ('nexora-cleanup-login-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster'
$script:failure=''
function Get-CimInstance {param($ClassName,$Filter,$ErrorAction) [pscustomobject]@{StartMode='Disabled';State='Stopped'}}
function Get-Service {param($Name,$ErrorAction) [pscustomobject]@{Status='Stopped'}}
function Read-FitStoreJson {param($Path) if($Path -eq 'fixture'){return @{postgresPassword=[guid]::NewGuid().ToString('N');databasePassword=[guid]::NewGuid().ToString('N')}};if(Test-Path -LiteralPath $Path){Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json}}
function Write-FitStoreJson {param($Path,$Value,[switch]$Protect) [IO.File]::WriteAllText($Path,($Value|ConvertTo-Json -Depth 20))}
function Get-FitStoreDatabaseActivitySql {param($Psql,$Arguments,$Password,$Archive,$Timestamp) 'SELECT 0;'}
function Enable-FitStoreTemporaryPostgresAccess {param($Database,$TransactionPath) [IO.File]::WriteAllText((Join-Path $TransactionPath 'recovery-pgdata-acl.json'),'KEEP'); [pscustomobject]@{Path=$Database;Sddl='fixture'}}
function Restore-FitStoreTemporaryPostgresAccess {param($OriginalAcl,$StatePath) if($script:failure -eq 'acl'){throw 'INJECTED ACL cleanup'}; Remove-Item -LiteralPath $StatePath -Force}
function Invoke-FitStoreRecoveryPgCtl {
 param($Tool,$Database,$Arguments)
 if($Arguments -contains 'stop' -and $script:failure -eq 'stop'){throw 'INJECTED stop cleanup'}
 & $realControl -Tool $Tool -Database $Database -Arguments $Arguments
}
function Sql {param($Text) @(Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Password 'isolated-trust' -Arguments @('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','postgres','-t','-A','-v','ON_ERROR_STOP=1') -Sql $Text)}
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 & $realControl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $cluster 'recovery-postgres.log'),'-o',"-p $Port",'-w','start')
 Sql 'CREATE ROLE fitstore LOGIN; CREATE DATABASE fitstore;'|Out-Null
 & $realControl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')
 $backup=Join-Path $root 'backup.dump';[IO.File]::WriteAllText($backup,'fixture guard archive')
 $paths=@{PgBin=(Join-Path $root 'missing-bin');Install=$root;Database=$cluster;Secrets='fixture';Data=$root}
 $tx=[pscustomobject]@{backupCutoffAt=[DateTimeOffset]::UtcNow.AddMinutes(-1).ToString('o');applicationAutostartDisabled=$true;backup=$backup;backupSha256=(Get-FileHash $backup).Hash;snapshotPath=$root;phase='services';transactionPath=$root}
 foreach($mode in @('stop','acl','success')) {
  $script:failure=$mode;$caught=$null;$warnings=[Collections.Generic.List[string]]::new()
  try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $tx -DatabasePort $Port -ExclusiveAccess -VerifiedPgBin $PgBin 3>&1 | ForEach-Object {if($_ -is [Management.Automation.WarningRecord]){$warnings.Add($_.Message)}}}catch{$caught=$_}
  if($mode -eq 'acl' -and ($warnings -join ' ') -notmatch 'Limpieza incompleta.*soporte.*marcador.*diario'){throw 'ACL cleanup failure omitted explicit support/journal warning'}
  if($mode -ne 'success' -and (-not $caught -or $caught.Exception.Message -notlike "*INJECTED $mode*")){throw "Original $mode error lost: $caught"}
  if(-not(Test-Path (Join-Path $cluster 'postmaster.pid'))){& $realControl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $cluster 'recovery-postgres.log'),'-o',"-p $Port",'-w','start')}
  $login=(Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';") -join ''
  if($mode -eq 'success'){if($caught -or $login.Trim() -ne 'f'){throw 'Successful guard lost exclusivity'}}
  else {if($login.Trim() -ne 't'){throw "$mode cleanup failure left real fitstore NOLOGIN"};if(-not(Test-Path (Join-Path $root 'recovery-pgdata-acl.json'))){throw 'Cleanup failure discarded ACL journal'}}
  Write-Host "PASS 3l M3 ${mode}: real LOGIN state and original error verified."
  Disable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets (Read-FitStoreJson 'fixture') -DatabasePort $Port
  & $realControl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')
  # Each scenario is independent; fixture journal is not a production DACL.
  Remove-Item -LiteralPath (Join-Path $root 'recovery-pgdata-acl.json') -Force -ErrorAction SilentlyContinue
 }
} finally {
 if(Test-Path (Join-Path $cluster 'postmaster.pid')){& $realControl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
