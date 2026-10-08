param(
  [string]$InstallDir,
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "FitStore.Common.ps1")

function Test-PrivateIpv4 {
  param([Parameter(Mandatory = $true)][string]$Address)
  $parsed = [Net.IPAddress]::Parse($Address)
  $bytes = $parsed.GetAddressBytes()
  return ($bytes[0] -eq 10) -or
    ($bytes[0] -eq 172 -and $bytes[1] -ge 16 -and $bytes[1] -le 31) -or
    ($bytes[0] -eq 192 -and $bytes[1] -eq 168)
}

function Get-PrivateIpv4Addresses {
  $addresses = @(Get-NetIPAddress -AddressFamily IPv4 -AddressState Preferred -ErrorAction SilentlyContinue |
      Where-Object { Test-PrivateIpv4 -Address $_.IPAddress } |
      Select-Object -ExpandProperty IPAddress -Unique |
      Sort-Object)
  return $addresses
}

function Get-StateValue {
  param($State, [string]$Name, $Default)
  if ($State.PSObject.Properties.Name -contains $Name) { return $State.$Name }
  return $Default
}

function Get-OrImportCaCertificate {
  param($Paths, $Secrets, $State)
  $thumbprint = [string](Get-StateValue -State $State -Name "caThumbprint" -Default "")
  if ($thumbprint) {
    $existing = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $thumbprint } | Select-Object -First 1
    if ($existing) { return $existing }
  }
  $caPfx = Join-Path $Paths.Pki "FitStore-CA.pfx"
  if (Test-Path -LiteralPath $caPfx) {
    $password = ConvertTo-SecureString ([string]$Secrets.pfxPassword) -AsPlainText -Force
    return Import-PfxCertificate -FilePath $caPfx -CertStoreLocation Cert:\LocalMachine\My -Password $password -Exportable
  }
  return $null
}

function New-FitStoreCa {
  param($Paths, $Secrets)
  $ca = New-SelfSignedCertificate `
    -Type Custom `
    -Subject "CN=FitStore POS CA" `
    -FriendlyName "FitStore POS CA local" `
    -CertStoreLocation Cert:\LocalMachine\My `
    -KeyAlgorithm RSA `
    -KeyLength 4096 `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -KeyUsage CertSign, CRLSign, DigitalSignature `
    -TextExtension @("2.5.29.19={critical}{text}ca=1&pathlength=1") `
    -NotAfter (Get-Date).AddYears(10)
  $password = ConvertTo-SecureString ([string]$Secrets.pfxPassword) -AsPlainText -Force
  Export-PfxCertificate -Cert $ca -FilePath (Join-Path $Paths.Pki "FitStore-CA.pfx") -Password $password -Force | Out-Null
  Export-Certificate -Cert $ca -FilePath (Join-Path $Paths.Pki "FitStore-CA.cer") -Type CERT -Force | Out-Null
  Import-Certificate -FilePath (Join-Path $Paths.Pki "FitStore-CA.cer") -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
  Protect-FitStoreFile -Path (Join-Path $Paths.Pki "FitStore-CA.pfx")
  return $ca
}

function New-FitStoreServerCertificate {
  param($Paths, $Secrets, $Ca, [string[]]$Ips, [string[]]$DnsNames)
  $san = @()
  foreach ($dns in $DnsNames) { $san += "DNS=$dns" }
  foreach ($ip in $Ips) { $san += "IPAddress=$ip" }
  $leaf = New-SelfSignedCertificate `
    -Type Custom `
    -Subject ("CN={0}" -f $env:COMPUTERNAME) `
    -FriendlyName "FitStore POS HTTPS" `
    -Signer $Ca `
    -CertStoreLocation Cert:\LocalMachine\My `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -KeyExportPolicy Exportable `
    -KeyUsage DigitalSignature, KeyEncipherment `
    -TextExtension @(
      "2.5.29.37={text}1.3.6.1.5.5.7.3.1",
      ("2.5.29.17={text}" + ($san -join "&"))
    ) `
    -NotAfter (Get-Date).AddMonths(24)
  $password = ConvertTo-SecureString ([string]$Secrets.pfxPassword) -AsPlainText -Force
  $serverPfx = Join-Path $Paths.Pki "FitStore-server.pfx"
  Export-PfxCertificate -Cert $leaf -FilePath $serverPfx -Password $password -Force | Out-Null
  Protect-FitStoreFile -Path $serverPfx
  return $leaf
}

Assert-FitStoreAdministrator
$paths = Get-FitStorePaths -InstallDir $InstallDir
$secrets = Read-FitStoreJson -Path $paths.Secrets
$state = Read-FitStoreJson -Path $paths.State
New-FitStoreDirectory -Path $paths.Pki

