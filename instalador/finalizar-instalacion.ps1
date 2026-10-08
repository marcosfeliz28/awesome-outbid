param(
    [Parameter(Mandatory)]
    [string] $SetupPath,

    [Parameter(Mandatory)]
    [string] $AnswerPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'La finalización requiere una consola elevada.'
}
if (-not [IO.File]::Exists($SetupPath)) {
    throw 'No se encontró el instalador final.'
}
if (-not [IO.File]::Exists($AnswerPath)) {
    throw 'No se encontró el archivo temporal de respuesta.'
}

$exitCode = 1
try {
    foreach ($serviceName in 'FitStoreWeb', 'FitStoreAPI', 'FitStorePostgreSQL') {
        $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($null -ne $service -and $service.Status -ne 'Stopped') {
            Stop-Service -Name $serviceName -Force -ErrorAction Stop
            $service.WaitForStatus('Stopped', [TimeSpan]::FromSeconds(90))
        }
    }

    $process = Start-Process -FilePath $SetupPath `
        -ArgumentList @('/S', "/ANSWER=$AnswerPath") `
        -Wait -PassThru
    $exitCode = [int]$process.ExitCode
}
finally {
    if ($exitCode -ne 0) {
        foreach ($serviceName in 'FitStorePostgreSQL', 'FitStoreAPI', 'FitStoreWeb') {
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($null -ne $service -and $service.Status -ne 'Running') {
                try {
                    Start-Service -Name $serviceName -ErrorAction Stop
                    $service.WaitForStatus('Running', [TimeSpan]::FromSeconds(90))
                }
                catch {
                    # El código original del instalador conserva prioridad.
                }
            }
        }
    }
}

exit $exitCode
