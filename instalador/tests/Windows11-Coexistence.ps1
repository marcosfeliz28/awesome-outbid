param(
  [string]$StoreInstaller,
  [string]$LocalInstaller,
  [string]$StoreSha256,
  [string]$LocalSha256,
  [string]$EvidenceDir,
  [switch]$BuildFromSource,
  [switch]$ConfirmDisposableVm
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\.."))
$storeInstall = Join-Path $env:ProgramFiles "FitStore POS"
$localInstall = Join-Path $env:ProgramFiles "Nexora POS Local"
$storeData = Join-Path $env:ProgramData "FitStore POS"
$localData = Join-Path $env:ProgramData "Nexora POS Local"
$storeRegistry = "HKLM:\SOFTWARE\FitStore POS"
$localRegistry = "HKLM:\SOFTWARE\Nexora POS Local"
$storeUninstallRegistry = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\FitStorePOS"
$localUninstallRegistry = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\NexoraPOSLocal"
$storeServices = @("FitStorePostgreSQL", "FitStoreAPI", "FitStoreWeb")
$localServices = @("NexoraLocalPostgreSQL", "NexoraLocalAPI", "NexoraLocalWeb")
$storePorts = @(5434, 3001, 4173)
$localPorts = @(5544, 4301, 4473)
$checks = [Collections.Generic.List[object]]::new()
$answerFiles = [Collections.Generic.List[string]]::new()
$installedStore = $false
$installedLocal = $false
$phase = "preflight"
$result = "fallo"

function Add-Check {
  param([string]$Name, [bool]$Ok, [string]$Detail)
  $checks.Add([ordered]@{ name = $Name; ok = $Ok; detail = $Detail })
  if (-not $Ok) { throw "$Name`: $Detail" }
}

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  Add-Check "Ejecución elevada" ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) "La prueba requiere una consola como administrador."
}

function Get-CurrentBuild {
  return [int](Get-ItemPropertyValue -LiteralPath "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion" -Name CurrentBuildNumber)
}

function Assert-DisposableWindows11Vm {
  if (-not $ConfirmDisposableVm) {
    throw "PC-22 solo se ejecuta con -ConfirmDisposableVm en una VM desechable; instala y desinstala servicios reales."
  }
  $build = Get-CurrentBuild
  Add-Check "Windows 11" ($build -ge 22000) "Build detectado: $build (se requiere 22000 o posterior)."
  $computer = Get-CimInstance Win32_ComputerSystem
  $identity = "$($computer.Manufacturer) $($computer.Model)"
  $knownVm = $identity -match "(?i)virtual|vmware|virtualbox|hyper-v|kvm|qemu|amazon ec2|google compute"
  Add-Check "VM reconocida" $knownVm "Fabricante/modelo: $identity. No se permite ejecutar esta prueba destructiva en la PC de la tienda."
  return [ordered]@{ build = $build; manufacturer = [string]$computer.Manufacturer; model = [string]$computer.Model }
}

function Assert-CleanStart {
  foreach ($path in @($storeInstall, $localInstall, $storeData, $localData, $storeRegistry, $localRegistry, $storeUninstallRegistry, $localUninstallRegistry)) {
    Add-Check "Inicio limpio: $path" (-not (Test-Path -LiteralPath $path)) "La VM ya contiene esta ruta o registro. Reviértela a un snapshot limpio."
  }
  foreach ($service in @($storeServices + $localServices)) {
    Add-Check "Inicio limpio: servicio $service" ($null -eq (Get-Service -Name $service -ErrorAction SilentlyContinue)) "El servicio ya existe."
  }
  foreach ($port in @($storePorts + $localPorts)) {
    $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
    Add-Check "Inicio limpio: puerto $port" ($null -eq $listener) "El puerto ya está ocupado."
  }
}

function New-TestPassword {
  $bytes = New-Object byte[] 24
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return "Pc22!" + ([Convert]::ToBase64String($bytes).Replace("+", "A").Replace("/", "B").TrimEnd("="))
}

