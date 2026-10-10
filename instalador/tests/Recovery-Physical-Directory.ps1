param([string]$RecoverySource=(Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'))
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. $RecoverySource -DefinitionsOnly
if(-not(Get-Command Resolve-FitStoreRecoveryPhysicalDirectory -ErrorAction SilentlyContinue)){throw '3i3: falta resolver ruta fisica de recuperacion'}
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-physical-'+[guid]::NewGuid().ToString('N'))
$original=Get-Location
try {
 $install=Join-Path $root 'installation';$transaction=Join-Path $root 'transaction';$external=Join-Path $root 'external'
 foreach($path in @($install,$transaction,$external)){[IO.Directory]::CreateDirectory($path)|Out-Null}
 $link=Join-Path $root 'alias'
 New-Item -ItemType Junction -Path $link -Target $transaction|Out-Null
 Set-Location $external
 Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory $external
 foreach($scenario in @('cwd','script')){
  $rejected=$false
  try {
   if($scenario -eq 'cwd'){Set-Location $link;Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory $external}
   else {Set-Location $external;Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory $link}
  } catch {if($_.Exception.Message -notmatch 'dentro de la transaccion'){throw};$rejected=$true}
  if(-not $rejected){throw "3i3: $scenario junction no rechazado"}
 }
 Write-Host 'PASS 3i3: paquete externo permitido; cwd y script dentro de transactionPath via junction rechazados antes de rollback.'
} finally {
 Set-Location $original
 if(Test-Path -LiteralPath $link){[IO.Directory]::Delete($link)}
 if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}
}
