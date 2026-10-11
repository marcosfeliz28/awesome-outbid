Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Exact-Dacl.ps1')
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$root=Join-Path $env:TEMP ('nexora-pending-always-'+[guid]::NewGuid().ToString('N'))
$database=Join-Path $root 'cluster';$transactionPath=Join-Path $root 'transaction'
$marker=Join-Path $root 'marker'
$script:ApiService='fixture-api';$script:WebService='fixture-web'
try {
 foreach($p in @($database,$transactionPath)){[IO.Directory]::CreateDirectory($p)|Out-Null}
 # El diario real usa FullName, no la representacion 8.3/../ del TEMP de CI.
 # Los JSON negativos deben cambiar solamente el campo que estan probando.
 $root=(Get-Item -LiteralPath $root).FullName
 $database=(Get-Item -LiteralPath $database).FullName
 $transactionPath=(Get-Item -LiteralPath $transactionPath).FullName
 $marker=Join-Path $root 'marker'
 $original=(Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 Enable-FitStoreTemporaryPostgresAccess -Database $database -TransactionPath $transactionPath|Out-Null
 $paths=[pscustomobject]@{Database=$database;PgBin='unused'}
 $transaction=[pscustomobject]@{transactionPath=$transactionPath;backupCutoffAt=[DateTimeOffset]::UtcNow.AddMinutes(-2).ToString('o');applicationAutostartDisabled=$true;backup='unused';backupSha256='unused';snapshotPath='unused';phase='verified'}
 $denied=$false
 try{Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $transaction}catch{if($_.Exception.Message -like '*transaccion no acredita*'){$denied=$true}else{throw}}
 if(-not $denied){throw 'Transaccion verified no rechazada.'}
 if(-not(Test-FitStoreExactDacl $original (Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw 'M1: diario no restaurado al entrar antes de rechazar la recuperacion.'}
 if(Test-Path -LiteralPath (Join-Path $transactionPath 'recovery-pgdata-acl.json')){throw 'M1: diario pendiente despues de entrada.'}
 Write-Host 'PASS M1: entrada restaura DACL reales incluso cuando la guardia rechaza antes de arrancar PostgreSQL.'
 # Ejecutar las instrucciones REALES de limpieza de rollback. Sin stubs de
 # restauracion/ACL: el unico recorte excluye operaciones previas de servicios.
 $rollback=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../scripts/Rollback-FitStoreUpdate.ps1') -Raw
 $anchor=$rollback.IndexOf('  Write-FitStoreLog -InstallDir $actualInstall -Level "AVISO" -Message "La actualización fallida')
 if($anchor -lt 0){throw 'No se encontro limpieza real de rollback.'}
 $begin=$rollback.IndexOf("`n",$anchor)+1;$end=$rollback.IndexOf('} catch {',$begin)
 $cleanup=[scriptblock]::Create($rollback.Substring($begin,$end-$begin))
 Enable-FitStoreTemporaryPostgresAccess -Database $database -TransactionPath $transactionPath|Out-Null
 [IO.File]::WriteAllText($marker,'keep-until-acl-restored')
 & $cleanup
 if(Test-Path -LiteralPath $marker){throw 'Marcador no retirado tras limpieza correcta.'}
 if(Test-Path -LiteralPath $transactionPath){throw 'Transaccion no retirada tras limpieza correcta.'}
 if(-not(Test-FitStoreExactDacl $original (Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw 'M1: rollback elimino diario sin restaurar DACL.'}
 Write-Host 'PASS M1: limpieza de rollback restaura permisos antes de borrar marcador/transaccion.'
 [IO.Directory]::CreateDirectory($transactionPath)|Out-Null
 [IO.File]::WriteAllText($marker,'must-survive-failure')
 $state=Join-Path $transactionPath 'recovery-pgdata-acl.json'
 [IO.File]::WriteAllText($state,(@{database=$database;entries=@(@{Path=(Join-Path $root 'outside');Sddl='D:(A;;FA;;;SY)'})}|ConvertTo-Json -Depth 4))
 $failed=$false;try{& $cleanup}catch{if($_.Exception.Message -like '*fuera de PGDATA*'){$failed=$true}else{throw}}
 if(-not $failed -or -not(Test-Path -LiteralPath $marker) -or -not(Test-Path -LiteralPath $state)){throw 'M1: fallo de restauracion no conserva marcador y diario/transaccion.'}
 Write-Host 'PASS M1 negativo: error de validacion conserva marcador, diario y carpeta para soporte.'
 # Una PGDATA realmente distinta sigue rechazada: no aceptar alias mediante
 # una relajacion del contrato de produccion ni borrar evidencia de soporte.
 $otherDatabase=Join-Path $root 'other-cluster'
 [IO.Directory]::CreateDirectory($otherDatabase)|Out-Null
 [IO.File]::WriteAllText($state,(@{database=$otherDatabase;entries=@(@{Path=$database;Sddl=$original})}|ConvertTo-Json -Depth 4))
 $before=[IO.File]::ReadAllText($state)
 $failed=$false;try{& $cleanup}catch{if($_.Exception.Message -like '*Estado DACL no corresponde a PGDATA*'){$failed=$true}else{throw}}
 if(-not $failed -or -not(Test-Path -LiteralPath $marker) -or [IO.File]::ReadAllText($state) -cne $before){throw 'M1: otra PGDATA no fue rechazada conservando evidencia.'}
 if(-not(Test-FitStoreExactDacl $original (Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw 'M1: otra PGDATA altero los permisos.'}
 Write-Host 'PASS M1 negativo: otra PGDATA sigue rechazada sin alterar diario, marcador ni DACL.'
}finally{if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}}
