param(
  [switch]$SoloPreparar,
  [switch]$SinInstalarNSIS
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.IO.Compression.FileSystem
$securityModule = Join-Path $PSHOME "Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1"
Import-Module -Name $securityModule -ErrorAction Stop

$installerRoot = $PSScriptRoot
$repoRoot = Split-Path -Parent $installerRoot
$buildRoot = Join-Path $installerRoot "build"
$payload = Join-Path $buildRoot "payload"
$downloads = Join-Path $env:LOCALAPPDATA "FitStore POS\InstallerCache"
$dist = Join-Path $installerRoot "dist"
$lock = Get-Content -LiteralPath (Join-Path $installerRoot "dependencias.lock.json") -Raw -Encoding UTF8 | ConvertFrom-Json
$version = (Get-Content -LiteralPath (Join-Path $installerRoot "VERSION") -Raw).Trim()

function Invoke-Checked {
  param([string]$File, [string[]]$Arguments, [string]$Message)
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Message Código: $LASTEXITCODE." }
}

function Get-Sha256 {
  param([Parameter(Mandatory = $true)][string]$Path)
  $stream = [IO.File]::OpenRead($Path)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
    $stream.Dispose()
  }
}

function Deploy-LockedApi {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string]$VerifiedLockHash)
  $sourceLock = Join-Path $RepositoryRoot 'pnpm-lock.yaml'
  if ((Get-Sha256 -Path $sourceLock) -ne $VerifiedLockHash) { throw 'El lock fuente cambio despues de verificarse.' }
  Push-Location $RepositoryRoot
  try {
    # store-dir del workspace es relativo. El install del destino vuelve a
    # interpretarlo alli: fijar la cache que YA lleno el install frozen.
    $versionedStore = ((& pnpm store path --silent) | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or (Split-Path -Leaf $versionedStore) -notmatch '^v\d+$') { throw 'No se pudo identificar la cache verificada de pnpm.' }
    $storeRoot = Split-Path -Parent $versionedStore
    # La instalacion frozen anterior YA verifico las politicas del lock fuente.
    # Solo el lock derivado usa trust-lockfile: offline evita resolver versiones
    # nuevas; la auditoria posterior exige las integridades del original.
    Invoke-Checked -File 'pnpm' -Arguments @('--filter', '@fitstore/api', 'deploy', $Destination,
      '--config.inject-workspace-packages=true', '--config.force-legacy-deploy=false',
      '--config.node-linker=hoisted', "--config.store-dir=$storeRoot", '--offline', '--trust-lockfile') -Message 'Fallo el despliegue bloqueado de la API'
    Invoke-Checked -File 'node' -Arguments @((Join-Path $RepositoryRoot 'instalador\tools\verify-deploy-lock.mjs'),
      $sourceLock, $Destination, $VerifiedLockHash) -Message 'El lock desplegado no equivale al lock verificado'
  } finally {
    Pop-Location
    if ((Get-Sha256 -Path $sourceLock) -ne $VerifiedLockHash) { throw 'El despliegue modifico el lock fuente.' }
  }
}

