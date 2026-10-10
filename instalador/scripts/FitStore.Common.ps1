Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:FitStoreRegistry = "HKLM:\SOFTWARE\FitStore POS"
$script:PostgresService = "FitStorePostgreSQL"
$script:ApiService = "FitStoreAPI"
$script:WebService = "FitStoreWeb"
$script:BackupTask = "FitStore POS - Respaldo diario"
$script:NetworkTask = "FitStore POS - Actualizar HTTPS"
$script:BackupReaderSid = ""

function Assert-FitStoreAdministrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Esta operación necesita permisos de administrador."
  }
}

function Get-FitStoreInstallDir {
  param([string]$Preferred)
  if ($Preferred) { return [IO.Path]::GetFullPath($Preferred) }
  if (Test-Path $script:FitStoreRegistry) {
    $saved = Get-ItemPropertyValue -Path $script:FitStoreRegistry -Name InstallLocation -ErrorAction SilentlyContinue
    if ($saved) { return [IO.Path]::GetFullPath($saved) }
  }
  return (Join-Path $env:ProgramFiles "FitStore POS")
}

function Get-FitStorePaths {
  param([string]$InstallDir)
  $resolvedInstall = Get-FitStoreInstallDir -Preferred $InstallDir
  $data = Join-Path $env:ProgramData "FitStore POS"
  [pscustomobject]@{
    Install       = $resolvedInstall
    Data          = $data
    State         = Join-Path $data "state.json"
    Secrets       = Join-Path $data "secrets.json"
    Env           = Join-Path $data ".env"
    ServerConfig  = Join-Path $data "server.json"
    Logs          = Join-Path $data "logs"
    Work          = Join-Path $data "work"
    UpdateWork    = Join-Path $data "work\updates"
    Database      = Join-Path $data "PostgreSQL\data"
    Pki           = Join-Path $data "pki"
    LocalBackups  = Join-Path $data "Backups"
    PgBin         = Join-Path $resolvedInstall "runtime\postgresql\bin"
    Node          = Join-Path $resolvedInstall "runtime\node\node.exe"
    WinSW         = Join-Path $resolvedInstall "runtime\WinSW.exe"
    Api           = Join-Path $resolvedInstall "app\api"
    Web           = Join-Path $resolvedInstall "app\web"
    Scripts       = Join-Path $resolvedInstall "scripts"
    Services      = Join-Path $resolvedInstall "service"
  }
}

function New-FitStoreDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -Path $Path -ItemType Directory -Force | Out-Null
  }
}

function Write-FitStoreLog {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$InstallDir,
    [ValidateSet("INFO", "AVISO", "ERROR")][string]$Level = "INFO"
  )
  $paths = Get-FitStorePaths -InstallDir $InstallDir
  New-FitStoreDirectory -Path $paths.Logs
  $line = "{0} [{1}] {2}" -f (Get-Date).ToString("s"), $Level, $Message
  Add-Content -LiteralPath (Join-Path $paths.Logs "instalador.log") -Value $line -Encoding UTF8
  Write-Host $line
}

function New-FitStoreSecret {
  param([ValidateRange(24, 256)][int]$Bytes = 48)
  $buffer = New-Object byte[] $Bytes
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
  return [Convert]::ToBase64String($buffer).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Write-FitStoreJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)]$Value,
    [switch]$Protect
  )
  New-FitStoreDirectory -Path (Split-Path -Parent $Path)
  $temporary = "$Path.tmp"
  $json = $Value | ConvertTo-Json -Depth 10
  [IO.File]::WriteAllText($temporary, $json, [Text.UTF8Encoding]::new($false))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
  if ($Protect) { Protect-FitStoreFile -Path $Path }
}

function Read-FitStoreJson {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { throw "No existe el archivo requerido: $Path" }
  return Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Protect-FitStoreFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  & "$env:SystemRoot\System32\icacls.exe" $Path "/inheritance:r" "/grant:r" "*S-1-5-18:(F)" "*S-1-5-32-544:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudieron proteger los permisos de $Path." }
}

