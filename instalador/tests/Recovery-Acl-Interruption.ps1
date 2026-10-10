Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Exact-Dacl.ps1')
function Test-FitStoreIcaclsDisplay {
 param([string]$ExpectedText,[string]$ActualText,[string]$ExpectedSddl,[string]$ActualSddl)
 if(-not(Test-FitStoreExactDacl $ExpectedSddl $ActualSddl)){return $false}
 if($ExpectedText -ceq $ActualText){return $true}
 $expected=[Security.AccessControl.RawSecurityDescriptor]::new($ExpectedSddl)
 $actual=[Security.AccessControl.RawSecurityDescriptor]::new($ActualSddl)
 $changed=[int]$expected.ControlFlags -bxor [int]$actual.ControlFlags
 # CI 38024535438: icacls agrega (I) cuando NTFS establece SOLO SD AI,
 # aunque cada ACE ya tenia IsInherited=True antes. No ignorar otros textos
 # ni herencia real de ACE: ExactDacl verifica bytes y orden primero.
 if($changed -ne [int][Security.AccessControl.ControlFlags]::DiscretionaryAclAutoInherited){return $false}
 return $ExpectedText.Replace('(I)','') -ceq $ActualText.Replace('(I)','')
}
# Caso exacto del diagnostico CI y negativos: la presentacion nunca puede
# ocultar derechos, SID, duplicados, proteccion ni herencia efectiva distinta.
$fixtureSddl='D:(A;OICIID;FA;;;SY)';$fixtureAi='D:AI(A;OICIID;FA;;;SY)'
if(-not(Test-FitStoreIcaclsDisplay 'SYSTEM:(OI)(CI)(F)' 'SYSTEM:(I)(OI)(CI)(F)' $fixtureSddl $fixtureAi)){throw 'Caso CI AI-only no reconocido'}
if(Test-FitStoreIcaclsDisplay 'SYSTEM:(OI)(CI)(F)' 'SYSTEM:(I)(OI)(CI)(R)' $fixtureSddl $fixtureAi){throw 'icacls derechos distintos aceptados'}
if(Test-FitStoreIcaclsDisplay 'SYSTEM:(OI)(CI)(F)' 'SYSTEM:(I)(OI)(CI)(F)' $fixtureSddl $fixtureAi.Replace('OICIID','OICI')){throw 'Herencia ACE distinta aceptada'}
if(Test-FitStoreIcaclsDisplay 'SYSTEM:(OI)(CI)(F)' 'SYSTEM:(I)(OI)(CI)(F)' $fixtureSddl $fixtureSddl){throw 'Cambio icacls sin cambio AI aceptado'}
Write-Host 'PASS icacls: AI-only confirmado; derechos, herencia ACE y cambios sin AI rechazados.'
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
 $savedEntries=@((Get-Content -LiteralPath $state -Raw|ConvertFrom-Json).entries)
 if(-not $acl.AreAccessRulesProtected -or @($acl.Access|Where-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -in @('S-1-1-0','S-1-5-32-545')}).Count){throw 'Diario DACL publico'}
 & taskkill.exe /PID $child.Id /F|Out-Null
 $child.WaitForExit()
 Restore-FitStorePendingPostgresAccess -Database $database -StatePath $state
 foreach($entry in $savedEntries){
  if(-not(Test-FitStoreExactDacl $entry.Sddl (Get-Acl -LiteralPath $entry.Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw "DACL distinta tras taskkill y recuperacion: $($entry.Path)"}
 }
 $actualSddl=(Get-Acl -LiteralPath $database).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $actualIcacls=(& icacls.exe $database) -join "`n"
 if(-not(Test-FitStoreIcaclsDisplay $originalIcacls $actualIcacls $original $actualSddl)){
  Write-Host 'ICACLS EXPECTED BEGIN';Write-Host $originalIcacls;Write-Host 'ICACLS EXPECTED END'
  Write-Host 'ICACLS ACTUAL BEGIN';Write-Host $actualIcacls;Write-Host 'ICACLS ACTUAL END'
  foreach($entry in $savedEntries){
   foreach($side in @('EXPECTED','ACTUAL')){
    $sddl=if($side -eq 'EXPECTED'){[string]$entry.Sddl}else{(Get-Acl -LiteralPath $entry.Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)}
    $raw=[Security.AccessControl.RawSecurityDescriptor]::new($sddl)
    $security=[Security.AccessControl.FileSecurity]::new();$security.SetSecurityDescriptorSddlForm($sddl,[Security.AccessControl.AccessControlSections]::Access)
    Write-Host "DACL ENTRY=$($entry.Path) $side SDDL=$sddl ControlFlags=$($raw.ControlFlags) Protected=$($security.AreAccessRulesProtected) Canonical=$($security.AreAccessRulesCanonical)"
    $i=0
    foreach($rule in $security.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
     Write-Host "DACL ENTRY=$($entry.Path) $side ACE[$i] SID=$($rule.IdentityReference.Value) Rights=$($rule.FileSystemRights) Mask=$([int]$rule.FileSystemRights) Type=$($rule.AccessControlType) Inherited=$($rule.IsInherited) Inheritance=$($rule.InheritanceFlags) Propagation=$($rule.PropagationFlags)"
     $i++
    }
    Write-Host "DACL ENTRY=$($entry.Path) $side ACE_COUNT=$i"
   }
  }
  throw 'icacls distinto tras taskkill y recuperacion'
 }
 if(Test-Path -LiteralPath $state){throw 'Diario no retirado tras restaurar todas las entradas'}
 Write-Host 'PASS 3j5: taskkill real; diario privado previo al grant; reinicio restaura DACL e icacls exactos.'
} finally {
 if($child){if(-not $child.HasExited){Stop-Process -Id $child.Id -Force};$child.Dispose()}
 if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}
}
