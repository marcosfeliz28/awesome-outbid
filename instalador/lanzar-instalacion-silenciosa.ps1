param(
    [Parameter(Mandatory)]
    [string] $SetupPath,

    [Parameter(Mandatory)]
    [ValidatePattern('^[0-9A-Fa-f]{64}$')]
    [string] $ExpectedSha256,

    [switch] $Resume,

    [switch] $ReuseCredentials
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ownerName = 'Marco'
$ownerEmail = 'propietario@example.invalid'
$seedDir = $null
$seedFile = $null
$credentialFile = $null
$rng = $null
$password = $null
$pin = $null
$iniContent = $null
$credentialContent = $null
$installerExitCode = 1
$cleanupFailed = $false

$icaclsExe = Join-Path $env:SystemRoot 'System32\icacls.exe'
$currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value

function Protect-PrivatePath {
    param(
        [Parameter(Mandatory)]
        [string] $LiteralPath,

        [switch] $Container
    )

    if ($Container) {
        $grants = @(
            "*$($currentSid):(OI)(CI)F",
            '*S-1-5-18:(OI)(CI)F',
            '*S-1-5-32-544:(OI)(CI)F'
        )
    }
    else {
        $grants = @(
            "*$($currentSid):(F)",
            '*S-1-5-18:(F)',
            '*S-1-5-32-544:(F)'
        )
    }

    $arguments = @($LiteralPath, '/inheritance:r', '/grant:r') + $grants
    $aclOutput = & $icaclsExe @arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo proteger una ruta privada. icacls=$LASTEXITCODE"
    }
}

function New-EmptyPrivateFile {
    param([Parameter(Mandatory)][string] $LiteralPath)

    $stream = $null
    try {
        $stream = [IO.File]::Open(
            $LiteralPath,
            [IO.FileMode]::CreateNew,
            [IO.FileAccess]::Write,
            [IO.FileShare]::None
        )
    }
    finally {
        if ($null -ne $stream) {
            $stream.Dispose()
        }
    }

    Protect-PrivatePath -LiteralPath $LiteralPath
}

function Get-Sha256Hex {
    param([Parameter(Mandatory)][string] $LiteralPath)

    $stream = $null
    $sha256 = $null
    try {
        $stream = [IO.File]::OpenRead($LiteralPath)
        $sha256 = [Security.Cryptography.SHA256]::Create()
        $digest = $sha256.ComputeHash($stream)
        return [BitConverter]::ToString($digest).Replace('-', '')
    }
    finally {
        if ($null -ne $sha256) { $sha256.Dispose() }
        if ($null -ne $stream) { $stream.Dispose() }
    }
}

function Get-CryptoInt32 {
    param(
        [Parameter(Mandatory)]
        [Security.Cryptography.RandomNumberGenerator] $Generator,

        [Parameter(Mandatory)]
        [ValidateRange(2, 2147483647)]
        [int] $MaxExclusive
    )

    [uint64] $range = ([uint64][uint32]::MaxValue) + 1
    [uint64] $limit = $range - ($range % [uint64]$MaxExclusive)
    $buffer = New-Object byte[] 4
    try {
        do {
            $Generator.GetBytes($buffer)
            [uint64] $candidate = [BitConverter]::ToUInt32($buffer, 0)
        } while ($candidate -ge $limit)
        return [int]($candidate % [uint64]$MaxExclusive)
    }
    finally {
        [Array]::Clear($buffer, 0, $buffer.Length)
    }
}

if ($Resume) {
    $resumeScript = Join-Path $PSScriptRoot 'reanudar-instalacion.ps1'
    $resumeOutput = Join-Path $PSScriptRoot 'reanudar-instalacion.log'
    $tokens = $null
    $parseErrors = $null
    [void][Management.Automation.Language.Parser]::ParseFile(
        $resumeScript,
        [ref]$tokens,
        [ref]$parseErrors
    )
    if ($parseErrors.Count -gt 0) {
        throw ('El script de reanudación no pasó el parser: ' +
            (($parseErrors | ForEach-Object Message) -join '; '))
    }

    $adminPowerShell = Join-Path $env:SystemRoot `
        'System32\WindowsPowerShell\v1.0\powershell.exe'
    $resumeArgs = @(
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        ('"' + $resumeScript + '"'),
        '-OutputPath',
        ('"' + $resumeOutput + '"'),
        '-Version',
        '0.1.0'
    )
    $resumeProcess = Start-Process -FilePath $adminPowerShell `
        -ArgumentList $resumeArgs -Verb RunAs -Wait -PassThru
    if ([IO.File]::Exists($resumeOutput)) {
        Get-Content -LiteralPath $resumeOutput
    }
    exit ([int]$resumeProcess.ExitCode)
}