function Get-VerifiedDownload {
  param([string]$Url, [string]$Sha256, [string]$Destination)
  if (Test-Path -LiteralPath $Destination) {
    $current = Get-Sha256 -Path $Destination
    if ($current -eq $Sha256.ToLowerInvariant()) { return }
    Write-Host "Reanudando descarga parcial de $Url"
  } else {
    Write-Host "Descargando $Url"
  }
  Invoke-Checked `
    -File "curl.exe" `
    -Arguments @(
      "--fail",
      "--location",
      "--retry", "20",
      "--retry-delay", "5",
      "--retry-all-errors",
      "--connect-timeout", "30",
      "--speed-limit", "1024",
      "--speed-time", "45",
      "--continue-at", "-",
      "--output", $Destination,
      $Url
    ) `
    -Message "No se pudo descargar $Url"
  $actual = Get-Sha256 -Path $Destination
  if ($actual -ne $Sha256.ToLowerInvariant()) {
    Remove-Item -LiteralPath $Destination -Force
    throw "El SHA-256 de $Url no coincide. Se eliminó la descarga."
  }
}

function Expand-ZipPrefixes {
  param(
    [Parameter(Mandatory = $true)][string]$Archive,
    [Parameter(Mandatory = $true)][string]$Destination,
    [Parameter(Mandatory = $true)][string[]]$Prefixes
  )
  New-Item -Path $Destination -ItemType Directory -Force | Out-Null
  $destinationRoot = [IO.Path]::GetFullPath($Destination).TrimEnd("\", "/")
  $normalizedPrefixes = @($Prefixes | ForEach-Object { $_.Replace("\", "/").TrimEnd("/") + "/" })
  $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName.Replace("\", "/")
      if (-not ($normalizedPrefixes | Where-Object { $name.StartsWith($_, [StringComparison]::Ordinal) } | Select-Object -First 1)) { continue }
      $relative = $name.Replace("/", [IO.Path]::DirectorySeparatorChar)
      $target = [IO.Path]::GetFullPath((Join-Path $destinationRoot $relative))
      if (-not $target.StartsWith($destinationRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "La descarga contiene una ruta insegura: $name"
      }
      if (-not $entry.Name) {
        New-Item -Path $target -ItemType Directory -Force | Out-Null
        continue
      }
      New-Item -Path (Split-Path -Parent $target) -ItemType Directory -Force | Out-Null
      [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
    }
  } finally {
    $zip.Dispose()
  }
}

function Remove-DeploymentLink {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) { return }
  $item = Get-Item -LiteralPath $Path -Force
  if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    Remove-Item -LiteralPath $Path -Force -ErrorAction Stop
  } else {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
}

function Protect-ApiPayload {
  param([Parameter(Mandatory = $true)][string]$Path)
  $root = [IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
  $rootItem = Get-Item -LiteralPath $root -Force -ErrorAction Stop
  if (-not $rootItem.PSIsContainer -or ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw 'El payload API debe ser una carpeta normal, no un enlace.'
  }
  $entries = @(Get-ChildItem -LiteralPath $root -Recurse -Force -ErrorAction Stop)
  foreach ($entry in $entries) {
    if (($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw 'El payload API contiene enlaces; no se puede filtrar con seguridad.'
    }
  }
  $removed = 0
  foreach ($entry in $entries) {
    if ($entry.PSIsContainer) { continue }
    $full = [IO.Path]::GetFullPath($entry.FullName)
    if (-not $full.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Un archivo del payload API queda fuera de su carpeta.'
    }
    $relative = $full.Substring($root.Length + 1).Replace('\', '/')
    # pnpm deploy no hereda aqui el .gitignore de la raiz. Solo se conservan
    # runtime compilado/dependencias, contrato Prisma y bootstrap del propietario.
    $allowed = $relative -match '^(package\.json|tsconfig\.json|prisma\.config\.ts|scripts/create-admin\.ts|dist/.+\.(js|json)|node_modules/.+|prisma/schema\.prisma|prisma/migrations/migration_lock\.toml|prisma/migrations/[^/]+/migration\.sql)$'
    $private = $relative -match '(^|/)(\.env($|\.)|\.npmrc$|secrets\.json$|credentials\.json$|id_(rsa|ed25519)($|\.))|\.(csv|xlsx?|ods|pfx|p12|pem|key|dump|backup|sqlite3?|db|log)$'
    if (-not $allowed -or $private) {
      Remove-Item -LiteralPath $full -Force -ErrorAction Stop
      $removed++
    }
  }
  Write-Host "Payload API filtrado: $removed archivos ajenos al runtime eliminados."
}

function Write-ApiRuntimeTsConfig {
  param([Parameter(Mandatory = $true)][string]$RepositoryRoot,
    [Parameter(Mandatory = $true)][string]$ApiPayload)
  $base = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'tsconfig.base.json') -Raw | ConvertFrom-Json
  $api = Get-Content -LiteralPath (Join-Path $RepositoryRoot 'apps\api\tsconfig.json') -Raw | ConvertFrom-Json
  if ($base.PSObject.Properties.Name -contains 'extends') { throw 'El tsconfig base requiere resolver otra herencia antes de empaquetar.' }
  $options = [ordered]@{}
  foreach ($source in @($base.compilerOptions, $api.compilerOptions)) {
    foreach ($property in $source.PSObject.Properties) { $options[$property.Name] = $property.Value }
  }
  $api.PSObject.Properties.Remove('extends')
  $api.compilerOptions = [pscustomobject]$options
  [IO.File]::WriteAllText((Join-Path $ApiPayload 'tsconfig.json'), ($api | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
}

if ($PSVersionTable.PSVersion.Major -ge 6 -and -not $IsWindows) { throw "El instalador se prepara en Windows 11 x64 para obtener binarios nativos correctos." }
if (-not [Environment]::Is64BitOperatingSystem) { throw "Se requiere Windows de 64 bits." }
if ($version -notmatch "^(\d+)\.(\d+)\.(\d+)([.-][A-Za-z0-9.-]+)?$") { throw "VERSION no tiene un formato válido." }
$productVersion = "$($Matches[1]).$($Matches[2]).$($Matches[3]).0"
$postgresVersion = [string]$lock.postgresql.version
if ($postgresVersion -notmatch "^(\d+)\.") { throw "La versión bloqueada de PostgreSQL no tiene un formato válido." }
$postgresMajor = $Matches[1]

$nodeMajor = [int]((& node -p "process.versions.node.split('.')[0]").Trim())
if ($LASTEXITCODE -ne 0 -or $nodeMajor -lt 24) { throw "Para construir se requiere Node 24 o posterior." }
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { throw "No se encontró pnpm. Ejecuta: corepack enable" }

$verifiedLockHash = Get-Sha256 -Path (Join-Path $repoRoot 'pnpm-lock.yaml')
Push-Location $repoRoot
try {
  Invoke-Checked -File "pnpm" -Arguments @("install", "--frozen-lockfile") -Message "Falló pnpm install"
  if ((Get-Sha256 -Path (Join-Path $repoRoot 'pnpm-lock.yaml')) -ne $verifiedLockHash) { throw 'La instalacion frozen modifico el lock fuente.' }
  Invoke-Checked -File "pnpm" -Arguments @("db:generate") -Message "Falló prisma generate"
  Invoke-Checked -File "pnpm" -Arguments @("build") -Message "Falló la compilación de FitStore"
} finally { Pop-Location }

if (Test-Path -LiteralPath $buildRoot) { Remove-Item -LiteralPath $buildRoot -Recurse -Force }
New-Item -Path $payload, $downloads, $dist -ItemType Directory -Force | Out-Null
New-Item -Path (Join-Path $payload "app"), (Join-Path $payload "runtime"), (Join-Path $payload "runtime\node"), (Join-Path $payload "scripts"), (Join-Path $payload "service"), (Join-Path $payload "assets"), (Join-Path $payload "docs"), (Join-Path $payload "tests") -ItemType Directory -Force | Out-Null

$apiPayload = Join-Path $payload "app\api"
Deploy-LockedApi -RepositoryRoot $repoRoot -Destination $apiPayload -VerifiedLockHash $verifiedLockHash

# Un instalador debe ser autosuficiente: se empaqueta Shared como
# CommonJS, manteniendo zod externo para que la API y Shared usen la misma
# instancia (los errores de validación dependen de esa identidad).
$esbuild = Get-ChildItem `
  -Path (Join-Path $repoRoot "node_modules\.pnpm\esbuild@*\node_modules\esbuild\bin\esbuild*") `
  -File `
  -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -in @("esbuild", "esbuild.exe") } |
  Select-Object -First 1
