Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
. (Join-Path (Split-Path -Parent $PSScriptRoot) "scripts\FitStore.Common.ps1")
$script:messages = @()
function Write-FitStoreLog { param($InstallDir, $Level, $Message) $script:messages += [pscustomobject]@{ Level=$Level; Message=$Message } }
function Protect-FitStoreBackupDirectory { param($Path) }
$root = Join-Path ([IO.Path]::GetTempPath()) ("nexora-aad-warning-" + [Guid]::NewGuid().ToString("N"))
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $state = [pscustomobject]@{ backupReaderSid="S-1-12-1-100-200-300-400" }
  $paths = [pscustomobject]@{ LocalBackups=$root; Install=$root }
  Initialize-FitStoreBackupStorage -Paths $paths -State $state | Out-Null
  if ($script:messages.Count -ne 1 -or $script:messages[0].Level -ne "AVISO" -or $script:messages[0].Message -notmatch "Azure AD") { throw "3h8: cuenta Azure AD descartada sin aviso." }
  if ($script:BackupReaderSid) { throw "3h8: se concedio lectura a identidad no admitida." }
  Write-Host "PASS 3h8-AzureAD: cuenta no admitida avisa; no agrega Users/Everyone ni pierde respaldo local."
  $state.backupReaderSid = "S-1-1-0"
  $rejected = $false
  try { Initialize-FitStoreBackupStorage -Paths $paths -State $state | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw "3h8: Everyone aceptado como usuario lector." }
  Write-Host "PASS 3h8-AzureAD: grupo publico sigue rechazado."
} finally { if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) } }
