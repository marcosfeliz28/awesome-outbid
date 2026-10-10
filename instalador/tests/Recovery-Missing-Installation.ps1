Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
. (Join-Path $PSScriptRoot '../scripts/FitStore.Common.ps1')
$root=Join-Path $env:TEMP ('nexora-moved-install-'+[guid]::NewGuid().ToString('N'))
$install=Join-Path $root 'installation'
$transaction=Join-Path $root 'transaction'
$snapshot=Join-Path $transaction 'snapshot'
$external=Join-Path $root 'recovery'
$original=Get-Location
try{
 foreach($path in @($install,$transaction,$external)){New-Item -ItemType Directory -Path $path -Force|Out-Null}
 [IO.File]::WriteAllText((Join-Path $install 'prior.fixture'),'unchanged')
 Move-Item -LiteralPath $install -Destination $snapshot
 Set-Location -LiteralPath $external
 Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory $external
 if((Get-FitStoreUpdateRecoveryAction -InstallPath $install -SnapshotPath $snapshot -Phase 'prepared-copy-pending') -ne 'restore-snapshot'){throw 'Seleccion no permite restaurar copia previa'}
 if([IO.File]::ReadAllText((Join-Path $snapshot 'prior.fixture')) -ne 'unchanged'){throw 'Snapshot alterado'}
 Write-Host 'PASS ruta ausente: corte tras Move conserva snapshot y permite recuperacion desde carpeta externa.'
 $rejected=$false
 try{Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory $snapshot}catch{$rejected=$_.Exception.Message -like '*transaccion*'}
 if(-not $rejected){throw 'Script dentro de snapshot no rechazado'}
 $junction=Join-Path $root 'alias'
 New-Item -ItemType Junction -Path $junction -Target $transaction|Out-Null
 $throughAlias=Resolve-FitStoreRecoveryPhysicalDirectory -Path (Join-Path $junction 'missing-child')
 $expected=(Resolve-FitStoreRecoveryPhysicalDirectory -Path $transaction)+'\missing-child'
 if($throughAlias -ne $expected){throw 'Ancestro junction no resuelto'}
 $rejected=$false
 try{Assert-FitStoreRecoveryWorkingDirectory -InstallDir $install -TransactionPath $transaction -RecoveryScriptDirectory (Join-Path $junction 'snapshot')}catch{$rejected=$_.Exception.Message -like '*transaccion*'}
 if(-not $rejected){throw 'Alias junction permite paquete interno'}
 [IO.Directory]::Delete($junction)
 Write-Host 'PASS ruta ausente: ancestro junction resuelto y paquete dentro de transaccion rechazado.'
}finally{
 Set-Location -LiteralPath $original.Path
 if(Test-Path -LiteralPath (Join-Path $root 'alias')){[IO.Directory]::Delete((Join-Path $root 'alias'))}
 if(Test-Path -LiteralPath $root){Remove-Item -LiteralPath $root -Recurse -Force}
}
