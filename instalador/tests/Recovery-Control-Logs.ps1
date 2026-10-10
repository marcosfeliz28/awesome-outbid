Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$root = Join-Path ([IO.Path]::GetTempPath()) ('nexora-pglogs-' + [guid]::NewGuid().ToString('N'))
$script:exitCode = 0
function Start-Process {
 param($FilePath,$ArgumentList,$WindowStyle,[switch]$PassThru,$RedirectStandardOutput,$RedirectStandardError)
 [IO.File]::WriteAllText($RedirectStandardOutput,'fixture stdout')
 [IO.File]::WriteAllText($RedirectStandardError,'fixture stderr')
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
 [IO.File]::WriteAllText((Join-Path $root 'recovery-postgres.log'),'fixture postgres log')
 [IO.File]::WriteAllText((Join-Path $root 'postgres-user.log'),'keep user log')
 $script:exitCode=0
 Invoke-FitStoreRecoveryPgCtl -Tool 'fixture-pg_ctl.exe' -Database $root -Arguments @('stop')
 if(Test-Path -LiteralPath (Join-Path $root 'recovery-postgres.log')){throw '3h8: log temporal postgres quedo tras detener'}
 if(-not(Test-Path -LiteralPath (Join-Path $root 'postgres-user.log'))){throw '3h8: se borro log ajeno'}
 Write-Host 'PASS 3h8: captura pg_ctl eliminada en exito/fallo; log temporal postgres eliminado tras stop, log ajeno conservado.'
} finally { if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)} }
