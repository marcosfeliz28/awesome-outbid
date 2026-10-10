function Test-FitStoreExactDacl {
 param([string]$ExpectedSddl,[string]$ActualSddl)
 $expected=[Security.AccessControl.RawSecurityDescriptor]::new($ExpectedSddl)
 $actual=[Security.AccessControl.RawSecurityDescriptor]::new($ActualSddl)
 # CI 38022105205: NTFS agrega SOLO SE_DACL_AUTO_INHERITED (0x400).
 # Ningun otro controlflag, permiso o indicador de ACE se ignora.
 $mask=-bnot [int][Security.AccessControl.ControlFlags]::DiscretionaryAclAutoInherited
 if(([int]$expected.ControlFlags -band $mask) -ne ([int]$actual.ControlFlags -band $mask)){return $false}
 if(($null -eq $expected.DiscretionaryAcl) -ne ($null -eq $actual.DiscretionaryAcl)){return $false}
 if($null -eq $expected.DiscretionaryAcl){return $true}
 if($expected.DiscretionaryAcl.Revision -ne $actual.DiscretionaryAcl.Revision -or $expected.DiscretionaryAcl.Count -ne $actual.DiscretionaryAcl.Count){return $false}
 $canonical=@()
 foreach($sddl in @($ExpectedSddl,$ActualSddl)){
  $acl=[Security.AccessControl.FileSecurity]::new()
  $acl.SetSecurityDescriptorSddlForm($sddl,[Security.AccessControl.AccessControlSections]::Access)
  $canonical+= $acl.AreAccessRulesCanonical
 }
 if($canonical[0] -ne $canonical[1]){return $false}
 $sets=@()
 foreach($descriptor in @($expected,$actual)){
  $entries=@(foreach($ace in $descriptor.DiscretionaryAcl){
   # Bytes incluyen SID, access mask, Allow/Deny, IsInherited, inheritance,
   # propagation, GUIDs de ACE objeto y cualquier bandera adicional.
   $bytes=[byte[]]::new($ace.BinaryLength);$ace.GetBinaryForm($bytes,0)
   [BitConverter]::ToString($bytes)
  })
  # Solo ACE canónicos admiten orden incidental: en DACL no canonica el
  # orden Allow/Deny puede cambiar acceso efectivo, conservarlo exactamente.
  if($canonical[0]){$sets+= ,@($entries|Sort-Object)}else{$sets+= ,$entries}
 }
 for($i=0;$i -lt $sets[0].Count;$i++){if($sets[0][$i] -cne $sets[1][$i]){return $false}}
 return $true
}
