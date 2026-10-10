param([string]$BuildScript = (Join-Path $PSScriptRoot '..\build.ps1'),
  [string]$DependenciesRoot = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = Join-Path $env:TEMP ('nexora-payload-privacy-' + [guid]::NewGuid().ToString('N'))
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($BuildScript, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'El build no analiza correctamente.' }
$definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Protect-ApiPayload' }, $true)
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
  $api = Join-Path $root 'payload\app\api'
  New-Item -ItemType Directory -Path (Join-Path $api 'scripts') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $repo 'apps\api\scripts\create-admin.ts') -Destination (Join-Path $api 'scripts\create-admin.ts')
  Write-ApiRuntimeTsConfig -RepositoryRoot $repo -ApiPayload $api
  $config = Get-Content -LiteralPath (Join-Path $api 'tsconfig.json') -Raw | ConvertFrom-Json
  if ($config.PSObject.Properties.Name -contains 'extends') { throw 'El bootstrap depende todavia de un tsconfig externo.' }
  if (-not $config.compilerOptions.esModuleInterop -or $config.compilerOptions.module -ne 'commonjs') { throw 'No se conservaron las opciones de compilacion del bootstrap.' }
  $link = Join-Path $api 'node_modules'
  New-Item -ItemType Junction -Path $link -Target (Join-Path $DependenciesRoot 'apps\api\node_modules') | Out-Null
  $saved = @{}
  try {
    foreach ($name in @('DATABASE_URL','ADMIN_EMAIL','ADMIN_PASSWORD','ADMIN_PIN','ADMIN_NAME','ADMIN_MODE')) { $saved[$name] = [Environment]::GetEnvironmentVariable($name) }
    $env:DATABASE_URL = 'postgresql://127.0.0.1:9/fixture_no_connection'
    $env:ADMIN_EMAIL = 'invalid-email'; $env:ADMIN_PASSWORD = ''; $env:ADMIN_PIN = ''; $env:ADMIN_NAME = ''; $env:ADMIN_MODE = 'bootstrap'
    $process = [Diagnostics.Process]::new()
    $process.StartInfo.FileName = (Get-Command node).Source
    $cli = [IO.Path]::GetFullPath((Join-Path $DependenciesRoot 'apps\api\node_modules\tsx\dist\cli.mjs'))
    $process.StartInfo.Arguments = '"' + $cli + '" "' + (Join-Path $api 'scripts\create-admin.ts') + '"'
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true
    $process.StartInfo.RedirectStandardOutput = $true
    $process.StartInfo.RedirectStandardError = $true
    try {
      $process.Start() | Out-Null
      $output = $process.StandardOutput.ReadToEnd() + $process.StandardError.ReadToEnd()
      $process.WaitForExit()
      if ($process.ExitCode -eq 0 -or $output -notmatch 'invalid_string|invalid_format' -or $output -match 'Cannot find|MODULE_NOT_FOUND|ECONNREFUSED|P1001') { throw 'El bootstrap real no llego a validar entradas antes de consultar la base.' }
    } finally { $process.Dispose() }
    Write-Host 'PASS: tsx y create-admin.ts reales validan entradas con tsconfig portable; sin conexion a base.'
  } finally {
    foreach ($name in $saved.Keys) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
    if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link) }
  }
  Write-Host 'PASS: filtro real del build elimina datos/secretos ficticios y conserva Prisma, tsx, migraciones y bootstrap.'
} finally {
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
