Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function New-RandomSecret {
  $bytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
  [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker no está instalado o no está disponible en PATH; no se inició ningún servicio."
}

$env:NEXORA_AUDIT_DB_PASSWORD = New-RandomSecret
$env:NEXORA_AUDIT_JWT_SECRET = New-RandomSecret
try {
  docker compose -f compose.audit.yaml up --build
  if ($LASTEXITCODE -ne 0) { throw "Docker Compose terminó con código $LASTEXITCODE." }
} finally {
  Remove-Item Env:NEXORA_AUDIT_DB_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:NEXORA_AUDIT_JWT_SECRET -ErrorAction SilentlyContinue
}