function New-AnswerFile {
  param([string]$Label, [string]$Email)
  $password = New-TestPassword
  $pinBytes = New-Object byte[] 4
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($pinBytes) } finally { $rng.Dispose() }
  $pinNumber = [BitConverter]::ToUInt32($pinBytes, 0) % 1000000
  $pin = $pinNumber.ToString("000000")
  $path = Join-Path $env:TEMP ("pc22-{0}-{1}.ini" -f $Label, [Guid]::NewGuid().ToString("N"))
  $content = @(
    "[Setup]",
    "OwnerName=Prueba PC22 $Label",
    "OwnerEmail=$Email",
    "OwnerPassword=$password",
    "OwnerPasswordConfirm=$password",
    "OwnerPin=$pin",
    "BackupPath="
  )
  [IO.File]::WriteAllLines($path, $content, [Text.UTF8Encoding]::new($false))
  & "$env:SystemRoot\System32\icacls.exe" $path "/inheritance:r" "/grant:r" "*S-1-5-18:(F)" "*S-1-5-32-544:(F)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "No se pudo proteger el archivo efímero de respuesta." }
  $answerFiles.Add($path)
  return $path
}

function Invoke-Exe {
  param([string]$Path, [string]$Arguments, [string]$Description)
  $process = Start-Process -FilePath $Path -ArgumentList $Arguments -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "$Description falló con código $($process.ExitCode)." }
}

function Resolve-Installer {
  param([string]$Path, [string]$ExpectedHash, [string]$Label)
  if (-not $Path) { throw "Falta la ruta del instalador $Label." }
  $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
  $actual = (Get-FileHash -LiteralPath $resolved -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($ExpectedHash -and $actual -ne $ExpectedHash.Trim().ToLowerInvariant()) {
    throw "El SHA-256 del instalador $Label no coincide. Esperado $ExpectedHash; recibido $actual."
  }
  Add-Check "SHA-256 $Label" $true $actual
  return [ordered]@{ path = $resolved; sha256 = $actual }
}

function Build-Installers {
  $version = (Get-Content -LiteralPath (Join-Path $repoRoot "instalador\VERSION") -Raw).Trim()
  $pnpm = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
  if (-not $pnpm) { $pnpm = Get-Command pnpm -ErrorAction Stop }
  Push-Location $repoRoot
  try {
    & $pnpm.Source "instalador:compilar" | ForEach-Object { Write-Host $_ }
    if ($LASTEXITCODE -ne 0) { throw "No se pudo construir el instalador de la Tienda." }
    $store = Join-Path $repoRoot "instalador\dist\Nexora-POS-Setup-$version.exe"
    $publicKey = (& node -e "const{generateKeyPairSync}=require('node:crypto');const k=generateKeyPairSync('ed25519').publicKey;process.stdout.write(k.export({type:'spki',format:'pem'}))") -join "`n"
    if ($LASTEXITCODE -ne 0 -or $publicKey -notmatch "BEGIN PUBLIC KEY") { throw "No se pudo generar la clave pública efímera de prueba." }
    $oldPublicKey = $env:NEXORA_LICENSE_PUBLIC_KEY
    try {
      $env:NEXORA_LICENSE_PUBLIC_KEY = $publicKey
      & $pnpm.Source "instalador:producto-local" | ForEach-Object { Write-Host $_ }
      if ($LASTEXITCODE -ne 0) { throw "No se pudo construir el instalador Local." }
    } finally {
      if ($null -eq $oldPublicKey) { Remove-Item Env:NEXORA_LICENSE_PUBLIC_KEY -ErrorAction SilentlyContinue } else { $env:NEXORA_LICENSE_PUBLIC_KEY = $oldPublicKey }
    }
    $local = Join-Path $repoRoot "instalador\dist\Nexora-POS-Local-Setup-$version.exe"
    return [ordered]@{ store = $store; local = $local }
  } finally { Pop-Location }
}

function Wait-ServiceState {
  param([string]$Name, [ValidateSet("Running", "Absent")][string]$State, [int]$TimeoutSeconds = 90)
  $limit = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
    if (($State -eq "Absent" -and $null -eq $service) -or ($State -eq "Running" -and $service.Status -eq "Running")) { return }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $limit)
  throw "El servicio $Name no llegó al estado $State."
}

