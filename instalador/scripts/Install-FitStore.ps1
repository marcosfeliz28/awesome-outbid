param(
  [Parameter(Mandatory = $true)][string]$InstallDir,
  [Parameter(Mandatory = $true)][string]$RespuestaPath,
  [Parameter(Mandatory = $true)][string]$Version
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

function Read-SetupIni {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "Falta el archivo temporal del asistente." }
  $result = @{}
  $section = ""
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match "^\s*\[(.+)\]\s*$") { $section = $Matches[1]; continue }
    if ($section -ne "Setup" -or $line -notmatch "^([^=]+)=(.*)$") { continue }
    $result[$Matches[1].Trim()] = $Matches[2]
  }
  return $result
}

function Get-ExistingEnvValue {
  param([string]$Path, [string]$Name, [string]$Default = "")
  if (-not (Test-Path -LiteralPath $Path)) { return $Default }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match ("^" + [Regex]::Escape($Name) + "=(.*)$")) { return $Matches[1] }
  }
  return $Default
}

function Assert-OwnerInput {
  param($Answer)
  if (-not $Answer.ContainsKey("OwnerName") -or [string]$Answer.OwnerName -notmatch "^.{2,100}$") { throw "El nombre del usuario dueño no es válido." }
  if (-not $Answer.ContainsKey("OwnerEmail")) { throw "Falta el correo del usuario dueño." }
  try {
    $mail = New-Object Net.Mail.MailAddress([string]$Answer.OwnerEmail)
    if ($mail.Address -ne [string]$Answer.OwnerEmail) { throw "correo" }
  } catch { throw "El correo del usuario dueño no es válido." }
  if (-not $Answer.ContainsKey("OwnerPassword") -or
      ([string]$Answer.OwnerPassword).Length -lt 12 -or
      ([string]$Answer.OwnerPassword).Length -gt 128 -or
      [Text.Encoding]::UTF8.GetByteCount([string]$Answer.OwnerPassword) -gt 72) {
    throw "La contraseña debe tener entre 12 y 72 bytes UTF-8."
  }
  if (-not $Answer.ContainsKey("OwnerPasswordConfirm") -or [string]$Answer.OwnerPassword -cne [string]$Answer.OwnerPasswordConfirm) { throw "Las contraseñas no coinciden." }
  if (-not $Answer.ContainsKey("OwnerPin") -or [string]$Answer.OwnerPin -notmatch "^\d{6}$") { throw "El PIN debe tener 6 dígitos." }
}

function Get-OptionalProperty {
  param($Object, [string]$Name, $Default)
  if ($Object.PSObject.Properties.Name -contains $Name) { return $Object.$Name }
  return $Default
}

function Install-MicrosoftRuntime {
  param($Paths)
  $installer = Join-Path $Paths.Install "runtime\vc_redist.x64.exe"
  if (-not (Test-Path -LiteralPath $installer)) { throw "Falta el runtime firmado de Microsoft requerido por PostgreSQL." }
  $process = Start-Process -FilePath $installer -ArgumentList @("/install", "/quiet", "/norestart") -Wait -PassThru
  if ($process.ExitCode -notin @(0, 1638, 3010)) { throw "No se pudo instalar Microsoft Visual C++ Runtime. Código: $($process.ExitCode)." }
}

