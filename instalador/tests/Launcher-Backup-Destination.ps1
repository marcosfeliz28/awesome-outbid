Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$documents = Join-Path $env:TEMP 'unused-documents-fixture'
$expected = Join-Path $env:ProgramData 'FitStore POS\Backups'
foreach ($name in @('lanzar-instalacion-silenciosa.ps1', 'reanudar-instalacion.ps1')) {
  $tokens = $null; $errors = $null
  $ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $repo "instalador\$name"), [ref]$tokens, [ref]$errors)
  if ($errors.Count) { throw "B9: error de sintaxis en $name" }
  $assignments = @($ast.FindAll({ param($node)
    $node -is [Management.Automation.Language.AssignmentStatementAst] -and $node.Left.Extent.Text -eq '$backupPath'
  }, $true))
  if ($assignments.Count -ne 1) { throw "B9: se esperaba una asignacion real de destino en $name" }
  # Ejecuta la asignacion del launcher, no una copia de su implementacion.
  $backupPath = $null
  . ([scriptblock]::Create($assignments[0].Extent.Text))
  if ($backupPath -ne $expected) { throw "B9: $name usa un destino distinto de ProgramData privado" }
  Write-Host "PASS B9: $name usa ProgramData\FitStore POS\Backups"
}
