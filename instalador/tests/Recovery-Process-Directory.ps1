Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$root=Join-Path $env:TEMP ('nexora-process-directory-'+[guid]::NewGuid().ToString('N'))
$install=Join-Path $root 'install';$transaction=Join-Path $root 'transaction';$external=Join-Path $root 'external'
$cwd=[Environment]::CurrentDirectory;$location=Get-Location
try{
 foreach($path in @($install,$transaction,$external)){New-Item -ItemType Directory -Path $path|Out-Null}
 Set-Location -LiteralPath $external
 [Environment]::CurrentDirectory=$transaction
 $rejected=$false;try{Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory $external}catch{$rejected=$_.Exception.Message -match 'transaccion'}
 if(-not $rejected){throw '3j7: CWD del proceso dentro de transaccion no rechazado'}
 Write-Host 'PASS 3j7: GetLocation externo no oculta Environment.CurrentDirectory dentro de transaccion.'
 [Environment]::CurrentDirectory=$external
 $local=Resolve-FitStoreRecoveryPhysicalDirectory -Path $transaction
 $unc='\\localhost\'+$transaction.Substring(0,1)+'$'+$transaction.Substring(2)
 if((Resolve-FitStoreRecoveryPhysicalDirectory -Path $unc) -ne $local){throw 'UNC localhost no equivale ruta fisica'}
 $extended='\\?\UNC\localhost\'+$transaction.Substring(0,1)+'$'+$transaction.Substring(2)
 if((Resolve-FitStoreRecoveryPhysicalDirectory -Path $extended) -ne $local){throw 'UNC extendida no equivale ruta fisica'}
 Write-Host 'PASS 3j7: UNC localhost administrativa y extendida equivalen ruta fisica local.'
}finally{
 [Environment]::CurrentDirectory=$cwd;Set-Location -LiteralPath $location.Path
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
