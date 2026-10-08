Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$installerRoot = Split-Path -Parent $PSScriptRoot
$files = @(
  Get-ChildItem -LiteralPath $installerRoot -File -Filter "*.ps1"
  Get-ChildItem -LiteralPath (Join-Path $installerRoot "scripts"), (Join-Path $installerRoot "tests") -Recurse -File -Filter "*.ps1"
)
$failures = New-Object Collections.Generic.List[string]
foreach ($file in $files) {
  $tokens = $null
  $errors = $null
  [void][Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)
  foreach ($parseError in @($errors)) {
    $failures.Add("$($file.FullName):$($parseError.Extent.StartLineNumber): $($parseError.Message)")
  }
}
if ($failures.Count -gt 0) {
  $failures | ForEach-Object { Write-Error $_ }
  exit 1
}
Write-Host "Sintaxis PowerShell correcta: $($files.Count) archivos."
