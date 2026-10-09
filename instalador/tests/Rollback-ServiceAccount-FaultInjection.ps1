Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot '../scripts/Rollback-FitStoreUpdate.ps1'
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
$definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Ensure-RestoredApplicationService' }, $true)
Invoke-Expression $definition.Extent.Text
$root = Join-Path ([IO.Path]::GetTempPath()) ('nexora-a1-' + [guid]::NewGuid().ToString('N'))
$script:registered = @{}; $script:installs = 0; $script:queries = 0
function Get-Service { param($Name, $ErrorAction) if ($script:registered.ContainsKey($Name)) { [pscustomobject]@{ Name=$Name } } }
function Remove-FitStoreServiceRegistration { param($Name, $WinSW, $Config) $script:registered.Remove($Name) }
function Set-FitStoreServiceStartMode { param($Name, $Mode) }
function Invoke-FitStoreProcess {
  param($FilePath, $Arguments, $FailureMessage)
  if ($Arguments[0] -ne 'install') { throw 'Unexpected operation' }
  $name = [IO.Path]::GetFileNameWithoutExtension($FilePath)
  [xml]$xml = Get-Content -LiteralPath ([IO.Path]::ChangeExtension($FilePath, '.xml')) -Raw
  $account = $xml.SelectSingleNode('/service/serviceaccount/user')
  $script:registered[$name] = if ($account) { 'NT AUTHORITY\LocalService' } else { 'LocalSystem' }
  $script:installs++
  Write-Output 'WinSW registration diagnostic (must not become account identity)'
}
function Get-CimInstance {
  param($ClassName, $Filter)
  if ($ClassName -ne 'Win32_Service') { throw 'Expected actual SCM identity query' }
  $script:queries++
  $name = $Filter.Substring(6, $Filter.Length - 7)
  [pscustomobject]@{ StartName=$script:registered[$name] }
}
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $paths = [pscustomobject]@{ Services=$root; WinSW=(Join-Path $root 'absent.exe') }
  foreach ($name in @('FitStoreAPI','FitStoreWeb')) {
    [IO.File]::WriteAllText((Join-Path $root "$name.exe"), 'fixture, never executed')
    [IO.File]::WriteAllText((Join-Path $root "$name.xml"), '<service><id>fixture</id></service>')
    # Old SYSTEM snapshot, after failed update SCM still registers LocalService.
    $script:registered[$name] = 'NT AUTHORITY\LocalService'
    $identity = Ensure-RestoredApplicationService -Paths $paths -Name $name
    if ($script:registered[$name] -ne 'LocalSystem') { throw "A1: rollback conservó LocalService para $name aunque restauró XML SYSTEM." }
    if ($identity -ne 'LocalSystem') { throw 'A1: no devolvió identidad real de Win32_Service.' }
  }
  if ($script:installs -ne 2 -or $script:queries -ne 2) { throw 'A1: ambos servicios deben reinstalarse y consultar SCM.' }
  Write-Host 'PASS A1: SYSTEM -> LocalService -> fallo -> rollback reinstala ambos servicios SYSTEM.'
  [IO.File]::WriteAllText((Join-Path $root 'FitStoreAPI.xml'), '<service><serviceaccount><user>LocalService</user></serviceaccount></service>')
  $identity = Ensure-RestoredApplicationService -Paths $paths -Name 'FitStoreAPI'
  if ($identity -ne 'NT AUTHORITY\LocalService') { throw 'A1: identidad LocalService restaurada incorrecta.' }
  Write-Host 'PASS A1: devuelve identidad real SCM para decidir ACL, no solo XML.'
  Remove-Item -LiteralPath (Join-Path $root 'FitStoreAPI.xml')
  try { Ensure-RestoredApplicationService -Paths $paths -Name 'FitStoreAPI'; throw 'Expected missing XML rejection' } catch { if ($_.Exception.Message -eq 'Expected missing XML rejection') { throw } }
  if ($script:registered['FitStoreAPI'] -ne 'NT AUTHORITY\LocalService') { throw 'A1: eliminó registro antes de validar artefactos.' }
  Write-Host 'PASS A1: XML faltante rechaza antes de retirar registro existente.'
} finally {
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
}
