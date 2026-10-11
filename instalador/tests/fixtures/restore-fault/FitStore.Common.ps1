Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:PostgresService = "FitStorePostgreSQL"
$script:ApiService = "FitStoreAPI"
$script:WebService = "FitStoreWeb"
$script:FixtureScripts = $PSScriptRoot

function Add-FixtureEvent {
  param([Parameter(Mandatory = $true)][string]$Event)
  [IO.File]::AppendAllText(
    $env:FITSTORE_RESTORE_FIXTURE_LOG,
    $Event + [Environment]::NewLine,
    [Text.UTF8Encoding]::new($false)
  )
}

function Assert-FitStoreAdministrator {}

function Get-FitStorePaths {
  param([string]$InstallDir)
  $root = $env:FITSTORE_RESTORE_FIXTURE_ROOT
  [pscustomobject]@{
    Install = Join-Path $root "install"
    Data = Join-Path $root "data"
    State = Join-Path $root "data\state.json"
    Secrets = Join-Path $root "data\secrets.json"
    Logs = Join-Path $root "logs"
    Work = Join-Path $root "work"
    Database = Join-Path $root "active-database"
    PgBin = Join-Path $root "mock-pg-bin"
    Scripts = $script:FixtureScripts
  }
}

function Read-FitStoreJson {
  param([Parameter(Mandatory = $true)][string]$Path)
  return [pscustomobject]@{
    postgresPassword = [Guid]::Empty.ToString()
    databasePassword = [Guid]::Empty.ToString()
  }
}

function New-FitStoreDirectory {
  param([Parameter(Mandatory = $true)][string]$Path)
  [IO.Directory]::CreateDirectory($Path) | Out-Null
}

function Stop-FitStoreApplication { Add-FixtureEvent -Event "stop-application" }

function Start-FitStoreApplication { Add-FixtureEvent -Event "start-application" }

function Start-FitStoreService {
  param([Parameter(Mandatory = $true)][string]$Name, [int]$TimeoutSeconds = 60)
  Add-FixtureEvent -Event "start-service:$Name"
}

function Wait-FitStorePostgres {
  param([Parameter(Mandatory = $true)]$Paths, [int]$TimeoutSeconds = 90)
  Add-FixtureEvent -Event "wait-postgres"
}

function Wait-FitStoreHttp {
  param([Parameter(Mandatory = $true)][string]$Url, [int]$TimeoutSeconds = 90)
  Add-FixtureEvent -Event "health:$Url"
}

function Write-FitStoreLog {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [string]$InstallDir,
    [ValidateSet("INFO", "AVISO", "ERROR")][string]$Level = "INFO"
  )
  Add-FixtureEvent -Event "log-${Level}:$Message"
}

function Invoke-FitStoreMigrations {
  param(
    [Parameter(Mandatory = $true)]$Paths,
    [Parameter(Mandatory = $true)]$Secrets,
    [string]$Database = "fitstore"
  )
  Add-FixtureEvent -Event "migrate-temp:$Database"
}

function Start-Process {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [object[]]$ArgumentList = @(),
    [switch]$Wait,
    [switch]$PassThru,
    [switch]$NoNewWindow,
    [string]$RedirectStandardOutput,
    [string]$RedirectStandardError
  )
  if ($RedirectStandardOutput) {
    [IO.File]::WriteAllText($RedirectStandardOutput, "fixture archive list", [Text.UTF8Encoding]::new($false))
  }
  if ($RedirectStandardError) {
    [IO.File]::WriteAllText($RedirectStandardError, "", [Text.UTF8Encoding]::new($false))
  }
  return [pscustomobject]@{ ExitCode = 0 }
}

function Invoke-FitStoreProcess {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [string]$FailureMessage = "fixture failure"
  )
  $toolName = [IO.Path]::GetFileName($FilePath).ToLowerInvariant()
  $databaseArgument = @($Arguments | Where-Object { $_ -like "--dbname=*" } | Select-Object -First 1)
  $database = if ($databaseArgument.Count) { [string]$databaseArgument[0].Substring(("--dbname=").Length) } else { "" }

  switch ($toolName) {
    "createdb.exe" {
      $database = [string]$Arguments[-1]
      [IO.File]::WriteAllText((Join-Path $env:FITSTORE_RESTORE_FIXTURE_ROOT "temp-db-$database.marker"), "temporary")
      Add-FixtureEvent -Event "create-temp:$database"
      return
    }
    "pg_restore.exe" {
      if ($database -eq "fitstore") {
        if ($Arguments -notcontains "--single-transaction" -or $Arguments -notcontains "--exit-on-error") {
          throw "El reemplazo activo perdió sus barreras transaccionales."
        }
        Add-FixtureEvent -Event "active-restore-attempt"
        throw "FALLO INYECTADO después de la validación temporal."
      }
      Add-FixtureEvent -Event "restore-temp:$database"
      return
    }
    "psql.exe" {
      $sqlFiles = @($Arguments | Where-Object { $_ -like '--file=*' })
      if ($sqlFiles.Count -ne 1) { throw 'SQL must use the real private-file helper.' }
      $sql = [IO.File]::ReadAllText($sqlFiles[0].Substring(7))
      if ($database -like "fitstore_restore_*") {
        if ($sql -notmatch '^SELECT count\(\*\) FROM "(_prisma_migrations|User|Product)";$') { throw 'Quoted validation SQL was lost.' }
        Add-FixtureEvent -Event "validate-temp:$database"
      } else {
        Add-FixtureEvent -Event "terminate-active"
      }
      return
    }
    "pg_dump.exe" {
      $fileArgument = @($Arguments | Where-Object { $_ -like "--file=*" } | Select-Object -First 1)
      if (-not $fileArgument.Count) { throw "El dump validado no indicó archivo." }
      $archive = [string]$fileArgument[0].Substring(7)
      [IO.File]::WriteAllText($archive, "validated fixture dump", [Text.UTF8Encoding]::new($false))
      Add-FixtureEvent -Event "dump-validated:$database"
      return
    }
    "dropdb.exe" {
      $database = [string]$Arguments[-1]
      Remove-Item -LiteralPath (Join-Path $env:FITSTORE_RESTORE_FIXTURE_ROOT "temp-db-$database.marker") -Force -ErrorAction SilentlyContinue
      Add-FixtureEvent -Event "drop-temp:$database"
      return
    }
    default { throw "Herramienta PostgreSQL inesperada en fixture: $toolName" }
  }
}