function Grant-FitStoreSystemAccess {
  param([Parameter(Mandatory = $true)][string]$Path)
  New-FitStoreDirectory -Path $Path
  & "$env:SystemRoot\System32\icacls.exe" $Path "/grant" "*S-1-5-18:(OI)(CI)F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo dar acceso al servicio de respaldo en $Path." }
}

function Grant-FitStoreApplicationAccess {
  param([Parameter(Mandatory = $true)]$Paths)
  $identity = [Security.Principal.SecurityIdentifier]::new("S-1-5-19")
  # No grants recursivos sobre Data: base, respaldos, CA y secrets son administrativos.
  foreach ($path in @($Paths.Data, $Paths.Work, (Join-Path $Paths.Work "app"), (Join-Path $Paths.Work "app\api"), $Paths.Pki)) {
    $acl = [IO.Directory]::GetAccessControl($path, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, "ReadAndExecute", "None", "None", "Allow"))
    [IO.Directory]::SetAccessControl($path, $acl)
  }
  foreach ($entry in @(@($Paths.Install, "ReadAndExecute"), @($Paths.Logs, "Modify"))) {
    $acl = [IO.Directory]::GetAccessControl($entry[0], [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, $entry[1], "ContainerInherit, ObjectInherit", "None", "Allow"))
    [IO.Directory]::SetAccessControl($entry[0], $acl)
  }
  foreach ($path in @((Join-Path $Paths.Work ".env"), $Paths.ServerConfig, (Join-Path $Paths.Pki "FitStore-server.pfx"))) {
    $acl = [IO.File]::GetAccessControl($path, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity, "Read", "Allow"))
    [IO.File]::SetAccessControl($path, $acl)
  }
}

function Protect-FitStoreBackupFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  # DACL nueva: /grant:r no elimina permisos explicitos de Everyone/Users.
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @("S-1-5-18", "S-1-5-32-544")) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
      [Security.Principal.SecurityIdentifier]::new($sid), "FullControl", "Allow"
    ))
  }
  if ($script:BackupReaderSid) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($script:BackupReaderSid), "Read", "Allow")) }
  [IO.File]::SetAccessControl($Path, $acl)
}

function New-FitStoreBackupFile {
  param([Parameter(Mandatory = $true)][string]$Path)
  # Crear con DACL privada desde el primer instante, antes de escribir datos.
  if (Test-Path -LiteralPath $Path) { throw "Ya existe el respaldo: $Path" }
  $acl = [Security.AccessControl.FileSecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @("S-1-5-18", "S-1-5-32-544")) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($sid), "FullControl", "Allow"))
  }
  if ($script:BackupReaderSid) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($script:BackupReaderSid), "Read", "Allow")) }
  $stream = [IO.File]::Create($Path, 4096, [IO.FileOptions]::None, $acl)
  $stream.Dispose()
}

