#!/bin/sh
set -eu

: "${API_UPSTREAM:?Render debe inyectar API_UPSTREAM desde nexora-pos-api}"
: "${PORT:=10000}"

# API_UPSTREAM proviene de `fromService.hostport`. La validación impide que un
# valor accidental termine convertido en una directiva de Nginx.
if ! printf '%s' "$API_UPSTREAM" | grep -Eq '^[A-Za-z0-9][A-Za-z0-9.-]*:[0-9]{1,5}$'; then
  echo "API_UPSTREAM no tiene el formato host:puerto esperado." >&2
  exit 1
fi

api_port=${API_UPSTREAM##*:}
if [ "$api_port" -lt 1 ] || [ "$api_port" -gt 65535 ]; then
  echo "API_UPSTREAM contiene un puerto fuera de rango." >&2
  exit 1
fi

# `fromService.hostport` entrega la dirección corta mostrada por Render
# (por ejemplo, nexora-pos-api:10000). El resolvedor asíncrono de Nginx no
# aplica los dominios de búsqueda de /etc/resolv.conf, así que para volver a
# resolver cambios de instancia debe consultar el hostname de descubrimiento
# explícito que Render publica para cada servicio.
api_host=${API_UPSTREAM%:*}
case "$api_host" in
  *-discovery) ;;
  *) api_host="${api_host}-discovery" ;;
esac
API_UPSTREAM="${api_host}:${api_port}"

if ! printf '%s' "$PORT" | grep -Eq '^[0-9]{1,5}$' \
  || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "PORT no contiene un puerto válido." >&2
  exit 1
fi

resolver_address=$(awk '$1 == "nameserver" { print $2; exit }' /etc/resolv.conf)
if [ -z "$resolver_address" ] \
  || ! printf '%s' "$resolver_address" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$|^[0-9A-Fa-f:]+$'; then
  echo "No se encontró un resolvedor DNS seguro en /etc/resolv.conf." >&2
  exit 1
fi

case "$resolver_address" in
  *:*) NGINX_RESOLVER="[$resolver_address]" ;;
  *)   NGINX_RESOLVER="$resolver_address" ;;
esac
export API_UPSTREAM PORT NGINX_RESOLVER

exec /docker-entrypoint.sh "$@"
