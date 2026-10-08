[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Config)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $Config -PathType Leaf)) { throw 'No existe la configuración local de respaldo cloud.' }
$options = Get-Content -LiteralPath $Config -Raw -Encoding UTF8 | ConvertFrom-Json
$backupScript = [string]$options.Script
if (-not (Test-Path -LiteralPath $backupScript -PathType Leaf)) { throw 'No se encontró el descargador cloud de Nexora POS.' }

& $backupScript `
  -Bucket ([string]$options.Bucket) `
  -PerfilAws ([string]$options.PerfilAws) `
  -Prefijo ([string]$options.Prefijo) `
  -Destino ([string]$options.Destino) `
  -AwsCli ([string]$options.AwsCli) `
  -PgRestore ([string]$options.PgRestore)
