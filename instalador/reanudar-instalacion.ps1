param(
    [Parameter(Mandatory)]
    [string] $OutputPath,

    [string] $Version = '0.1.0'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'La reanudación requiere una consola elevada.'
}

$answerDir = $null
$answerFile = $null
$password = $null
$pin = $null
$resultLines = [Collections.Generic.List[string]]::new()
$exitCode = 1

function Protect-Path {
    param([string] $LiteralPath, [switch] $Container)

    if ($Container) {
        $grants = @(
            "*$($identity.User.Value):(OI)(CI)F",
            '*S-1-5-18:(OI)(CI)F',
            '*S-1-5-32-544:(OI)(CI)F'
        )
    }
    else {
        $grants = @(
            "*$($identity.User.Value):(F)",
            '*S-1-5-18:(F)',
            '*S-1-5-32-544:(F)'
        )
    }

    $aclOutput = & "$env:SystemRoot\System32\icacls.exe" `
        $LiteralPath '/inheritance:r' '/grant:r' @grants 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo proteger una ruta temporal. icacls=$LASTEXITCODE"
    }
}

function Add-SafeLine {
    param([AllowNull()][object] $Value)

    $safe = [string]$Value
    if (-not [string]::IsNullOrEmpty($password)) {
        $safe = $safe.Replace($password, '[REDACTED]')
    }
    if (-not [string]::IsNullOrEmpty($pin)) {
        $safe = $safe.Replace($pin, '[REDACTED]')
    }
    $safe = $safe -replace '(?i)(password|passwordconfirm|contrase(?:n|ñ)a|ownerpin|\bpin\b|secret|token)\s*[=:]\s*[^\s,;]+', '$1=[REDACTED]'
    $resultLines.Add($safe)
}

try {
    $documents = [Environment]::GetFolderPath(
        [Environment+SpecialFolder]::MyDocuments
    )
    $credentialFile = Get-ChildItem -LiteralPath $documents `
        -Filter 'FitStore-Credenciales-iniciales*.txt' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    if ($null -eq $credentialFile) {
        throw 'No se encontró el archivo privado de credenciales iniciales.'
    }

    $credentialLines = @(Get-Content -LiteralPath $credentialFile.FullName)
    $emailLine = $credentialLines | Where-Object { $_ -like 'Usuario propietario:*' } | Select-Object -First 1
    $passwordLine = $credentialLines | Where-Object { $_ -like 'Contrase*:*' } | Select-Object -First 1
    $pinLine = $credentialLines | Where-Object { $_ -like 'PIN:*' } | Select-Object -First 1
    if (-not $emailLine -or -not $passwordLine -or -not $pinLine) {
        throw 'El archivo privado de credenciales no tiene el formato esperado.'
    }

    $ownerEmail = ([string]$emailLine).Substring(([string]$emailLine).IndexOf(':') + 1).Trim()
    $password = ([string]$passwordLine).Substring(([string]$passwordLine).IndexOf(':') + 1).Trim()
    $pin = ([string]$pinLine).Substring(([string]$pinLine).IndexOf(':') + 1).Trim()
    if ($ownerEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$' -or
        $password.Length -lt 12 -or $pin -notmatch '^\d{4,6}$') {
        throw 'El archivo privado de credenciales contiene valores inválidos.'
    }
    $backupPath = Join-Path $env:ProgramData 'FitStore POS\Backups'

    $answerDir = Join-Path ([IO.Path]::GetTempPath()) (
        'FitStoreResume-' + [Guid]::NewGuid().ToString('N')
    )
    $answerFile = Join-Path $answerDir 'respuesta.ini'
    $null = [IO.Directory]::CreateDirectory($answerDir)
    Protect-Path -LiteralPath $answerDir -Container

    $stream = [IO.File]::Open(
        $answerFile,
        [IO.FileMode]::CreateNew,
        [IO.FileAccess]::Write,
        [IO.FileShare]::None
    )
    $stream.Dispose()
    Protect-Path -LiteralPath $answerFile

    $answerContent = @"
[Setup]
Mode=instalar
OwnerName=Administrador Nexora
OwnerEmail=$ownerEmail
OwnerPassword=$password
OwnerPasswordConfirm=$password
OwnerPin=$pin
BackupPath=$backupPath
"@
    [IO.File]::WriteAllText(
        $answerFile,
        $answerContent,
        [Text.UnicodeEncoding]::new($false, $true, $true)
    )

    $installDir = Join-Path $env:ProgramFiles 'FitStore POS'
    $installScript = Join-Path $installDir 'scripts\Install-FitStore.ps1'
    if (-not [IO.File]::Exists($installScript)) {
        throw 'No se encontró el script instalado de FitStore.'
    }
    $patchedInstallScript = Join-Path $PSScriptRoot 'scripts\Install-FitStore.ps1'
    if (-not [IO.File]::Exists($patchedInstallScript)) {
        throw 'No se encontró el script corregido de FitStore.'
    }
    Copy-Item -LiteralPath $patchedInstallScript -Destination $installScript -Force
    $patchedCommonScript = Join-Path $PSScriptRoot 'scripts\FitStore.Common.ps1'
    $installedCommonScript = Join-Path $installDir 'scripts\FitStore.Common.ps1'
    if (-not [IO.File]::Exists($patchedCommonScript)) {
        throw 'No se encontró la biblioteca corregida de FitStore.'
    }
    Copy-Item -LiteralPath $patchedCommonScript `
        -Destination $installedCommonScript -Force

    $portableNodeModules = Join-Path $PSScriptRoot 'build\api-hoisted\node_modules'
    $bundledShared = Join-Path $PSScriptRoot `
        'build\payload\app\api\node_modules\@fitstore\shared'
    $installedApi = Join-Path $installDir 'app\api'
    $installedNodeModules = Join-Path $installedApi 'node_modules'
    if (-not [IO.Directory]::Exists($portableNodeModules)) {
        throw 'No se encontró el paquete portable de dependencias de la API.'
    }
    if (-not [IO.Directory]::Exists($bundledShared)) {
        throw 'No se encontró el paquete compilado de @fitstore/shared.'
    }
    if ([IO.Directory]::Exists($installedNodeModules)) {
        Remove-Item -LiteralPath $installedNodeModules -Recurse -Force
    }
    Copy-Item -LiteralPath $portableNodeModules `
        -Destination $installedNodeModules -Recurse -Force
    $installedShared = Join-Path $installedNodeModules '@fitstore\shared'
    if ([IO.Directory]::Exists($installedShared)) {
        Remove-Item -LiteralPath $installedShared -Recurse -Force
    }
    Copy-Item -LiteralPath $bundledShared -Destination $installedShared `
        -Recurse -Force

    $childPowerShell = Join-Path $env:SystemRoot `
        'System32\WindowsPowerShell\v1.0\powershell.exe'
    $childArgs = @(
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        $installScript,
        '-InstallDir',
        $installDir,
        '-RespuestaPath',
        $answerFile,
        '-Version',
        $Version
    )

    $resultLines.Add("StartedUtc=$([DateTime]::UtcNow.ToString('o'))")
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $childOutput = @(& $childPowerShell @childArgs 2>&1)
        $exitCode = [int]$LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    foreach ($line in $childOutput) {
        Add-SafeLine -Value $line
    }

    if ($exitCode -eq 0) {
        $regExe = Join-Path $env:SystemRoot 'System32\reg.exe'
        $productKey = 'HKLM\Software\FitStore POS'
        $uninstallKey = 'HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\FitStorePOS'
        $uninstallExe = Join-Path $installDir 'Uninstall.exe'
        $registryItems = @(
            @($productKey, 'InstallLocation', 'REG_SZ', $installDir),
            @($productKey, 'DataLocation', 'REG_SZ', (Join-Path $env:ProgramData 'FitStore POS')),
            @($productKey, 'Version', 'REG_SZ', $Version),
            @($uninstallKey, 'DisplayName', 'REG_SZ', 'FitStore POS'),
            @($uninstallKey, 'DisplayVersion', 'REG_SZ', $Version),
            @($uninstallKey, 'Publisher', 'REG_SZ', 'FitStore POS'),
            @($uninstallKey, 'InstallLocation', 'REG_SZ', $installDir),
            @($uninstallKey, 'DisplayIcon', 'REG_SZ', (Join-Path $installDir 'assets\fitstore.ico')),
            @($uninstallKey, 'UninstallString', 'REG_SZ', ('"' + $uninstallExe + '"')),
            @($uninstallKey, 'QuietUninstallString', 'REG_SZ', ('"' + $uninstallExe + '" /S')),
            @($uninstallKey, 'NoModify', 'REG_DWORD', '1'),
            @($uninstallKey, 'NoRepair', 'REG_DWORD', '1')
        )
        $registryOk = $true
        $previousErrorAction = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            foreach ($item in $registryItems) {
                & $regExe 'ADD' $item[0] '/v' $item[1] '/t' $item[2] `
                    '/d' $item[3] '/f' '/reg:64' 2>$null | Out-Null
                if ($LASTEXITCODE -ne 0) { $registryOk = $false }
            }
        }
        finally {
            $ErrorActionPreference = $previousErrorAction
        }
        $resultLines.Add("RegistryRegistration=$registryOk")

        $statePath = Join-Path $env:ProgramData 'FitStore POS\state.json'
        $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $resultLines.Add("InstallationComplete=$([bool]$state.installationComplete)")
        foreach ($serviceName in 'FitStorePostgreSQL', 'FitStoreAPI', 'FitStoreWeb') {
            $service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
            if ($null -eq $service) {
                $resultLines.Add("Service:$serviceName=Missing")
                $exitCode = 91
            }
            else {
                $resultLines.Add("Service:$serviceName=$($service.Status)")
                if ($service.Status -ne 'Running') { $exitCode = 91 }
            }
        }

        $verifyScript = Join-Path $installDir 'scripts\Verify-FitStore.ps1'
        if ([IO.File]::Exists($verifyScript)) {
            $previousErrorAction = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                $verifyOutput = @(& $childPowerShell '-NoProfile' '-NonInteractive' `
                    '-ExecutionPolicy' 'Bypass' '-File' $verifyScript `
                    '-InstallDir' $installDir 2>&1)
                $verifyExit = [int]$LASTEXITCODE
            }
            finally {
                $ErrorActionPreference = $previousErrorAction
            }
            foreach ($line in $verifyOutput) {
                Add-SafeLine -Value ('VERIFY: ' + [string]$line)
            }
            $resultLines.Add("VerifyExitCode=$verifyExit")
            if ($verifyExit -ne 0) { $exitCode = 92 }
        }
        else {
            $resultLines.Add('VerifyScript=Missing')
            $exitCode = 92
        }
    }
    $resultLines.Add("ExitCode=$exitCode")
    $resultLines.Add("FinishedUtc=$([DateTime]::UtcNow.ToString('o'))")
}
catch {
    Add-SafeLine -Value ('ResumeLauncherError=' + $_.Exception.Message)
    $exitCode = 1
}
finally {
    if ($null -ne $answerFile -and [IO.File]::Exists($answerFile)) {
        try {
            [IO.File]::WriteAllBytes($answerFile, [byte[]]@())
            Remove-Item -LiteralPath $answerFile -Force
        }
        catch {
            $resultLines.Add('PrivateAnswerCleanup=False')
        }
    }
    if ($null -ne $answerDir -and [IO.Directory]::Exists($answerDir)) {
        try {
            Remove-Item -LiteralPath $answerDir -Recurse -Force
        }
        catch {
            $resultLines.Add('PrivateDirectoryCleanup=False')
        }
    }

    $password = $null
    $pin = $null
    [IO.File]::WriteAllLines(
        $OutputPath,
        $resultLines,
        [Text.UTF8Encoding]::new($false)
    )
}

exit $exitCode
