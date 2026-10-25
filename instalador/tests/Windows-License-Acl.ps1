param(
  # PEM Ed25519 PRIVADA de PRUEBA cuya clave publica es la que se compilo en esta VM
  # (NEXORA_LICENSE_PUBLIC_KEY). Nunca una clave real de produccion.
  [Parameter(Mandatory = $true)][string]$TestPrivateKeyPath,
  [string]$EvidenceDir,
  [switch]$ConfirmDisposableVm
)

# PC-19: verificacion en Windows de la licencia local de Nexora POS Local.
# Ejecutar SOLO en una VM desechable con "Nexora POS Local" recien instalado
# (sin licencia aprovisionada) y SIN la tienda FitStore. Mensajes en ASCII a proposito (PowerShell 5.1 sin BOM).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$installDir = Join-Path $env:ProgramFiles "Nexora POS Local"
$dataDir = Join-Path $env:ProgramData "Nexora POS Local"
$licenseDir = Join-Path $dataDir "license"
$apiService = "NexoraLocalAPI"
$storeServices = @("FitStorePostgreSQL", "FitStoreAPI", "FitStoreWeb")
$storePorts = @(5434, 3001, 4173)
$apiPort = 4301
$systemSid = "S-1-5-18"
$adminsSid = "S-1-5-32-544"
$forbiddenSids = @("S-1-5-32-545", "S-1-1-0", "S-1-5-11")  # Users, Everyone, Authenticated Users
$files = [ordered]@{
  "license.json"  = @{ path = (Join-Path $licenseDir "license.json"); apiWrites = $true }
  "clock.json"    = @{ path = (Join-Path $licenseDir "clock.json"); apiWrites = $true }
  "state.json"    = @{ path = (Join-Path $dataDir "state.json"); apiWrites = $false }
  ".env"          = @{ path = (Join-Path $dataDir ".env"); apiWrites = $false }
  "work\.env"     = @{ path = (Join-Path $dataDir "work\.env"); apiWrites = $false }
}
$checks = [Collections.Generic.List[object]]::new()
$raw = [ordered]@{}
$phase = "preflight"
$result = "fallo"
$testUser = $null
$workDir = $null

function Add-Check {
  param([string]$Name, [bool]$Ok, [string]$Detail)
  $checks.Add([ordered]@{ name = $Name; ok = $Ok; detail = $Detail })
  if (-not $Ok) { throw "$Name`: $Detail" }
}

function Assert-DisposableVm {
  if (-not $ConfirmDisposableVm) {
    throw "PC-19 solo se ejecuta con -ConfirmDisposableVm en una VM desechable; crea y borra un usuario local y escribe en la carpeta de licencia."
  }
  $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
  Add-Check "Ejecucion elevada" ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) "Se requiere una consola como administrador."
  $computer = Get-CimInstance Win32_ComputerSystem
  $identity = "$($computer.Manufacturer) $($computer.Model)"
  $knownVm = $identity -match "(?i)virtual|vmware|virtualbox|hyper-v|kvm|qemu|amazon ec2|google compute"
  Add-Check "VM reconocida" $knownVm "Fabricante/modelo: $identity. No se permite ejecutar esta prueba en la PC de la tienda."
  foreach ($service in $storeServices) {
    Add-Check "Sin tienda: servicio $service" ($null -eq (Get-Service -Name $service -ErrorAction SilentlyContinue)) "La VM tiene la tienda FitStore instalada; usa una VM solo con Nexora POS Local."
  }
  foreach ($port in $storePorts) {
    Add-Check "Sin tienda: puerto $port" ($null -eq (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) "Puerto de la tienda ocupado."
  }
  return [ordered]@{ manufacturer = [string]$computer.Manufacturer; model = [string]$computer.Model }
}

function Get-ServiceSid {
  param([string]$Name)
  $text = (& "$env:SystemRoot\System32\sc.exe" showsid $Name) -join " "
  if ($LASTEXITCODE -ne 0 -or $text -notmatch "S-1-5-80-[0-9-]+") { throw "Windows no resolvio el SID del servicio $Name." }
  return $Matches[0]
}

