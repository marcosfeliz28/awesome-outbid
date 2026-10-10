Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Exact-Dacl.ps1')
$source=(Resolve-Path (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1')).Path
. $source -DefinitionsOnly
if(-not(Get-Command Restore-FitStorePendingPostgresAccess -ErrorAction SilentlyContinue)){throw '3j5: falta recuperacion persistente de DACL'}
$root=Join-Path $env:TEMP ('nexora-acl-kill-'+[guid]::NewGuid().ToString('N'))
$database=Join-Path $root 'cluster';$transaction=Join-Path $root 'transaction'
$child=$null
try {
 foreach($path in @($database,$transaction)){[IO.Directory]::CreateDirectory($path)|Out-Null}
 [IO.File]::WriteAllText((Join-Path $database 'fixture'),'unchanged')
 $original=(Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $originalIcacls=(& icacls.exe $database) -join "`n"
 $ready=Join-Path $root 'ready'
 $command=". '$source' -DefinitionsOnly; Enable-FitStoreTemporaryPostgresAccess -Database '$database' -TransactionPath '$transaction' | Out-Null; [IO.File]::WriteAllText('$ready','ready'); Start-Sleep -Seconds 120"
 $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
 $child=Start-Process powershell.exe -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-EncodedCommand',$encoded) -WindowStyle Hidden -PassThru
 $deadline=[DateTime]::UtcNow.AddSeconds(20)
 while(-not(Test-Path -LiteralPath $ready) -and [DateTime]::UtcNow -lt $deadline){Start-Sleep -Milliseconds 100}
 if(-not(Test-Path -LiteralPath $ready)){throw 'Proceso hijo no concedio acceso temporal'}
 $state=Join-Path $transaction 'recovery-pgdata-acl.json'
 if(-not(Test-Path -LiteralPath $state)){throw 'Diario no persistido antes de interrupcion'}
 $acl=Get-Acl -LiteralPath $state
 if(-not $acl.AreAccessRulesProtected -or @($acl.Access|Where-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -in @('S-1-1-0','S-1-5-32-545')}).Count){throw 'Diario DACL publico'}
 & taskkill.exe /PID $child.Id /F|Out-Null
 $child.WaitForExit()
 Restore-FitStorePendingPostgresAccess -Database $database -StatePath $state
 if(-not(Test-FitStoreExactDacl $original (Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw 'DACL distinta tras taskkill y recuperacion'}
 if(((& icacls.exe $database) -join "`n") -cne $originalIcacls){throw 'icacls distinto tras taskkill y recuperacion'}
 if(Test-Path -LiteralPath $state){throw 'Diario no retirado tras restaurar todas las entradas'}
 Write-Host 'PASS 3j5: taskkill real; diario privado previo al grant; reinicio restaura DACL e icacls exactos.'
} finally {
 if($child){if(-not $child.HasExited){Stop-Process -Id $child.Id -Force};$child.Dispose()}
 if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}
}