if (-not $esbuild) { throw "No se encontró el binario de esbuild usado por Vite." }
$sharedBundle = Join-Path $buildRoot "shared\index.cjs"
New-Item -Path (Split-Path -Parent $sharedBundle) -ItemType Directory -Force | Out-Null
Invoke-Checked `
  -File "node" `
  -Arguments @(
    $esbuild.FullName,
    (Join-Path $repoRoot "packages\shared\src\index.ts"),
    "--bundle",
    "--platform=node",
    "--format=cjs",
    "--target=node24",
    "--external:zod",
    "--outfile=$sharedBundle"
  ) `
  -Message "No se pudo compilar @fitstore/shared para producción"
$deployedShared = Join-Path $apiPayload "node_modules\@fitstore\shared"
Remove-DeploymentLink -Path $deployedShared
New-Item -Path $deployedShared -ItemType Directory -Force | Out-Null
Copy-Item -LiteralPath $sharedBundle -Destination (Join-Path $deployedShared "index.cjs") -Force
@{
  name = "@fitstore/shared"
  version = "0.0.0-installer"
  private = $true
  type = "commonjs"
  main = "index.cjs"
} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $deployedShared "package.json") -Encoding UTF8
Remove-DeploymentLink -Path (Join-Path $apiPayload "node_modules\.pnpm\node_modules\@fitstore\api")
$nodeModulesPayload = Join-Path $apiPayload "node_modules"
$reparsePoints = @(Get-ChildItem -LiteralPath $nodeModulesPayload -Recurse -Force -ErrorAction Stop |
  Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
if ($reparsePoints.Count -gt 0) {
  throw "La API desplegable conserva enlaces no portables: $($reparsePoints[0].FullName)"
}
Protect-ApiPayload -Path $apiPayload
Write-ApiRuntimeTsConfig -RepositoryRoot $repoRoot -ApiPayload $apiPayload
Push-Location $apiPayload
try {
  Invoke-Checked -File "node" -Arguments @("node_modules\prisma\build\index.js", "generate", "--schema=prisma\schema.prisma") -Message "No se pudo generar Prisma Client en la API desplegable"
} finally { Pop-Location }
$requiredPrismaPaths = @(
  "prisma\build\index.js",
  "@prisma\client\package.json",
  "@prisma\config\package.json",
  "@prisma\debug\package.json",
  "@prisma\engines\package.json",
  "@prisma\engines\schema-engine-windows.exe",
  "@prisma\engines-version\package.json",
  "@prisma\fetch-engine\package.json",
  "@prisma\get-platform\package.json",
  ".prisma\client\query_engine-windows.dll.node"
)
foreach ($relativePath in $requiredPrismaPaths) {
  $requiredPath = Join-Path $nodeModulesPayload $relativePath
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "La API desplegable no contiene el componente Prisma requerido: $relativePath"
  }
}
Push-Location $apiPayload
try {
  Invoke-Checked -File "node" -Arguments @("-e", "const s=require('@fitstore/shared');const z=require('zod');if(s.z!==z.z||s.money(1.239)!==1.24)throw new Error('Shared no es autosuficiente');") -Message "La API desplegable no puede cargar @fitstore/shared"
  Invoke-Checked -File "node" -Arguments @("-e", "require.resolve('@prisma/engines');require.resolve('@prisma/config');const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.`$disconnect().catch(e=>{console.error(e);process.exit(1)});") -Message "La API desplegable no puede resolver Prisma"
  Invoke-Checked -File "node" -Arguments @("node_modules\prisma\build\index.js", "-v") -Message "La CLI de Prisma no funciona en la API desplegable"
} finally { Pop-Location }
Copy-Item -LiteralPath (Join-Path $repoRoot "apps\web\dist") -Destination (Join-Path $payload "app\web") -Recurse -Force