function Assert-Services {
  param([string[]]$Names, [string]$ExpectedRoot)
  foreach ($name in $Names) {
    Wait-ServiceState -Name $name -State Running
    $escaped = $name.Replace("'", "''")
    $service = Get-CimInstance Win32_Service -Filter "Name='$escaped'"
    $path = [string]$service.PathName
    Add-Check "Servicio $name activo" ($service.State -eq "Running" -and $service.StartMode -eq "Auto") "Estado=$($service.State), inicio=$($service.StartMode)."
    Add-Check "Servicio $name aislado" ($path.IndexOf($ExpectedRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0) "Binario: $path"
  }
}

function Assert-Ports {
  param([int[]]$Ports, [string]$Label)
  foreach ($port in $Ports) {
    $listener = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
    Add-Check "$Label escucha $port" ($listener.Count -gt 0) "Listeners: $($listener.Count)."
  }
}

function Invoke-InstalledVerification {
  param([string]$InstallRoot, [string]$Label)
  $script = Join-Path $InstallRoot "scripts\Verify-FitStore.ps1"
  $output = @(& "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $script -InstallDir $InstallRoot 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "La verificación instalada de $Label falló: $($output -join ' ')" }
  $json = $output -join "`n" | ConvertFrom-Json
  Add-Check "Verificación operativa $Label" ([bool]$json.ok) "El verificador instalado devolvió ok=true."
}

function Invoke-DatabaseScalar {
  param([string]$InstallRoot, [string]$DataRoot, [int]$Port, [string]$Database, [string]$User, [string]$Sql)
  $secrets = Get-Content -LiteralPath (Join-Path $DataRoot "secrets.json") -Raw -Encoding UTF8 | ConvertFrom-Json
  $oldPassword = $env:PGPASSWORD
  try {
    $env:PGPASSWORD = [string]$secrets.databasePassword
    $psql = Join-Path $InstallRoot "runtime\postgresql\bin\psql.exe"
    $value = @(& $psql "--host=127.0.0.1" "--port=$Port" "--username=$User" "--dbname=$Database" "--no-password" "--tuples-only" "--no-align" "--set=ON_ERROR_STOP=1" "--command=$Sql" 2>&1)
    if ($LASTEXITCODE -ne 0) { throw "La consulta aislada a $Database falló: $($value -join ' ')" }
    return (($value -join "`n").Trim())
  } finally {
    if ($null -eq $oldPassword) { Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue } else { $env:PGPASSWORD = $oldPassword }
  }
}

function Assert-DatabaseIdentity {
  param([string]$InstallRoot, [string]$DataRoot, [int]$Port, [string]$Database, [string]$User, [string]$OwnEmail, [string]$OtherEmail, [string]$Label)
  $identity = Invoke-DatabaseScalar -InstallRoot $InstallRoot -DataRoot $DataRoot -Port $Port -Database $Database -User $User -Sql "SELECT current_database() || '|' || current_user || '|' || inet_server_port();"
  Add-Check "Identidad PostgreSQL $Label" ($identity -eq "$Database|$User|$Port") $identity
  $own = Invoke-DatabaseScalar -InstallRoot $InstallRoot -DataRoot $DataRoot -Port $Port -Database $Database -User $User -Sql "SELECT count(*) FROM `"User`" WHERE email='$OwnEmail';"
  $other = Invoke-DatabaseScalar -InstallRoot $InstallRoot -DataRoot $DataRoot -Port $Port -Database $Database -User $User -Sql "SELECT count(*) FROM `"User`" WHERE email='$OtherEmail';"
  Add-Check "Dueña propia en $Label" ($own -eq "1") "Coincidencias: $own."
  Add-Check "Sin dueña ajena en $Label" ($other -eq "0") "Coincidencias: $other."
}

function Assert-Registrations {
  Add-Check "Registro Tienda" ((Get-ItemPropertyValue -LiteralPath $storeRegistry -Name InstallLocation) -eq $storeInstall) "Ruta propia registrada."
  Add-Check "Registro Local" ((Get-ItemPropertyValue -LiteralPath $localRegistry -Name InstallLocation) -eq $localInstall) "Ruta propia registrada."
  Add-Check "Desinstalador Tienda registrado" (Test-Path -LiteralPath $storeUninstallRegistry) "Clave propia presente."
  Add-Check "Desinstalador Local registrado" (Test-Path -LiteralPath $localUninstallRegistry) "Clave propia presente."
}

function Assert-LocalRemovedConservatively {
  foreach ($service in $localServices) {
    Wait-ServiceState -Name $service -State Absent
    Add-Check "Desinstalación Local retira $service" $true "Servicio ausente."
  }
  Add-Check "Desinstalación Local retira programa" (-not (Test-Path -LiteralPath $localInstall)) $localInstall
  Add-Check "Desinstalación Local conserva datos" (Test-Path -LiteralPath $localData -PathType Container) $localData
  foreach ($relative in @("state.json", "secrets.json", "PostgreSQL\data\PG_VERSION", "Backups")) {
    Add-Check "Dato Local conservado: $relative" (Test-Path -LiteralPath (Join-Path $localData $relative)) (Join-Path $localData $relative)
  }
  Add-Check "Registro Local retirado" (-not (Test-Path -LiteralPath $localRegistry)) "La clave del producto se eliminó."
  Add-Check "Tienda no desregistrada" (Test-Path -LiteralPath $storeRegistry) "La clave de la Tienda permanece."
}

if (-not $EvidenceDir) {
  $EvidenceDir = Join-Path $env:PUBLIC ("Documents\Nexora PC22 Evidence\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
}
$EvidenceDir = [IO.Path]::GetFullPath($EvidenceDir)
New-Item -Path $EvidenceDir -ItemType Directory -Force | Out-Null
$transcript = Join-Path $EvidenceDir "pc22-windows11.log"
Start-Transcript -LiteralPath $transcript -Force | Out-Null
$machine = $null
$storeArtifact = $null
$localArtifact = $null

try {
  Assert-Administrator
  $machine = Assert-DisposableWindows11Vm
  Assert-CleanStart

  if ($BuildFromSource) {
    $built = Build-Installers
    $StoreInstaller = $built.store
    $LocalInstaller = $built.local
  }
  $storeArtifact = Resolve-Installer -Path $StoreInstaller -ExpectedHash $StoreSha256 -Label "Tienda"
  $localArtifact = Resolve-Installer -Path $LocalInstaller -ExpectedHash $LocalSha256 -Label "Nexora Local"

  $runId = [Guid]::NewGuid().ToString("N")
  $storeEmail = "pc22-tienda-$runId@example.invalid"
  $localEmail = "pc22-local-$runId@example.invalid"
  $storeAnswer = New-AnswerFile -Label "tienda" -Email $storeEmail
  $localAnswer = New-AnswerFile -Label "local" -Email $localEmail

  $phase = "instalar-tienda"
  Invoke-Exe -Path $storeArtifact.path -Arguments "/S /ANSWER=`"$storeAnswer`"" -Description "La instalación de la Tienda"
  $installedStore = $true
  Assert-Services -Names $storeServices -ExpectedRoot $storeInstall
  Assert-Ports -Ports $storePorts -Label "Tienda"
  Invoke-InstalledVerification -InstallRoot $storeInstall -Label "Tienda"
  Assert-DatabaseIdentity -InstallRoot $storeInstall -DataRoot $storeData -Port 5434 -Database "fitstore" -User "fitstore" -OwnEmail $storeEmail -OtherEmail $localEmail -Label "Tienda"
  $storeSecretsHash = (Get-FileHash -LiteralPath (Join-Path $storeData "secrets.json") -Algorithm SHA256).Hash

  $phase = "instalar-local"
  Invoke-Exe -Path $localArtifact.path -Arguments "/S /ANSWER=`"$localAnswer`"" -Description "La instalación de Nexora Local"
  $installedLocal = $true
  Assert-Registrations
  Assert-Services -Names $storeServices -ExpectedRoot $storeInstall
  Assert-Services -Names $localServices -ExpectedRoot $localInstall
  Assert-Ports -Ports $storePorts -Label "Tienda tras instalar Local"
  Assert-Ports -Ports $localPorts -Label "Local"
  Invoke-InstalledVerification -InstallRoot $storeInstall -Label "Tienda tras instalar Local"
  Invoke-InstalledVerification -InstallRoot $localInstall -Label "Local"
  Assert-DatabaseIdentity -InstallRoot $storeInstall -DataRoot $storeData -Port 5434 -Database "fitstore" -User "fitstore" -OwnEmail $storeEmail -OtherEmail $localEmail -Label "Tienda tras instalar Local"
  Assert-DatabaseIdentity -InstallRoot $localInstall -DataRoot $localData -Port 5544 -Database "nexoralocal" -User "nexoralocal" -OwnEmail $localEmail -OtherEmail $storeEmail -Label "Local"
  $localSecretsHash = (Get-FileHash -LiteralPath (Join-Path $localData "secrets.json") -Algorithm SHA256).Hash
  Add-Check "Secretos Tienda sin sobrescritura" ((Get-FileHash -LiteralPath (Join-Path $storeData "secrets.json") -Algorithm SHA256).Hash -eq $storeSecretsHash) "Hash estable antes/después de Local."

  $phase = "desinstalar-local"
  Invoke-Exe -Path (Join-Path $localInstall "Uninstall.exe") -Arguments "/S" -Description "La desinstalación conservadora de Nexora Local"
  $installedLocal = $false
  Assert-LocalRemovedConservatively
  Add-Check "Datos Local sin sobrescritura al desinstalar" ((Get-FileHash -LiteralPath (Join-Path $localData "secrets.json") -Algorithm SHA256).Hash -eq $localSecretsHash) "Hash estable tras desinstalar."
  Assert-Services -Names $storeServices -ExpectedRoot $storeInstall
  Assert-Ports -Ports $storePorts -Label "Tienda tras desinstalar Local"
  Invoke-InstalledVerification -InstallRoot $storeInstall -Label "Tienda tras desinstalar Local"
  Assert-DatabaseIdentity -InstallRoot $storeInstall -DataRoot $storeData -Port 5434 -Database "fitstore" -User "fitstore" -OwnEmail $storeEmail -OtherEmail $localEmail -Label "Tienda final"
  Add-Check "Secretos Tienda sin cambios finales" ((Get-FileHash -LiteralPath (Join-Path $storeData "secrets.json") -Algorithm SHA256).Hash -eq $storeSecretsHash) "Hash estable al final."

  $phase = "completado"
  $result = "correcto"
  Write-Host "PC-22 CORRECTO: Tienda y Nexora Local coexistieron; retirar Local conservó sus datos y no afectó la Tienda."
} catch {
  Write-Error ("PC-22 falló en fase '{0}': {1}" -f $phase, $_.Exception.Message) -ErrorAction Continue
  throw
} finally {
  foreach ($answer in $answerFiles) { Remove-Item -LiteralPath $answer -Force -ErrorAction SilentlyContinue }
  $report = [ordered]@{
    schemaVersion = 1
    checkedAt = (Get-Date).ToUniversalTime().ToString("o")
    result = $result
    phase = $phase
    windows = $machine
    storeInstaller = $storeArtifact
    localInstaller = $localArtifact
    storeWasInstalled = $installedStore
    localRemainsInstalled = $installedLocal
    evidenceDirectory = $EvidenceDir
    checks = $checks
  }
  $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $EvidenceDir "resultado.json") -Encoding UTF8
  Stop-Transcript | Out-Null
}
