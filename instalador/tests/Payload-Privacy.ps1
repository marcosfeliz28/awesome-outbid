param([string]$BuildScript = (Join-Path $PSScriptRoot '..\build.ps1'),
  [string]$DependenciesRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
  [switch]$InjectMissingBootstrapCli)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:TEMP ('nexora-payload-privacy-' + [guid]::NewGuid().ToString('N'))
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($BuildScript, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'El build no analiza correctamente.' }
$definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Protect-ApiPayload' }, $true)
function Invoke-FixtureNode {
  param([string]$Directory, [string]$Arguments)
  $process = [Diagnostics.Process]::new()
  $process.StartInfo.FileName = (Get-Command node).Source
  $process.StartInfo.WorkingDirectory = $Directory
  $process.StartInfo.Arguments = $Arguments
  $process.StartInfo.UseShellExecute = $false
  $process.StartInfo.CreateNoWindow = $true
  $process.StartInfo.RedirectStandardOutput = $true
  $process.StartInfo.RedirectStandardError = $true
  # No se heredan credenciales ni rutas de resolucion externas del workspace.
  $process.StartInfo.EnvironmentVariables.Clear()
  foreach ($name in @('SystemRoot','WINDIR','PATH','PATHEXT','TEMP','TMP')) {
    $value = [Environment]::GetEnvironmentVariable($name)
    if ($value) { $process.StartInfo.EnvironmentVariables[$name] = $value }
  }
  foreach ($entry in @{DATABASE_URL='postgresql://127.0.0.1:9/fixture_no_connection';ADMIN_EMAIL='invalid-email';ADMIN_PASSWORD='';ADMIN_PIN='';ADMIN_NAME='';ADMIN_MODE='bootstrap'}.GetEnumerator()) {
    $process.StartInfo.EnvironmentVariables[$entry.Key] = $entry.Value
  }
  try {
    $process.Start() | Out-Null
    $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return [pscustomobject]@{ ExitCode = $process.ExitCode; Output = $output }
  } finally { $process.Dispose() }
}
function Assert-FixtureBootstrap {
  param($Result)
  $output = $Result.Output
  if ($Result.ExitCode -eq 0 -or $output -notmatch 'invalid_string|invalid_format' -or $output -match 'Cannot find|MODULE_NOT_FOUND|ECONNREFUSED|P1001|BOOTSTRAP_FIXTURE_EXTERNAL' -or $output -notmatch 'PASS fixture: proceso Node real usa cwd API') {
    # El hijo solo recibio entradas ficticias y entorno minimo; aun asi, las
    # URLs con usuario/clave se censuran y la salida se acota antes de mostrarla.
    $safeOutput = $output -replace 'postgres(?:ql)?://[^/@\s]+@', 'postgresql://[REDACTADO]@'
    Write-Host ('BOOTSTRAP_FIXTURE_EXIT=' + $Result.ExitCode)
    Write-Host ($safeOutput.Substring(0, [Math]::Min(8192, $safeOutput.Length)))
    throw 'El bootstrap real no llego a validar entradas antes de consultar la base.'
  }
}
try {
  New-Item -ItemType Directory -Path $root | Out-Null
  $keep = @('package.json', 'tsconfig.json', 'prisma.config.ts', 'dist/main.js', 'scripts/create-admin.ts', 'prisma/schema.prisma', 'prisma/migrations/migration_lock.toml', 'prisma/migrations/202610010001_example/migration.sql', 'node_modules/prisma/build/index.js', 'node_modules/.prisma/client/query_engine-windows.dll.node', 'node_modules/.bin/tsx.cmd')
  $remove = @('revision-inventario.csv', '.env', '.env.production', 'secrets.json', 'src/main.ts', 'scripts/import-inventario.ts', 'prisma/seed.ts', 'prisma/backup.sql', 'dist/.env', 'dist/secrets.json', 'dist/export.xlsx', 'node_modules/example/private.key', 'node_modules/example/.npmrc', 'node_modules/example/customer.csv', 'certificate.pfx', 'backup.dump')
  foreach ($relative in @($keep + $remove)) {
    $file = Join-Path $root $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $file) -Force | Out-Null
    [IO.File]::WriteAllText($file, 'fixture ficticia, sin datos reales')
  }
  [IO.File]::WriteAllText((Join-Path $root 'package.json'), '{"name":"nexora-payload-fixture","version":"0.0.0"}')
  # La lista real de npm-packlist prueba que el CSV ficticio llegaria por
  # pnpm deploy. Solo se leen archivos de esta fixture descartable.
  $packProbe = 'const path=require("node:path");const base=path.join(path.dirname(process.execPath),"node_modules/npm/node_modules");const Arborist=require(path.join(base,"@npmcli/arborist"));const packlist=require(path.join(base,"npm-packlist"));(async()=>{const tree=await new Arborist({path:process.argv[1]}).loadActual();const files=await packlist(tree);if(!files.includes("revision-inventario.csv"))throw new Error("La fixture no reproduce la inclusion del CSV");console.log("PASS npm-packlist real: CSV ficticio incluido antes del filtro");})().catch(e=>{console.error(e.message);process.exit(1)})'
  $probePath = Join-Path $root 'pack-probe.cjs'
  [IO.File]::WriteAllText($probePath, $packProbe.Replace('process.argv[1]', 'process.argv[2]'))
  & node $probePath $root
  if ($LASTEXITCODE -ne 0) { throw 'Fallo la reproduccion real de npm-packlist.' }
  if (-not $definition) { throw 'El build no filtra datos y secretos del payload API: CSV ficticio incluido.' }
  $call = $ast.Find({ param($node) $node -is [Management.Automation.Language.CommandAst] -and $node.GetCommandName() -eq 'Protect-ApiPayload' }, $true)
  if (-not $call) { throw 'El filtro no esta conectado al build real.' }
  Invoke-Expression $definition.Extent.Text
  Protect-ApiPayload -Path $root
  foreach ($relative in $keep) { if (-not (Test-Path -LiteralPath (Join-Path $root $relative) -PathType Leaf)) { throw "Falta runtime necesario: $relative" } }
  foreach ($relative in $remove) { if (Test-Path -LiteralPath (Join-Path $root $relative)) { throw "Se empaquetaria un archivo no permitido: $relative" } }
  # Segunda pasada: idempotencia real, sin modificar los archivos necesarios.
  Protect-ApiPayload -Path $root
  $configDefinition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Write-ApiRuntimeTsConfig' }, $true)
  if (-not $configDefinition) { throw 'Falta el tsconfig portable para el bootstrap.' }
  Invoke-Expression $configDefinition.Extent.Text
  $repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  foreach ($name in @('Invoke-Checked','Get-Sha256','Deploy-LockedApi')) {
    $deployDefinition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
    if (-not $deployDefinition) { throw "Falta funcion real del build: $name" }
    Invoke-Expression $deployDefinition.Extent.Text
  }
  $api = Join-Path $root 'runtimeApi'
  # La copia es propia y real; nunca se enlaza node_modules del workspace.
  $lockHash = Get-Sha256 -Path (Join-Path $DependenciesRoot 'pnpm-lock.yaml')
  Deploy-LockedApi -RepositoryRoot $DependenciesRoot -Destination $api -VerifiedLockHash $lockHash
  Protect-ApiPayload -Path $api
  Write-ApiRuntimeTsConfig -RepositoryRoot $repo -ApiPayload $api
  $config = Get-Content -LiteralPath (Join-Path $api 'tsconfig.json') -Raw | ConvertFrom-Json
  if ($config.PSObject.Properties.Name -contains 'extends') { throw 'El bootstrap depende todavia de un tsconfig externo.' }
  if (-not $config.compilerOptions.esModuleInterop -or $config.compilerOptions.module -ne 'commonjs') { throw 'No se conservaron las opciones de compilacion del bootstrap.' }
  $generated = Invoke-FixtureNode -Directory $api -Arguments ('"' + (Join-Path $api 'node_modules\prisma\build\index.js') + '" generate --schema="prisma/schema.prisma"')
  if ($generated.ExitCode -ne 0) { throw ('No se genero Prisma Client real dentro de la fixture: ' + $generated.Output) }
  $cwdProbe = Join-Path $api 'cwd-probe.cjs'
  [IO.File]::WriteAllText($cwdProbe, @'
const fs = require('node:fs');
const path = require('node:path');
if (fs.realpathSync(process.cwd()) !== fs.realpathSync(__dirname)) throw new Error('BOOTSTRAP_FIXTURE_WRONG_CWD');
const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'tsconfig.json'), 'utf8'));
if (config.extends || config.compilerOptions.module !== 'commonjs' || !config.compilerOptions.esModuleInterop) throw new Error('BOOTSTRAP_FIXTURE_WRONG_CONFIG');
const prefix = fs.realpathSync(__dirname).toLowerCase() + path.sep;
process.on('exit', () => {
  for (const name of Object.keys(require.cache)) {
    if (!fs.realpathSync(name).toLowerCase().startsWith(prefix)) throw new Error('BOOTSTRAP_FIXTURE_EXTERNAL_TRANSITIVE_DEPENDENCY');
  }
});
console.log('PASS fixture: proceso Node real usa cwd API y tsconfig del payload.');
'@, [Text.UTF8Encoding]::new($false))
  $cli = Join-Path $api 'node_modules\tsx\dist\cli.mjs'
  $bootstrapArguments = '--require "' + $cwdProbe + '" "' + $cli + '" "' + (Join-Path $api 'scripts\create-admin.ts') + '"'
  $dotenv = Join-Path $api 'node_modules\dotenv'
  $heldDotenv = Join-Path $root 'dotenv-held'
  # Solo la entrada de una dependencia en nuestra copia TEMP se aparta.
  # Misma CLI, mismo bootstrap y mismo entorno: reproduce el error de CI.
  Move-Item -LiteralPath $dotenv -Destination $heldDotenv
  try {
    $missing = Invoke-FixtureNode -Directory $api -Arguments $bootstrapArguments
    if ($missing.ExitCode -eq 0 -or $missing.Output -notmatch "Cannot find module 'dotenv'" -or $missing.Output -notmatch 'MODULE_NOT_FOUND' -or $missing.Output -notmatch 'create-admin.ts') { throw 'La fixture no reproduce el fallo real de resolucion dotenv.' }
    Write-Host "ANTES: bootstrap real rechaza Cannot find module 'dotenv' / MODULE_NOT_FOUND."
  } finally { Move-Item -LiteralPath $heldDotenv -Destination $dotenv }
  $originsProbe = Join-Path $api 'origins-probe.cjs'
  [IO.File]::WriteAllText($originsProbe, @'
const fs = require('node:fs');
const path = require('node:path');
if (process.env.NODE_PATH || process.env.NODE_OPTIONS) throw new Error('BOOTSTRAP_FIXTURE_EXTERNAL_ENVIRONMENT');
const prefix = fs.realpathSync(__dirname).toLowerCase() + path.sep;
for (const name of ['dotenv', 'tsx/package.json', 'prisma/package.json', '@prisma/client', 'zod', 'bcryptjs', '@fitstore/shared']) {
  if (!fs.realpathSync(require.resolve(name)).toLowerCase().startsWith(prefix)) throw new Error('BOOTSTRAP_FIXTURE_EXTERNAL_DEPENDENCY: ' + name);
}
console.log('PASS origins: dotenv, tsx, Prisma, zod, bcrypt y Shared resuelven dentro de TEMP.');
'@, [Text.UTF8Encoding]::new($false))
  $origins = Invoke-FixtureNode -Directory $api -Arguments ('"' + $originsProbe + '"')
  if ($origins.ExitCode -ne 0 -or $origins.Output -notmatch 'PASS origins:') { throw ('La fixture depende de modulos externos: ' + $origins.Output) }
  Write-Host $origins.Output.Trim()
  # CLI faltante: conserva la regresion del diagnostico, sin volver a
  # desplegar ni crear junctions hacia dependencias externas.
  $missingCli = Invoke-FixtureNode -Directory $api -Arguments ('--require "' + $cwdProbe + '" "' + (Join-Path $api 'missing-fixture-cli.mjs') + '"')
  $diagnosticOutput = @(& {
    try { Assert-FixtureBootstrap -Result $missingCli }
    catch { Write-Output $_.Exception.Message }
  } 6>&1) -join "`n"
  if ($missingCli.ExitCode -eq 0 -or $diagnosticOutput -notmatch 'BOOTSTRAP_FIXTURE_EXIT=1' -or $diagnosticOutput -notmatch 'MODULE_NOT_FOUND' -or $diagnosticOutput -notmatch 'missing-fixture-cli' -or $diagnosticOutput -notmatch 'El bootstrap real no llego a validar entradas') { throw 'El fallo real de Node no conserva el rechazo y diagnostico del bootstrap.' }
  Write-Host 'PASS diagnostico: CLI inexistente falla en Node real, conserva exitcode, causa y rechazo original.'
  if ($InjectMissingBootstrapCli) { Assert-FixtureBootstrap -Result $missingCli }
  $positive = Invoke-FixtureNode -Directory $api -Arguments $bootstrapArguments
  Assert-FixtureBootstrap -Result $positive
  if ((Get-Sha256 -Path (Join-Path $DependenciesRoot 'pnpm-lock.yaml')) -ne $lockHash) { throw 'El lock fuente cambio durante la fixture.' }
  Write-Host 'PASS fixture: proceso Node real usa cwd API y tsconfig del payload.'
  Write-Host 'PASS transitive: todos los modulos CJS cargados por el bootstrap real quedan dentro de TEMP.'
  Write-Host 'PASS: tsx y create-admin.ts reales validan entradas con tsconfig portable; sin conexion a base.'
  Write-Host 'PASS: filtro real del build elimina datos/secretos ficticios y conserva Prisma, tsx, migraciones y bootstrap.'
} finally {
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
