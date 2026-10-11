Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$root = Join-Path ([IO.Path]::GetTempPath()) ('nexora-pglogs-' + [guid]::NewGuid().ToString('N'))
$script:exitCode = 0
$script:launchFailure = $false
function Start-Process {
 param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
 [IO.File]::WriteAllText($RedirectStandardOutput,'fixture stdout')
 [IO.File]::WriteAllText($RedirectStandardError,'fixture stderr')
 if ($script:launchFailure) { throw 'injected-launch-failure' }
 $process = [pscustomobject]@{Handle=1;ExitCode=$script:exitCode}
 $process | Add-Member ScriptMethod WaitForExit { }
 $process | Add-Member ScriptMethod Refresh { }
 return $process
}
try {
 [IO.Directory]::CreateDirectory($root)|Out-Null
 foreach($code in @(0,1)) {
  $script:exitCode=$code;$rejected=$false
  try { Invoke-FitStoreRecoveryPgCtl -Tool 'fixture-pg_ctl.exe' -Database $root -Arguments @('start') } catch {$rejected=$true}
  if($rejected -ne ($code -ne 0)){throw '3h8: control de exitcode perdido'}
  if(@(Get-ChildItem -LiteralPath $root -Filter 'recovery-control-*').Count){throw '3h8: stdout/stderr de pg_ctl quedaron en PGDATA'}
 }
 $script:launchFailure=$true;$caught=$null
 try {Invoke-FitStoreRecoveryPgCtl -Tool 'fixture-pg_ctl.exe' -Database $root -Arguments @('start')} catch {$caught=$_}
 if(-not $caught -or $caught.Exception.Message -ne 'injected-launch-failure'){throw '3h8: se oculto error de lanzamiento'}
 $script:launchFailure=$false
 [IO.File]::WriteAllText((Join-Path $root 'recovery-postgres.log'),'fixture postgres log')
 $legacy=Join-Path $root ('recovery-control-'+[guid]::NewGuid().ToString('N')+'.err')
 [IO.File]::WriteAllText($legacy,'legacy stderr')
 [IO.File]::WriteAllText((Join-Path $root 'postgres-user.log'),'keep user log')
 $script:exitCode=1;$rejected=$false
 try {Invoke-FitStoreRecoveryPgCtl -Tool 'fixture-pg_ctl.exe' -Database $root -Arguments @('stop')}catch{$rejected=$true}
 if(-not $rejected -or -not(Test-Path -LiteralPath (Join-Path $root 'recovery-postgres.log')) -or -not(Test-Path -LiteralPath $legacy)){throw 'Failed stop removed PostgreSQL logs or hid failure'}
 $script:exitCode=0
 Invoke-FitStoreRecoveryPgCtl -Tool 'fixture-pg_ctl.exe' -Database $root -Arguments @('stop')
 if(Test-Path -LiteralPath (Join-Path $root 'recovery-postgres.log')){throw '3h8: log temporal postgres quedo tras detener'}
 if(Test-Path -LiteralPath $legacy){throw '3h8: captura antigua quedo tras detener'}
 if(-not(Test-Path -LiteralPath (Join-Path $root 'postgres-user.log'))){throw '3h8: se borro log ajeno'}
 Write-Host 'PASS 3h8: captura pg_ctl eliminada en exito/fallo; log temporal postgres eliminado tras stop, log ajeno conservado.'
} finally { if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)} }
