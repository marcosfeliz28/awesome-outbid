param(
  [Parameter(Mandatory = $true)][string]$Bucket,
  [Parameter(Mandatory = $true)][string]$PerfilAws,
  [string]$Prefijo = "nexora/postgres/",
  [Parameter(Mandatory = $true)][string]$Destino,
  [string]$AwsCli = "aws",
  [string]$PgRestore = "pg_restore",
  [ValidateRange(1, 3650)][int]$RetencionDias = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Invoke-Aws {
  param([string[]]$Arguments)
  $output = & $AwsCli @Arguments --profile $PerfilAws --no-cli-pager
  if ($LASTEXITCODE -ne 0) { throw "AWS CLI falló al consultar/descargar el respaldo (código $LASTEXITCODE)." }
  return $output
}

if (-not (Get-Command -Name $AwsCli -ErrorAction SilentlyContinue)) { throw "No se encontró AWS CLI; instala/configura AWS CLI antes de continuar." }
if (-not (Get-Command -Name $PgRestore -ErrorAction SilentlyContinue) -and -not (Test-Path -LiteralPath $PgRestore -PathType Leaf)) { throw "No se encontró pg_restore; indica su ruta en -PgRestore." }
if ([string]::IsNullOrWhiteSpace($PerfilAws)) { throw "Usa un perfil AWS con acceso de sólo lectura al prefijo de respaldos." }

$null = New-Item -ItemType Directory -Path $Destino -Force
$prefixPath = $Prefijo.Trim('/') + '/'
$listing = Invoke-Aws @("s3api", "list-objects-v2", "--bucket", $Bucket, "--prefix", $prefixPath, "--output", "json")
$objects = ($listing -join "`n" | ConvertFrom-Json).Contents
$manifestObject = @($objects | Where-Object { $_.Key -like "$prefixPath*.dump.json" } | Sort-Object LastModified -Descending | Select-Object -First 1)
if ($manifestObject.Count -eq 0) { throw "No hay un manifiesto de respaldo disponible en s3://$Bucket/$prefixPath." }
$manifestKey = [string]$manifestObject[0].Key
if ($manifestKey -notmatch '^(?<folder>.+)/(?<file>nexora-[A-Za-z0-9_.-]+\.dump)\.json$') { throw "El nombre de manifiesto cloud no tiene el formato esperado." }
$folder = $Matches.folder
$filename = $Matches.file
$dumpKey = "$folder/$filename"
$downloadId = [Guid]::NewGuid().ToString('N')
$temporary = Join-Path ([IO.Path]::GetFullPath($Destino)) (".$filename.$downloadId.incompleto")
$temporaryManifest = "$temporary.json"
$final = Join-Path ([IO.Path]::GetFullPath($Destino)) $filename

try {
  Invoke-Aws @("s3", "cp", "s3://$Bucket/$dumpKey", $temporary, "--only-show-errors") | Out-Null
  Invoke-Aws @("s3", "cp", "s3://$Bucket/$manifestKey", $temporaryManifest, "--only-show-errors") | Out-Null
  $manifest = Get-Content -LiteralPath $temporaryManifest -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($manifest.file -ne $filename -or [int64]$manifest.bytes -ne (Get-Item -LiteralPath $temporary).Length) { throw "La copia descargada no coincide con su manifiesto (nombre/tamaño)." }
  $actualHash = (Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actualHash -ne [string]$manifest.sha256) { throw "El SHA-256 de la copia descargada no coincide." }
  $listingOutput = Join-Path ([IO.Path]::GetTempPath()) ("nexora-pg-restore-{0}.txt" -f $downloadId)
  try {
    $process = Start-Process -FilePath $PgRestore -ArgumentList @("--list", "`"$temporary`"") -Wait -PassThru -NoNewWindow -RedirectStandardOutput $listingOutput -RedirectStandardError "$listingOutput.err"
    if ($process.ExitCode -ne 0 -or (Get-Item -LiteralPath $listingOutput).Length -eq 0) { throw "pg_restore no pudo leer la copia cloud." }
  } finally { Remove-Item -LiteralPath $listingOutput, "$listingOutput.err" -Force -ErrorAction SilentlyContinue }

  Move-Item -LiteralPath $temporary -Destination $final
  Move-Item -LiteralPath $temporaryManifest -Destination "$final.json"
  "$actualHash *$filename" | Set-Content -LiteralPath "$final.sha256" -Encoding ASCII
  $cutoff = (Get-Date).AddDays(-$RetencionDias)
  Get-ChildItem -LiteralPath $Destino -Filter "nexora-*.dump" -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    ForEach-Object {
      Remove-Item -LiteralPath $_.FullName -Force
      Remove-Item -LiteralPath ($_.FullName + ".json"), ($_.FullName + ".sha256") -Force -ErrorAction SilentlyContinue
    }
  Write-Output "Respaldo cloud descargado, validado y conservado en: $final"
} catch {
  Remove-Item -LiteralPath $temporary, $temporaryManifest -Force -ErrorAction SilentlyContinue
  throw
}
