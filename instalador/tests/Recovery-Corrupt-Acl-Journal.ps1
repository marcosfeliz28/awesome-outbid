Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Exact-Dacl.ps1')
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$root=Join-Path $env:TEMP ('nexora-corrupt-journal-'+[guid]::NewGuid().ToString('N'))
$database=Join-Path $root 'cluster';$transaction=Join-Path $root 'transaction'
try {
 foreach($p in @($database,$transaction)){[IO.Directory]::CreateDirectory($p)|Out-Null}
 # Igual que el escritor real: FullName resuelve el alias 8.3 del TEMP de CI.
 # De lo contrario un JSON de SDDL corrupto prueba otra ruta accidentalmente.
 $database=(Get-Item -LiteralPath $database).FullName
 $transaction=(Get-Item -LiteralPath $transaction).FullName
 $leaf=Join-Path $database 'fixture';[IO.File]::WriteAllText($leaf,'intact')
 $saved=@(Enable-FitStoreTemporaryPostgresAccess -Database $database -TransactionPath $transaction)
 $statePath=Join-Path $transaction 'recovery-pgdata-acl.json'
 $current=@{}
 foreach($entry in $saved){$current[$entry.Path]=(Get-Acl -LiteralPath $entry.Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)}
 $invalid=@(
  @{name='JSON truncado';text='{"database":'},
  @{name='objeto vacio';text='{}'},
  @{name='entradas vacias';text=(@{database=$database;entries=@()}|ConvertTo-Json -Depth 5)},
  @{name='descriptor invalido despues de entrada valida';text=(@{database=$database;entries=@($saved[0],@{Path=$leaf;Sddl='D:(INVALID'})}|ConvertTo-Json -Depth 5)},
  @{name='ruta ausente';text=(@{database=$database;entries=@(@{Sddl=$saved[0].Sddl})}|ConvertTo-Json -Depth 5)},
  @{name='descriptor ausente';text=(@{database=$database;entries=@(@{Path=$database})}|ConvertTo-Json -Depth 5)},
  @{name='descriptor sin DACL';text=(@{database=$database;entries=@(@{Path=$database;Sddl='O:SY'})}|ConvertTo-Json -Depth 5)},
  @{name='rutas duplicadas';text=(@{database=$database;entries=@($saved[0],$saved[0])}|ConvertTo-Json -Depth 5)},
  @{name='entradas no array';text=(@{database=$database;entries=$saved[0]}|ConvertTo-Json -Depth 5)}
 )
 foreach($case in $invalid){
  [IO.File]::WriteAllText($statePath,$case.text)
  $before=[IO.File]::ReadAllBytes($statePath)
  $failure=$null;try{Restore-FitStorePendingPostgresAccess -Database $database -StatePath $statePath}catch{$failure=$_}
  if(-not $failure -or $failure.Exception.Message -notlike '*Diario de permisos corrupto o incompleto*'){throw "M2: $($case.name) no produce diagnostico explicito; error=$($failure.Exception.Message)"}
  if(-not(Test-Path -LiteralPath $statePath) -or [Convert]::ToBase64String($before) -cne [Convert]::ToBase64String([IO.File]::ReadAllBytes($statePath))){throw 'M2: diario alterado o borrado al rechazar.'}
  foreach($entry in $saved){if(-not(Test-FitStoreExactDacl $current[$entry.Path] (Get-Acl -LiteralPath $entry.Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw 'M2: aplico parcialmente permisos antes de validar diario completo.'}}
  Write-Host "PASS M2: $($case.name) diagnostico explicito; bytes del diario y DACL reales intactos."
 }
 [IO.File]::WriteAllText($statePath,(@{database=$database;entries=$saved}|ConvertTo-Json -Depth 5))
 Restore-FitStorePendingPostgresAccess -Database $database -StatePath $statePath
 foreach($entry in $saved){if(-not(Test-FitStoreExactDacl $entry.Sddl (Get-Acl -LiteralPath $entry.Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access))){throw 'M2: diario valido no restaura DACL originales.'}}
 Write-Host 'PASS M2: diario valido sigue restaurando DACL originales y retirando estado.'
}finally{if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}}