function Register-PostgresService {
  param($Paths)
  if (-not (Get-Service -Name $script:PostgresService -ErrorAction SilentlyContinue)) {
    Invoke-FitStoreProcess `
      -FilePath (Join-Path $Paths.PgBin "pg_ctl.exe") `
      -Arguments @("register", "-N", $script:PostgresService, "-D", $Paths.Database, "-S", "auto") `
      -FailureMessage "No se pudo registrar PostgreSQL como servicio"
  }
  & "$env:SystemRoot\System32\sc.exe" config $script:PostgresService start= delayed-auto | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo configurar el inicio automático de PostgreSQL." }
}

function Initialize-PostgresCluster {
  param($Paths, $Secrets)
  if (Get-Service -Name $script:PostgresService -ErrorAction SilentlyContinue) {
    throw "Ya existe un servicio llamado $script:PostgresService sin una instalación reconocida. No se modificó."
  }
  $databaseParent = Split-Path -Parent $Paths.Database
  $installerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  New-FitStoreDirectory -Path $databaseParent
  & "$env:SystemRoot\System32\icacls.exe" $databaseParent "/grant:r" "*$installerSid`:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar la carpeta temporalmente para initdb." }
  $passwordFile = Join-Path $Paths.Data "initdb-password.tmp"
  try {
    [string]$Secrets.postgresPassword | Set-Content -LiteralPath $passwordFile -Encoding ASCII
    Protect-FitStoreFile -Path $passwordFile
    & "$env:SystemRoot\System32\icacls.exe" $passwordFile "/grant:r" "*$installerSid`:(F)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudo permitir a initdb leer su archivo temporal." }
    Invoke-FitStoreProcess `
      -FilePath (Join-Path $Paths.PgBin "initdb.exe") `
      -Arguments @(
        "--pgdata=$($Paths.Database)",
        "--username=postgres",
        "--pwfile=$passwordFile",
        "--auth-host=scram-sha-256",
        "--auth-local=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C"
      ) `
      -FailureMessage "No se pudo crear la base local"
  } finally {
    Remove-Item -LiteralPath $passwordFile -Force -ErrorAction SilentlyContinue
    & "$env:SystemRoot\System32\icacls.exe" $databaseParent "/remove:g" "*$installerSid" "/T" "/C" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "No se pudieron retirar los permisos temporales de initdb." }
  }
  @(
    "",
    "# Configuración administrada por FitStore POS",
    "listen_addresses = '127.0.0.1'",
    "port = 5434",
    "timezone = 'UTC'",
    "log_timezone = 'UTC'",
    "password_encryption = 'scram-sha-256'",
    "max_connections = 100"
  ) | Add-Content -LiteralPath (Join-Path $Paths.Database "postgresql.conf") -Encoding UTF8
  @(
    "# Acceso local exclusivo de FitStore POS",
    "host all all 127.0.0.1/32 scram-sha-256",
    "host all all ::1/128 scram-sha-256"
  ) | Set-Content -LiteralPath (Join-Path $Paths.Database "pg_hba.conf") -Encoding ASCII
  Register-PostgresService -Paths $Paths
}

function Assert-PostgresMajorVersion {
  param($Paths)
  if (-not (Test-Path -LiteralPath $Paths.Database)) { throw "Falta la carpeta de datos de PostgreSQL." }
  $dataMajor = (Get-Content -LiteralPath (Join-Path $Paths.Database "PG_VERSION") -Raw).Trim().Split(".")[0]
  $binaryVersion = (& (Join-Path $Paths.PgBin "postgres.exe") --version) -join " "
  if ($LASTEXITCODE -ne 0 -or $binaryVersion -notmatch "PostgreSQL\)\s+(\d+)") { throw "No se pudo identificar la versión incluida de PostgreSQL." }
  if ($dataMajor -ne $Matches[1]) {
    throw "La base usa PostgreSQL $dataMajor y el instalador incluye $($Matches[1]). Una actualización mayor requiere migración asistida; no se tocaron los datos."
  }
}

function Initialize-FitStoreDatabase {
  param($Paths, $Secrets)
  $sqlFile = Join-Path $Paths.Data "crear-base.tmp.sql"
  $password = [string]$Secrets.databasePassword
  if ($password -notmatch "^[A-Za-z0-9_-]+$") { throw "El secreto interno de base no tiene el formato esperado." }
  try {
    @"
\set ON_ERROR_STOP on
DO `$fitstore`$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'fitstore') THEN
    CREATE ROLE fitstore LOGIN PASSWORD '$password';
  ELSE
    ALTER ROLE fitstore WITH LOGIN PASSWORD '$password';
  END IF;
END
`$fitstore`$;
SELECT 'CREATE DATABASE fitstore OWNER fitstore'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'fitstore')\gexec
ALTER DATABASE fitstore OWNER TO fitstore;
ALTER ROLE fitstore SET timezone TO 'UTC';
"@ | Set-Content -LiteralPath $sqlFile -Encoding UTF8
    Protect-FitStoreFile -Path $sqlFile
    Invoke-FitStorePg `
      -Tool (Join-Path $Paths.PgBin "psql.exe") `
      -Password ([string]$Secrets.postgresPassword) `
      -Arguments @("--host=127.0.0.1", "--port=5434", "--username=postgres", "--dbname=postgres", "--no-password", "--file=$sqlFile") `
      -FailureMessage "No se pudo crear el rol y la base de FitStore"
  } finally {
    Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue
  }
}

function Write-EnvironmentFile {
  param($Paths, $Secrets)
  $anthropicKey = Get-ExistingEnvValue -Path $Paths.Env -Name "ANTHROPIC_API_KEY"
  $anthropicModel = Get-ExistingEnvValue -Path $Paths.Env -Name "ANTHROPIC_MODEL" -Default "claude-opus-5-5"
  $lines = @(
    "DATABASE_URL=$(Get-FitStoreDatabaseUrl -Secrets $Secrets)",
    "JWT_SECRET=$([string]$Secrets.jwtSecret)",
    "WEB_ORIGIN=https://localhost:4173",
    "PORT=3001",
    "ANTHROPIC_API_KEY=$anthropicKey",
    "ANTHROPIC_MODEL=$anthropicModel"
  )
  $encoding = [Text.UTF8Encoding]::new($false)
  [IO.File]::WriteAllLines($Paths.Env, $lines, $encoding)
  Protect-FitStoreFile -Path $Paths.Env
  $runtimeEnv = Join-Path $Paths.Work ".env"
  [IO.File]::WriteAllLines($runtimeEnv, $lines, $encoding)
  Protect-FitStoreFile -Path $runtimeEnv
}

function New-OwnerAccount {
  param($Paths, $Secrets, $Answer)
  $tsx = Join-Path $Paths.Api "node_modules\.bin\tsx.cmd"
  $old = @{
    DATABASE_URL = $env:DATABASE_URL
    ADMIN_EMAIL = $env:ADMIN_EMAIL
    ADMIN_PASSWORD = $env:ADMIN_PASSWORD
    ADMIN_PIN = $env:ADMIN_PIN
    ADMIN_NAME = $env:ADMIN_NAME
    ADMIN_MODE = $env:ADMIN_MODE
  }
  try {
    $env:DATABASE_URL = Get-FitStoreDatabaseUrl -Secrets $Secrets
    $env:ADMIN_EMAIL = [string]$Answer.OwnerEmail
    $env:ADMIN_PASSWORD = [string]$Answer.OwnerPassword
    $env:ADMIN_PIN = [string]$Answer.OwnerPin
    $env:ADMIN_NAME = [string]$Answer.OwnerName
    $env:ADMIN_MODE = "bootstrap"
    Push-Location $Paths.Api
    try {
      Invoke-FitStoreProcess -FilePath $tsx -Arguments @("scripts\create-admin.ts") -FailureMessage "No se pudo crear el usuario dueño"
    } finally { Pop-Location }
  } finally {
    foreach ($name in $old.Keys) {
      if ($null -eq $old[$name]) { Remove-Item "Env:$name" -ErrorAction SilentlyContinue } else { Set-Item "Env:$name" $old[$name] }
    }
  }
}

function Install-WinSwService {
  param(
    $Paths,
    [string]$Name,
    [string]$TemplateName,
    [hashtable]$Replacements,
    [ValidateSet("delayed-auto", "demand")][string]$StartMode = "delayed-auto"
  )
  $template = Get-Content -LiteralPath (Join-Path $Paths.Services "$TemplateName.xml.template") -Raw -Encoding UTF8
  foreach ($key in $Replacements.Keys) { $template = $template.Replace("{{$key}}", (ConvertTo-FitStoreXmlText -Value ([string]$Replacements[$key]))) }
  $config = Join-Path $Paths.Services "$Name.xml"
  $wrapper = Join-Path $Paths.Services "$Name.exe"
  $template | Set-Content -LiteralPath $config -Encoding UTF8
  Remove-FitStoreServiceRegistration -Name $Name -WinSW $wrapper -Config $config
  Copy-Item -LiteralPath $Paths.WinSW -Destination $wrapper -Force
  Invoke-FitStoreProcess -FilePath $wrapper -Arguments @("install") -FailureMessage "No se pudo instalar el servicio $Name"
  Set-FitStoreServiceStartMode -Name $Name -Mode $StartMode
}

function Register-FitStoreTasks {
  param($Paths)
  Unregister-ScheduledTask -TaskName $script:BackupTask -Confirm:$false -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $script:NetworkTask -Confirm:$false -ErrorAction SilentlyContinue
  $powerShell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 3) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 5)
  $backupAction = New-ScheduledTaskAction -Execute $powerShell -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`" -InstallDir `"{1}`" -Motivo programado" -f (Join-Path $Paths.Scripts "Backup-FitStore.ps1"), $Paths.Install)
  $backupTrigger = New-ScheduledTaskTrigger -Daily -At 2:00am
  Register-ScheduledTask -TaskName $script:BackupTask -Action $backupAction -Trigger $backupTrigger -Principal $principal -Settings $settings -Description "Respaldo diario verificado de FitStore POS; conserva 30 días." | Out-Null
  $networkAction = New-ScheduledTaskAction -Execute $powerShell -Argument ("-NoProfile -ExecutionPolicy Bypass -File `"{0}`" -InstallDir `"{1}`"" -f (Join-Path $Paths.Scripts "Configure-Network.ps1"), $Paths.Install)
  $networkTrigger = New-ScheduledTaskTrigger -AtStartup
  $networkTrigger.Delay = "PT1M"
  Register-ScheduledTask -TaskName $script:NetworkTask -Action $networkAction -Trigger $networkTrigger -Principal $principal -Settings $settings -Description "Renueva el certificado HTTPS si cambia la dirección local." | Out-Null
}

