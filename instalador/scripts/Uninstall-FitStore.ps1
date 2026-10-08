param(
  [string]$InstallDir,
  [switch]$PurgeData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$state = $null
$lastBackup = ""
if (Test-Path -LiteralPath $paths.State) { $state = Read-FitStoreJson -Path $paths.State }
$postgresService = Get-Service -Name $script:PostgresService -ErrorAction SilentlyContinue
$backupTool = Join-Path $paths.Scripts "Backup-FitStore.ps1"
$databaseExists = Test-Path -LiteralPath (Join-Path $paths.Database "PG_VERSION") -PathType Leaf
if ($PurgeData -and $databaseExists -and ($null -eq $postgresService -or -not (Test-Path -LiteralPath $backupTool -PathType Leaf))) {
  throw "No se puede borrar la base porque falta el servicio PostgreSQL o la herramienta de respaldo. Los datos se conservaron."
}

if ($postgresService -and (Test-Path -LiteralPath $backupTool -PathType Leaf)) {
  # Se cierra primero la entrada web y luego la API para que el respaldo final
  # no compita con ventas que todavía estén entrando.
  Stop-FitStoreApplication
  try {
    Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
    $backupOutput = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $backupTool -InstallDir $paths.Install -Motivo "antes-de-desinstalar")
    if ($LASTEXITCODE -ne 0) { throw "falló pg_dump" }
    $lastBackup = [string]($backupOutput | Select-Object -Last 1)
    if (-not $lastBackup -or -not (Test-Path -LiteralPath $lastBackup -PathType Leaf)) { throw "no se pudo comprobar el respaldo creado" }
  } catch {
    if ($PurgeData) {
      try { Start-FitStoreApplication } catch {}
      throw "No se pudo crear el respaldo previo; por seguridad no se borraron los datos y se intentó reabrir la aplicación."
    }
    Write-Warning "No fue posible crear un respaldo adicional. Los datos existentes se conservarán."
  }
}

Remove-FitStoreServiceRegistration -Name $script:WebService -WinSW $paths.WinSW -Config (Join-Path $paths.Services "FitStoreWeb.xml")
Remove-FitStoreServiceRegistration -Name $script:ApiService -WinSW $paths.WinSW -Config (Join-Path $paths.Services "FitStoreAPI.xml")
Stop-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
if (Get-Service -Name $script:PostgresService -ErrorAction SilentlyContinue) {
  & "$env:SystemRoot\System32\sc.exe" delete $script:PostgresService | Out-Null
}

Unregister-ScheduledTask -TaskName $script:BackupTask -Confirm:$false -ErrorAction SilentlyContinue
Unregister-ScheduledTask -TaskName $script:NetworkTask -Confirm:$false -ErrorAction SilentlyContinue
Get-NetFirewallRule -DisplayName "FitStore POS - HTTPS red local" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName "FitStore POS - Bloquear API directa" -ErrorAction SilentlyContinue | Remove-NetFirewallRule

$desktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
$programs = Join-Path ([Environment]::GetFolderPath("CommonPrograms")) "FitStore POS"
Remove-Item -LiteralPath (Join-Path $desktop "FitStore POS.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $desktop "Certificado FitStore para celulares.cer") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $desktop "FitStore - acceso en celulares.txt") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $programs -Recurse -Force -ErrorAction SilentlyContinue

if ($PurgeData) {
  $expected = [IO.Path]::GetFullPath((Join-Path $env:ProgramData "FitStore POS")).TrimEnd("\")
  $actual = [IO.Path]::GetFullPath($paths.Data).TrimEnd("\")
  if ($actual -ne $expected -or $actual.Length -lt 10) { throw "La ruta de datos no pasó la comprobación de seguridad; no se borró." }
  if ($state) {
    $leafThumbprint = if ($state.PSObject.Properties.Name -contains "leafThumbprint") { [string]$state.leafThumbprint } else { "" }
    $caThumbprint = if ($state.PSObject.Properties.Name -contains "caThumbprint") { [string]$state.caThumbprint } else { "" }
    foreach ($thumbprint in @($leafThumbprint, $caThumbprint)) {
      if (-not $thumbprint) { continue }
      Get-ChildItem Cert:\LocalMachine\My, Cert:\LocalMachine\Root -ErrorAction SilentlyContinue |
        Where-Object { $_.Thumbprint -eq $thumbprint } |
        Remove-Item -Force -ErrorAction SilentlyContinue
    }
  }
  if ($lastBackup -and (Test-Path -LiteralPath $lastBackup) -and [IO.Path]::GetFullPath($lastBackup).StartsWith($actual, [StringComparison]::OrdinalIgnoreCase)) {
    $finalBackupDir = Join-Path $env:PUBLIC "Documents\FitStore POS - respaldo final"
    New-FitStoreDirectory -Path $finalBackupDir
    Copy-Item -LiteralPath $lastBackup -Destination $finalBackupDir -Force
    foreach ($suffix in @(".sha256", ".json")) {
      if (Test-Path -LiteralPath ($lastBackup + $suffix)) { Copy-Item -LiteralPath ($lastBackup + $suffix) -Destination $finalBackupDir -Force }
    }
  }
  Remove-Item -LiteralPath $actual -Recurse -Force
} else {
  New-FitStoreDirectory -Path $paths.Data
  @(
    "FitStore POS fue desinstalado, pero sus datos se conservaron a propósito.",
    "",
    "Base: $($paths.Database)",
    "Respaldos locales: $($paths.LocalBackups)",
    "",
    "Al volver a instalar FitStore POS, el asistente reutilizará estos datos.",
    "No edites ni borres esta carpeta sin un respaldo restaurado y comprobado."
  ) | Set-Content -LiteralPath (Join-Path $paths.Data "DESINSTALADO_LEEME.txt") -Encoding UTF8
}

Remove-Item -Path $script:FitStoreRegistry -Recurse -Force -ErrorAction SilentlyContinue
