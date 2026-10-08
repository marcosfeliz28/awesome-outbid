[CmdletBinding(SupportsShouldProcess = $true)]
param(
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$')][string]$Bucket,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9_.-]{1,64}$')][string]$PerfilAws,
  [string]$Prefijo = 'nexora/postgres/',
  [string]$Destino = (Join-Path $env:USERPROFILE 'Documents\Nexora POS\Respaldos cloud'),
  [string]$PgRestore = 'pg_restore',
  [ValidateRange(0, 23)][int]$HoraDiaria = 3,
  [switch]$ReplaceExisting,
  [switch]$RunNow
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$taskName = 'Nexora POS - Respaldo cloud diario'
$runner = Join-Path $PSScriptRoot 'Invoke-NexoraCloudBackupTask.ps1'
$aws = Get-Command aws -ErrorAction SilentlyContinue
$restore = Get-Command $PgRestore -ErrorAction SilentlyContinue
if (-not $aws) { throw 'No se encontró AWS CLI. Instálalo y configura el perfil de solo lectura antes de programar la tarea.' }
if (-not $restore) { throw "No se encontró pg_restore '$PgRestore'. Agrega PostgreSQL al PATH o indica la ruta completa." }
if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) { throw 'Falta el ejecutor de respaldo cloud del repositorio.' }
if (-not (Test-Path -LiteralPath (Join-Path $env:USERPROFILE '.aws\config') -PathType Leaf)) { throw 'No se encontró la configuración de perfiles AWS en el perfil de este usuario.' }
$profiles = @(& $aws.Source configure list-profiles 2>$null)
if ($LASTEXITCODE -ne 0 -or $PerfilAws -notin $profiles) { throw "El perfil AWS '$PerfilAws' no aparece en la configuración local de este usuario." }

$settingsDir = Join-Path $env:LOCALAPPDATA 'NexoraPOS'
$settingsPath = Join-Path $settingsDir 'cloud-backup.json'
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if (($task -or (Test-Path -LiteralPath $settingsPath)) -and -not $ReplaceExisting) { throw "Ya existe una tarea o configuración '$taskName'. Usa -ReplaceExisting sólo si quieres sustituirla." }

$settings = [ordered]@{
  Bucket = $Bucket
  PerfilAws = $PerfilAws
  Prefijo = $Prefijo
  Destino = [IO.Path]::GetFullPath($Destino)
  AwsCli = [IO.Path]::GetFullPath($aws.Source)
  PgRestore = [IO.Path]::GetFullPath($restore.Source)
  Script = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'pull-cloud-backup.ps1'))
}
$settingsJson = $settings | ConvertTo-Json -Depth 4
$shell = if (Test-Path -LiteralPath (Join-Path $PSHOME 'pwsh.exe')) { Join-Path $PSHOME 'pwsh.exe' } else { Join-Path $PSHOME 'powershell.exe' }
$arguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}" -Config "{1}"' -f $runner, $settingsPath
$action = New-ScheduledTaskAction -Execute $shell -Argument $arguments
$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn -User ([Security.Principal.WindowsIdentity]::GetCurrent().Name)),
  (New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($HoraDiaria)))
)
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
$settingsTask = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 45) -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 10)

if ($PSCmdlet.ShouldProcess($taskName, 'Crear tarea diaria y al iniciar sesión para descargar y verificar el respaldo privado')) {
  $null = New-Item -ItemType Directory -Path $settingsDir -Force
  Set-Content -LiteralPath $settingsPath -Value $settingsJson -Encoding UTF8
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Principal $principal -Settings $settingsTask -Description 'Descarga y verifica el último respaldo privado de Nexora POS; requiere perfil AWS de solo lectura.' -Force | Out-Null
  if ($RunNow) { Start-ScheduledTask -TaskName $taskName }
  Write-Output "Tarea '$taskName' preparada para este usuario. Configuración no secreta: $settingsPath"
  Write-Output 'La copia se ejecuta al iniciar sesión y diariamente; requiere internet, acceso S3 y credenciales AWS válidas.'
}
