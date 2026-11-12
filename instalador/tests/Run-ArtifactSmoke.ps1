param([Parameter(Mandatory = $true)][string]$SetupPath)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# Solo el runner efimero aprobado; no es un lanzador para PC ni produccion.
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_ENVIRONMENT -ne 'github-hosted' -or
    $env:RUNNER_OS -ne 'Windows' -or $env:GITHUB_REPOSITORY -ne 'marcosfeliz28/awesome-outbid' -or
    $env:GITHUB_REF -ne 'refs/heads/qa/windows-smoke-c02-12nov' -or
    $env:GITHUB_WORKFLOW -ne 'Norexos Windows artifact smoke') { throw 'Destino de prueba no autorizado.' }
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
if (-not ([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'El runner no es administrador.' }
$expected = 'a52bbade983f6a5ff935b980e50e58dfd25d060fa225cb4e8204679a8ec547ee'
if ((Get-FileHash -LiteralPath $SetupPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Artefacto distinto al aprobado.' }
$install = Join-Path $env:ProgramFiles 'FitStore POS'
$data = Join-Path $env:ProgramData 'FitStore POS'
if ((Test-Path -LiteralPath $install) -or (Test-Path -LiteralPath $data) -or @(Get-Service -Name 'FitStore*' -ErrorAction SilentlyContinue).Count) { throw 'El runner ya tiene FitStore; no se modifica.' }
foreach ($port in @(3001,4173,5434)) {
  if (@(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count) { throw "Puerto de prueba $port ocupado." }
}
$os = Get-CimInstance Win32_OperatingSystem
Write-Output ("Entorno: {0}, version {1}, PowerShell {2}" -f $os.Caption,$os.Version,$PSVersionTable.PSVersion)
Write-Output ('Firma del EXE: ' + (Get-AuthenticodeSignature -LiteralPath $SetupPath).Status)
$root = Join-Path $env:RUNNER_TEMP ('norexos-smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $root -ErrorAction Stop | Out-Null
& icacls.exe $root /inheritance:r /grant:r "*$($identity.User.Value):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-544:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo proteger la carpeta efimera.' }
$password = 'Nx!QA-' + [Guid]::NewGuid().ToString('N')
$pin = (Get-Random -Minimum 100000 -Maximum 999999).ToString()
Write-Output "::add-mask::$password"
Write-Output "::add-mask::$pin"
$credential = Join-Path $root 'qa.json'
[ordered]@{email='qa@example.invalid';password=$password;pin=$pin} | ConvertTo-Json | Set-Content -LiteralPath $credential -Encoding UTF8
$answer = Join-Path $root 'answer.ini'
@('[Setup]','OwnerName=Norexos QA','OwnerEmail=qa@example.invalid',"OwnerPassword=$password","OwnerPasswordConfirm=$password","OwnerPin=$pin","BackupPath=$data\Backups") | Set-Content -LiteralPath $answer -Encoding Unicode
$stage = 'instalacion'
function Write-SafeDiagnostics {
  Get-Service -Name 'FitStore*' -ErrorAction SilentlyContinue | Select-Object Name,Status | Format-Table | Out-String | Write-Output
  if (Test-Path -LiteralPath (Join-Path $data 'state.json')) {
    $state = Get-Content -LiteralPath (Join-Path $data 'state.json') -Raw | ConvertFrom-Json
    $state | Select-Object version,ownerCreated,installationComplete | ConvertTo-Json | Write-Output
  }
  $log = Join-Path $data 'logs\instalador.log'
  if (Test-Path -LiteralPath $log) {
    $lines = Get-Content -LiteralPath $log -Tail 40
    foreach ($line in $lines) {
      $safe = $line.Replace($password,'[REDACTED]').Replace($pin,'[REDACTED]')
      $safe = $safe -replace '(?i)(postgres(?:ql)?://)[^\s]+','$1[REDACTED]' -replace '(?i)(password|secret|token|pfxPassword)\s*[=:]\s*[^\s,;]+','$1=[REDACTED]'
      Write-Output $safe
    }
  }
}
try {
  $process = Start-Process -FilePath $SetupPath -ArgumentList @('/S',"/ANSWER=`"$answer`"") -WindowStyle Hidden -PassThru
  if (-not $process.WaitForExit(480000)) {
    # Solo el proceso del instalador lanzado en este runner descartable.
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw 'El instalador no termino en 8 minutos; no se presume exito.'
  }
  $process.Refresh()
  if ($process.ExitCode -ne 0) { throw "Instalador termino con codigo $($process.ExitCode)." }
  Write-Output 'PASS instalacion: EXE original, sin parches, codigo 0.'
  $stage = 'verificacion operativa y HTTPS'
  & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -File (Join-Path $install 'scripts\Verify-FitStore.ps1') -InstallDir $install
  if ($LASTEXITCODE -ne 0) { throw 'La verificacion operativa fallo.' }
  # Sin SkipCertificateCheck ni callback de confianza alternativo.
  $page = Invoke-WebRequest -UseBasicParsing -Uri 'https://localhost:4173/' -TimeoutSec 30
  if ($page.StatusCode -ne 200 -or $page.Content -notmatch '<html') { throw 'La pagina HTTPS no abre.' }
  Write-Output 'PASS inicio: pagina HTTPS 200 y confianza de certificado de Windows.'
  $stage = 'venta y cierre por API local'
  $env:NEXORA_DISPOSABLE_TEST = '1'
  & (Join-Path $install 'runtime\node\node.exe') (Join-Path $PSScriptRoot 'artifact-business-smoke.mjs') $credential
  if ($LASTEXITCODE -ne 0) { throw 'Smoke de negocio fallo.' }
  $stage = 'respaldo y restauracion en base separada'
  & "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -File (Join-Path $PSScriptRoot 'Windows-Smoke.ps1') -InstallDir $install
  if ($LASTEXITCODE -ne 0) { throw 'Respaldo/restauracion Windows-Smoke fallo.' }
  Write-Output 'PASS respaldo/restauracion: script real, conteos de usuarios, ventas y migraciones iguales.'
  @('## Norexos: prueba del artefacto aprobado',"SHA256: $expected",'- Instalacion original: PASS','- Servicios, HTTPS y certificado: PASS','- Venta y cierre por API: PASS','- Respaldo/restauracion aislada: PASS','- NO prueba GUI, Windows 10/11 cliente, impresora, LAN, actualizacion, reinicio ni rollback.','- Sin cambios en PC del usuario ni produccion; sin secretos o dumps publicados.') | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding UTF8
} catch {
  Write-Output ('FAIL etapa: ' + $stage)
  $originalFailure = $_
  try { Write-SafeDiagnostics } catch { Write-Output 'Diagnostico parcial: archivo de estado/log no legible.' }
  ('## Prueba bloqueada o fallida' + "`nEtapa: $stage. Las etapas posteriores no se ejecutaron.") | Add-Content -LiteralPath $env:GITHUB_STEP_SUMMARY -Encoding UTF8
  throw $originalFailure
} finally {
  # Solo los dos archivos privados creados por esta prueba, no datos del producto.
  foreach ($file in @($answer,$credential)) { if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force } }
  $password = $null; $pin = $null
}