function New-FitStoreShortcuts {
  param($Paths)
  $shell = New-Object -ComObject WScript.Shell
  $desktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
  $programs = Join-Path ([Environment]::GetFolderPath("CommonPrograms")) "Nexora POS"
  New-FitStoreDirectory -Path $programs
  $open = $shell.CreateShortcut((Join-Path $desktop "Nexora POS.lnk"))
  $open.TargetPath = "$env:SystemRoot\explorer.exe"
  $open.Arguments = "https://localhost:4173"
  $open.IconLocation = (Join-Path $Paths.Install "assets\fitstore.ico")
  $open.Description = "Abrir Nexora POS"
  $open.Save()
  Copy-Item -LiteralPath (Join-Path $desktop "Nexora POS.lnk") -Destination (Join-Path $programs "Nexora POS.lnk") -Force
  $restore = $shell.CreateShortcut((Join-Path $programs "Restaurar un respaldo.lnk"))
  $restore.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
  $restore.Arguments = ("-STA -NoProfile -ExecutionPolicy Bypass -File `"{0}`" -InstallDir `"{1}`"" -f (Join-Path $Paths.Scripts "Restore-FitStore.ps1"), $Paths.Install)
  $restore.IconLocation = (Join-Path $Paths.Install "assets\fitstore.ico")
  $restore.Description = "Restaurar una copia de Nexora POS"
  $restore.Save()
  Remove-Item -LiteralPath (Join-Path $desktop "FitStore POS.lnk") -Force -ErrorAction SilentlyContinue
  Copy-Item -LiteralPath (Join-Path $Paths.Pki "FitStore-CA.cer") -Destination (Join-Path $desktop "Certificado FitStore para celulares.cer") -Force
  Copy-Item -LiteralPath (Join-Path $Paths.Data "RED_LOCAL.txt") -Destination (Join-Path $desktop "FitStore - acceso en celulares.txt") -Force
}

Assert-FitStoreAdministrator
$answer = Read-SetupIni -Path $RespuestaPath
$paths = Get-FitStorePaths -InstallDir $InstallDir
$stateExists = Test-Path -LiteralPath $paths.State
# Sin estado no se puede distinguir una instalación nueva de datos huérfanos.
# Rechazar antes de instalar runtimes, cambiar ACL o generar nuevas credenciales.
if (-not $stateExists) {
  $hasPreviousSecrets = Test-Path -LiteralPath $paths.Secrets
  $hasPreviousDatabase = Test-Path -LiteralPath (Join-Path $paths.Database "PG_VERSION")
  if (-not $hasPreviousDatabase -and (Test-Path -LiteralPath $paths.Database)) {
    $hasPreviousDatabase = @(
      Get-ChildItem -LiteralPath $paths.Database -Force -ErrorAction Stop |
        Select-Object -First 1
    ).Count -gt 0
  }
  if ($hasPreviousSecrets -or $hasPreviousDatabase) {
    throw "Se encontraron datos anteriores sin el estado de instalación. No se modificaron los datos ni las credenciales. Recupera el estado original y su respaldo antes de reinstalar; no borres secrets.json ni la carpeta PostgreSQL."
  }
}
$isUpdate = $false
$isResume = $false
$isReinstall = $false
$resumeHadPostgresData = $false
if ($stateExists) {
  $stateProbe = Read-FitStoreJson -Path $paths.State
  $complete = [bool](Get-OptionalProperty -Object $stateProbe -Name "installationComplete" -Default $true)
  if ($complete) {
    $isUpdate = $true
    $isReinstall = -not [bool](Get-Service -Name $script:PostgresService -ErrorAction SilentlyContinue)
  } else {
    $isResume = $true
  }
}
if ($isUpdate) { Set-FitStoreUpdatePhase -Paths $paths -Phase "configuring" }

$requiredFiles = @(
  $paths.Node,
  $paths.WinSW,
  (Join-Path $paths.Install "runtime\vc_redist.x64.exe"),
  (Join-Path $paths.Api "dist\main.js"),
  (Join-Path $paths.Web "index.html")
)
$requiredFiles += @("postgres.exe", "pg_ctl.exe", "initdb.exe", "pg_isready.exe", "psql.exe", "pg_dump.exe", "pg_restore.exe", "createdb.exe", "dropdb.exe") |
  ForEach-Object { Join-Path $paths.PgBin $_ }
foreach ($required in $requiredFiles) {
  if (-not (Test-Path -LiteralPath $required)) { throw "El paquete de instalación está incompleto: $required" }
}

if (-not $isUpdate) { Assert-OwnerInput -Answer $answer }
Install-MicrosoftRuntime -Paths $paths
New-FitStoreDirectory -Path $paths.Data
foreach ($directory in @($paths.Logs, $paths.Work, (Join-Path $paths.Work "app\api"), $paths.LocalBackups, $paths.Pki)) { New-FitStoreDirectory -Path $directory }
& "$env:SystemRoot\System32\icacls.exe" $paths.Data "/inheritance:r" "/grant:r" "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "No se pudo proteger la carpeta de datos de FitStore." }

if ($isUpdate -or $isResume) {
  $secrets = Read-FitStoreJson -Path $paths.Secrets
  $state = Read-FitStoreJson -Path $paths.State
  if (Test-Path -LiteralPath (Join-Path $paths.Database "PG_VERSION")) {
    $resumeHadPostgresData = $isResume
    Assert-PostgresMajorVersion -Paths $paths
    Register-PostgresService -Paths $paths
  } elseif ($isResume) {
    if (Get-Service -Name $script:PostgresService -ErrorAction SilentlyContinue) {
      Stop-FitStoreService -Name $script:PostgresService
      & "$env:SystemRoot\System32\sc.exe" delete $script:PostgresService | Out-Null
      Start-Sleep -Seconds 2
    }
    Initialize-PostgresCluster -Paths $paths -Secrets $secrets
  } else {
    throw "Se conservaron los datos de FitStore, pero falta PG_VERSION. No se modificó la carpeta."
  }
} else {
  $secrets = [ordered]@{
    schemaVersion = 1
    postgresPassword = New-FitStoreSecret -Bytes 48
    databasePassword = New-FitStoreSecret -Bytes 48
    jwtSecret = New-FitStoreSecret -Bytes 64
    pfxPassword = New-FitStoreSecret -Bytes 48
  }
  $backupPath = $paths.LocalBackups
  if ($answer.ContainsKey("BackupPath") -and [string]$answer.BackupPath) { $backupPath = [IO.Path]::GetFullPath([string]$answer.BackupPath) }
  $state = [pscustomobject][ordered]@{
    schemaVersion = 1
    version = $Version
    installedAt = (Get-Date).ToUniversalTime().ToString("o")
    updatedAt = (Get-Date).ToUniversalTime().ToString("o")
    installDir = $paths.Install
    dataDir = $paths.Data
    backupPath = $backupPath
    postgresqlPort = 5434
    caThumbprint = ""
    leafThumbprint = ""
    certificateIps = @()
    certificateDnsNames = @()
    ownerCreated = $false
    installationComplete = $false
  }
  Write-FitStoreJson -Path $paths.Secrets -Value $secrets -Protect
  Write-FitStoreJson -Path $paths.State -Value $state -Protect
  Initialize-PostgresCluster -Paths $paths -Secrets $secrets
}

$installerUserSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
if ($installerUserSid.IsAccountSid()) { $state | Add-Member -NotePropertyName backupReaderSid -NotePropertyValue $installerUserSid.Value -Force }
Initialize-FitStoreBackupStorage -Paths $paths -State $state | Out-Null
Write-FitStoreJson -Path $paths.State -Value $state -Protect
Write-EnvironmentFile -Paths $paths -Secrets $secrets

Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
Wait-FitStorePostgres -Paths $paths -TimeoutSeconds 90
if ($isReinstall) {
  $reinstallBackup = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File (Join-Path $paths.Scripts "Backup-FitStore.ps1") -InstallDir $paths.Install -Motivo "antes-de-reinstalar")
  $reinstallBackupPath = $reinstallBackup | Select-Object -Last 1
  if ($LASTEXITCODE -ne 0 -or -not $reinstallBackupPath -or -not (Test-Path -LiteralPath $reinstallBackupPath -PathType Leaf)) { throw "No se pudo verificar un respaldo antes de reinstalar." }
}
Initialize-FitStoreDatabase -Paths $paths -Secrets $secrets
$ownerCreated = $true
if (-not $isUpdate) {
  $ownerCreated = [bool](Get-OptionalProperty -Object $state -Name "ownerCreated" -Default $false)
}
if ($isResume -and $resumeHadPostgresData -and -not $ownerCreated) {
  $resumeBackupOutput = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File (Join-Path $paths.Scripts "Backup-FitStore.ps1") -InstallDir $paths.Install -Motivo "antes-de-reanudar-propietario")
  $resumeBackupExitCode = $LASTEXITCODE
  $resumeBackupPath = $resumeBackupOutput | Where-Object {
    $_ -is [string] -and (Test-Path -LiteralPath $_ -PathType Leaf)
  } | Select-Object -Last 1
  if ($resumeBackupExitCode -ne 0 -or -not $resumeBackupPath) {
    throw "No se pudo verificar un respaldo antes de reparar el usuario dueño."
  }
}
if ($isUpdate) { Set-FitStoreUpdatePhase -Paths $paths -Phase "migrating" }
Invoke-FitStoreMigrations -Paths $paths -Secrets $secrets
if (-not $isUpdate) {
  if (-not $ownerCreated) {
    New-OwnerAccount -Paths $paths -Secrets $secrets -Answer $answer
  }
  $state | Add-Member -NotePropertyName ownerCreated -NotePropertyValue $true -Force
  Write-FitStoreJson -Path $paths.State -Value $state -Protect
}

