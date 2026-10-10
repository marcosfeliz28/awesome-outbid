Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'Exact-Dacl.ps1')
$base='D:(A;OICIID;FA;;;SY)(A;OICIID;FA;;;BA)'
if(-not(Test-FitStoreExactDacl $base $base.Replace('D:','D:AI'))){throw 'AutoInherited solo debe permitir igualdad exacta de ACE'}
$cases=[ordered]@{
 SID=$base.Replace(';;;SY',';;;BU')
 Rights=$base.Replace(';FA;',';FR;')
 Type=$base.Replace('(A;','(D;')
 Inherited=$base.Replace('OICIID','OICI')
 Inheritance=$base.Replace('OICIID','CIID')
 Propagation=$base.Replace('OICIID','OICINPID')
 Added=($base+'(A;;FR;;;BU)')
 Removed='D:(A;OICIID;FA;;;SY)'
 Duplicate=($base+'(A;OICIID;FA;;;SY)')
 Protection=$base.Replace('D:','D:P')
 OtherControlFlag=$base.Replace('D:','D:AR')
}
foreach($case in $cases.Keys){if(Test-FitStoreExactDacl $base $cases[$case]){throw "Diferencia $case indebidamente permitida"};Write-Host "PASS DACL exacta rechaza $case"}
if(Test-FitStoreExactDacl 'D:NO_ACCESS_CONTROL' 'D:'){throw 'DACL null no equivale a DACL vacia'}
if(-not(Test-FitStoreExactDacl 'D:(A;;FR;;;SY)(A;;FR;;;BA)' 'D:AI(A;;FR;;;BA)(A;;FR;;;SY)')){throw 'Orden de Allow canonicos no altera multiset'}
if(Test-FitStoreExactDacl 'D:(D;;FR;;;BA)(A;;FA;;;SY)' 'D:(A;;FA;;;SY)(D;;FR;;;BA)'){throw 'Cambio de orden canonico a no canonico indebidamente permitido'}
Write-Host 'PASS DACL exacta: solo AutoInherited permitido; NULL no equivale a vacia; multiset conserva duplicados.'
