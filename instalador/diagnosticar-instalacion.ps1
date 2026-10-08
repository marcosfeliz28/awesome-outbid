param(
    [Parameter(Mandatory)]
    [string] $OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:ProgramFiles 'FitStore POS'
$dataRoot = Join-Path $env:ProgramData 'FitStore POS'
$statePath = Join-Path $dataRoot 'state.json'
$logPath = Join-Path $dataRoot 'logs\instalador.log'
$lines = [Collections.Generic.List[string]]::new()

$lines.Add("CapturedUtc=$([DateTime]::UtcNow.ToString('o'))")
$lines.Add("InstallRootExists=$([IO.Directory]::Exists($installRoot))")
$lines.Add("DataRootExists=$([IO.Directory]::Exists($dataRoot))")
$lines.Add("StateExists=$([IO.File]::Exists($statePath))")
$lines.Add("LogExists=$([IO.File]::Exists($logPath))")
$lines.Add("SecretsExists=$([IO.File]::Exists((Join-Path $dataRoot 'secrets.json')))")
$lines.Add("EnvExists=$([IO.File]::Exists((Join-Path $dataRoot '.env')))")
$pgData = Join-Path $dataRoot 'PostgreSQL\data'
$lines.Add("PgDataExists=$([IO.Directory]::Exists($pgData))")
$lines.Add("PgVersionExists=$([IO.File]::Exists((Join-Path $pgData 'PG_VERSION')))")
if ([IO.Directory]::Exists($dataRoot)) {
    $topLevel = @(Get-ChildItem -LiteralPath $dataRoot -Force -ErrorAction SilentlyContinue |
        Sort-Object Name |
        ForEach-Object { if ($_.PSIsContainer) { 'DIR:' + $_.Name } else { 'FILE:' + $_.Name } })
    $lines.Add('DataTopLevel=' + ($topLevel -join ','))
}

if ([IO.File]::Exists($statePath)) {
    try {
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $lines.Add("StateJsonParse=True")
        if ($state.PSObject.Properties.Name -contains 'installationComplete') {
            $lines.Add("InstallationComplete=$([bool]$state.installationComplete)")
        }
        $stateKeys = @($state.PSObject.Properties.Name | Sort-Object)
        $lines.Add('StateKeys=' + ($stateKeys -join ','))
    }
    catch {
        $lines.Add('StateJsonParse=False')
        $lines.Add('StateReadError=' + $_.Exception.GetType().FullName)
    }
}

$serviceNames = 'FitStorePostgreSQL', 'FitStoreAPI', 'FitStoreWeb'
foreach ($name in $serviceNames) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        $lines.Add("Service:$name=Missing")
    }
    else {
        $lines.Add("Service:$name=$($service.Status)")
    }
}

$fitStoreTasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { $_.TaskName -like 'FitStore*' -or $_.TaskPath -like '*FitStore*' })
$lines.Add("ScheduledTaskCount=$($fitStoreTasks.Count)")
foreach ($task in $fitStoreTasks) {
    $lines.Add("Task:$($task.TaskName)=$($task.State);Enabled=$($task.Settings.Enabled)")
}

if ([IO.File]::Exists($logPath)) {
    $lines.Add('--- SanitizedLogTail ---')
    $tail = @(Get-Content -LiteralPath $logPath -Tail 180)
    foreach ($line in $tail) {
        $safe = $line
        $safe = $safe -replace '(?i)(password|passwordconfirm|contrase(?:n|ñ)a|ownerpin|\bpin\b|secret|token)\s*[=:]\s*[^\s,;]+', '$1=[REDACTED]'
        $safe = $safe -replace '(?i)(authorization:\s*bearer\s+)\S+', '$1[REDACTED]'
        $lines.Add($safe)
    }
}

$logsDirectory = Join-Path $dataRoot 'logs'
if ([IO.Directory]::Exists($logsDirectory)) {
    $serviceLogs = @(Get-ChildItem -LiteralPath $logsDirectory -File -Force `
        -ErrorAction SilentlyContinue | Sort-Object Name)
    $lines.Add('LogFiles=' + (($serviceLogs | ForEach-Object {
        $_.Name + ':' + $_.Length
    }) -join ','))
    foreach ($file in $serviceLogs) {
        $lines.Add("--- Sanitized:$($file.Name) ---")
        foreach ($line in @(Get-Content -LiteralPath $file.FullName -Tail 100 `
            -ErrorAction SilentlyContinue)) {
            $safe = $line
            $safe = $safe -replace '(?i)(password|passwordconfirm|contrase(?:n|ñ)a|ownerpin|\bpin\b|secret|token)\s*[=:]\s*[^\s,;]+', '$1=[REDACTED]'
            $safe = $safe -replace '(?i)(authorization:\s*bearer\s+)\S+', '$1[REDACTED]'
            $lines.Add($safe)
        }
    }
}

$encoding = [Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllLines($OutputPath, $lines, $encoding)
