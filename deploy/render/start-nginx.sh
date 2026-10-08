#!/bin/sh
set -eu

: "${API_UPSTREAM:?Render debe inyectar API_UPSTREAM desde nexora-pos-api}"
: "${PORT:=10000}"

# El identificador del commit se inyecta en tiempo de ejecución para que la
# app del navegador informe a Sentry qué versión está usando cada deploy.
if printf '%s' "${RENDER_GIT_COMMIT:-}" | grep -Eq '^[a-fA-F0-9]{7,64}$'; then
  printf 'window.__NEXORA_SENTRY_RELEASE__ = "nexora-pos@%s";\n' \
    "$RENDER_GIT_COMMIT" > /usr/share/nginx/html/runtime-config.js
fi

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
# (por ejemplo, nexora-pos-api:10000). Render requiere resolver esos nombres
# con el resolvedor del sistema para aplicar su configuración privada. Nginx
# consulta DNS directamente y no puede resolver ese nombre corto, por lo que
# lo convertimos a la IPv4 privada antes de generar su configuración.
api_host=${API_UPSTREAM%:*}
api_ip=$(getent hosts "$api_host" 2>/dev/null | awk 'NR == 1 { print $1 }')
if ! printf '%s' "$api_ip" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
  echo "No se pudo resolver la IPv4 privada de API_UPSTREAM." >&2
  exit 1
fi
API_UPSTREAM="${api_ip}:${api_port}"

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
