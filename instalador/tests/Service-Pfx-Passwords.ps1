Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\scripts\FitStore.Common.ps1')
$tokens=$null; $errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot '..\scripts\Configure-Network.ps1'),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'B8: Configure-Network no analiza.' }
$definition=$ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'New-FitStoreServerCertificate' },$true)
Invoke-Expression $definition.Extent.Text
$root=Join-Path $env:TEMP ('nexora-b8-pfx-' + [guid]::NewGuid().ToString('N'))
$ca=$null; $leaf=$null
try {
  New-FitStoreDirectory -Path $root
  $secrets=[pscustomobject]@{ pfxPassword=(New-FitStoreSecret) }
  Initialize-FitStorePfxSecrets -Secrets $secrets | Out-Null
  # Solo certificados descartables en CurrentUser; la funcion productiva real
  # conserva LocalMachine como ubicacion predeterminada.
  $ca=New-SelfSignedCertificate -Type Custom -Subject 'CN=Nexora disposable B8 CA' -CertStoreLocation Cert:\CurrentUser\My -KeyExportPolicy Exportable -KeyUsage CertSign,CRLSign,DigitalSignature -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=1')
  $caPfx=Join-Path $root 'FitStore-CA.pfx'
  Export-PfxCertificate -Cert $ca -FilePath $caPfx -Password (ConvertTo-SecureString $secrets.caPfxPassword -AsPlainText -Force) | Out-Null
  $leaf=New-FitStoreServerCertificate -Paths ([pscustomobject]@{Pki=$root}) -Secrets $secrets -Ca $ca -Ips @('127.0.0.1') -DnsNames @('localhost') -CertStoreLocation Cert:\CurrentUser\My
  $serverPfx=Join-Path $root 'FitStore-server.pfx'
  # Exportar protege el archivo; el propietario de la prueba habilita lectura
  # exclusivamente para inspeccionar el PFX real bajo su propio token.
  $identity=[Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl=[IO.File]::GetAccessControl($serverPfx,[Security.AccessControl.AccessControlSections]::Access)
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($identity,'Read','Allow'))
  [IO.File]::SetAccessControl($serverPfx,$acl)
  foreach ($case in @(@($caPfx,$secrets.caPfxPassword,$secrets.serverPfxPassword),@($serverPfx,$secrets.serverPfxPassword,$secrets.caPfxPassword))) {
    Get-PfxData -FilePath $case[0] -Password (ConvertTo-SecureString $case[1] -AsPlainText -Force) | Out-Null
    $rejected=$false
    try { Get-PfxData -FilePath $case[0] -Password (ConvertTo-SecureString $case[2] -AsPlainText -Force) | Out-Null }
    catch { $rejected=$true }
    if (-not $rejected) { throw 'B8: el PFX acepta la clave del otro certificado.' }
  }
  Write-Host 'PASS B8: PFX reales CA/servidor aceptan solo sus claves distintas; funcion real del servidor en CurrentUser.'
} finally {
  foreach ($cert in @($leaf,$ca)) { if ($null -ne $cert) { Remove-Item -LiteralPath (Join-Path 'Cert:\CurrentUser\My' $cert.Thumbprint) -Force -ErrorAction SilentlyContinue } }
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root,$true) }
}
