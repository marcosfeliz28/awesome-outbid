param(
  [string]$PgBin = $env:PGBIN,
  [int]$Port = 55631
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\scripts\FitStore.Common.ps1')
. (Join-Path $PSScriptRoot '..\scripts\Recover-FitStoreUpdate.ps1') -DefinitionsOnly

if (-not $PgBin) { throw 'PC-18 requiere PostgreSQL real: indique -PgBin o PGBIN.' }
foreach ($tool in @('initdb.exe', 'pg_ctl.exe', 'psql.exe')) {
  if (-not (Test-Path -LiteralPath (Join-Path $PgBin $tool) -PathType Leaf)) {
    throw "PC-18: falta herramienta PostgreSQL real: $tool"
  }
}

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$installSource = Join-Path $repo 'instalador\scripts\Install-FitStore.ps1'
$installText = Get-Content -LiteralPath $installSource -Raw
foreach ($contract in @(
  'CREATE ROLE nexora_tenant_runtime NOLOGIN;',
  'CREATE ROLE nexora_platform_billing NOLOGIN;',
  'ALTER ROLE nexora_tenant_runtime WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;',
  'ALTER ROLE nexora_platform_billing WITH NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;',
  'GRANT nexora_tenant_runtime TO fitstore WITH ADMIN OPTION;'
)) {
  if (-not $installText.Contains($contract)) {
    throw "PC-18: el instalador perdió el contrato de roles: $contract"
  }
}

$root = Join-Path ([IO.Path]::GetTempPath()) ('nexora-pc18-pg-' + [guid]::NewGuid().ToString('N'))
$cluster = Join-Path $root 'data'
$log = Join-Path $root 'postgres.log'
$psql = Join-Path $PgBin 'psql.exe'
$pgCtl = Join-Path $PgBin 'pg_ctl.exe'
$started = $false
$previousDatabaseUrl = $env:DATABASE_URL

function Invoke-Psql {
  param(
    [Parameter(Mandatory = $true)][string]$Database,
    [Parameter(Mandatory = $true)][string]$User,
    [Parameter(Mandatory = $true)][string]$Sql,
    [switch]$TuplesOnly
  )
  $arguments = @('-h', '127.0.0.1', '-p', [string]$Port, '-U', $User, '-d', $Database, '-v', 'ON_ERROR_STOP=1')
  if ($TuplesOnly) { $arguments += @('-t', '-A') }
  $output = & $psql @arguments -c $Sql 2>&1
  if ($LASTEXITCODE -ne 0) { throw "PC-18 SQL falló: $($output -join [Environment]::NewLine)" }
  return @($output)
}

try {
  New-Item -ItemType Directory -Path $root -Force | Out-Null
  & (Join-Path $PgBin 'initdb.exe') -D $cluster -U postgres -A trust --encoding=UTF8 --no-locale | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'PC-18: initdb no pudo crear el clúster desechable.' }

  Invoke-FitStoreRecoveryPgCtl `
    -Tool $pgCtl `
    -Database $cluster `
    -Arguments @('-D', $cluster, '-l', $log, '-o', "-p $Port -h 127.0.0.1", '-w', 'start')
  $started = $true
  Write-Host 'PC-18: PostgreSQL desechable iniciado.'

  # Reproduce el bootstrap privilegiado del instalador antes de entregar la
  # conexión a la aplicación. La aplicación queda deliberadamente sin
  # CREATEROLE; sólo recibe ADMIN OPTION sobre su rol de tenant.
  Invoke-Psql -Database postgres -User postgres -Sql @'
CREATE ROLE fitstore LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE nexora_tenant_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE nexora_platform_billing NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
GRANT nexora_tenant_runtime TO fitstore WITH ADMIN OPTION;
'@ | Out-Null
  Write-Host 'PC-18: roles internos precreados.'
  Invoke-Psql -Database postgres -User postgres -Sql 'CREATE DATABASE fitstore OWNER fitstore;' | Out-Null
  Write-Host 'PC-18: base desechable creada.'

  $before = (@(Invoke-Psql -Database postgres -User postgres -TuplesOnly -Sql "SELECT rolsuper::text || '|' || rolcreaterole::text || '|' || rolcreatedb::text FROM pg_roles WHERE rolname='fitstore';")[-1]).Trim()
  if ($before -ne 'false|false|false') { throw "PC-18: el usuario de app nació privilegiado: $before" }

  $env:DATABASE_URL = "postgresql://fitstore@127.0.0.1:$Port/fitstore?schema=public"
  Write-Host 'PC-18: ejecutando prisma migrate deploy sin CREATEROLE.'
  Push-Location $repo
  try {
    & pnpm.cmd --filter '@fitstore/api' db:migrate
    if ($LASTEXITCODE -ne 0) { throw "PC-18: prisma migrate deploy falló con código $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  $after = (Invoke-Psql -Database postgres -User postgres -TuplesOnly -Sql "SELECT rolname || '|' || rolcanlogin::text || '|' || rolsuper::text || '|' || rolcreaterole::text || '|' || rolcreatedb::text || '|' || rolreplication::text || '|' || rolbypassrls::text FROM pg_roles WHERE rolname IN ('nexora_tenant_runtime','nexora_platform_billing') ORDER BY rolname;") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
  $expected = @(
    'nexora_platform_billing|false|false|false|false|false|false',
    'nexora_tenant_runtime|false|false|false|false|false|false'
  )
  if (($after -join "`n") -ne ($expected -join "`n")) {
    throw "PC-18: roles internos inesperados. Esperado=$($expected -join ',') Real=$($after -join ',')"
  }

  $membership = (@(Invoke-Psql -Database postgres -User postgres -TuplesOnly -Sql @'
SELECT pg_has_role('fitstore', 'nexora_tenant_runtime', 'MEMBER')::text || '|' ||
       pg_has_role('fitstore', 'nexora_platform_billing', 'MEMBER')::text || '|' ||
       r.admin_option::text
FROM pg_auth_members r
JOIN pg_roles member_role ON member_role.oid = r.member
JOIN pg_roles granted_role ON granted_role.oid = r.roleid
WHERE member_role.rolname = 'fitstore' AND granted_role.rolname = 'nexora_tenant_runtime';
'@)[-1]).Trim()
  # PostgreSQL retira ADMIN OPTION cuando la propia migración repite el GRANT
  # sin esa opción. Es el estado final más restrictivo y esperado.
  if ($membership -ne 'true|false|false') {
    throw "PC-18: membresías internas inesperadas: $membership"
  }

  $afterApp = (@(Invoke-Psql -Database postgres -User postgres -TuplesOnly -Sql "SELECT rolsuper::text || '|' || rolcreaterole::text || '|' || rolcreatedb::text FROM pg_roles WHERE rolname='fitstore';")[-1]).Trim()
  if ($afterApp -ne 'false|false|false') { throw "PC-18: la migración elevó al usuario de app: $afterApp" }

  $migrationCount = [int](@(Invoke-Psql -Database fitstore -User fitstore -TuplesOnly -Sql 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;')[-1]).Trim()
  if ($migrationCount -lt 1) { throw 'PC-18: Prisma no registró migraciones aplicadas.' }

  Write-Host "PC-18 OK: $migrationCount migraciones reales; app sin CREATEROLE; roles internos endurecidos."
} finally {
  $env:DATABASE_URL = $previousDatabaseUrl
  if ($started -and (Test-Path -LiteralPath (Join-Path $cluster 'postmaster.pid'))) {
    Invoke-FitStoreRecoveryPgCtl `
      -Tool $pgCtl `
      -Database $cluster `
      -Arguments @('-D', $cluster, '-m', 'fast', '-w', 'stop')
  }
  Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