$nodeZip = Join-Path $downloads "node-win-x64.zip"
Get-VerifiedDownload -Url ([string]$lock.node.url) -Sha256 ([string]$lock.node.sha256) -Destination $nodeZip
$nodeExpand = Join-Path $buildRoot "node-expand"
Expand-Archive -LiteralPath $nodeZip -DestinationPath $nodeExpand -Force
$nodeSource = Get-ChildItem -LiteralPath $nodeExpand -Directory | Select-Object -First 1
if (-not $nodeSource -or -not (Test-Path -LiteralPath (Join-Path $nodeSource.FullName "node.exe"))) { throw "La descarga de Node no tiene la estructura esperada." }
Copy-Item -Path (Join-Path $nodeSource.FullName "*") -Destination (Join-Path $payload "runtime\node") -Recurse -Force

$postgresZip = Join-Path $downloads "postgresql-windows-x64.zip"
Get-VerifiedDownload -Url ([string]$lock.postgresql.url) -Sha256 ([string]$lock.postgresql.sha256) -Destination $postgresZip
$postgresExpand = Join-Path $buildRoot "postgres-expand"
Expand-ZipPrefixes -Archive $postgresZip -Destination $postgresExpand -Prefixes @(
  ([string]$lock.postgresql.archiveRoot + "/bin"),
  ([string]$lock.postgresql.archiveRoot + "/lib"),
  ([string]$lock.postgresql.archiveRoot + "/share")
)
$postgresSource = Join-Path $postgresExpand ([string]$lock.postgresql.archiveRoot)
$postgresTarget = Join-Path $payload "runtime\postgresql"
New-Item -Path $postgresTarget -ItemType Directory -Force | Out-Null
foreach ($folder in @("bin", "lib", "share")) {
  $source = Join-Path $postgresSource $folder
  if (-not (Test-Path -LiteralPath $source)) { throw "El archivo oficial de PostgreSQL no contiene $folder." }
  Copy-Item -LiteralPath $source -Destination (Join-Path $postgresTarget $folder) -Recurse -Force
}
foreach ($tool in @("postgres.exe", "pg_ctl.exe", "initdb.exe", "pg_isready.exe", "psql.exe", "pg_dump.exe", "pg_restore.exe", "createdb.exe", "dropdb.exe")) {
  if (-not (Test-Path -LiteralPath (Join-Path $postgresTarget "bin\$tool"))) { throw "El archivo oficial de PostgreSQL no contiene $tool." }
}