function Initialize-FitStoreBackupStorage {
  param([Parameter(Mandatory = $true)]$Paths, [Parameter(Mandatory = $true)]$State)
  $previous = if ($State.PSObject.Properties.Name -contains "backupPath") { [string]$State.backupPath } else { "" }
  $script:BackupReaderSid = ""
  if ($State.PSObject.Properties.Name -contains "backupReaderSid" -and $State.backupReaderSid) {
    $sid = [Security.Principal.SecurityIdentifier]::new([string]$State.backupReaderSid)
    if ($sid.Value -like "S-1-12-1-*") {
      Write-FitStoreLog -InstallDir $Paths.Install -Level "AVISO" -Message "La cuenta Azure AD no tiene lectura automatica de respaldos en esta version. Las copias siguen privadas para SYSTEM y administradores; solicite configurar el acceso de esa cuenta sin usar Users ni Everyone."
    } elseif (-not $sid.IsAccountSid()) { throw "El lector de respaldos debe ser el SID real de una cuenta de Windows." }
    else { $script:BackupReaderSid = $sid.Value }
  } elseif ([Security.Principal.WindowsIdentity]::GetCurrent().User.Value -like "S-1-12-1-*") {
    # Install descarta IsAccountSid() para identidades Azure AD. No callar esa
    # limitacion: la copia local sigue privada, pero OneDrive no podra leerla.
    Write-FitStoreLog -InstallDir $Paths.Install -Level "AVISO" -Message "La cuenta Azure AD del instalador no tiene lectura automatica de respaldos. Solicite configurar el acceso de esa cuenta sin usar Users ni Everyone."
  }
  New-FitStoreDirectory -Path $Paths.LocalBackups
  Protect-FitStoreBackupDirectory -Path $Paths.LocalBackups
  # La carpeta nueva y sus copias siempre deben quedar privadas: sus errores
  # no se ignoran. El destino antiguo puede estar en una USB o red desconectada.
  foreach ($file in Get-ChildItem -LiteralPath $Paths.LocalBackups -Filter "FitStore_*" -File -ErrorAction Stop) {
    Protect-FitStoreBackupFile -Path $file.FullName
  }
  if ($previous -and -not [string]::Equals($previous, $Paths.LocalBackups, [StringComparison]::OrdinalIgnoreCase)) {
    try {
      if (-not (Test-Path -LiteralPath $previous -PathType Container -ErrorAction Stop)) { throw "El destino anterior no esta disponible." }
      foreach ($file in Get-ChildItem -LiteralPath $previous -Filter "FitStore_*" -File -ErrorAction Stop) { Protect-FitStoreBackupFile -Path $file.FullName }
    } catch {
      Write-FitStoreLog -InstallDir $Paths.Install -Level "AVISO" -Message "No se pudieron retirar los permisos publicos de todas las copias del destino anterior. Revise esa USB o ubicacion de red; las nuevas copias se guardan en la carpeta local privada."
    }
  }
  $State | Add-Member -NotePropertyName backupPath -NotePropertyValue $Paths.LocalBackups -Force
  return $Paths.LocalBackups
}

function Protect-FitStoreBackupDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @("S-1-5-18", "S-1-5-32-544")) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
      [Security.Principal.SecurityIdentifier]::new($sid), "FullControl",
      "ContainerInherit, ObjectInherit", "None", "Allow"
    ))
  }
  if ($script:BackupReaderSid) { $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($script:BackupReaderSid), "ReadAndExecute", "ContainerInherit, ObjectInherit", "None", "Allow")) }
  [IO.Directory]::SetAccessControl($Path, $acl)
}

function Invoke-FitStoreProcess {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string[]]$Arguments = @(),
    [string]$FailureMessage = "Falló un proceso requerido."
  )
  if (-not (Test-Path -LiteralPath $FilePath)) { throw "No se encontró el ejecutable requerido: $FilePath" }
  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$FailureMessage Código: $LASTEXITCODE." }
}

function Invoke-FitStorePg {
  param(
    [Parameter(Mandatory = $true)][string]$Tool,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [Parameter(Mandatory = $true)][string]$Password,
    [string]$FailureMessage = "Falló una operación de PostgreSQL."
  )
  $previous = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = $Password
    Invoke-FitStoreProcess -FilePath $Tool -Arguments $Arguments -FailureMessage $FailureMessage
  } finally {
    if ($null -eq $previous) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $previous }
  }
}

function Get-FitStoreDatabaseUrl {
  param([Parameter(Mandatory = $true)]$Secrets, [int]$Port = 5434, [string]$Database = "fitstore")
  $encoded = [Uri]::EscapeDataString([string]$Secrets.databasePassword)
  return "postgresql://fitstore:$encoded@127.0.0.1:$Port/$Database`?options=-c%20TimeZone%3DUTC"
}

function Stop-FitStoreService {
  param([Parameter(Mandatory = $true)][string]$Name, [int]$TimeoutSeconds = 45)
  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if ($null -eq $service -or $service.Status -eq "Stopped") { return }
  Stop-Service -Name $Name -Force -ErrorAction Stop
  $service.WaitForStatus("Stopped", [TimeSpan]::FromSeconds($TimeoutSeconds))
}

