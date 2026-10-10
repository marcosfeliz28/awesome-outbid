param(
  [string]$ExistingInstallDir,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerSession,
  [Parameter(Mandatory = $true)][ValidatePattern("^\d+$")][string]$ExpectedPostgresMajor
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $ExistingInstallDir
if (-not (Test-Path -LiteralPath $paths.State)) {
  Write-Host "No hay una instalación anterior que preparar."
  exit 0
}
if (-not (Test-Path -LiteralPath $paths.Secrets)) {
  throw "Existe una instalación anterior, pero falta secrets.json. No se sobrescribirá."
}

$state = Read-FitStoreJson -Path $paths.State
$expectedInstall = [IO.Path]::GetFullPath((Join-Path $env:ProgramFiles "FitStore POS")).TrimEnd("\")
$actualInstall = [IO.Path]::GetFullPath($paths.Install).TrimEnd("\")
if ($actualInstall -ne $expectedInstall) {
  throw "La ruta instalada no pasó la comprobación de seguridad; no se movió ningún archivo: $actualInstall"
}
if ($state.PSObject.Properties.Name -contains "installDir") {
  $stateInstall = [IO.Path]::GetFullPath([string]$state.installDir).TrimEnd("\")
  if ($stateInstall -ne $actualInstall) { throw "state.json no coincide con la ruta instalada. No se movió ningún archivo." }
}
$installItem = Get-Item -LiteralPath $actualInstall -Force
if (($installItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
  throw "La carpeta instalada es un enlace o punto de reanálisis; la actualización segura se canceló."
}
$marker = Get-FitStoreUpdateMarker -Paths $paths
if (Test-Path -LiteralPath $marker) {
  throw "Existe una actualización anterior sin cerrar. Ejecuta su recuperación antes de iniciar otra."
}
$pgVersionFile = Join-Path $paths.Database "PG_VERSION"
if (-not (Test-Path -LiteralPath $pgVersionFile -PathType Leaf)) {
  throw "Falta PG_VERSION en la base instalada. No se reemplazará ningún archivo."
}
$installedPostgresMajor = ((Get-Content -LiteralPath $pgVersionFile -Raw).Trim() -split "\.")[0]
if ($installedPostgresMajor -ne $ExpectedPostgresMajor) {
  throw "La base usa PostgreSQL $installedPostgresMajor y el instalador incluye PostgreSQL $ExpectedPostgresMajor. La actualización mayor requiere migración asistida; no se reemplazó ningún archivo."
}
$backupScript = Join-Path $paths.Scripts "Backup-FitStore.ps1"
if (-not (Test-Path -LiteralPath $backupScript)) {
  throw "La versión instalada no tiene la herramienta de respaldo. Actualízala manualmente sólo después de crear y verificar un pg_dump."
}
$previousVersion = if ($state.PSObject.Properties.Name -contains "version") { [string]$state.version } else { "desconocida" }
$transactionId = (Get-Date -Format "yyyyMMdd_HHmmss_fff") + "_" + [Guid]::NewGuid().ToString("N").Substring(0, 12)
$transactionPath = Join-Path $paths.UpdateWork $transactionId
$snapshotPath = Join-Path $transactionPath "previous-install"
$previousDataPath = Join-Path $transactionPath "previous-data"
$manifestPath = Join-Path $transactionPath "previous-install.sha256"
$installVolume = [IO.Path]::GetPathRoot($actualInstall)
$transactionVolume = [IO.Path]::GetPathRoot([IO.Path]::GetFullPath($transactionPath))
if (-not [string]::Equals($installVolume, $transactionVolume, [StringComparison]::OrdinalIgnoreCase)) {
  throw "La actualización segura requiere que Program Files y ProgramData estén en el mismo volumen. No se detuvo ni reemplazó la instalación."
}
$applicationStopped = $false
$applicationAutostartDisabled = $false
$snapshotReady = $false

try {
  # Primero se cierra la entrada web y después la API. Desde este punto no se
  # aceptan ventas nuevas antes del respaldo consistente.
  Stop-FitStoreApplication
  $applicationStopped = $true
  Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
  Wait-FitStorePostgres -Paths $paths -TimeoutSeconds 90

  $backupCutoffAt = (Get-Date).ToUniversalTime().ToString('o')
  $output = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $backupScript -InstallDir $paths.Install -Motivo "antes-de-actualizar")
  if ($LASTEXITCODE -ne 0) { throw "No se creó el respaldo previo. La actualización fue cancelada." }
  $backup = $output | Select-Object -Last 1
  if (-not $backup -or -not (Test-Path -LiteralPath $backup -PathType Leaf)) {
    throw "No se pudo verificar la ruta del respaldo previo. La actualización fue cancelada."
  }
  $backupHashFile = "$backup.sha256"
  if (-not (Test-Path -LiteralPath $backupHashFile -PathType Leaf)) {
    throw 'Falta el SHA256 del respaldo previo. La actualizacion fue cancelada.'
  }
  $hashRecord = ([IO.File]::ReadAllText($backupHashFile)).Trim()
  if ($hashRecord -notmatch '^(?<hash>[0-9a-fA-F]{64})\s+\*?[^\r\n]+$') {
    throw 'El SHA256 del respaldo previo no tiene un formato valido. La actualizacion fue cancelada.'
  }
  $expectedBackupHash = $Matches.hash.ToLowerInvariant()
  if ((Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedBackupHash) {
    throw 'El respaldo previo no coincide con su SHA256 registrado. La actualizacion fue cancelada.'
  }
  # Cargar el SID registrado, no el de una fixture ni una identidad publica.
  $privateBackupDirectory = Initialize-FitStoreBackupStorage -Paths $paths -State $state
  try {
    foreach ($backupFile in @($backup, "$backup.sha256", "$backup.json")) {
      if (Test-Path -LiteralPath $backupFile -PathType Leaf) { Protect-FitStoreBackupFile -Path $backupFile }
    }
  } catch {
    # USB/FAT o red pueden permitir leer pero no cambiar ACL. Conservar el
    # original y utilizar una copia local privada creada con ACL desde el inicio.
    $sourceBackup = [string]$backup
    $privateBackup = Join-Path $privateBackupDirectory ("FitStore_preflight_" + [Guid]::NewGuid().ToString('N') + '.dump')
    foreach ($suffix in @('', '.sha256', '.json')) {
      $sourceFile = $sourceBackup + $suffix
      if (-not (Test-Path -LiteralPath $sourceFile -PathType Leaf)) { continue }
      $destinationFile = $privateBackup + $suffix
      New-FitStoreBackupFile -Path $destinationFile
      $inputStream = $null
      $outputStream = $null
      try {
        $inputStream = [IO.File]::OpenRead($sourceFile)
        $outputStream = [IO.File]::Open($destinationFile, [IO.FileMode]::Open, [IO.FileAccess]::Write, [IO.FileShare]::None)
        $inputStream.CopyTo($outputStream)
      } finally {
        if ($outputStream) { $outputStream.Dispose() }
        if ($inputStream) { $inputStream.Dispose() }
      }
      if ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash -cne (Get-FileHash -LiteralPath $destinationFile -Algorithm SHA256).Hash) {
        throw 'La copia privada del respaldo previo no coincide con el original. La actualizacion fue cancelada.'
      }
    }
    # El contenido del dump debe coincidir con el hash registrado antes de la
    # copia, no con un original que pudo alterarse mientras se copiaba.
    if ((Get-FileHash -LiteralPath $privateBackup -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expectedBackupHash) {
      throw 'La copia privada no coincide con el SHA256 registrado del respaldo. La actualizacion fue cancelada.'
    }
    [IO.File]::WriteAllText("$privateBackup.sha256", ($expectedBackupHash + ' *' + (Split-Path -Leaf $privateBackup) + [Environment]::NewLine), [Text.Encoding]::ASCII)
    $backup = $privateBackup
    Write-FitStoreLog -InstallDir $paths.Install -Level 'AVISO' -Message 'No se pudo proteger el respaldo anterior en USB/red. Se usara una copia local privada; revise los permisos del original conservado.'
  }
  $backupHash = (Get-FileHash -LiteralPath $backup -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($backupHash -cne $expectedBackupHash) { throw 'El respaldo cambio despues de verificar su SHA256. La actualizacion fue cancelada.' }

  # Si Windows se reinicia durante el staging, ninguna versión sin verificar
  # debe abrir la caja automáticamente. El instalador o el rollback restauran
  # el inicio retardado una vez comprobada la versión que quedará activa.
  $applicationAutostartDisabled = $true
  Set-FitStoreServiceStartMode -Name $script:WebService -Mode "disabled"
  Set-FitStoreServiceStartMode -Name $script:ApiService -Mode "disabled"
  Stop-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
  New-FitStoreDirectory -Path $transactionPath
  New-FitStoreDirectory -Path $previousDataPath
  & "$env:SystemRoot\System32\icacls.exe" $transactionPath "/inheritance:r" "/grant:r" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo proteger el área temporal de la actualización." }

  $manifestLines = Get-ChildItem -LiteralPath $actualInstall -Recurse -File -Force |
    Sort-Object FullName |
    ForEach-Object {
      $relative = $_.FullName.Substring($actualInstall.Length + 1).Replace("\", "/")
      $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
      "$hash *$relative"
    }
  if (@($manifestLines).Count -eq 0) { throw "La instalación anterior está vacía; no se preparó la actualización." }
  $manifestLines | Set-Content -LiteralPath $manifestPath -Encoding ASCII
  $manifestHash = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()

  foreach ($dataFile in @($paths.State, $paths.Env, $paths.ServerConfig)) {
    if (Test-Path -LiteralPath $dataFile -PathType Leaf) {
      Copy-Item -LiteralPath $dataFile -Destination (Join-Path $previousDataPath (Split-Path -Leaf $dataFile)) -Force
    }
  }
  $runtimeEnv = Join-Path $paths.Work ".env"
  if (Test-Path -LiteralPath $runtimeEnv -PathType Leaf) {
    Copy-Item -LiteralPath $runtimeEnv -Destination (Join-Path $previousDataPath "work.env") -Force
  }
  if (Test-Path -LiteralPath $paths.Pki -PathType Container) {
    Copy-Item -LiteralPath $paths.Pki -Destination (Join-Path $previousDataPath "pki") -Recurse -Force
  }

  $transaction = [ordered]@{
    schemaVersion = 2
    backupCutoffAt = $backupCutoffAt
    applicationAutostartDisabled = $applicationAutostartDisabled
    transactionId = $transactionId
    installerSession = $InstallerSession
    preparedAt = (Get-Date).ToUniversalTime().ToString("o")
    phase = "prepared-copy-pending"
    phaseChangedAt = (Get-Date).ToUniversalTime().ToString("o")
    previousVersion = $previousVersion
    installDir = $actualInstall
    transactionPath = $transactionPath
    snapshotPath = $snapshotPath
    previousDataPath = $previousDataPath
    manifestPath = $manifestPath
    manifestSha256 = $manifestHash
    backup = [string]$backup
    backupSha256 = $backupHash
  }
  Write-FitStoreJson -Path $marker -Value $transaction -Protect

  Move-Item -LiteralPath $actualInstall -Destination $snapshotPath
  $snapshotReady = $true
  $transaction.phase = "snapshot-ready"
  $transaction.phaseChangedAt = (Get-Date).ToUniversalTime().ToString("o")
  Write-FitStoreJson -Path $marker -Value $transaction -Protect
  Write-FitStoreLog -InstallDir $actualInstall -Message "Actualización preparada; aplicación cerrada, respaldo verificado y versión anterior apartada en una transacción recuperable."
} catch {
  $originalError = $_.Exception.Message
  try {
    if ((Test-Path -LiteralPath $snapshotPath -PathType Container) -and -not (Test-Path -LiteralPath $actualInstall)) {
      Move-Item -LiteralPath $snapshotPath -Destination $actualInstall
      $snapshotReady = $false
    }
    if (-not $snapshotReady -and (Test-Path -LiteralPath $transactionPath)) {
      Remove-Item -LiteralPath $transactionPath -Recurse -Force
      Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
    }
    if ($applicationAutostartDisabled) {
      Set-FitStoreServiceStartMode -Name $script:ApiService -Mode "delayed-auto"
      Set-FitStoreServiceStartMode -Name $script:WebService -Mode "delayed-auto"
    }
    if ($applicationStopped -and (Test-Path -LiteralPath $actualInstall)) { Start-FitStoreApplication }
  } catch {
    throw "$originalError Además, no se pudo reabrir automáticamente la versión anterior: $($_.Exception.Message)"
  }
  throw $originalError
}
