param([string]$PgBin='C:/Program Files/PostgreSQL/18/bin',[int]$Port=55613,[string]$RecoverySource)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source=if($RecoverySource){$RecoverySource}else{Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'}
$t=$null;$e=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$t,[ref]$e)
foreach($f in $ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst]},$true)){Invoke-Expression $f.Extent.Text}
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-login-exit-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster';$marker=Join-Path $root 'marker.json'
function Read-FitStoreJson {param($Path) Get-Content -LiteralPath $Path -Raw|ConvertFrom-Json}
function Write-FitStoreJson {param($Path,$Value,[switch]$Protect) [IO.File]::WriteAllText($Path,($Value|ConvertTo-Json -Depth 10))}
function Invoke-FitStorePg {param($Tool,$Password,$Arguments,$FailureMessage) & $Tool @Arguments; if($LASTEXITCODE -ne 0){throw $FailureMessage}}
function Sql([string]$Query){ & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -t -A -v ON_ERROR_STOP=1 -c $Query; if($LASTEXITCODE -ne 0){throw 'Fixture SQL failed'} }
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale|Out-Null
 if($LASTEXITCODE -ne 0){throw 'Fixture initdb failed'}
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $root 'pg.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 Sql 'CREATE ROLE fitstore NOLOGIN; CREATE ROLE cashier LOGIN;'|Out-Null
 $tx=[pscustomobject]@{transactionPath=$root;installerSession='isolated';phase='snapshot-ready'}
 Write-FitStoreJson -Path $marker -Value $tx
 Write-FitStoreJson -Path (Join-Path $root 'recovery-login-state.json') -Value @{originalLoginRoles=@()}
 $secrets=[pscustomobject]@{postgresPassword=[guid]::NewGuid().ToString('N')}
 Disable-FitStoreRecoveryIsolation -Transaction $tx -Psql (Join-Path $PgBin 'psql.exe') -Secrets $secrets -DatabasePort $Port
 if(([string](Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='fitstore';")).Trim() -ne 't'){throw '3h2: fitstore sigue NOLOGIN cuando falta en la lista original.'}
 Write-Host 'PASS 3h2: fitstore LOGIN siempre, incluso lista original vacia.'
 $args=@{Transaction=$tx;Psql=(Join-Path $PgBin 'psql.exe');Secrets=$secrets;DatabasePort=$Port}
 if((Get-Command Enable-FitStoreRecoveryIsolation).Parameters.ContainsKey('MarkerPath')){$args.MarkerPath=$marker}
 Enable-FitStoreRecoveryIsolation @args
 $saved=Read-FitStoreJson -Path $marker
 if($saved.PSObject.Properties.Name -notcontains 'recoveryLoginRoles' -or 'cashier' -notin $saved.recoveryLoginRoles){throw '3h2: lista de LOGIN no conservada en marcador.'}
 Remove-Item -LiteralPath (Join-Path $root 'recovery-login-state.json')
 Disable-FitStoreRecoveryIsolation -Transaction $saved -Psql (Join-Path $PgBin 'psql.exe') -Secrets $secrets -DatabasePort $Port
 if(([string](Sql "SELECT rolcanlogin FROM pg_roles WHERE rolname='cashier';")).Trim() -ne 't'){throw '3h2: perder archivo auxiliar pierde restitucion del marcador.'}
 Write-Host 'PASS 3h2: marcador conserva lista y recupera LOGIN si falta archivo auxiliar.'
 if((Get-Content -LiteralPath $source -Raw).IndexOf('ALTER ROLE fitstore LOGIN') -lt 0){throw '3h2: falta salida manual en log.'}
 Write-Host 'PASS 3h2: salida manual documentada en log sin secretos.'
} finally {
 if(Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid')){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