$ips = @(Get-PrivateIpv4Addresses)
$hasPrivateAddress = $ips.Count -gt 0
if (-not $hasPrivateAddress) {
  Write-FitStoreLog -InstallDir $paths.Install -Level "AVISO" -Message "No hay una IPv4 privada activa. HTTPS local continuará en localhost; las otras cajas podrán conectarse cuando esta PC vuelva a la red de la tienda."
}
$dnsNames = @("localhost", $env:COMPUTERNAME.ToLowerInvariant(), ($env:COMPUTERNAME.ToLowerInvariant() + ".local"), "fitstore") | Select-Object -Unique
$savedIps = @((Get-StateValue -State $state -Name "certificateIps" -Default @()) | ForEach-Object { [string]$_ } | Sort-Object)
$sameIps = (($savedIps -join ",") -eq (($ips | Sort-Object) -join ","))
$serverPfx = Join-Path $paths.Pki "FitStore-server.pfx"
$leafThumbprint = [string](Get-StateValue -State $state -Name "leafThumbprint" -Default "")
$existingLeaf = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $leafThumbprint } | Select-Object -First 1
$mustIssue = $Force -or -not $sameIps -or -not (Test-Path -LiteralPath $serverPfx) -or $null -eq $existingLeaf -or $existingLeaf.NotAfter -lt (Get-Date).AddDays(60)

$ca = Get-OrImportCaCertificate -Paths $paths -Secrets $secrets -State $state
if ($null -eq $ca) {
  $ca = New-FitStoreCa -Paths $paths -Secrets $secrets
  $mustIssue = $true
}
$trustedRoot = Get-ChildItem Cert:\LocalMachine\Root | Where-Object { $_.Thumbprint -eq $ca.Thumbprint } | Select-Object -First 1
if ($null -eq $trustedRoot) {
  Import-Certificate -FilePath (Join-Path $paths.Pki "FitStore-CA.cer") -CertStoreLocation Cert:\LocalMachine\Root | Out-Null
}

if ($mustIssue) {
  if ($leafThumbprint) {
    Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $leafThumbprint } | Remove-Item -Force -ErrorAction SilentlyContinue
  }
  $leaf = New-FitStoreServerCertificate -Paths $paths -Secrets $secrets -Ca $ca -Ips $ips -DnsNames $dnsNames
  $state | Add-Member -NotePropertyName leafThumbprint -NotePropertyValue $leaf.Thumbprint -Force
  $state | Add-Member -NotePropertyName caThumbprint -NotePropertyValue $ca.Thumbprint -Force
  $state | Add-Member -NotePropertyName certificateIps -NotePropertyValue $ips -Force
  $state | Add-Member -NotePropertyName certificateDnsNames -NotePropertyValue $dnsNames -Force
  Write-FitStoreJson -Path $paths.State -Value $state -Protect
}

$serverConfig = [ordered]@{
  host = "0.0.0.0"
  port = 4173
  apiPort = 3001
  webRoot = $paths.Web
  pfxPath = $serverPfx
  pfxPassword = [string]$secrets.pfxPassword
}
Write-FitStoreJson -Path $paths.ServerConfig -Value $serverConfig -Protect

Get-NetFirewallRule -DisplayName "FitStore POS - HTTPS red local" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule `
  -DisplayName "FitStore POS - HTTPS red local" `
  -Direction Inbound `
  -Action Allow `
  -Protocol TCP `
  -LocalPort 4173 `
  -RemoteAddress LocalSubnet `
  -Profile Domain, Private | Out-Null

Get-NetFirewallRule -DisplayName "FitStore POS - Bloquear API directa" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule `
  -DisplayName "FitStore POS - Bloquear API directa" `
  -Direction Inbound `
  -Action Block `
  -Protocol TCP `
  -LocalPort 3001 `
  -Profile Any | Out-Null

$lines = @(
  "FITSTORE POS EN LA RED LOCAL",
  "",
  "Dirección en esta computadora: https://localhost:4173",
  "Direcciones para cajas y celulares:"
)
foreach ($ip in $ips) { $lines += "https://${ip}:4173" }
$lines += @(
  "",
  "Certificado que debe instalarse en cada celular:",
  (Join-Path $paths.Pki "FitStore-CA.cer"),
  "",
  "La conexión Wi-Fi/Ethernet de la tienda debe estar marcada como red Privada en Windows.",
  "Conviene reservar una dirección IP fija para esta laptop en el router."
)
$lines | Set-Content -LiteralPath (Join-Path $paths.Data "RED_LOCAL.txt") -Encoding UTF8

$trustedProfiles = @(Get-NetConnectionProfile -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4Connectivity -ne "Disconnected" -and $_.NetworkCategory -in @("Private", "DomainAuthenticated") })
if ($trustedProfiles.Count -eq 0) {
  Write-FitStoreLog -InstallDir $paths.Install -Level "AVISO" -Message "No hay una conexión activa marcada como Privada o Dominio. La instalación local sigue siendo válida; otros equipos no podrán entrar hasta corregir el perfil de red."
}

$webService = Get-Service -Name $script:WebService -ErrorAction SilentlyContinue
if ($mustIssue -and $null -ne $webService -and $webService.Status -eq "Running") {
  Restart-Service -Name $script:WebService -Force -ErrorAction Stop
  Wait-FitStoreHttp -Url "https://localhost:4173/__fitstore/health" -TimeoutSeconds 60
}

$httpsTargets = @("localhost") + $ips
Write-FitStoreLog -InstallDir $paths.Install -Message ("HTTPS listo para: " + ($httpsTargets -join ", "))
