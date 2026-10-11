Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '../scripts/Recover-FitStoreUpdate.ps1'
. $source -DefinitionsOnly
$schema=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../../apps/api/prisma/schema.prisma') -Raw
# Solo el nucleo imprescindible es fijo; el resto se descubre en la base real.
$expected=@{Sale=@('createdAt','updatedAt');AuditLog=@('createdAt');Payment=@('createdAt');SaleReturn=@('createdAt');CashMovement=@('createdAt');CashSession=@('openedAt','closedAt');InventoryMovement=@('createdAt')}
$actual=Get-FitStoreRecoveryActivityColumns
if($actual.Count -ne 7){throw 'B2: mapa fijo aun contiene modelos opcionales del paquete nuevo; debe ser solo nucleo de siete tablas.'}
foreach($table in $expected.Keys){
 if(-not $actual.Contains($table) -or @(Compare-Object @($expected[$table]) @($actual[$table])).Count){throw "Nucleo omitido o alterado: $table"}
 $model=[regex]::Match($schema,'(?ms)^model\s+'+$table+'\s*\{(.*?)^\}')
 if(-not $model.Success -or $model.Groups[1].Value -match '@@map|@map'){throw "Modelo SQL requiere revisar nucleo: $table"}
 foreach($column in $expected[$table]){if($model.Groups[1].Value -notmatch ('(?m)^\s+'+$column+'\s+DateTime\??\b')){throw "Columna nucleo no corresponde a Prisma: $table.$column"}}
}
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$null,[ref]$null)
$dynamic=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Get-FitStoreDatabaseActivitySql'},$true).Extent.Text
foreach($required in @('information_schema.tables','information_schema.columns','Get-FitStoreRecoveryActivityColumns','--list','$liveTables','$live.Keys')){
 if(-not $dynamic.Contains($required)){throw "Guardia dinamica no acredita contrato real: $required"}
}
foreach($column in @('lastActivityAt','approvedAt','revokedAt','sentAt')){if(-not $dynamic.Contains($column)){throw "Actividad adicional omitida: $column"}}
Write-Host 'PASS B2: nucleo fijo siete tablas cotejado con Prisma; consulta viva dinamica information_schema y tablas del dump, no mapa de 38 modelos.'