$winswExe = Join-Path $downloads "WinSW.exe"
Get-VerifiedDownload -Url ([string]$lock.winsw.url) -Sha256 ([string]$lock.winsw.sha256) -Destination $winswExe
Copy-Item -LiteralPath $winswExe -Destination (Join-Path $payload "runtime\WinSW.exe") -Force
$vcRuntime = Join-Path $downloads "vc_redist.x64.exe"
Get-VerifiedDownload -Url ([string]$lock.vcRuntime.url) -Sha256 ([string]$lock.vcRuntime.sha256) -Destination $vcRuntime
$vcSignature = Get-AuthenticodeSignature -FilePath $vcRuntime
if ($vcSignature.Status -ne "Valid" -or $null -eq $vcSignature.SignerCertificate -or $vcSignature.SignerCertificate.Subject -notmatch "Microsoft Corporation") {
  throw "La firma Authenticode del runtime de Microsoft no es válida."
}
Copy-Item -LiteralPath $vcRuntime -Destination (Join-Path $payload "runtime\vc_redist.x64.exe") -Force
Copy-Item -LiteralPath (Join-Path $installerRoot "runtime\web-server.mjs") -Destination (Join-Path $payload "runtime\web-server.mjs") -Force
Copy-Item -Path (Join-Path $installerRoot "scripts\*") -Destination (Join-Path $payload "scripts") -Recurse -Force
Copy-Item -Path (Join-Path $installerRoot "service\*") -Destination (Join-Path $payload "service") -Recurse -Force
Copy-Item -Path (Join-Path $installerRoot "assets\*") -Destination (Join-Path $payload "assets") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $repoRoot "docs\INSTALADOR.md") -Destination (Join-Path $payload "docs\INSTALADOR.md") -Force
Copy-Item -LiteralPath (Join-Path $installerRoot "tests\Windows-Smoke.ps1") -Destination (Join-Path $payload "tests\Windows-Smoke.ps1") -Force
Copy-Item -LiteralPath (Join-Path $installerRoot "VERSION") -Destination (Join-Path $payload "VERSION") -Force
Copy-Item -LiteralPath (Join-Path $installerRoot "THIRD_PARTY_NOTICES.txt") -Destination (Join-Path $payload "THIRD_PARTY_NOTICES.txt") -Force

