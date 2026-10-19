#!/usr/bin/env bash
# Humo REAL del producto SaaS sobre imágenes Render y PostgreSQL desechable.
# No utiliza render.yaml ni la base/servicios de la tienda.
set -euo pipefail

API_IMAGE=${NEXORA_API_IMAGE:-nexora-pos-api:ci}
WEB_IMAGE=${NEXORA_WEB_IMAGE:-nexora-pos-web:ci}
PG_IMAGE=${NEXORA_PG_IMAGE:-postgres:17.11@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3}
WEB_PORT=${NEXORA_SMOKE_PORT:-18080}
WEB_URL="http://127.0.0.1:${WEB_PORT}"
suffix="$$"
net="nexora-product-smoke-${suffix}"
db="nexora-product-db-${suffix}"
api="nexora-product-api-${suffix}"
web="nexora-product-web-${suffix}"
pg_password=$(openssl rand -hex 16)
jwt_secret=$(openssl rand -hex 32)
database_url="postgresql://nexora_saas_migrator:${pg_password}@nexora-saas-db:5432/nexora_saas"

fail() { echo "FALLO producto: $*" >&2; exit 1; }
cleanup() {
  status=$?
  if [ "$status" -ne 0 ]; then
    for container in "$db" "$api" "$web"; do
      echo "--- logs de ${container}" >&2
      docker logs --tail 80 "$container" >&2 2>&1 || true
    done
  fi
  docker rm -f "$web" "$api" "$db" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
  exit "$status"
}
trap cleanup EXIT

status_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$1" || true; }
wait_status() {
  local url=$1 expected=$2 seconds=$3 got=""
  for _ in $(seq 1 "$seconds"); do
    got=$(status_of "$url")
    [ "$got" = "$expected" ] && return 0
    sleep 1
  done
  fail "$url respondió ${got:-nada}; esperado $expected"
}

docker network create "$net" >/dev/null
echo "1) PostgreSQL 17 desechable para Nexora SaaS"
docker run -d --name "$db" --network "$net" --network-alias nexora-saas-db \
  -e POSTGRES_USER=nexora_saas_migrator -e POSTGRES_PASSWORD="$pg_password" \
  -e POSTGRES_DB=nexora_saas "$PG_IMAGE" \
  -c ssl=on -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem \
  -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key >/dev/null
for _ in $(seq 1 60); do
  docker exec "$db" pg_isready -U nexora_saas_migrator -d nexora_saas -h 127.0.0.1 \
    >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$db" pg_isready -U nexora_saas_migrator -d nexora_saas -h 127.0.0.1 \
  >/dev/null || fail "PostgreSQL no arrancó"

echo "2) Rol de producto antes de migrar: script exacto e idempotente"
for _ in 1 2; do
  docker exec -i "$db" psql -X -v ON_ERROR_STOP=1 -U nexora_saas_migrator -d nexora_saas \
    < scripts/producto-bootstrap.sql >/dev/null
done

echo "3) Web antes que API: disponibilidad y error claro"
docker run -d --name "$web" --network "$net" -p "127.0.0.1:${WEB_PORT}:10000" \
  -e PORT=10000 -e API_UPSTREAM=nexora-saas-api:10000 \
  -e NEXORA_UPSTREAM_REFRESH_SECONDS=2 "$WEB_IMAGE" >/dev/null
wait_status "$WEB_URL/healthz" 204 60
[ "$(status_of "$WEB_URL/")" = 200 ] || fail "la PWA no sirve sin API"
[ "$(status_of "$WEB_URL/healthz/deep")" = 503 ] || fail "la web no detecta API ausente"

echo "4) Predeploy exacto de render.producto.yaml"
predeploy=$(sed -n 's/^ *preDeployCommand: *//p' render.producto.yaml)
[ -n "$predeploy" ] || fail "render.producto.yaml no tiene preDeployCommand"
# shellcheck disable=SC2086 -- la orden del blueprint se divide a propósito.
docker run --rm --network "$net" -e RENDER_DATABASE_URL="$database_url" \
  "$API_IMAGE" $predeploy

echo "5) API con aislamiento obligatorio y comprobación a través de la web"
docker run -d --name "$api" --network "$net" --network-alias nexora-saas-api \
  -e NODE_ENV=production -e PORT=10000 -e ENABLE_SWAGGER=false \
  -e PRODUCT_TENANCY=required -e RENDER_DATABASE_URL="$database_url" \
  -e WEB_ORIGIN="$WEB_URL" -e JWT_SECRET="$jwt_secret" "$API_IMAGE" >/dev/null
wait_status "$WEB_URL/api/health" 200 60
wait_status "$WEB_URL/healthz/deep" 204 30
wait_status "$WEB_URL/api/products" 400 10

echo "6) Comprobación SQL: rol sin LOGIN, RLS y claves por empresa"
docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U nexora_saas_migrator -d nexora_saas \
  -Atqc "SELECT CASE WHEN NOT r.rolcanlogin AND pg_has_role('nexora_saas_migrator', r.oid, 'MEMBER') THEN 'ok' ELSE 'fail' END FROM pg_roles r WHERE r.rolname='nexora_tenant_runtime'" \
  | grep -qx ok || fail "rol de ejecución RLS ausente"
docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U nexora_saas_migrator -d nexora_saas \
  -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('Sale','User','Variant','Tenant') AND rowsecurity" \
  | grep -qx 4 || fail "RLS no está activo en las tablas críticas"
docker exec "$db" psql -X -v ON_ERROR_STOP=1 -U nexora_saas_migrator -d nexora_saas \
  -Atqc "SELECT count(*) FROM pg_indexes WHERE schemaname='public' AND indexname IN ('Sale_tenantId_number_key','User_tenantId_email_key','Variant_tenantId_sku_ci_key','Counter_pkey')" \
  | grep -qx 4 || fail "faltan índices/secuencias por empresa"

echo "7) Migración idempotente"
# shellcheck disable=SC2086
docker run --rm --network "$net" -e RENDER_DATABASE_URL="$database_url" \
  "$API_IMAGE" $predeploy | grep -q "No pending migrations to apply" \
  || fail "migrate deploy no quedó sin pendientes"
echo "Prueba de humo del producto: correcta."