try {
    $setupFullPath = (Resolve-Path -LiteralPath $SetupPath).ProviderPath
    if (-not [IO.File]::Exists($setupFullPath)) {
        throw 'El instalador no existe o no es un archivo.'
    }

    $actualSha256 = Get-Sha256Hex -LiteralPath $setupFullPath
    if ($actualSha256 -cne $ExpectedSha256.ToUpperInvariant()) {
        throw 'El SHA-256 del instalador no coincide con el valor esperado.'
    }

    $documents = [Environment]::GetFolderPath(
        [Environment+SpecialFolder]::MyDocuments
    )
    if ([string]::IsNullOrWhiteSpace($documents) -or
        -not [IO.Path]::IsPathRooted($documents)) {
        throw 'No se pudo resolver la carpeta Documents.'
    }

    $backupPath = Join-Path $documents 'FitStore Backups'
    $baseCredentialFile = Join-Path $documents 'FitStore-Credenciales-iniciales.txt'
    if ($ReuseCredentials) {
        $credentialFile = Get-ChildItem -LiteralPath $documents `
            -Filter 'FitStore-Credenciales-iniciales*.txt' -File |
            Sort-Object LastWriteTime -Descending |
            Select-Object -First 1 |
            ForEach-Object FullName
        if (-not $credentialFile) {
            throw 'No se encontró el archivo privado de credenciales iniciales.'
        }
        $credentialLines = @(Get-Content -LiteralPath $credentialFile)
        $emailLine = $credentialLines | Where-Object {
            $_ -like 'Usuario propietario:*'
        } | Select-Object -First 1
        $passwordLine = $credentialLines | Where-Object {
            $_ -like 'Contrase*:*'
        } | Select-Object -First 1
        $pinLine = $credentialLines | Where-Object {
            $_ -like 'PIN:*'
        } | Select-Object -First 1
        if (-not $emailLine -or -not $passwordLine -or -not $pinLine) {
            throw 'El archivo privado de credenciales no tiene el formato esperado.'
        }
        $ownerEmail = ([string]$emailLine).Substring(
            ([string]$emailLine).IndexOf(':') + 1
        ).Trim()
        $password = ([string]$passwordLine).Substring(
            ([string]$passwordLine).IndexOf(':') + 1
        ).Trim()
        $pin = ([string]$pinLine).Substring(
            ([string]$pinLine).IndexOf(':') + 1
        ).Trim()
        if ($ownerEmail -notmatch '^[^\s@]+@[^\s@]+\.[^\s@]+$' -or
            $password.Length -lt 12 -or $pin -notmatch '^\d{4,6}$') {
            throw 'El archivo privado de credenciales contiene valores inválidos.'
        }
    }
    elseif ([IO.File]::Exists($baseCredentialFile)) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $credentialFile = Join-Path $documents "FitStore-Credenciales-iniciales-$stamp.txt"
    }
    else {
        $credentialFile = $baseCredentialFile
    }

    foreach ($value in @($ownerName, $ownerEmail, $backupPath)) {
        if ($value -match '[\r\n]') {
            throw 'Un valor de configuración contiene un salto de línea no permitido.'
        }
    }

    if (-not $ReuseCredentials) {
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        $passwordBytes = New-Object byte[] 16
        try {
            $rng.GetBytes($passwordBytes)
            $randomHex = [BitConverter]::ToString($passwordBytes).
                Replace('-', '').ToLowerInvariant()
            $password = 'Fs!7-' + $randomHex
        }
        finally {
            [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
        }

        $pinNumber = Get-CryptoInt32 -Generator $rng -MaxExclusive 1000000
        $pin = $pinNumber.ToString('D6')
    }

    $seedDir = Join-Path ([IO.Path]::GetTempPath()) (
        'FitStoreSeed-' + [Guid]::NewGuid().ToString('N')
    )
    $seedFile = Join-Path $seedDir 'respuesta.ini'

    $null = [IO.Directory]::CreateDirectory($seedDir)
    Protect-PrivatePath -LiteralPath $seedDir -Container
    New-EmptyPrivateFile -LiteralPath $seedFile

    $iniContent = @"
[Setup]
OwnerName=$ownerName
OwnerEmail=$ownerEmail
OwnerPassword=$password
OwnerPasswordConfirm=$password
OwnerPin=$pin
BackupPath=$backupPath
"@
    $iniEncoding = [Text.UnicodeEncoding]::new($false, $true, $true)
    [IO.File]::WriteAllText($seedFile, $iniContent, $iniEncoding)

    if (-not $ReuseCredentials) {
        New-EmptyPrivateFile -LiteralPath $credentialFile
        $credentialContent = @"
FITSTORE POS - CREDENCIALES INICIALES

Usuario propietario: $ownerEmail
Contraseña: $password
PIN: $pin

Conserve este archivo en un lugar seguro y cambie las credenciales
después del primer acceso.
"@
        $credentialEncoding = [Text.UTF8Encoding]::new($true, $true)
        [IO.File]::WriteAllText(
            $credentialFile,
            $credentialContent,
            $credentialEncoding
        )
    }

    if ($ReuseCredentials) {
        $finalizer = Join-Path $PSScriptRoot 'finalizar-instalacion.ps1'
        $adminPowerShell = Join-Path $env:SystemRoot `
            'System32\WindowsPowerShell\v1.0\powershell.exe'
        $finalizerArgs = @(
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            ('"' + $finalizer + '"'),
            '-SetupPath',
            ('"' + $setupFullPath + '"'),
            '-AnswerPath',
            ('"' + $seedFile + '"')
        )
        $process = Start-Process -FilePath $adminPowerShell `
            -ArgumentList $finalizerArgs -Verb RunAs -Wait -PassThru
    }
    else {
        $process = Start-Process `
            -FilePath $setupFullPath `
            -ArgumentList @('/S', "/ANSWER=$seedFile") `
            -Verb RunAs `
            -Wait `
            -PassThru
    }
    $installerExitCode = [int]$process.ExitCode
}
catch {
    $failureMessage = $_.Exception.Message
    $failureCode = 1
    $candidate = $_.Exception
    while ($null -ne $candidate -and
        -not ($candidate -is [ComponentModel.Win32Exception])) {
        $candidate = $candidate.InnerException
    }
    if ($candidate -is [ComponentModel.Win32Exception] -and
        $candidate.NativeErrorCode -gt 0) {
        $failureCode = [int]$candidate.NativeErrorCode
    }

    [pscustomobject]@{
        Status = 'LauncherFailed'
        ExitCode = $failureCode
        CredentialFile = $credentialFile
        Error = $failureMessage
    } | ConvertTo-Json -Compress
    $installerExitCode = $failureCode
}
finally {
    if ($null -ne $seedFile -and [IO.File]::Exists($seedFile)) {
        try {
            [IO.File]::WriteAllBytes($seedFile, [byte[]]@())
            Remove-Item -LiteralPath $seedFile -Force -ErrorAction Stop
        }
        catch {
            $cleanupFailed = $true
        }
    }
    if ($null -ne $seedDir -and [IO.Directory]::Exists($seedDir)) {
        try {
            Remove-Item -LiteralPath $seedDir -Recurse -Force -ErrorAction Stop
        }
        catch {
            $cleanupFailed = $true
        }
    }
    if ($null -ne $rng) {
        $rng.Dispose()
    }
    $password = $null
    $pin = $null
    $iniContent = $null
    $credentialContent = $null
}

if ($installerExitCode -eq 0) {
    [pscustomobject]@{
        Status = 'Completed'
        ExitCode = 0
        CredentialFile = $credentialFile
        CleanupFailed = $cleanupFailed
    } | ConvertTo-Json -Compress
}

if ($cleanupFailed -and $installerExitCode -eq 0) {
    exit 90
}
exit $installerExitCode
