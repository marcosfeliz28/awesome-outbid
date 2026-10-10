param([string]$BuildScript = (Join-Path $PSScriptRoot '..\build.ps1'))
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$tokens = $null; $errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($BuildScript, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'El build no analiza.' }
foreach ($name in @('Invoke-Checked','Get-Sha256','Deploy-LockedApi')) {
  $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  if (-not $definition) { throw 'El build usa deploy legacy/hoisted sin garantizar el lock verificado.' }
  Invoke-Expression $definition.Extent.Text
}
$root = Join-Path $env:TEMP ('nexora-locked-deploy-test-' + [guid]::NewGuid().ToString('N'))
$hash = Get-Sha256 -Path (Join-Path $repo 'pnpm-lock.yaml')
try {
  # CI llega aqui despues de install frozen normal. La fixture no cambia el
  # workspace ni vuelve a resolver dependencias: llama al despliegue real.
  Deploy-LockedApi -RepositoryRoot $repo -Destination $root -VerifiedLockHash $hash
  $probe = "const fs=require('node:fs');const p=process.argv[1];const yaml=require(p+'/node_modules/js-yaml');const source=yaml.load(fs.readFileSync(process.argv[3],'utf8'),{schema:yaml.JSON_SCHEMA});const dev=source.importers['apps/api'].devDependencies;const prisma=require(p+'/node_modules/prisma/package.json').version;const client=require(p+'/node_modules/@prisma/client/package.json').version;const tsx=require(p+'/node_modules/tsx/package.json').version;if(prisma!=='6.19.0'||client!==prisma||prisma!==dev.prisma.version.split('(')[0]||tsx!==dev.tsx.version.split('(')[0])throw new Error('Prisma CLI/client o tsx no coincide con el lock fuente');console.log('PASS runtime bloqueado: Prisma '+prisma+', tsx '+tsx);"
  $probePath = Join-Path $root 'probe.cjs'
  [IO.File]::WriteAllText($probePath, $probe.Replace('process.argv[1]', 'process.argv[2]'))
  & node $probePath $root (Join-Path $repo 'pnpm-lock.yaml')
  if ($LASTEXITCODE -ne 0) { throw 'No se conservaron las herramientas de bootstrap y migraciones.' }
  $tamperProbe = @'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const {pathToFileURL} = require('node:url');
const [payload, sourcePath, auditor] = process.argv.slice(2);
const yaml = require(payload + '/node_modules/js-yaml');
const source = yaml.load(fs.readFileSync(sourcePath, 'utf8'), {schema: yaml.JSON_SCHEMA});
const deployed = yaml.load(fs.readFileSync(payload + '/pnpm-lock.yaml', 'utf8'), {schema: yaml.JSON_SCHEMA});
import(pathToFileURL(auditor).href).then(({verifyDeployLock}) => {
  const registry = Object.keys(deployed.packages).find(name => deployed.packages[name].resolution.integrity);
  const changed = structuredClone(deployed);
  changed.packages[registry].resolution.integrity = 'sha512-ficticia-alterada';
  assert.throws(() => verifyDeployLock(source, changed, require('node:path').dirname(sourcePath), payload), /nuevo o alterado/);
  const added = structuredClone(deployed);
  added.packages['ficticio-no-autorizado@99.0.0'] = structuredClone(deployed.packages[registry]);
  assert.throws(() => verifyDeployLock(source, added, require('node:path').dirname(sourcePath), payload), /nuevo o alterado/);
  console.log('PASS auditor real: lock completo desplegado rechaza integridad alterada y paquete externo nuevo.');
}).catch(error => { console.error(error.message); process.exitCode = 1; });
'@
  $tamperPath = Join-Path $root 'tamper-probe.cjs'
  [IO.File]::WriteAllText($tamperPath, $tamperProbe)
  & node $tamperPath $root (Join-Path $repo 'pnpm-lock.yaml') (Join-Path $repo 'instalador\tools\verify-deploy-lock.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'El auditor no detecta cambios en el lock dedicado real.' }
  if ((Get-Sha256 -Path (Join-Path $repo 'pnpm-lock.yaml')) -ne $hash) { throw 'Cambio el lock fuente.' }
  Write-Host 'PASS deploy real offline, lock dedicado equivalente e integridades auditadas; fuente inmutable.'
} finally {
  if ([IO.Directory]::Exists($root)) { [IO.Directory]::Delete($root, $true) }
}