function Start-FitStoreService {
  param([Parameter(Mandatory = $true)][string]$Name, [int]$TimeoutSeconds = 60)
  $service = Get-Service -Name $Name -ErrorAction Stop
  if ($service.Status -ne "Running") { Start-Service -Name $Name -ErrorAction Stop }
  $service.WaitForStatus("Running", [TimeSpan]::FromSeconds($TimeoutSeconds))
}

function Set-FitStoreServiceStartMode {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][ValidateSet("delayed-auto", "demand", "disabled")][string]$Mode
  )
  if (-not (Get-Service -Name $Name -ErrorAction SilentlyContinue)) { return }
  & "$env:SystemRoot\System32\sc.exe" config $Name start= $Mode | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo configurar el inicio $Mode del servicio $Name." }
}

function Stop-FitStoreApplication {
  Stop-FitStoreService -Name $script:WebService
  Stop-FitStoreService -Name $script:ApiService
}

function Start-FitStoreApplication {
  Start-FitStoreService -Name $script:PostgresService -TimeoutSeconds 90
  Start-FitStoreService -Name $script:ApiService -TimeoutSeconds 90
  Start-FitStoreService -Name $script:WebService -TimeoutSeconds 90
}

function Get-FitStoreUpdateMarker {
  param([Parameter(Mandatory = $true)]$Paths)
  return (Join-Path $Paths.Data "actualizacion-preparada.json")
}

function Assert-FitStoreSafeUpdatePath {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [Parameter(Mandatory = $true)][string]$Path
  )
  $root = [IO.Path]::GetFullPath($Paths.UpdateWork).TrimEnd("\")
  $resolved = [IO.Path]::GetFullPath($Path).TrimEnd("\")
  if (-not $resolved.StartsWith($root + "\", [StringComparison]::OrdinalIgnoreCase) -or $resolved.Length -le $root.Length + 1) {
    throw "La ruta de transacción de actualización no pasó la comprobación de seguridad: $resolved"
  }
  return $resolved
}

function Get-FitStoreUpdateRecoveryAction {
  param(
    [Parameter(Mandatory = $true)][string]$InstallPath,
    [Parameter(Mandatory = $true)][string]$SnapshotPath,
    [Parameter(Mandatory = $true)][string]$Phase
  )
  $hasInstall = Test-Path -LiteralPath $InstallPath -PathType Container
  $hasSnapshot = Test-Path -LiteralPath $SnapshotPath -PathType Container
  # Una versión sólo llega a verified después de responder en API y HTTPS.
  # Priorizarla evita restaurar la base previa y perder ventas si Windows se
  # corta entre esa verificación y la limpieza de la copia anterior.
  if ($hasInstall -and $Phase -eq "verified") { throw "La actualizacion ya fue verificada; no se permite restaurar una base anterior. Conserve la version activa y solicite limpiar el marcador sin rollback." }
  if ($hasSnapshot) { return "restore-snapshot" }
  if ($hasInstall -and $Phase -eq "prepared-copy-pending") { return "restart-previous" }
  if ($hasInstall -and $Phase -eq "rollback-files-moving") { return "resume-rollback" }
  if ($hasInstall -and $Phase -eq "rollback-files-restored") { return "resume-rollback" }
  if ($hasInstall) { throw "Falta la copia anterior para recuperar una actualización detenida en la fase $Phase." }
  throw "No existen ni la instalación activa ni la copia anterior de la actualización."
}

function Set-FitStoreUpdatePhase {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [Parameter(Mandatory = $true)][string]$Phase
  )
  $marker = Get-FitStoreUpdateMarker -Paths $Paths
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { return }
  $transaction = Read-FitStoreJson -Path $marker
  $transaction | Add-Member -NotePropertyName phase -NotePropertyValue $Phase -Force
  $transaction | Add-Member -NotePropertyName phaseChangedAt -NotePropertyValue ((Get-Date).ToUniversalTime().ToString("o")) -Force
  Write-FitStoreJson -Path $marker -Value $transaction -Protect
}

function Complete-FitStoreUpdate {
  param([Parameter(Mandatory = $true)]$Paths)
  $marker = Get-FitStoreUpdateMarker -Paths $Paths
  if (-not (Test-Path -LiteralPath $marker -PathType Leaf)) { return }
  try {
    $transaction = Read-FitStoreJson -Path $marker
    # Quitar primero el marcador evita que un corte durante la limpieza haga
    # que una actualización ya verificada se interprete como fallida.
    Remove-Item -LiteralPath $marker -Force
    if ($transaction.PSObject.Properties.Name -contains "transactionPath") {
      $transactionPath = Assert-FitStoreSafeUpdatePath -Paths $Paths -Path ([string]$transaction.transactionPath)
      if (Test-Path -LiteralPath $transactionPath) {
        Remove-Item -LiteralPath $transactionPath -Recurse -Force
      }
    }
  } catch {
    Write-FitStoreLog -InstallDir $Paths.Install -Level "AVISO" -Message ("La actualización quedó verificada, pero no se pudo retirar su copia temporal: " + $_.Exception.Message)
  }
}

function Wait-FitStorePostgres {
  param([Parameter(Mandatory = $true)]$Paths, [int]$TimeoutSeconds = 90)
  $ready = Join-Path $Paths.PgBin "pg_isready.exe"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    & $ready "-h" "127.0.0.1" "-p" "5434" "-q"
    if ($LASTEXITCODE -eq 0) { return }
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "PostgreSQL no respondió dentro de $TimeoutSeconds segundos."
}

function Wait-FitStoreHttp {
  param([Parameter(Mandatory = $true)][string]$Url, [int]$TimeoutSeconds = 90)
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) { return }
    } catch {}
    Start-Sleep -Seconds 2
  } while ((Get-Date) -lt $deadline)
  throw "FitStore no respondió en $Url dentro de $TimeoutSeconds segundos."
}

