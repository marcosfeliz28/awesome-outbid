param([string]$InstallDir)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

$paths = Get-FitStorePaths -InstallDir $InstallDir
$checks = New-Object Collections.Generic.List[object]
function Add-Check([string]$Name, [bool]$Ok, [string]$Detail, [bool]$Required = $true) {
  $checks.Add([pscustomobject]@{ name = $Name; ok = $Ok; required = $Required; detail = $Detail })
}

foreach ($serviceName in @($script:PostgresService, $script:ApiService, $script:WebService)) {
  $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
  Add-Check "Servicio $serviceName" ($null -ne $service -and $service.Status -eq "Running") $(if ($service) { [string]$service.Status } else { "No instalado" })
}

foreach ($file in @($paths.State, $paths.Secrets, $paths.Env, $paths.ServerConfig, (Join-Path $paths.Database "PG_VERSION"), (Join-Path $paths.Api "dist\main.js"), (Join-Path $paths.Web "index.html"))) {
  Add-Check "Archivo $file" (Test-Path -LiteralPath $file -PathType Leaf) $(if (Test-Path -LiteralPath $file) { "Presente" } else { "Falta" })
}

try { Wait-FitStoreHttp -Url "http://127.0.0.1:3001/api/health" -TimeoutSeconds 10; Add-Check "Salud API" $true "HTTP correcto" } catch { Add-Check "Salud API" $false $_.Exception.Message }
try { Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 10; Add-Check "Salud HTTPS" $true "HTTPS correcto" } catch { Add-Check "Salud HTTPS" $false $_.Exception.Message }

foreach ($taskName in @($script:BackupTask, $script:NetworkTask)) {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  Add-Check "Tarea $taskName" ($null -ne $task) $(if ($task) { [string]$task.State } else { "No instalada" })
}

$allow = Get-NetFirewallRule -DisplayName "FitStore POS - HTTPS red local" -ErrorAction SilentlyContinue
$block = Get-NetFirewallRule -DisplayName "FitStore POS - Bloquear API directa" -ErrorAction SilentlyContinue
Add-Check "Firewall HTTPS local" ($null -ne $allow -and $allow.Enabled -eq "True" -and $allow.Action -eq "Allow") "Puerto 4173"
Add-Check "Firewall API privada" ($null -ne $block -and $block.Enabled -eq "True" -and $block.Action -eq "Block") "Puerto 3001"

$trustedProfiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4Connectivity -ne "Disconnected" -and $_.NetworkCategory -in @("Private", "DomainAuthenticated") })
$profileDetail = if ($trustedProfiles.Count) {
  ($trustedProfiles | ForEach-Object { "$($_.Name): $($_.NetworkCategory)" }) -join "; "
} else {
  "No hay una red Privada/Dominio activa"
}
Add-Check "Perfil de red para las cajas" ($trustedProfiles.Count -gt 0) $profileDetail $false

$state = $null
try { $state = Read-FitStoreJson -Path $paths.State } catch {}
if ($state -and ($state.PSObject.Properties.Name -contains "caThumbprint") -and $state.caThumbprint) {
  $root = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq [string]$state.caThumbprint } | Select-Object -First 1
  Add-Check "CA local confiable" ($null -ne $root -and $root.NotAfter -gt (Get-Date).AddDays(30)) $(if ($root) { "Vence $($root.NotAfter.ToString('yyyy-MM-dd'))" } else { "No instalada" })
}

$ok = -not ($checks | Where-Object { $_.required -and -not $_.ok })
[ordered]@{
  checkedAt = (Get-Date).ToUniversalTime().ToString("o")
  ok = $ok
  checks = $checks
} | ConvertTo-Json -Depth 5
if (-not $ok) { exit 1 }
