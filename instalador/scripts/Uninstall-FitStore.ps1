param(
  [string]$InstallDir,
  [switch]$PurgeData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

function Assert-UninstallPlainPath {
  param([Parameter(Mandatory)][string]$Path)
  $full = [IO.Path]::GetFullPath($Path).TrimEnd('\')
  $current = $full
  while ($current) {
    if (Test-Path -LiteralPath $current -ErrorAction Stop) {
      $item = Get-Item -LiteralPath $current -Force -ErrorAction Stop
      if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "No se permiten enlaces ni junctions en la ruta de desinstalacion: $current" }
    }
    $parent = [IO.Path]::GetDirectoryName($current)
    if ($parent -eq $current) { break }
    $current = $parent
  }
  return $full
}

function Assert-UninstallDataBoundary {
  param([Parameter(Mandatory)][string]$Data, [Parameter(Mandatory)][string]$ProgramDataRoot)
  $root = Assert-UninstallPlainPath -Path $ProgramDataRoot
  $actual = Assert-UninstallPlainPath -Path $Data
  $expected = [IO.Path]::GetFullPath((Join-Path $root 'FitStore POS')).TrimEnd('\')
  if (-not [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)) { throw 'La ruta de datos no coincide exactamente con ProgramData\FitStore POS; no se borro.' }
  # Enumerar cada nivel sin seguir enlaces. Un enlace interno tampoco puede
  # quedar dentro del arbol que posteriormente se borra de forma recursiva.
  $pending = [Collections.Generic.Stack[string]]::new()
  if (Test-Path -LiteralPath $actual -PathType Container -ErrorAction Stop) { $pending.Push($actual) }
  while ($pending.Count) {
    foreach ($entry in Get-ChildItem -LiteralPath $pending.Pop() -Force -ErrorAction Stop) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Hay un enlace/junction dentro de los datos; no se borraron: $($entry.FullName)" }
      if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
    }
  }
  return $actual
}

function Test-UninstallBackupSet {
  param([Parameter(Mandatory)][string]$Dump)
  foreach ($path in @($Dump, ($Dump + '.sha256'), ($Dump + '.json'))) {
    Assert-UninstallPlainPath -Path $path | Out-Null
    if (-not (Test-Path -LiteralPath $path -PathType Leaf -ErrorAction Stop)) { throw "Falta el respaldo o su verificacion: $path. Los datos se conservaron." }
  }
  $sha = [IO.File]::ReadAllText($Dump + '.sha256').Trim()
  $match = [regex]::Match($sha, '^(?<hash>[a-fA-F0-9]{64})\s+\*?(?<file>[^\r\n]+)$')
  $name = [IO.Path]::GetFileName($Dump)
  $hash = (Get-FileHash -LiteralPath $Dump -Algorithm SHA256 -ErrorAction Stop).Hash
  $manifest = [IO.File]::ReadAllText($Dump + '.json') | ConvertFrom-Json
  if (-not $match.Success -or $match.Groups['file'].Value -cne $name -or $match.Groups['hash'].Value -ine $hash -or
    $manifest.PSObject.Properties.Name -notcontains 'sha256' -or $manifest.PSObject.Properties.Name -notcontains 'file' -or
    [string]$manifest.sha256 -ine $hash -or [string]$manifest.file -cne $name) { throw "SHA o manifiesto invalido: $Dump. Los datos se conservaron." }
}

function Get-UninstallBackupPlan {
  param([Parameter(Mandatory)]$Paths, [string]$LastBackup, [Parameter(Mandatory)][string]$ProgramDataRoot)
  $data = Assert-UninstallDataBoundary -Data $Paths.Data -ProgramDataRoot $ProgramDataRoot
  $backups = Assert-UninstallPlainPath -Path $Paths.LocalBackups
  if (-not [string]::Equals($backups, (Join-Path $data 'Backups'), [StringComparison]::OrdinalIgnoreCase)) { throw 'El destino local de respaldos no coincide con la carpeta esperada.' }
  $plan = [Collections.Generic.List[object]]::new()
  if (Test-Path -LiteralPath $backups -PathType Container -ErrorAction Stop) {
    foreach ($file in Get-ChildItem -LiteralPath $backups -File -Recurse -Force -ErrorAction Stop) {
      $relative = $file.FullName.Substring($backups.Length + 1)
      $plan.Add([pscustomobject]@{Source=$file.FullName; Relative=(Join-Path 'retenidos' $relative)})
      if ($file.Extension -ieq '.dump') { Test-UninstallBackupSet -Dump $file.FullName }
    }
  }
  if ($LastBackup) {
    $final = Assert-UninstallPlainPath -Path $LastBackup
    Test-UninstallBackupSet -Dump $final
    if (-not @($plan | Where-Object { [string]::Equals($_.Source, $final, [StringComparison]::OrdinalIgnoreCase) }).Count) {
      foreach ($suffix in @('', '.sha256', '.json')) { $plan.Add([pscustomobject]@{Source=($final + $suffix); Relative=(Join-Path 'final' ([IO.Path]::GetFileName($final) + $suffix))}) }
    }
  }
  return $plan.ToArray()
}

function Save-UninstallBackups {
  param([Parameter(Mandatory)]$Paths, [string]$LastBackup, [Parameter(Mandatory)][string]$ProgramDataRoot, [string]$ReaderSid)
  $plan = @(Get-UninstallBackupPlan -Paths $Paths -LastBackup $LastBackup -ProgramDataRoot $ProgramDataRoot)
  $directoryAcl = [Security.AccessControl.DirectorySecurity]::new()
  $fileAcl = [Security.AccessControl.FileSecurity]::new()
  $directoryAcl.SetAccessRuleProtection($true, $false)
  $fileAcl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @('S-1-5-18','S-1-5-32-544')) {
    $identity = [Security.Principal.SecurityIdentifier]::new($sid)
    $directoryAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit, ObjectInherit','None','Allow'))
    $fileAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','Allow'))
  }
  if ($ReaderSid) {
    $reader = [Security.Principal.SecurityIdentifier]::new($ReaderSid)
    if (-not $reader.IsAccountSid()) { throw 'El lector de respaldos debe ser el SID real de una cuenta Windows.' }
    $directoryAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($reader,'ReadAndExecute','ContainerInherit, ObjectInherit','None','Allow'))
    $fileAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($reader,'Read','Allow'))
  }
  $parent = Assert-UninstallPlainPath -Path (Join-Path $ProgramDataRoot 'Nexora POS - respaldos conservados')
  [IO.Directory]::CreateDirectory($parent, $directoryAcl) | Out-Null
  [IO.Directory]::SetAccessControl($parent, $directoryAcl)
  $saved = Join-Path $parent ([guid]::NewGuid().ToString('N'))
  [IO.Directory]::CreateDirectory($saved, $directoryAcl) | Out-Null
  foreach ($entry in $plan) {
    Assert-UninstallPlainPath -Path $entry.Source | Out-Null
    $destination = Join-Path $saved $entry.Relative
    [IO.Directory]::CreateDirectory((Split-Path -Parent $destination), $directoryAcl) | Out-Null
    $inputStream = $null; $outputStream = $null
    try {
      $inputStream = [IO.File]::Open($entry.Source, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
      # ACL privada en la creacion, ANTES del primer byte; nunca Copy-Item
      # sobre un archivo heredado/publico ni un permiso aplicado despues.
      $outputStream = [IO.File]::Create($destination, 65536, [IO.FileOptions]::None, $fileAcl)
      $inputStream.CopyTo($outputStream)
      $outputStream.Flush($true)
    } finally {
      if ($outputStream) { $outputStream.Dispose() }
      if ($inputStream) { $inputStream.Dispose() }
    }
    if ((Get-FileHash -LiteralPath $entry.Source -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash) { throw 'La copia no coincide con el original. Se cancelo el borrado de datos.' }
  }
  foreach ($entry in $plan | Where-Object { [IO.Path]::GetExtension($_.Source) -ieq '.dump' }) { Test-UninstallBackupSet -Dump (Join-Path $saved $entry.Relative) }
  Write-Host "Respaldos conservados fuera de la base: $saved"
  return $saved
}

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$state = $null
$lastBackup = ""
$preservedBackups = ''
if ($PurgeData) { Assert-UninstallDataBoundary -Data $paths.Data -ProgramDataRoot $env:ProgramData | Out-Null }
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

if ($PurgeData) {
  try {
    $reader = if ($state -and $state.PSObject.Properties.Name -contains 'backupReaderSid' -and $state.backupReaderSid) { [string]$state.backupReaderSid } else { [Security.Principal.WindowsIdentity]::GetCurrent().User.Value }
    $preservedBackups = Save-UninstallBackups -Paths $paths -LastBackup $lastBackup -ProgramDataRoot $env:ProgramData -ReaderSid $reader
  } catch {
    try { Start-FitStoreApplication } catch {}
    throw "No se pudieron conservar y verificar TODOS los respaldos; no se borraron datos ni se retiraron servicios. Detalle: $($_.Exception.Message)"
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
$nexoraPrograms = Join-Path ([Environment]::GetFolderPath("CommonPrograms")) "Nexora POS"
Remove-Item -LiteralPath (Join-Path $desktop "FitStore POS.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $desktop "Nexora POS.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $desktop "Certificado FitStore para celulares.cer") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $desktop "FitStore - acceso en celulares.txt") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $programs -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $nexoraPrograms "Nexora POS.lnk") -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $nexoraPrograms "Restaurar un respaldo.lnk") -Force -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $nexoraPrograms -PathType Container) {
  if (@(Get-ChildItem -LiteralPath $nexoraPrograms -Force).Count -eq 0) {
    Remove-Item -LiteralPath $nexoraPrograms -Force -ErrorAction SilentlyContinue
  }
}

if ($PurgeData) {
  $actual = Assert-UninstallDataBoundary -Data $paths.Data -ProgramDataRoot $env:ProgramData
  if (-not $preservedBackups -or -not (Test-Path -LiteralPath $preservedBackups -PathType Container)) { throw 'No existe el destino verificado de respaldos; no se borraron datos.' }
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
  Remove-Item -LiteralPath $actual -Recurse -Force
  Write-Host "Datos de la instalacion borrados. Respaldos conservados fuera de la base: $preservedBackups"
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
