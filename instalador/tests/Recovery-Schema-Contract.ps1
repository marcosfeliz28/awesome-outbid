$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1') -DefinitionsOnly
$schema=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../apps/api/prisma/schema.prisma') -Raw
$expected=[ordered]@{}
foreach($model in [regex]::Matches($schema,'(?ms)^model\s+(\w+)\s*\{(.*?)^\}')){
 $columns=@([regex]::Matches($model.Groups[2].Value,'(?m)^\s+(createdAt|updatedAt|openedAt|closedAt)\s+DateTime\??\b')|ForEach-Object{$_.Groups[1].Value})
 if($columns.Count){$expected[$model.Groups[1].Value]=$columns}
 if($columns.Count -and $model.Groups[2].Value -match '@@map|@map'){throw 'Mapeo SQL requiere revisar contrato de recuperacion'}
}
if(-not(Get-Command Get-FitStoreRecoveryActivityColumns -ErrorAction SilentlyContinue)){throw '3i4: falta contrato de tablas y columnas de actividad'}
$actual=Get-FitStoreRecoveryActivityColumns
if($actual.Count -ne $expected.Count){throw 'Contrato omite o inventa modelos Prisma'}
foreach($table in $actual.Keys){
 if(-not $expected.Contains($table)){throw "Tabla inexistente $table"}
 if(@(Compare-Object @($expected[$table]) @($actual[$table])).Count){throw "Columnas no corresponden a Prisma: $table"}
}
Write-Host "PASS 3i4: $($actual.Count) modelos y todas sus marcas de actividad coinciden con Prisma."