& (Join-Path $paths.Scripts "Configure-Network.ps1") -InstallDir $paths.Install -Force:(!$isUpdate)
Grant-FitStoreApplicationAccess -Paths $paths

$applicationServiceStartMode = if ($isUpdate) { "demand" } else { "delayed-auto" }
$serviceValues = @{
  NODE_EXE = $paths.Node
  API_MAIN = (Join-Path $paths.Api "dist\main.js")
  API_WORKDIR = (Join-Path $paths.Work "app\api")
  LOG_DIR = $paths.Logs
  WEB_SERVER = (Join-Path $paths.Install "runtime\web-server.mjs")
  SERVER_CONFIG = $paths.ServerConfig
  INSTALL_DIR = $paths.Install
  SERVICE_START_MODE = $(if ($isUpdate) { "Manual" } else { "Automatic" })
  DELAYED_AUTO_START = $(if ($isUpdate) { "false" } else { "true" })
}
if ($isUpdate) { Set-FitStoreUpdatePhase -Paths $paths -Phase "services" }
Install-WinSwService -Paths $paths -Name $script:ApiService -TemplateName "FitStoreAPI" -Replacements $serviceValues -StartMode $applicationServiceStartMode
Install-WinSwService -Paths $paths -Name $script:WebService -TemplateName "FitStoreWeb" -Replacements $serviceValues -StartMode $applicationServiceStartMode
Register-FitStoreTasks -Paths $paths