function Invoke-FitStoreMigrations {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [Parameter(Mandatory = $true)]$Secrets,
    [ValidatePattern("^[a-zA-Z0-9_]+$")][string]$Database = "fitstore"
  )
  $prisma = Join-Path $Paths.Api "node_modules\.bin\prisma.cmd"
  $previousUrl = $env:DATABASE_URL
  $previousNodeEnv = $env:NODE_ENV
  try {
    $env:DATABASE_URL = Get-FitStoreDatabaseUrl -Secrets $Secrets -Database $Database
    $env:NODE_ENV = "production"
    Push-Location $Paths.Api
    try {
      Invoke-FitStoreProcess -FilePath $prisma -Arguments @("migrate", "deploy", "--schema", "prisma\schema.prisma") -FailureMessage "No se pudieron aplicar las migraciones"
    } finally { Pop-Location }
  } finally {
    if ($null -eq $previousUrl) { Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_URL = $previousUrl }
    if ($null -eq $previousNodeEnv) { Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue } else { $env:NODE_ENV = $previousNodeEnv }
  }
}

function ConvertTo-FitStoreXmlText {
  param([Parameter(Mandatory = $true)][string]$Value)
  return [Security.SecurityElement]::Escape($Value)
}

function Remove-FitStoreServiceRegistration {
  param([Parameter(Mandatory = $true)][string]$Name, [string]$WinSW, [string]$Config)
  Stop-FitStoreService -Name $Name
  $wrapper = if ($Config) { [IO.Path]::ChangeExtension($Config, ".exe") } else { $WinSW }
  if ($wrapper -and (Test-Path -LiteralPath $wrapper) -and $Config -and (Test-Path -LiteralPath $Config)) {
    & $wrapper "uninstall" | Out-Null
  }
  if (Get-Service -Name $Name -ErrorAction SilentlyContinue) {
    & "$env:SystemRoot\System32\sc.exe" delete $Name | Out-Null
    $deadline = (Get-Date).AddSeconds(20)
    while ((Get-Service -Name $Name -ErrorAction SilentlyContinue) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
    if (Get-Service -Name $Name -ErrorAction SilentlyContinue) { throw "El servicio $Name quedó pendiente de eliminación. Cierra services.msc y vuelve a intentar." }
  }
}
