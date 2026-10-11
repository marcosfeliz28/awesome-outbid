Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\FitStore.Common.ps1')
$source = Join-Path (Split-Path -Parent $PSScriptRoot) 'scripts\Uninstall-FitStore.ps1'
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'B10: desinstalador con errores de sintaxis.' }
foreach ($name in @('Assert-UninstallPlainPath', 'Assert-UninstallDataBoundary', 'Test-UninstallBackupSet', 'Get-UninstallBackupPlan', 'Save-UninstallBackups')) {
  $fn = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  if (-not $fn) { throw "B10: falta funcion real $name; los respaldos retenidos se borran." }
  . ([scriptblock]::Create($fn.Extent.Text))
}
$root = Join-Path ([IO.Path]::GetTempPath()) ('nexora-b10-fixture-' + [guid]::NewGuid().ToString('N'))
$reader = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$admin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if ($env:CI -and -not $admin) { throw 'B10: CI debe ejecutar copia positiva con administrador real.' }
function Expect-Rejection([scriptblock]$Action, [string]$Label) {
  $rejected = $false
  try { & $Action | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw "B10: no rechazo $Label." }
}
function Write-FixtureBackup([string]$Path, [string]$Content) {
  [IO.Directory]::CreateDirectory((Split-Path -Parent $Path)) | Out-Null
  [IO.File]::WriteAllText($Path, $Content)
  $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText(($Path + '.sha256'), "$hash *$([IO.Path]::GetFileName($Path))")
  [IO.File]::WriteAllText(($Path + '.json'), (@{schemaVersion=1; file=[IO.Path]::GetFileName($Path); sha256=$hash} | ConvertTo-Json))
}
function Check-Private([string]$Path) {
  $acl = Get-Acl -LiteralPath $Path
  if (-not $acl.AreAccessRulesProtected) { throw 'B10: destino hereda permisos.' }
  foreach ($rule in $acl.Access) {
    $sid = $rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value
    if ($sid -notin @('S-1-5-18','S-1-5-32-544',$reader)) { throw "B10: acceso ajeno $sid." }
    if ($sid -eq $reader -and ($rule.FileSystemRights -band [Security.AccessControl.FileSystemRights]::Write)) { throw 'B10: lector puede escribir.' }
  }
}
try {
  [IO.Directory]::CreateDirectory($root) | Out-Null
  $data = Join-Path $root 'FitStore POS'
  $backups = Join-Path $data 'Backups'
  $old = Join-Path $backups 'FitStore_old.dump'
  $final = Join-Path $backups 'FitStore_final.dump'
  Write-FixtureBackup $old 'retained-original'
  Write-FixtureBackup $final 'final-original'
  [IO.File]::WriteAllText((Join-Path $backups 'retained-note.txt'), 'keep-every-file')
  $paths = [pscustomobject]@{Data=$data; LocalBackups=$backups}
  Assert-UninstallDataBoundary -Data $data -ProgramDataRoot $root | Out-Null
  Expect-Rejection { Assert-UninstallDataBoundary -Data ($data + '-other') -ProgramDataRoot $root } 'confusion por prefijo'
  Expect-Rejection { Assert-UninstallDataBoundary -Data $root -ProgramDataRoot $root } 'raiz amplia'
  $plan = @(Get-UninstallBackupPlan -Paths $paths -LastBackup $final -ProgramDataRoot $root)
  if ($plan.Count -ne 7) { throw 'B10: no conserva todos los archivos retenidos y companions.' }
  [IO.File]::WriteAllText(($final + '.sha256'), ('0' * 64) + ' *FitStore_final.dump')
  Expect-Rejection { Get-UninstallBackupPlan -Paths $paths -LastBackup $final -ProgramDataRoot $root } 'SHA incorrecto'
  Write-FixtureBackup $final 'final-original'
  Remove-Item -LiteralPath ($final + '.json')
  Expect-Rejection { Get-UninstallBackupPlan -Paths $paths -LastBackup $final -ProgramDataRoot $root } 'manifest ausente'
  Write-FixtureBackup $final 'final-original'
  $linked = Join-Path $data 'junction'
  $outside = Join-Path $root 'outside'
  [IO.Directory]::CreateDirectory($outside) | Out-Null
  New-Item -ItemType Junction -Path $linked -Target $outside | Out-Null
  try { Expect-Rejection { Assert-UninstallDataBoundary -Data $data -ProgramDataRoot $root } 'junction dentro de datos' }
  finally { [IO.Directory]::Delete($linked) }
  $savedLink = Join-Path $root 'Nexora POS - respaldos conservados'
  New-Item -ItemType Junction -Path $savedLink -Target $outside | Out-Null
  try { Expect-Rejection { Save-UninstallBackups -Paths $paths -LastBackup $final -ProgramDataRoot $root -ReaderSid $reader } 'junction en destino conservado' }
  finally { [IO.Directory]::Delete($savedLink) }
  $sibling = Join-Path $root 'FitStore POS-other'
  $external = Join-Path $sibling 'FitStore_external.dump'
  Write-FixtureBackup $external 'external-final'
  $externalPlan = @(Get-UninstallBackupPlan -Paths $paths -LastBackup $external -ProgramDataRoot $root)
  if ($externalPlan.Count -ne 10) { throw 'B10: confunde respaldo externo con prefijo de Data.' }
  if ($admin) {
    $saved = Save-UninstallBackups -Paths $paths -LastBackup $external -ProgramDataRoot $root -ReaderSid $reader
    if ($saved.StartsWith(($data + '\'), [StringComparison]::OrdinalIgnoreCase)) { throw 'B10: destino sigue dentro de datos.' }
    Check-Private $saved
    foreach ($entry in Get-ChildItem -LiteralPath $saved -File -Recurse) { Check-Private $entry.FullName }
    if ([IO.File]::ReadAllText((Join-Path $saved 'retenidos\FitStore_old.dump')) -ne 'retained-original') { throw 'B10: copia retenida perdida.' }
    if ([IO.File]::ReadAllText((Join-Path $saved 'final\FitStore_external.dump')) -ne 'external-final') { throw 'B10: respaldo final perdido.' }
    Test-UninstallBackupSet -Dump (Join-Path $saved 'retenidos\FitStore_old.dump')
    Test-UninstallBackupSet -Dump (Join-Path $saved 'final\FitStore_external.dump')
    # Fallo real al abrir un archivo: el origen sigue integro y el llamador recibe excepcion.
    $locked = Join-Path $backups 'z-locked.bin'
    $handle = [IO.File]::Open($locked, [IO.FileMode]::Create, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    try { Expect-Rejection { Save-UninstallBackups -Paths $paths -LastBackup $final -ProgramDataRoot $root -ReaderSid $reader } 'copia que falla' }
    finally { $handle.Dispose() }
    Write-Host 'PASS B10: copia real completa privada, SHA/manifest verificados y fallo de copia aborta.'
  } else {
    Expect-Rejection { Save-UninstallBackups -Paths $paths -LastBackup $final -ProgramDataRoot $root -ReaderSid $reader } 'escritura sin elevacion'
    Write-Host 'PASS B10: validacion real SHA/manifest/rutas/junction; copia privada rechaza token no administrador. CI verifica copia positiva.'
  }
  if ([IO.File]::ReadAllText($old) -ne 'retained-original' -or [IO.File]::ReadAllText($final) -ne 'final-original') { throw 'B10: origen modificado o borrado.' }
  $text = [IO.File]::ReadAllText($source)
  $savePosition = $text.IndexOf('$preservedBackups = Save-UninstallBackups')
  if ($savePosition -lt 0 -or $savePosition -gt $text.IndexOf('Remove-FitStoreServiceRegistration -Name')) { throw 'B10: retira servicios antes de conservar copias.' }
  if ($text -notmatch 'Respaldos conservados fuera de la base:') { throw 'B10: no informa destino final.' }
  Write-Host 'PASS B10: origen intacto y copia obligatoria anterior a retirar servicios/borrar Data.'
} finally {
  if ([IO.Directory]::Exists($root)) {
    # Solo el arbol GUID de esta fixture; nunca un destino real del instalador.
    foreach ($entry in @(Get-ChildItem -LiteralPath $root -Recurse -Force)) {
      $acl = if ($entry.PSIsContainer) { [IO.Directory]::GetAccessControl($entry.FullName, [Security.AccessControl.AccessControlSections]::Access) } else { [IO.File]::GetAccessControl($entry.FullName, [Security.AccessControl.AccessControlSections]::Access) }
      $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), 'FullControl', 'Allow'))
      if ($entry.PSIsContainer) { [IO.Directory]::SetAccessControl($entry.FullName, $acl) } else { [IO.File]::SetAccessControl($entry.FullName, $acl) }
    }
    $acl = [IO.Directory]::GetAccessControl($root, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new($reader), 'FullControl', 'ContainerInherit, ObjectInherit', 'None', 'Allow'))
    [IO.Directory]::SetAccessControl($root, $acl)
    Remove-Item -LiteralPath $root -Recurse -Force
  }
}
