param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$InstallerSession,
  [switch]$RecoverInterrupted
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

function Assert-UpdateManifest {
  param(
    [Parameter(Mandatory = $true)][string]$Manifest,
    [Parameter(Mandatory = $true)][string]$ExpectedManifestHash,
    [Parameter(Mandatory = $true)][string]$Root
  )
  if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { throw "Falta el manifiesto de la versión anterior." }
  $manifestHash = (Get-FileHash -LiteralPath $Manifest -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($manifestHash -ne $ExpectedManifestHash.ToLowerInvariant()) { throw "El manifiesto de rollback fue modificado." }
  $rootPath = [IO.Path]::GetFullPath($Root).TrimEnd("\")
  $count = 0
  foreach ($line in Get-Content -LiteralPath $Manifest -Encoding ASCII) {
    if ($line -notmatch "^([0-9a-fA-F]{64}) \*(.+)$") { throw "El manifiesto de rollback contiene una línea inválida." }
    $target = [IO.Path]::GetFullPath((Join-Path $rootPath $Matches[2].Replace("/", "\")))
    if (-not $target.StartsWith($rootPath + "\", [StringComparison]::OrdinalIgnoreCase)) { throw "El manifiesto intenta salir de la instalación." }
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { throw "Falta un archivo de la versión anterior: $($Matches[2])" }
    $actualHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $Matches[1].ToLowerInvariant()) { throw "No coincide el hash restaurado de $($Matches[2])." }
    $count++
  }
  if ($count -eq 0) { throw "El manifiesto de rollback está vacío." }
}

function Restore-PreviousDataFiles {
  param($Paths, [string]$PreviousDataPath)
  if (-not (Test-Path -LiteralPath $PreviousDataPath -PathType Container)) { return }
  $mapping = @{
    "state.json" = $Paths.State
    ".env" = $Paths.Env
    "work.env" = (Join-Path $Paths.Work ".env")
    "server.json" = $Paths.ServerConfig
  }
  foreach ($name in $mapping.Keys) {
    $source = Join-Path $PreviousDataPath $name
    if (Test-Path -LiteralPath $source -PathType Leaf) {
      Copy-Item -LiteralPath $source -Destination $mapping[$name] -Force
      Protect-FitStoreFile -Path $mapping[$name]
    }
  }
  $previousPki = Join-Path $PreviousDataPath "pki"
  if (Test-Path -LiteralPath $previousPki -PathType Container) {
    $expectedPki = [IO.Path]::GetFullPath((Join-Path $env:ProgramData "FitStore POS\pki")).TrimEnd("\")
    $actualPki = [IO.Path]::GetFullPath($Paths.Pki).TrimEnd("\")
    if ($actualPki -ne $expectedPki) { throw "La ruta PKI no pasó la comprobación de seguridad." }
    if (Test-Path -LiteralPath $actualPki) { Remove-Item -LiteralPath $actualPki -Recurse -Force }
    Copy-Item -LiteralPath $previousPki -Destination $actualPki -Recurse -Force
  }
}

function Restore-DatabaseFromUpdateBackup {
  param($Paths, $Secrets, [string]$Archive, [string]$ExpectedHash, [switch]$ExclusiveRecovery)
  if (-not (Test-Path -LiteralPath $Archive -PathType Leaf)) { throw "Falta el respaldo previo a la actualización: $Archive" }
  $actualHash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne $ExpectedHash.ToLowerInvariant()) { throw "El respaldo previo a la actualización no conserva su SHA-256." }
  $pgRestore = Join-Path $Paths.PgBin "pg_restore.exe"
  Invoke-FitStorePg -Tool $pgRestore -Password ([string]$Secrets.databasePassword) -Arguments @("--list", $Archive) -FailureMessage "El respaldo previo no pasó la verificación de PostgreSQL"
  Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
  Wait-FitStorePostgres -Paths $Paths -TimeoutSeconds 90
  Invoke-FitStorePg `
    -Tool (Join-Path $Paths.PgBin "psql.exe") `
    -Password ([string]$Secrets.postgresPassword) `
    -Arguments @("--host=127.0.0.1", "--port=5434", "--username=postgres", "--dbname=postgres", "--no-password", "--command=SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'fitstore' AND pid <> pg_backend_pid();") `
    -FailureMessage "No se pudieron cerrar las conexiones antes del rollback"
  $restoreUser = if ($ExclusiveRecovery) { 'postgres' } else { 'fitstore' }
  $restorePassword = if ($ExclusiveRecovery) { [string]$Secrets.postgresPassword } else { [string]$Secrets.databasePassword }
  Invoke-FitStorePg `
    -Tool $pgRestore `
    -Password $restorePassword `
    -Arguments @(
      "--host=127.0.0.1",
      "--port=5434",
      "--username=$restoreUser",
      "--role=fitstore",
      "--dbname=fitstore",
      "--no-owner",
      "--no-privileges",
      "--clean",
      "--if-exists",
      "--single-transaction",
      "--exit-on-error",
      $Archive
    ) `
    -FailureMessage "No se pudo revertir la base dentro de una transacción"
}

function Ensure-RestoredApplicationService {
  param($Paths, [Parameter(Mandatory = $true)][string]$Name, [switch]$KeepDisabled)
  $config = Join-Path $Paths.Services "$Name.xml"
  $dedicatedWrapper = Join-Path $Paths.Services "$Name.exe"
  # El XML restaurado no cambia una cuenta ya registrada en SCM: reinstalar
  # siempre, incluso si el servicio de la actualizacion fallida aun existe.
  if (-not (Test-Path -LiteralPath $config -PathType Leaf)) { throw "Falta la configuración restaurada del servicio $Name." }
  if (-not (Test-Path -LiteralPath $dedicatedWrapper -PathType Leaf) -and -not (Test-Path -LiteralPath $Paths.WinSW -PathType Leaf)) {
    throw "Falta el ejecutable WinSW restaurado para $Name."
  }
  Remove-FitStoreServiceRegistration -Name $Name -WinSW $Paths.WinSW -Config $config
    if (Test-Path -LiteralPath $dedicatedWrapper -PathType Leaf) {
      Invoke-FitStoreProcess -FilePath $dedicatedWrapper -Arguments @("install") -FailureMessage "No se pudo volver a registrar el servicio restaurado $Name" | Out-Null
    } elseif (Test-Path -LiteralPath $Paths.WinSW -PathType Leaf) {
      # Compatibilidad con instalaciones antiguas que usaban un WinSW global y
      # recibían el XML como argumento.
      Invoke-FitStoreProcess -FilePath $Paths.WinSW -Arguments @("install", $config) -FailureMessage "No se pudo volver a registrar el servicio restaurado $Name" | Out-Null
    } else {
      throw "Falta el ejecutable WinSW restaurado para $Name."
    }
  $mode = if ($KeepDisabled) { 'disabled' } else { 'delayed-auto' }
  Set-FitStoreServiceStartMode -Name $Name -Mode $mode
  $escapedName = $Name.Replace("'", "''")
  $registered = Get-CimInstance -ClassName Win32_Service -Filter "Name='$escapedName'" -ErrorAction Stop
  if (-not $registered -or [string]::IsNullOrWhiteSpace([string]$registered.StartName)) {
    throw "No se pudo verificar la cuenta registrada del servicio restaurado $Name."
  }
  return [string]$registered.StartName
}

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$marker = Get-FitStoreUpdateMarker -Paths $paths
if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) {
  Write-Host "No existe una transacción de actualización que revertir."
  exit 0
}
$transaction = Read-FitStoreJson -Path $marker
# No tocar servicios, archivos ni base con un marcador de otra ejecución.
# Marcadores anteriores sin sesión requieren recuperación manual verificada.
if (-not ($transaction.PSObject.Properties.Name -contains "installerSession") -or
    [string]$transaction.installerSession -cne $InstallerSession -or
    ($transaction.PSObject.Properties.Name -contains "phase" -and [string]$transaction.phase -eq "verified")) {
  throw "La transacción no pertenece a esta ejecución activa o ya fue verificada. No se modificaron datos; requiere revisión y recuperación manual con respaldo verificado."
}
foreach ($property in @("installDir", "transactionPath", "snapshotPath", "manifestPath", "manifestSha256", "backup", "backupSha256")) {
  if (-not ($transaction.PSObject.Properties.Name -contains $property) -or -not [string]$transaction.$property) {
    throw "La transacción de actualización está incompleta: falta $property."
  }
}
$expectedInstall = [IO.Path]::GetFullPath((Join-Path $env:ProgramFiles "FitStore POS")).TrimEnd("\")
$actualInstall = [IO.Path]::GetFullPath($paths.Install).TrimEnd("\")
$recordedInstall = [IO.Path]::GetFullPath([string]$transaction.installDir).TrimEnd("\")
if ($actualInstall -ne $expectedInstall -or $recordedInstall -ne $actualInstall) { throw "La ruta del rollback no pasó la comprobación de seguridad." }
$transactionPath = Assert-FitStoreSafeUpdatePath -Paths $paths -Path ([string]$transaction.transactionPath)
$snapshotPath = [IO.Path]::GetFullPath([string]$transaction.snapshotPath).TrimEnd("\")
if (-not $snapshotPath.StartsWith($transactionPath + "\", [StringComparison]::OrdinalIgnoreCase)) { throw "La copia anterior está fuera de la transacción permitida." }
$previousDataPath = if ($transaction.PSObject.Properties.Name -contains "previousDataPath") { [string]$transaction.previousDataPath } else { "" }
$failedInstall = Join-Path $transactionPath "failed-install"
$phase = if ($transaction.PSObject.Properties.Name -contains "phase") { [string]$transaction.phase } else { "desconocida" }
$recoveryAction = Get-FitStoreUpdateRecoveryAction -InstallPath $actualInstall -SnapshotPath $snapshotPath -Phase $phase
$hadSnapshot = $recoveryAction -in @("restore-snapshot", "resume-rollback")
if ($RecoverInterrupted) {
  # Verificar archivos antes de ejecutar psql/pg_ctl de la copia anterior.
  $verifiedRoot = if ($recoveryAction -eq 'restore-snapshot') { $snapshotPath } else { $actualInstall }
  Assert-UpdateManifest -Manifest ([string]$transaction.manifestPath) -ExpectedManifestHash ([string]$transaction.manifestSha256) -Root $verifiedRoot
  . (Join-Path $PSScriptRoot 'Recover-FitStoreUpdate.ps1') -DefinitionsOnly
  $relativeBin = $paths.PgBin.Substring($actualInstall.Length).TrimStart('\')
  $verifiedPgBin = Join-Path $verifiedRoot $relativeBin
  Assert-FitStoreInterruptedRecovery -Paths $paths -Transaction $transaction -ExclusiveAccess -VerifiedPgBin $verifiedPgBin
}

try {
  Stop-FitStoreApplication
  Stop-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90

  if ($recoveryAction -eq "restore-snapshot") {
    Assert-UpdateManifest -Manifest ([string]$transaction.manifestPath) -ExpectedManifestHash ([string]$transaction.manifestSha256) -Root $snapshotPath
    Set-FitStoreUpdatePhase -Paths $paths -Phase "rollback-files-moving"
    if (Test-Path -LiteralPath $actualInstall) {
      if (Test-Path -LiteralPath $failedInstall) { throw "Ya existe una instalación fallida preservada; no se sobrescribió." }
      $activeItem = Get-Item -LiteralPath $actualInstall -Force
      if (($activeItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "La instalación activa es un punto de reanálisis; no se movió." }
      Move-Item -LiteralPath $actualInstall -Destination $failedInstall
    }
    Move-Item -LiteralPath $snapshotPath -Destination $actualInstall
    Assert-UpdateManifest -Manifest ([string]$transaction.manifestPath) -ExpectedManifestHash ([string]$transaction.manifestSha256) -Root $actualInstall
    Set-FitStoreUpdatePhase -Paths $paths -Phase "rollback-files-restored"
  }
  if ($recoveryAction -in @("restore-snapshot", "resume-rollback")) {
    Assert-UpdateManifest -Manifest ([string]$transaction.manifestPath) -ExpectedManifestHash ([string]$transaction.manifestSha256) -Root $actualInstall
    if ($previousDataPath) { Restore-PreviousDataFiles -Paths $paths -PreviousDataPath $previousDataPath }

    $secrets = Read-FitStoreJson -Path $paths.Secrets
    Restore-DatabaseFromUpdateBackup -Paths $paths -Secrets $secrets -Archive ([string]$transaction.backup) -ExpectedHash ([string]$transaction.backupSha256) -ExclusiveRecovery:$RecoverInterrupted
  }

  # Restore-PreviousDataFiles protege de nuevo .env/TLS y elimina sus grants.
  # La identidad real en SCM (no el XML) determina los permisos necesarios.
  $usesLocalService = $false
  foreach ($service in @($script:ApiService, $script:WebService)) {
    $account = Ensure-RestoredApplicationService -Paths $paths -Name $service -KeepDisabled:$RecoverInterrupted
    if ($account -in @('NT AUTHORITY\LocalService', 'LocalService')) { $usesLocalService = $true }
    elseif ($account -notin @('LocalSystem', 'NT AUTHORITY\SYSTEM')) { throw "Cuenta de servicio restaurada no admitida para $service." }
  }
  if ($usesLocalService) { Grant-FitStoreApplicationAccess -Paths $paths }
  if ($RecoverInterrupted) {
    Disable-FitStoreRecoveryIsolation -Transaction $transaction -Psql (Join-Path $paths.PgBin 'psql.exe') -Secrets (Read-FitStoreJson -Path $paths.Secrets)
    Set-FitStoreServiceStartMode -Name $script:ApiService -Mode 'delayed-auto'
    Set-FitStoreServiceStartMode -Name $script:WebService -Mode 'delayed-auto'
  }
  Start-FitStoreApplication
  Wait-FitStoreHttp -Url "http://127.0.0.1:3001/api/health" -TimeoutSeconds 120
  Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 120
  if ($hadSnapshot -and $transaction.PSObject.Properties.Name -contains "previousVersion") {
    New-Item -Path $script:FitStoreRegistry -Force | Out-Null
    New-ItemProperty -Path $script:FitStoreRegistry -Name Version -Value ([string]$transaction.previousVersion) -PropertyType String -Force | Out-Null
  }
  Write-FitStoreLog -InstallDir $actualInstall -Level "AVISO" -Message "La actualización fallida fue revertida y la versión anterior respondió correctamente."
  Remove-Item -LiteralPath $marker -Force
  if (Test-Path -LiteralPath $transactionPath) { Remove-Item -LiteralPath $transactionPath -Recurse -Force }
  Write-Host "ROLLBACK CORRECTO: la versión anterior y su base fueron restauradas y verificadas."
} catch {
  try { Stop-FitStoreApplication } catch {}
  Write-FitStoreLog -InstallDir $actualInstall -Level "ERROR" -Message ("El rollback automático no terminó; se conservaron la transacción y el respaldo. " + $_.Exception.Message)
  throw
}