$state = Read-FitStoreJson -Path $paths.State
$state | Add-Member -NotePropertyName version -NotePropertyValue $Version -Force
$state | Add-Member -NotePropertyName updatedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString("o")) -Force
$state | Add-Member -NotePropertyName installationComplete -NotePropertyValue $true -Force
Write-FitStoreJson -Path $paths.State -Value $state -Protect

try {
  New-Item -Path $script:FitStoreRegistry -Force | Out-Null
  New-ItemProperty -Path $script:FitStoreRegistry -Name InstallLocation -Value $paths.Install -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $script:FitStoreRegistry -Name DataLocation -Value $paths.Data -PropertyType String -Force | Out-Null
  New-ItemProperty -Path $script:FitStoreRegistry -Name Version -Value $Version -PropertyType String -Force | Out-Null
} catch {
  Write-FitStoreLog -InstallDir $paths.Install -Level "AVISO" -Message "La aplicación quedó instalada, pero Windows no permitió registrar sus metadatos en PowerShell. El instalador externo lo reintentará."
}

if ($isUpdate) { Set-FitStoreUpdatePhase -Paths $paths -Phase "verifying" }
Start-FitStoreApplication
Wait-FitStoreHttp -Url "http://127.0.0.1:3001/api/health" -TimeoutSeconds 120
Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 120
if ($isUpdate) {
  Set-FitStoreServiceStartMode -Name $script:ApiService -Mode "delayed-auto"
  Set-FitStoreServiceStartMode -Name $script:WebService -Mode "delayed-auto"
  Set-FitStoreUpdatePhase -Paths $paths -Phase "verified"
  Complete-FitStoreUpdate -Paths $paths
  try {
    New-FitStoreShortcuts -Paths $paths
  } catch {
    Write-FitStoreLog -InstallDir $paths.Install -Level "AVISO" -Message ("La actualización quedó verificada, pero no se pudieron renovar todos los accesos directos: " + $_.Exception.Message)
  }
} else {
  New-FitStoreShortcuts -Paths $paths
}
Remove-Item -LiteralPath (Join-Path $paths.Data "DESINSTALADO_LEEME.txt") -Force -ErrorAction SilentlyContinue
Write-FitStoreLog -InstallDir $paths.Install -Message "FitStore POS $Version instalado y verificado correctamente."
