param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55617)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$rollbackPath=Join-Path $PSScriptRoot '..\scripts\Rollback-FitStoreUpdate.ps1'
$source=Get-Content -LiteralPath $rollbackPath -Raw
$start=$source.IndexOf('try {' + "`r`n" + '  Stop-FitStoreApplication')
if($start -lt 0){$start=$source.IndexOf('try {' + "`n" + '  Stop-FitStoreApplication')}
if($start -lt 0){throw 'Fixture no encontro cuerpo rollback'}
$fixtureBody=[regex]::Replace($source.Substring($start),'(?m)^(\s*Disable-FitStoreRecoveryIsolation[^\r\n]+)$','$1 -DatabasePort $Port')
$body=[scriptblock]::Create('$databaseTouched = $false; $isolationReleased = $false' + "`n" + $fixtureBody)
. (Join-Path $PSScriptRoot '..\scripts\Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$tokens=$null;$parseErrors=$null
$commonAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..\scripts\FitStore.Common.ps1'),[ref]$tokens,[ref]$parseErrors)
foreach($name in @('Invoke-FitStoreProcess','Invoke-FitStorePg','Invoke-FitStorePgSql')){
 $definition=$commonAst.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
 if(-not $definition){throw "Falta Common real: $name"};Invoke-Expression $definition.Extent.Text
}
$actionFunction=$commonAst.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-FitStoreUpdateRecoveryAction'},$true)
if(-not $actionFunction){throw 'Falta selector real de recuperacion'}
. ([scriptblock]::Create($actionFunction.Extent.Text))
$root=Join-Path $env:TEMP ('nexora-restart-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster'
$script:running=$false;$script:inject='';$script:logs=@()
function Sql([string]$query){Invoke-FitStorePgSql -Tool (Join-Path $PgBin 'psql.exe') -Password ([guid]::NewGuid().ToString('N')) -Arguments @('-h','127.0.0.1','-p',[string]$Port,'-U','postgres','-d','postgres','-t','-A','-v','ON_ERROR_STOP=1') -Sql $query -FailureMessage 'Fixture SQL failed'}
function Start-FitStoreService {param($Name)
 if(-not $script:running){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start');$script:running=$true}
}
function Stop-FitStoreService {param($Name,$TimeoutSeconds)
 if($script:running){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop');$script:running=$false}
}
function Wait-FitStorePostgres {
 param([Parameter(Mandatory = $true)]$Paths, [int]$TimeoutSeconds = 90)
 Sql 'SELECT 1;'|Out-Null
}
$realWait=$commonAst.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-FitStorePostgres'},$true)
$fixtureAst=[Management.Automation.Language.Parser]::ParseFile($PSCommandPath,[ref]$tokens,[ref]$parseErrors)
$fixtureWait=$fixtureAst.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Wait-FitStorePostgres'},$true)
if(-not $realWait -or $realWait.Body.ParamBlock.Extent.Text -ne $fixtureWait.Body.ParamBlock.Extent.Text){throw '3j1: firma de espera fixture no coincide con funcion real'}
function Read-FitStoreJson {param($Path) [pscustomobject]@{postgresPassword=[guid]::NewGuid().ToString('N') }}
function Stop-FitStoreApplication {}
function Ensure-RestoredApplicationService {param($Paths,$Name,[switch]$KeepDisabled) if($script:inject -eq 'winsw'){throw 'fixture-original-winsw'}; return 'LocalSystem'}
function Resolve-FitStoreServiceAccountSid {param($Account) 'S-1-5-18'}
function Remove-FitStoreLocalServiceAccess {param($Paths)}
function Set-FitStoreServiceStartMode {param($Name,$Mode)}
function Start-FitStoreApplication {}
function Wait-FitStoreHttp {param($Url,$TimeoutSeconds) if($script:inject -eq 'health'){throw 'fixture-original-health'}}
function Write-FitStoreLog {param($InstallDir,$Level,$Message) $script:logs+= $Message}
function Assert-UpdateManifest {param($Manifest,$ExpectedManifestHash,$Root)}
function Restore-PreviousDataFiles {param($Paths,$PreviousDataPath)}
function Restore-DatabaseFromUpdateBackup {param($Paths,$Secrets,$Archive,$ExpectedHash,[switch]$ExclusiveRecovery) throw 'fixture-original-pg-restore'}
$script:PostgresService='fixture-pg';$script:ApiService='fixture-api';$script:WebService='fixture-web'
try {
 New-Item -ItemType Directory -Path $root|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb failed'}
 $paths=[pscustomobject]@{PgBin=$PgBin;Secrets=(Join-Path $root 'unused')};$actualInstall=$root
 $transaction=[pscustomobject]@{transactionPath=$root;recoveryLoginRoles=@('fitstore');manifestPath='fixture';manifestSha256='fixture';backup='fixture';backupSha256='fixture'}
 $RecoverInterrupted=$true;$hadSnapshot=$false;$previousDataPath='';$snapshotPath=$root;$failedInstall=Join-Path $root 'failed'
 Start-FitStoreService
 Sql 'CREATE ROLE fitstore NOLOGIN;'|Out-Null
 foreach($case in @('success','winsw','health','pg-restore')){
  if(-not $script:running){Start-FitStoreService}
  Sql 'ALTER ROLE fitstore NOLOGIN;'|Out-Null
  $script:inject=if($case -in @('winsw','health')){$case}else{''};$script:logs=@()
  $phase=if($case -eq 'pg-restore'){'rollback-files-restored'}else{'prepared-copy-pending'}
  $recoveryAction=Get-FitStoreUpdateRecoveryAction -InstallPath $root -SnapshotPath (Join-Path $root 'missing-snapshot') -Phase $phase
  $marker=Join-Path $root 'marker';[IO.File]::WriteAllText($marker,'fixture')
  $transactionPath=Join-Path $root 'discarded';New-Item -ItemType Directory -Path $transactionPath -Force|Out-Null
  $failure=$null;try { & $body }catch {$failure=$_}
  if($case -eq 'success'){
   if($failure){throw "3i1: restart-previous no restituye LOGIN: $($failure.Exception.Message)"}
   if(([string](Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';")).Trim() -ne 't'){throw 'LOGIN no restituido'}
   Write-Host 'PASS 3i1 PostgreSQL real: prepared-copy-pending restart-previous arranca cluster antes de restituir LOGIN.'
  }elseif($case -eq 'winsw'){
   if(-not $failure -or $failure.Exception.Message -ne 'fixture-original-winsw'){throw 'No conserva fallo original WinSW'}
   if(([string](Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';")).Trim() -ne 't'){throw 'LOGIN no restituido sin tocar base'}
   Write-Host 'PASS 3i1 PostgreSQL real: fallo WinSW con base intacta restituye LOGIN y conserva error original.'
  }elseif($case -eq 'health'){
   if(-not $failure -or $failure.Exception.Message -ne 'fixture-original-health'){throw 'No conserva fallo original HTTP'}
   if(([string](Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';")).Trim() -ne 't'){throw 'LOGIN restituido no conservado'}
   if(-not($script:logs -match 'LOGIN ya fue restituido') -or ($script:logs -match 'NOLOGIN conservado a proposito')){throw 'Estado LOGIN falso tras fallo HTTP'}
   Write-Host 'PASS PostgreSQL real: fallo HTTP posterior informa LOGIN ya restituido, sin prometer NOLOGIN.'
  }else{
   if(-not $failure -or $failure.Exception.Message -ne 'fixture-original-pg-restore'){throw 'No conserva fallo original restore'}
   Start-FitStoreService
   if(([string](Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';")).Trim() -ne 'f'){throw 'Base posiblemente parcial habilitada'}
   if(-not ($script:logs -match 'NOLOGIN.*proposito')){throw 'Falta aviso cierre deliberado'}
   Write-Host 'PASS 3i1 PostgreSQL real: fallo tras tocar base conserva NOLOGIN deliberado, aviso y error original.'
  }
 }
}finally{
 if($script:running){Stop-FitStoreService}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