$manifestLines = Get-ChildItem -LiteralPath $payload -Recurse -File |
  Sort-Object FullName |
  ForEach-Object {
    $relative = $_.FullName.Substring($payload.Length + 1).Replace("\", "/")
    $hash = Get-Sha256 -Path $_.FullName
    "$hash *$relative"
  }
$manifestLines | Set-Content -LiteralPath (Join-Path $payload "MANIFEST.sha256") -Encoding ASCII
Write-Host "Contenido preparado y verificado en $payload"

if ($SoloPreparar) { exit 0 }
$makeNsisCommand = Get-Command makensis.exe -ErrorAction SilentlyContinue
$makeNsisPath = if ($makeNsisCommand) { $makeNsisCommand.Source } else { "" }
if (-not $makeNsisPath) {
  foreach ($candidate in @(
    (Join-Path ${env:ProgramFiles(x86)} "NSIS\makensis.exe"),
    (Join-Path $env:ProgramFiles "NSIS\makensis.exe")
  )) {
    if (Test-Path -LiteralPath $candidate) { $makeNsisPath = $candidate; break }
  }
}
if (-not $makeNsisPath -and -not $SinInstalarNSIS) {
  if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) { throw "Falta NSIS y no se encontró winget para instalarlo." }
  Invoke-Checked -File "winget.exe" -Arguments @("install", "--id", [string]$lock.nsis.wingetId, "--exact", "--silent", "--accept-package-agreements", "--accept-source-agreements") -Message "No se pudo instalar NSIS"
  foreach ($candidate in @(
    (Join-Path ${env:ProgramFiles(x86)} "NSIS\makensis.exe"),
    (Join-Path $env:ProgramFiles "NSIS\makensis.exe")
  )) {
    if (Test-Path -LiteralPath $candidate) { $makeNsisPath = $candidate; break }
  }
}
if (-not $makeNsisPath) { throw "No se encontró makensis.exe. Instala NSIS 3.10 o posterior." }
$nsisVersionOutput = ((& $makeNsisPath "/VERSION" 2>&1) | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $nsisVersionOutput -notmatch "(\d+\.\d+(?:\.\d+)?)") { throw "No se pudo identificar la versión de NSIS." }
$foundNsisVersion = [Version]$Matches[1]
$minimumNsisVersion = [Version]([string]$lock.nsis.minimumVersion)
if ($foundNsisVersion -lt $minimumNsisVersion) { throw "NSIS $foundNsisVersion es demasiado antiguo; se requiere $minimumNsisVersion o posterior." }

$nsisScript = Join-Path $installerRoot "installer\FitStore.nsi"
Invoke-Checked -File $makeNsisPath -Arguments @(
  "/DVERSION=$version",
  "/DPRODUCT_VERSION=$productVersion",
  "/DPOSTGRES_MAJOR=$postgresMajor",
  "/DPAYLOAD_DIR=$payload",
  "/DOUTPUT_DIR=$dist",
  $nsisScript
) -Message "NSIS no pudo construir el instalador"
$setup = Join-Path $dist "Nexora-POS-Setup-$version.exe"
if (-not (Test-Path -LiteralPath $setup)) { throw "NSIS terminó sin crear $setup." }
$setupHash = Get-Sha256 -Path $setup
"$setupHash *$(Split-Path -Leaf $setup)" | Set-Content -LiteralPath "$setup.sha256" -Encoding ASCII
Write-Host "Instalador listo: $setup"
Write-Host "SHA-256: $setupHash"
