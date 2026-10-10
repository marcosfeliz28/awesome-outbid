param([string]$PgBin=$env:PGBIN,[int]$Port=55628)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if(-not $PgBin){throw '3l1 requiere PostgreSQL real: indique -PgBin o PGBIN.'}
. (Join-Path $PSScriptRoot 'Exact-Dacl.ps1')
$displayAst=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Recovery-Acl-Interruption.ps1'),[ref]$null,[ref]$null)
$display=$displayAst.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Test-FitStoreIcaclsDisplay'},$true)
if(-not $display){throw 'Falta comparador estricto de icacls.'}
Invoke-Expression $display.Extent.Text
$source=(Resolve-Path (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1')).Path
. $source -DefinitionsOnly
$root=Join-Path $env:TEMP ('nexora-acl-missing-'+[guid]::NewGuid().ToString('N'))
$database=Join-Path $root 'cluster';$transaction=Join-Path $root 'transaction'
$child=$null;$running=$false
try {
 foreach($path in @($database,$transaction)){[IO.Directory]::CreateDirectory($path)|Out-Null}
 # El diario usa FileSystemInfo.FullName. TEMP puede contener alias o '..';
 # comparar la misma representacion real antes de que PostgreSQL borre el leaf.
 $database=(Get-Item -LiteralPath $database -Force).FullName
 $transaction=(Get-Item -LiteralPath $transaction -Force).FullName
 & (Join-Path $PgBin 'initdb.exe') -D $database -U postgres -A trust --encoding=UTF8 --no-locale | Out-Null
 if($LASTEXITCODE -ne 0){throw 'initdb real fallo.'}
 # Obtener un archivo de estadisticas real, creado al detener PostgreSQL.
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $database -Arguments @('-D',$database,'-l',(Join-Path $root 'postgres.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
 $running=$true
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $database -Arguments @('-D',$database,'-m','fast','-w','stop')
 $running=$false
 $volatile=Join-Path $database 'pg_stat/pgstat.stat'
 if(-not(Test-Path -LiteralPath $volatile -PathType Leaf)){throw 'PostgreSQL no genero pg_stat/pgstat.stat para la regresion.'}
 $volatileInput=$volatile
 $volatile=(Get-Item -LiteralPath $volatile -Force).FullName
 $originalIcacls=@{}
 foreach($item in @(Get-Item -LiteralPath $database)+@(Get-ChildItem -LiteralPath $database -Recurse -Force)){
  $originalIcacls[$item.FullName]=(& icacls.exe $item.FullName)-join "`n"
 }
 $ready=Join-Path $root 'ready'
 $command=". '$source' -DefinitionsOnly; Enable-FitStoreTemporaryPostgresAccess -Database '$database' -TransactionPath '$transaction' | Out-Null; Invoke-FitStoreRecoveryPgCtl -Tool '$(Join-Path $PgBin 'pg_ctl.exe')' -Database '$database' -Arguments @('-D','$database','-l','$(Join-Path $root 'postgres.log')','-o','-p $Port -h 127.0.0.1','-w','start'); [IO.File]::WriteAllText('$ready','ready'); Start-Sleep -Seconds 120"
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
 $child=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -WindowStyle Hidden -PassThru
 $deadline=[DateTime]::UtcNow.AddSeconds(30)
 while(-not(Test-Path -LiteralPath $ready) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
 if(-not(Test-Path -LiteralPath $ready)){throw 'Proceso hijo no arranco PostgreSQL real.'}
 $running=$true
 & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -t -A -c 'SELECT 1;'|Out-Null
 if($LASTEXITCODE -ne 0){throw 'PostgreSQL real no responde antes del taskkill.'}
 $state=Join-Path $transaction 'recovery-pgdata-acl.json'
 $saved=@((Get-Content -LiteralPath $state -Raw|ConvertFrom-Json).entries)
 $statEntries=@($saved|Where-Object{[IO.Path]::GetFileName($_.Path) -eq 'pgstat.stat'})
 Write-Host "A1 PATH TEMP_INPUT=$env:TEMP EXPECTED_INPUT=$volatileInput EXPECTED_FULLNAME=$volatile JOURNAL_DATABASE=$((Get-Content -LiteralPath $state -Raw|ConvertFrom-Json).database)"
 foreach($entry in $statEntries){Write-Host "A1 PATH JOURNAL_ENTRY=$($entry.Path)"}
 if(-not @($saved|Where-Object{$_.Path -eq $volatile}).Count){throw 'Archivo volatil no figura en el diario persistido.'}
 & taskkill.exe /PID $child.Id /F|Out-Null
 if($LASTEXITCODE -ne 0){throw 'taskkill no interrumpio el proceso hijo.'}
 $child.WaitForExit()
 Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $database -Arguments @('-D',$database,'-m','fast','-w','stop')
 $running=$false
 Remove-Item -LiteralPath $volatile -Force
 Write-Host 'PRECONDICION: PostgreSQL real respondio; taskkill real; pg_stat/pgstat.stat del diario borrado.'
 Restore-FitStorePendingPostgresAccess -Database $database -StatePath $state
 foreach($entry in $saved){
  if(-not(Test-Path -LiteralPath $entry.Path)){continue}
  $actual=(Get-Acl -LiteralPath $entry.Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
  if(-not(Test-FitStoreExactDacl $entry.Sddl $actual)){throw "Permisos distintos en $($entry.Path)"}
  $text=(& icacls.exe $entry.Path)-join "`n"
  if(-not(Test-FitStoreIcaclsDisplay $originalIcacls[$entry.Path] $text $entry.Sddl $actual)){throw "icacls distinto en $($entry.Path)"}
 }
 if(Test-Path -LiteralPath $state){throw 'Diario no retirado tras recuperar todas las entradas existentes.'}
 Write-Host 'PASS 3l1: archivo volatil inexistente no bloquea; DACL ordenadas e icacls de todas las entradas restantes coinciden.'
 # Una entrada inexistente fuera de PGDATA sigue siendo un ataque rechazado.
 [IO.File]::WriteAllText($state,(@{database=$database;entries=@(@{Path=(Join-Path $root 'outside-missing');Sddl='D:(A;;FA;;;SY)'})}|ConvertTo-Json -Depth 4))
 $rejected=$false
 try{Restore-FitStorePendingPostgresAccess -Database $database -StatePath $state}catch{if($_.Exception.Message -like '*fuera de PGDATA*'){$rejected=$true}else{throw}}
 if(-not $rejected){throw 'Ruta externa inexistente aceptada.'}
 Write-Host 'PASS 3l1 negativo: ruta externa inexistente sigue rechazada; no se relajan permisos ni validacion de rutas.'
} finally {
 if($child){if(-not $child.HasExited){Stop-Process -Id $child.Id -Force};$child.Dispose()}
 if($running){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $database -Arguments @('-D',$database,'-m','immediate','-w','stop')}
 if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}
}
