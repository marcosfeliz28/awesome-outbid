Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$source = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) "installer\FitStore.nsi") -Raw
$section = $source.Substring($source.IndexOf('Section "Nexora POS" SecMain'))
$ready = $section.IndexOf('StrCpy $UpdatePrepared "1"')
$preflight = $section.IndexOf('-File "$PLUGINSDIR\Preflight-FitStore.ps1"')
if ($ready -lt 0 -or $ready -ge $preflight) { throw "A6: rollback no esta habilitado antes de Preflight." }
if ($section.Contains("cancelada sin reemplazar archivos")) { throw "A6: mensaje promete que Preflight no cambio archivos." }
if (-not $source.Contains('${AndIf} $UpdatePrepared == "1"')) { throw "A6: falta guarda de rollback preparado." }
Write-Host "PASS A6: rollback habilitado antes de Preflight y mensaje sin promesa falsa."
