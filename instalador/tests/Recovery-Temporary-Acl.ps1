param([string]$PgBin,[int]$Port=55619,[string]$RecoverySource=(Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'))
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. $RecoverySource -DefinitionsOnly
if(-not(Get-Command Enable-FitStoreTemporaryPostgresAccess -ErrorAction SilentlyContinue)){throw '3i2: falta acceso temporal a PGDATA para cuenta actual'}
$root=Join-Path ([IO.Path]::GetTempPath()) ('nexora-temporary-acl-'+[guid]::NewGuid().ToString('N'))
$cluster=Join-Path $root 'cluster'
$cleanupAcl=$null
function Write-FitStoreAclDifference {
 param([string]$Label,[string]$ExpectedSddl,$ActualAcl,[bool]$Directory)
 $expected=if($Directory){[Security.AccessControl.DirectorySecurity]::new()}else{[Security.AccessControl.FileSecurity]::new()}
 $expected.SetSecurityDescriptorSddlForm($ExpectedSddl,[Security.AccessControl.AccessControlSections]::Access)
 foreach($side in @('EXPECTED','ACTUAL')){
  $acl=if($side -eq 'EXPECTED'){$expected}else{$ActualAcl}
  $sddl=$acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
  $raw=[Security.AccessControl.RawSecurityDescriptor]::new($sddl)
  Write-Host ("DACL $Label $side SDDL=$sddl ControlFlags=$($raw.ControlFlags) Protected=$($acl.AreAccessRulesProtected) Canonical=$($acl.AreAccessRulesCanonical)")
  $index=0
  foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
   Write-Host ("DACL $Label $side ACE[$index] SID=$($rule.IdentityReference.Value) Rights=$($rule.FileSystemRights) Mask=$([int]$rule.FileSystemRights) Type=$($rule.AccessControlType) Inherited=$($rule.IsInherited) Inheritance=$($rule.InheritanceFlags) Propagation=$($rule.PropagationFlags)")
   $index++
  }
  Write-Host "DACL $Label $side ACE_COUNT=$index"
 }
}
try {
 [IO.Directory]::CreateDirectory($cluster)|Out-Null
 $leaf=Join-Path $cluster 'fixture';[IO.File]::WriteAllText($leaf,'unchanged')
 $original=(Get-Acl -LiteralPath $cluster).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $originalLeaf=(Get-Acl -LiteralPath $leaf).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $saved=@(Enable-FitStoreTemporaryPostgresAccess -Database $cluster)
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
 $rules=@((Get-Acl -LiteralPath $leaf).Access | Where-Object {$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -eq $sid -and $_.AccessControlType -eq 'Allow' -and ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Modify) -eq [Security.AccessControl.FileSystemRights]::Modify})
 if(-not $rules.Count){throw '3i2: la cuenta actual no recibio Modify en PGDATA'}
 Restore-FitStoreTemporaryPostgresAccess -OriginalAcl $saved -StatePath (Join-Path $root 'recovery-pgdata-acl.json')
 $actualRoot=Get-Acl -LiteralPath $cluster;$actualLeaf=Get-Acl -LiteralPath $leaf
 if($actualRoot.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -cne $original -or $actualLeaf.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -cne $originalLeaf){
  Write-FitStoreAclDifference -Label ROOT -ExpectedSddl $original -ActualAcl $actualRoot -Directory $true
  Write-FitStoreAclDifference -Label LEAF -ExpectedSddl $originalLeaf -ActualAcl $actualLeaf -Directory $false
  throw '3i2: DACL originales no restauradas'
 }
 Write-Host 'PASS 3i2: cuenta actual recibe Modify; DACL originales de raiz y archivo restauradas.'
 # Reproducir control de herencia de runners: padre protegido y descendiente
 # heredado con una concesion explicita. No normalizar ni debilitar SDDL.
 $parentAcl=Get-Acl -LiteralPath $root
 $parentAcl.SetAccessRuleProtection($true,$true)
 ([IO.DirectoryInfo]::new($root)).SetAccessControl($parentAcl)
 $explicitAcl=Get-Acl -LiteralPath $leaf
 $explicitAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.AccessControl.FileSystemRights]::Read,[Security.AccessControl.AccessControlType]::Allow))
 ([IO.FileInfo]::new($leaf)).SetAccessControl($explicitAcl)
 $original=(Get-Acl -LiteralPath $cluster).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $originalLeaf=(Get-Acl -LiteralPath $leaf).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $saved=@(Enable-FitStoreTemporaryPostgresAccess -Database $cluster)
 Restore-FitStoreTemporaryPostgresAccess -OriginalAcl $saved -StatePath (Join-Path $root 'recovery-pgdata-acl.json')
 $actualRoot=Get-Acl -LiteralPath $cluster;$actualLeaf=Get-Acl -LiteralPath $leaf
 if($actualRoot.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -cne $original -or $actualLeaf.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -cne $originalLeaf){
  Write-FitStoreAclDifference -Label ROOT-INHERITANCE -ExpectedSddl $original -ActualAcl $actualRoot -Directory $true
  Write-FitStoreAclDifference -Label LEAF-INHERITANCE -ExpectedSddl $originalLeaf -ActualAcl $actualLeaf -Directory $false
  throw '3j2: herencia y ACE explicitos originales no restaurados'
 }
 Write-Host 'PASS 3j2: DACL exactas con padre protegido, herencia y ACE explicitos restauradas.'
 if($PgBin) {
  Remove-Item -LiteralPath $leaf -Force
  & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale | Out-Null
  if($LASTEXITCODE -ne 0){throw '3i2: initdb real fallo'}
  $cleanupAcl=(Get-Acl -LiteralPath $cluster).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
  $restricted=[Security.AccessControl.DirectorySecurity]::new()
  $restricted.SetAccessRuleProtection($true,$false)
  $inheritance=[Security.AccessControl.InheritanceFlags]'ContainerInherit,ObjectInherit'
  foreach($identity in @('S-1-5-18','S-1-5-32-544')) {
   $restricted.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($identity),[Security.AccessControl.FileSystemRights]::FullControl,$inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
  }
  $restricted.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.AccessControl.FileSystemRights]::ReadAndExecute,$inheritance,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow))
  ([IO.DirectoryInfo]::new($cluster)).SetAccessControl($restricted)
  $restrictedSddl=(Get-Acl -LiteralPath $cluster).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
  $window=@(Enable-FitStoreTemporaryPostgresAccess -Database $cluster)
  $started=$false
  try {
   Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-l',(Join-Path $cluster 'recovery-postgres.log'),'-o',"-p $Port -h 127.0.0.1",'-w','start')
   $started=$true
   & (Join-Path $PgBin 'psql.exe') -h 127.0.0.1 -p $Port -U postgres -d postgres -t -A -c 'SELECT 1;' | Out-Null
   if($LASTEXITCODE -ne 0){throw '3i2: PostgreSQL real no consulta con permiso temporal'}
  } finally {
   try {if($started){Invoke-FitStoreRecoveryPgCtl -Tool (Join-Path $PgBin 'pg_ctl.exe') -Database $cluster -Arguments @('-D',$cluster,'-m','fast','-w','stop')}} finally {Restore-FitStoreTemporaryPostgresAccess -OriginalAcl $window -StatePath (Join-Path $root 'recovery-pgdata-acl.json')}
  }
  $actualRoot=Get-Acl -LiteralPath $cluster
  if($actualRoot.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -cne $restrictedSddl){
   Write-FitStoreAclDifference -Label ROOT-POSTGRES -ExpectedSddl $restrictedSddl -ActualAcl $actualRoot -Directory $true
   throw '3i2: permiso temporal quedo tras PostgreSQL real'
  }
  Write-Host 'PASS 3i2 PostgreSQL real: PGDATA con cuenta ReadAndExecute arranca con Modify temporal; ACL restringida vuelve tras stop.'
  Write-Host '@duena: probar en Windows limpio con PGDATA creado por otra cuenta/SYSTEM. Este proceso no elevado no puede crear ese escenario; no se certifica identidad distinta.'
 }
} finally {
 if($cleanupAcl -and (Test-Path -LiteralPath $cluster)){$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetSecurityDescriptorSddlForm($cleanupAcl,[Security.AccessControl.AccessControlSections]::Access);([IO.DirectoryInfo]::new($cluster)).SetAccessControl($acl)}
 if([IO.Directory]::Exists($root)){[IO.Directory]::Delete($root,$true)}
}
