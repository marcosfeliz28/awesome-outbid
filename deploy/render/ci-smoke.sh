#!/usr/bin/env bash
# Prueba de humo de las imágenes de Render, sin publicarlas (CI, A4/M5).
#
# Reproduce en Docker lo que hace Render, en el orden de un despliegue real:
#   1. PostgreSQL 17 con TLS (como el gestionado de Render).
#   2. La web arranca ANTES que la API: debe servir la PWA, /healthz en 204 y
#      /api en 502 con mensaje claro (no puede quedarse caída).
#   3. El preDeployCommand de render.yaml aplica las migraciones.
#   4. Arranca la API y la web la encuentra sola (re-resolución del upstream).
#   5. deploy/render/post-deploy-check.mjs pasa contra la web y, con --db-only,
#      contra la base (índices válidos, restricciones validadas, disparador).
#
# Uso: bash deploy/render/ci-smoke.sh   (desde la raíz del repositorio)
# Imágenes: NEXORA_API_IMAGE y NEXORA_WEB_IMAGE (por defecto, las de CI).
set -euo pipefail

API_IMAGE=${NEXORA_API_IMAGE:-nexora-pos-api:ci}
WEB_IMAGE=${NEXORA_WEB_IMAGE:-nexora-pos-web:ci}
# Misma versión mayor y menor que la base de Render (17.11), fijada por digest.
PG_IMAGE=${NEXORA_PG_IMAGE:-postgres:17.11@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3}
WEB_PORT=${NEXORA_SMOKE_PORT:-18080}
WEB_URL="http://127.0.0.1:${WEB_PORT}"

suffix="$$"
net="nexora-smoke-${suffix}"
db="nexora-smoke-db-${suffix}"
api="nexora-smoke-api-${suffix}"
web="nexora-smoke-web-${suffix}"
pg_password=$(openssl rand -hex 16)
jwt_secret=$(openssl rand -hex 32)
database_url="postgresql://fitstore:${pg_password}@nexora-pos-db:5432/fitstore_bfjz"

fail() {
  echo "FALLO: $*" >&2
  exit 1
}

cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    for container in "$web" "$api" "$db"; do
      echo "--- logs de ${container}" >&2
      docker logs --tail 80 "$container" >&2 2>&1 || true
    done
  fi
  docker rm -f "$web" "$api" "$db" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

status_of() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" || true
}

wait_status() {
  local url=$1 expected=$2 seconds=$3 got=""
  for _ in $(seq 1 "$seconds"); do
    got=$(status_of "$url")
    [ "$got" = "$expected" ] && return 0
    sleep 1
  done
  fail "$url respondió ${got:-nada}, se esperaba $expected"
}

docker network create "$net" >/dev/null

echo "1) PostgreSQL 17 con TLS"
docker run -d --name "$db" --network "$net" --network-alias nexora-pos-db \
  -e POSTGRES_USER=fitstore -e POSTGRES_PASSWORD="$pg_password" \
  -e POSTGRES_DB=fitstore_bfjz "$PG_IMAGE" \
  -c ssl=on \
  -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem \
  -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key >/dev/null
for _ in $(seq 1 60); do
  docker exec "$db" pg_isready -U fitstore -d fitstore_bfjz -h 127.0.0.1 \
    >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$db" pg_isready -U fitstore -d fitstore_bfjz -h 127.0.0.1 \
  >/dev/null || fail "PostgreSQL no arrancó"

echo "2) La web arranca sin API"
docker run -d --name "$web" --network "$net" \
  -p "127.0.0.1:${WEB_PORT}:10000" \
  -e PORT=10000 -e API_UPSTREAM=nexora-pos-api:10000 \
  -e NEXORA_UPSTREAM_REFRESH_SECONDS=2 "$WEB_IMAGE" >/dev/null
wait_status "$WEB_URL/healthz" 204 60
[ "$(status_of "$WEB_URL/")" = 200 ] || fail "la PWA no se sirve sin API"
[ "$(status_of "$WEB_URL/healthz/deep")" = 503 ] \
  || fail "/healthz/deep debe dar 503 sin API"
body=$(curl -s --max-time 10 -w '\n%{http_code}' "$WEB_URL/api/health")
[ "$(printf '%s' "$body" | tail -n 1)" = 502 ] || fail "/api sin API no dio 502"
printf '%s' "$body" | grep -q '"statusCode":502' \
  || fail "/api sin API no devolvió el JSON claro"

echo "3) preDeployCommand de render.yaml (migraciones)"
predeploy=$(sed -n 's/^ *preDeployCommand: *//p' render.yaml)
[ -n "$predeploy" ] || fail "render.yaml no tiene preDeployCommand"
# shellcheck disable=SC2086 # la orden se divide en palabras a propósito
docker run --rm --network "$net" -e RENDER_DATABASE_URL="$database_url" \
  "$API_IMAGE" $predeploy

echo "4) Arranca la API"
docker run -d --name "$api" --network "$net" --network-alias nexora-pos-api \
  -e NODE_ENV=production -e PORT=10000 -e ENABLE_SWAGGER=false \
  -e RENDER_DATABASE_URL="$database_url" -e WEB_ORIGIN="$WEB_URL" \
  -e JWT_SECRET="$jwt_secret" "$API_IMAGE" >/dev/null

echo "5) Comprobación posterior al despliegue a través de la web"
NEXORA_CHECK_ATTEMPTS=24 NEXORA_CHECK_DELAY_MS=5000 \
  node deploy/render/post-deploy-check.mjs "$WEB_URL"
wait_status "$WEB_URL/healthz/deep" 204 30

echo "5b) Índices, restricciones validadas y disparador (solo lectura)"
# Mismo script que se corre en el shell de la API de Render tras desplegar
# (docs/DEPLOY-RENDER.md): falla si una migración omitió algo sin avisar.
docker run --rm --network "$net" -e RENDER_DATABASE_URL="$database_url" \
  "$API_IMAGE" node deploy/render/post-deploy-check.mjs --db-only

echo "6) Las migraciones son idempotentes"
# shellcheck disable=SC2086
docker run --rm --network "$net" -e RENDER_DATABASE_URL="$database_url" \
  "$API_IMAGE" $predeploy | grep -q "No pending migrations to apply" \
  || fail "un segundo migrate deploy no quedó sin pendientes"

echo "Prueba de humo de las imágenes: correcta."
