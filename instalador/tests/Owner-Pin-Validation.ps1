$ErrorActionPreference = "Stop"

$sourcePath = Join-Path $PSScriptRoot "..\scripts\Install-FitStore.ps1"
$tokens = $null
$parseErrors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile(
  $sourcePath,
  [ref]$tokens,
  [ref]$parseErrors
)
if ($parseErrors.Count -gt 0) { throw "Install-FitStore.ps1 no analiza correctamente." }
$functionAst = $ast.Find({
  param($node)
  $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and
    $node.Name -eq "Assert-OwnerInput"
}, $true)
if (-not $functionAst) { throw "No se encontró la función real Assert-OwnerInput." }
. ([scriptblock]::Create($functionAst.Extent.Text))

$valid = @{
  OwnerName = "Marco Feliz"
  OwnerEmail = "owner@example.test"
  OwnerPassword = "Fixture-Only-Password-123"
  OwnerPasswordConfirm = "Fixture-Only-Password-123"
  OwnerPin = "012345"
}
Assert-OwnerInput -Answer $valid

$unicodeDigits = -join @(
  [char]0xFF11, [char]0xFF12, [char]0xFF13,
  [char]0xFF14, [char]0xFF15, [char]0xFF16
)
foreach ($pin in @("1234", "12345", "1234567", "12A456", $unicodeDigits)) {
  $invalid = $valid.Clone()
  $invalid.OwnerPin = $pin
  $rejected = $false
  try { Assert-OwnerInput -Answer $invalid }
  catch { $rejected = $_.Exception.Message -eq "El PIN debe tener 6 dígitos." }
  if (-not $rejected) { throw "Assert-OwnerInput aceptó un PIN inválido." }
}

Write-Output "Validación real del PIN de dueño: 1 PIN ASCII de 6 dígitos aceptado; 5 casos inválidos rechazados."
