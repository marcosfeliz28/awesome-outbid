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

# La CSP sólo autoriza el destino de Sentry si hay VITE_SENTRY_DSN (G8): sin
# DSN, connect-src queda en 'self'. Ver render-security-headers.sh.
nexora-render-security-headers /etc/nginx/nexora/security-headers.conf.in \
  /etc/nginx/snippets/nexora-security-headers.conf

# Redes del borde de Render y de Cloudflare cuya CF-Connecting-IP se acepta
# como IP real del cliente (S-01, N-04). Ver render-trusted-edge.sh y
# nginx.conf.template.
nexora-render-trusted-edge /etc/nginx/snippets/nexora-trusted-edge.conf \
  /etc/nginx/snippets/nexora-cloudflare-ips.conf

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
# (por ejemplo, nexora-pos-api:10000). Ese nombre sólo se resuelve con el
# resolvedor del sistema (getent), no con el cliente DNS de Nginx. Como la IP
# privada de la API cambia al redesplegarla, el upstream se guarda en un
# archivo incluido por la configuración y un bucle lo vuelve a resolver cada
# 10 s; si la IP cambió, reescribe el archivo y recarga Nginx sin cortar
# conexiones. Así la web no queda con una IP vieja (502) tras desplegar la API.
api_host=${API_UPSTREAM%:*}
upstream_file=/etc/nginx/snippets/nexora-api-upstream.conf

resolve_api_ip() {
  getent hosts "$api_host" 2>/dev/null | awk 'NR == 1 { print $1 }' \
    | grep -E '^([0-9]{1,3}\.){3}[0-9]{1,3}$' || true
}

write_upstream() {
  printf 'server %s:%s;\n' "$1" "$api_port" > "$upstream_file.tmp"
  mv "$upstream_file.tmp" "$upstream_file"
}

# Upstream de reserva: un servidor marcado `down`, así Nginx arranca y
# responde 502 (JSON claro en /api, ver nginx.conf.template) en vez de dejar
# la web caída. La PWA trata el 502 como «sin conexión».
write_unavailable_upstream() {
  printf 'server 127.0.0.1:%s down;\n' "$api_port" > "$upstream_file.tmp"
  mv "$upstream_file.tmp" "$upstream_file"
}

# Si la API no resuelve al arrancar (suspendida, reiniciando o en un
# despliegue fallido), la web arranca igual: sirve la PWA, /healthz responde
# y /api devuelve 502 hasta que el bucle de abajo encuentre la API.
api_ip=$(resolve_api_ip)
if [ -n "$api_ip" ]; then
  write_upstream "$api_ip"
else
  echo "La API aún no resuelve; Nginx arranca con /api en 502 y se reintenta cada ${NEXORA_UPSTREAM_REFRESH_SECONDS:-10} s." >&2
  write_unavailable_upstream
fi

# El bucle mantiene vivo el enlace con la API. Si termina (error o señal),
# detiene Nginx ($$ es el PID que hereda Nginx con `exec`) para que Render
# reinicie la web en lugar de dejarla con una IP vieja para siempre. Docker
# sólo envía la señal de parada a Nginx (PID 1), no a este bucle.
(
  trap 'echo "El bucle de re-resolución de la API terminó; se detiene Nginx para reiniciar la web." >&2; kill -TERM $$ 2>/dev/null' EXIT
  trap 'exit 1' HUP INT TERM
  current_ip=$api_ip
  while sleep "${NEXORA_UPSTREAM_REFRESH_SECONDS:-10}"; do
    new_ip=$(resolve_api_ip)
    # Si la resolución falla (API reiniciando) se conserva la última IP.
    if [ -n "$new_ip" ] && [ "$new_ip" != "$current_ip" ] \
      && [ -s /run/nginx.pid ]; then
      write_upstream "$new_ip"
      if nginx -t >/dev/null 2>&1 && nginx -s reload 2>/dev/null; then
        current_ip=$new_ip
        echo "Upstream de la API actualizado y Nginx recargado." >&2
      fi
    fi
  done
) &

if ! printf '%s' "$PORT" | grep -Eq '^[0-9]{1,5}$' \
  || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "PORT no contiene un puerto válido." >&2
  exit 1
fi

export API_UPSTREAM PORT

exec /docker-entrypoint.sh "$@"