function Get-WriterSids {
  param([string]$Path)
  $writeMask = [Security.AccessControl.FileSystemRights]::WriteData -bor [Security.AccessControl.FileSystemRights]::AppendData -bor
    [Security.AccessControl.FileSystemRights]::Delete -bor [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
    [Security.AccessControl.FileSystemRights]::ChangePermissions -bor [Security.AccessControl.FileSystemRights]::TakeOwnership
  $rules = (Get-Acl -LiteralPath $Path).GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
  $writers = @($rules | Where-Object { $_.AccessControlType -eq "Allow" -and ($_.FileSystemRights -band $writeMask) -ne 0 } |
    ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
  $all = @($rules | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
  return [pscustomobject]@{ writers = $writers; all = $all }
}

function Assert-Acl {
  param([string]$Label, [string]$Path, [string[]]$AllowedWriters)
  Add-Check "ACL existe: $Label" (Test-Path -LiteralPath $Path) "No existe $Path."
  $raw["icacls $Label"] = (& "$env:SystemRoot\System32\icacls.exe" $Path) -join "`n"
  $acl = Get-WriterSids -Path $Path
  $extra = @($acl.writers | Where-Object { $_ -notin $AllowedWriters })
  Add-Check "ACL escritura: $Label" ($extra.Count -eq 0) "Solo $($AllowedWriters -join ', ') pueden escribir; sobran: $($extra -join ', ')."
  $leak = @($acl.all | Where-Object { $_ -in $forbiddenSids })
  Add-Check "ACL sin Users/Everyone: $Label" ($leak.Count -eq 0) "Aparecen entradas para: $($leak -join ', ')."
  $protected = (Get-Acl -LiteralPath $Path).AreAccessRulesProtected
  return [ordered]@{ writers = $acl.writers; entries = $acl.all; inheritanceBlocked = $protected }
}

function Invoke-Http {
  param([string]$Method, [string]$Path)
  $uri = "http://127.0.0.1:$apiPort$Path"
  try {
    $request = @{ Uri = $uri; Method = $Method; UseBasicParsing = $true; TimeoutSec = 15 }
    if ($Method -eq "POST") { $request.Body = "{}"; $request.ContentType = "application/json" }
    $response = Invoke-WebRequest @request
    return [pscustomobject]@{ status = [int]$response.StatusCode; body = [string]$response.Content }
  } catch {
    $response = $_.Exception.Response
    if ($null -eq $response) { throw }
    $reader = [IO.StreamReader]::new($response.GetResponseStream())
    try { $body = $reader.ReadToEnd() } finally { $reader.Dispose() }
    return [pscustomobject]@{ status = [int]$response.StatusCode; body = $body }
  }
}

function New-SignedToken {
  param([string]$Node, [string]$InstallationId, [string]$Status, [datetime]$Issued)
  $script = Join-Path $workDir "sign.js"
  Set-Content -LiteralPath $script -Encoding ASCII -Value @'
const { createPrivateKey, createPublicKey, sign } = require("node:crypto");
const { readFileSync } = require("node:fs");
const [keyPath, id, status, issuedAt, expiresAt, publicPath] = process.argv.slice(2);
const priv = createPrivateKey(readFileSync(keyPath));
if (priv.asymmetricKeyType !== "ed25519") throw new Error("La clave de prueba debe ser Ed25519.");
const body = (pem) => pem.replace(/-----[^-]+-----|\s|\\n/g, "");
const mine = body(createPublicKey(priv).export({ type: "spki", format: "pem" }).toString());
if (mine !== body(readFileSync(publicPath, "utf8"))) throw new Error("La clave privada de prueba no corresponde a la clave publica instalada.");
const claims = { version: 1, installationId: id, issuedAt, expiresAt, status };
const payload = JSON.stringify([1, id, issuedAt, expiresAt, status]);
process.stdout.write(JSON.stringify({ claims, signature: sign(null, Buffer.from(payload), priv).toString("base64url") }));
'@
  $issuedAt = $Issued.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
  $expiresAt = $Issued.AddDays(6).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
  $out = & $Node $script $TestPrivateKeyPath $InstallationId $Status $issuedAt $expiresAt (Join-Path $installDir "runtime\license-public-key.pem")
  if ($LASTEXITCODE -ne 0) { throw "No se pudo firmar el token de prueba." }
  return ($out -join "")
}

# Se ejecuta como usuario estandar: intenta alterar cada archivo y reporta el tipo de error.
$probeScript = @'
param([string]$LicenseDir, [string]$DataDir, [string]$Out)
$ErrorActionPreference = "Stop"
$results = [ordered]@{}
function Try-Op([string]$Name, [scriptblock]$Op) {
  try { & $Op; $results[$Name] = "allowed" }
  catch {
    $e = $_.Exception
    while ($e.InnerException) { $e = $e.InnerException }
    $results[$Name] = $e.GetType().Name
  }
}
$lic = Join-Path $LicenseDir "license.json"
$clk = Join-Path $LicenseDir "clock.json"
Try-Op "crear-archivo-en-license" { [IO.File]::WriteAllText((Join-Path $LicenseDir "intruso.tmp"), "x") }
Try-Op "sobrescribir-license.json" { $s = [IO.File]::Open($lic, "Open", "Write"); $s.Dispose() }
Try-Op "editar-clock.json" { $s = [IO.File]::Open($clk, "Open", "Write"); $s.Dispose() }
Try-Op "renombrar-license.json" { [IO.File]::Move($lic, "$lic.bak") }
Try-Op "borrar-license.json" { [IO.File]::Delete($lic); if (-not (Test-Path -LiteralPath $lic)) { return }; throw [UnauthorizedAccessException]::new("sigue existiendo") }
Try-Op "reemplazar-license.json" { $n = Join-Path $env:TEMP "nxl-replace.json"; [IO.File]::WriteAllText($n, "[]"); [IO.File]::Replace($n, $lic, $null) }
Try-Op "editar-state.json" { $s = [IO.File]::Open((Join-Path $DataDir "state.json"), "Open", "Write"); $s.Dispose() }
Try-Op "editar-.env" { $s = [IO.File]::Open((Join-Path $DataDir ".env"), "Open", "Write"); $s.Dispose() }
Try-Op "editar-work-.env" { $s = [IO.File]::Open((Join-Path $DataDir "work\.env"), "Open", "Write"); $s.Dispose() }
$results | ConvertTo-Json | Set-Content -LiteralPath $Out -Encoding ASCII
'@

try {
  $vm = Assert-DisposableVm
  $raw["vm"] = $vm
  if (-not $EvidenceDir) { $EvidenceDir = Join-Path $env:PUBLIC ("Documents\Nexora PC19 Evidence\" + (Get-Date -Format "yyyyMMdd-HHmmss")) }
  $EvidenceDir = [IO.Path]::GetFullPath($EvidenceDir)
  New-Item -Path $EvidenceDir -ItemType Directory -Force | Out-Null
  $workDir = Join-Path $env:SystemRoot ("Temp\nxl-acl-" + [guid]::NewGuid().ToString("N"))
  New-Item -Path $workDir -ItemType Directory -Force | Out-Null

  $phase = "servicio"
  Add-Check "Producto instalado" ((Test-Path -LiteralPath $installDir) -and (Test-Path -LiteralPath $dataDir)) "Instala Nexora POS Local antes de ejecutar esta prueba."
  Add-Check "Clave de prueba" (Test-Path -LiteralPath $TestPrivateKeyPath) "No existe $TestPrivateKeyPath."
  $node = Join-Path $installDir "runtime\node\node.exe"
  Add-Check "Node del producto" (Test-Path -LiteralPath $node) "Falta $node."
  $service = Get-CimInstance Win32_Service -Filter "Name='$apiService'"
  Add-Check "Servicio $apiService existe y corre" ($null -ne $service -and $service.State -eq "Running") "Estado: $(if ($service) { $service.State } else { 'inexistente' })."
  Add-Check "Cuenta virtual propia" ($service.StartName -ieq "NT SERVICE\$apiService") "StartName: $($service.StartName)."
  $apiSid = Get-ServiceSid -Name $apiService
  $raw["apiSid"] = $apiSid
  $owners = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($service.ProcessId) OR ProcessId=$($service.ProcessId)" | ForEach-Object {
    $o = Invoke-CimMethod -InputObject $_ -MethodName GetOwner
    "$($_.Name): $($o.Domain)\$($o.User)"
  })
  $raw["procesos"] = $owners
  Add-Check "Procesos de la API con la cuenta virtual" (($owners.Count -gt 0) -and (@($owners | Where-Object { $_ -notmatch "NT SERVICE\\$apiService$" }).Count -eq 0)) "Propietarios: $($owners -join '; ')."
  $listener = Get-NetTCPConnection -State Listen -LocalPort $apiPort -ErrorAction SilentlyContinue
  Add-Check "API escucha en $apiPort" ($null -ne $listener) "Nada escucha en el puerto local $apiPort."

  $phase = "sin-licencia"
  Add-Check "Instalacion sin licencia previa" (-not (Test-Path -LiteralPath (Join-Path $licenseDir "license.json"))) "Ya existe license.json; usa una VM recien instalada."
  $get = Invoke-Http -Method GET -Path "/api/local-license/status"
  $raw["sin-licencia GET status"] = $get
  Add-Check "Sin licencia: GET status 200 solo lectura" ($get.status -eq 200 -and $get.body -match '"mode"\s*:\s*"read-only"') "HTTP $($get.status): $($get.body)"
  $post = Invoke-Http -Method POST -Path "/api/products"
  $raw["sin-licencia POST"] = $post
  Add-Check "Sin licencia: POST de escritura devuelve 423" ($post.status -eq 423) "HTTP $($post.status): $($post.body)"

  $phase = "con-licencia"
  $state = Get-Content -LiteralPath $files["state.json"].path -Raw -Encoding UTF8 | ConvertFrom-Json
  $installationId = [string]$state.installationId
  Add-Check "state.json tiene installationId" (-not [string]::IsNullOrWhiteSpace($installationId)) "Falta installationId en state.json."
  $token = New-SignedToken -Node $node -InstallationId $installationId -Status "active" -Issued ((Get-Date).AddMinutes(-1))
  [IO.File]::WriteAllText($files["license.json"].path, "[$token]", [Text.UTF8Encoding]::new($false))
  $get = Invoke-Http -Method GET -Path "/api/local-license/status"
  $raw["con-licencia GET status"] = $get
  Add-Check "Con licencia firmada: modo escritura" ($get.status -eq 200 -and $get.body -match '"mode"\s*:\s*"write"') "HTTP $($get.status): $($get.body)"
  $post = Invoke-Http -Method POST -Path "/api/products"
  $raw["con-licencia POST"] = $post
  Add-Check "Con licencia: POST ya no devuelve 423" ($post.status -ne 423 -and $post.status -ne 0) "HTTP $($post.status): $($post.body)"

  $phase = "acl"
  $apiAndAdmins = @($systemSid, $adminsSid, $apiSid)
  $raw["acl directorio license"] = Assert-Acl -Label "license (directorio)" -Path $licenseDir -AllowedWriters $apiAndAdmins
  $dirAcl = Get-WriterSids -Path $licenseDir
  Add-Check "La cuenta de la API escribe en license" ($apiSid -in $dirAcl.writers) "La cuenta virtual no tiene escritura en $licenseDir."
  foreach ($name in $files.Keys) {
    $allowed = if ($files[$name].apiWrites) { $apiAndAdmins } else { @($systemSid, $adminsSid) }
    $raw["acl $name"] = Assert-Acl -Label $name -Path $files[$name].path -AllowedWriters $allowed
  }
  $owner = (Get-Acl -LiteralPath $files["clock.json"].path).Owner
  $raw["propietario clock.json"] = $owner
  Add-Check "clock.json lo creo la cuenta de la API" ($owner -match "NT SERVICE\\$apiService$|$apiService$") "Propietario: $owner."
  $envAcl = Get-WriterSids -Path $files["work\.env"].path
  Add-Check "La API lee work\.env" ($apiSid -in $envAcl.all) "La cuenta virtual no tiene entrada de lectura en work\.env."
  foreach ($protectedPath in @($dataDir, $installDir)) {
    $w = Get-WriterSids -Path $protectedPath
    Add-Check "La API no escribe fuera de license/logs: $protectedPath" ($apiSid -notin $w.writers) "La cuenta virtual puede escribir en $protectedPath."
  }

  $phase = "usuario-estandar"
  $testUser = "nxlacl" + (Get-Random -Minimum 1000 -Maximum 9999)
  $bytes = New-Object byte[] 18
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  $plain = "Aa1!" + [Convert]::ToBase64String($bytes).Replace("+", "x").Replace("/", "y").TrimEnd("=")
  New-LocalUser -Name $testUser -Password (ConvertTo-SecureString $plain -AsPlainText -Force) -AccountNeverExpires -PasswordNeverExpires | Out-Null
  $isAdmin = @(Get-LocalGroupMember -SID $adminsSid -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*\$testUser" }).Count
  Add-Check "Usuario de prueba es estandar" ($isAdmin -eq 0) "El usuario temporal quedo en Administradores."
  $userSid = (Get-LocalUser -Name $testUser).SID.Value
  & "$env:SystemRoot\System32\icacls.exe" $workDir "/grant" "*${userSid}:(OI)(CI)M" | Out-Null
  $probe = Join-Path $workDir "probe.ps1"
  $outFile = Join-Path $workDir "probe.json"
  Set-Content -LiteralPath $probe -Value $probeScript -Encoding ASCII
  $hashBefore = @{}
  foreach ($name in $files.Keys) { $hashBefore[$name] = (Get-FileHash -LiteralPath $files[$name].path -Algorithm SHA256).Hash }
  $credential = [pscredential]::new(".\$testUser", (ConvertTo-SecureString $plain -AsPlainText -Force))
  $proc = Start-Process -FilePath "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -Credential $credential -WorkingDirectory $workDir -WindowStyle Hidden -Wait -PassThru `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $probe, "-LicenseDir", $licenseDir, "-DataDir", $dataDir, "-Out", $outFile) `
    -RedirectStandardError (Join-Path $workDir "probe.err")
  Add-Check "Sonda de usuario estandar termino" ($proc.ExitCode -eq 0 -and (Test-Path -LiteralPath $outFile)) "Codigo $($proc.ExitCode): $(Get-Content -LiteralPath (Join-Path $workDir 'probe.err') -Raw -ErrorAction SilentlyContinue)"
  $probeResult = Get-Content -LiteralPath $outFile -Raw | ConvertFrom-Json
  $raw["usuario estandar"] = $probeResult
  foreach ($property in $probeResult.PSObject.Properties) {
    # Solo "acceso denegado" cuenta; "no existe" o "allowed" son fallo (no es evidencia valida).
    Add-Check "Usuario estandar NO puede: $($property.Name)" ($property.Value -in @("UnauthorizedAccessException", "SecurityException")) "Resultado: $($property.Value)."
  }
  foreach ($name in $files.Keys) {
    Add-Check "Archivo intacto tras la sonda: $name" ((Test-Path -LiteralPath $files[$name].path) -and ((Get-FileHash -LiteralPath $files[$name].path -Algorithm SHA256).Hash -eq $hashBefore[$name])) "El archivo cambio o desaparecio."
  }
  Add-Check "No quedo archivo intruso" (-not (Test-Path -LiteralPath (Join-Path $licenseDir "intruso.tmp"))) "El usuario estandar creo un archivo en license."

  $phase = "falla-cerrado"
  # Un administrador local SI puede alterar; se verifica que la API falle cerrada y se restaura.
  $originalLicense = [IO.File]::ReadAllText($files["license.json"].path)
  $originalClock = [IO.File]::ReadAllText($files["clock.json"].path)
  try {
    [IO.File]::WriteAllText($files["license.json"].path, "no-es-json")
    $get = Invoke-Http -Method GET -Path "/api/local-license/status"
    Add-Check "license.json corrupto: solo lectura (invalid)" ($get.body -match '"mode"\s*:\s*"read-only"' -and $get.body -match "invalid") "HTTP $($get.status): $($get.body)"
    [IO.File]::WriteAllText($files["license.json"].path, $originalLicense)
    $future = [DateTimeOffset]::UtcNow.AddDays(30).ToUnixTimeMilliseconds()
    [IO.File]::WriteAllText($files["clock.json"].path, "{`"lastSeen`":$future}")
    $get = Invoke-Http -Method GET -Path "/api/local-license/status"
    Add-Check "clock.json adelantado: solo lectura (clock-backwards)" ($get.body -match '"mode"\s*:\s*"read-only"' -and $get.body -match "clock-backwards") "HTTP $($get.status): $($get.body)"
  } finally {
    [IO.File]::WriteAllText($files["license.json"].path, $originalLicense)
    [IO.File]::WriteAllText($files["clock.json"].path, $originalClock)
  }
  $get = Invoke-Http -Method GET -Path "/api/local-license/status"
  Add-Check "Restaurado: vuelve a modo escritura" ($get.body -match '"mode"\s*:\s*"write"') "HTTP $($get.status): $($get.body)"

  $phase = "impago"
  $unpaid = New-SignedToken -Node $node -InstallationId $installationId -Status "unpaid" -Issued (Get-Date)
  [IO.File]::WriteAllText($files["license.json"].path, $originalLicense.TrimEnd().TrimEnd("]") + ",$unpaid]")
  $get = Invoke-Http -Method GET -Path "/api/local-license/status"
  $post = Invoke-Http -Method POST -Path "/api/products"
  Add-Check "Licencia unpaid: solo lectura y 423" ($get.body -match "unpaid" -and $post.status -eq 423) "status: $($get.body); POST: $($post.status)."

  $result = "correcto"
  Write-Host "PC-19 CORRECTO: ACL, cuenta virtual, manipulacion y modo solo lectura verificados."
} catch {
  $raw["error"] = [ordered]@{ phase = $phase; message = $_.Exception.Message }
  Write-Host "PC-19 FALLO en $phase`: $($_.Exception.Message)"
  $global:LASTEXITCODE = 1
} finally {
  if ($testUser) { Remove-LocalUser -Name $testUser -ErrorAction SilentlyContinue }
  if ($workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force -ErrorAction SilentlyContinue }
  if ($EvidenceDir) {
    $report = [ordered]@{ result = $result; phase = $phase; checks = $checks; evidence = $raw; evidenceDirectory = $EvidenceDir }
    $report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $EvidenceDir "resultado.json") -Encoding UTF8
  }
  if ($result -ne "correcto") { exit 1 }
}
