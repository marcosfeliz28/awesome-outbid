#!/bin/sh
# Genera el snippet de cabeceras de seguridad de Nginx a partir de
# deploy/render/security-headers.conf, que lleva el marcador
# ${NEXORA_CSP_SENTRY_SRC} dentro de connect-src.
#
# El destino de Sentry sólo se añade a la CSP si hay VITE_SENTRY_DSN (la misma
# variable con la que se compila la web; Render la entrega también al
# arrancar). Sin DSN, o con uno que no sea https://<clave>@<host>/<proyecto>,
# connect-src queda en 'self' y el arranque sigue.
#
# Uso: render-security-headers.sh <plantilla> <destino>
set -eu

template=${1:?Falta la plantilla de cabeceras}
target=${2:?Falta el destino del snippet}

sentry_src=""
dsn=$(printf '%s' "${VITE_SENTRY_DSN:-}" | tr -d '[:space:]')
if [ -n "$dsn" ]; then
  rest=${dsn#https://}
  origin=""
  if [ "$rest" != "$dsn" ]; then
    rest=${rest#*@}
    origin="https://${rest%%/*}"
  fi
  # Sólo un origen https con host (y puerto opcional): el valor acaba dentro
  # de una directiva de Nginx y no puede contener comillas, espacios ni `;`.
  if printf '%s' "$origin" | grep -Eq \
    '^https://[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?(:[0-9]{1,5})?$'; then
    sentry_src=" $origin"
  else
    echo "VITE_SENTRY_DSN no tiene el formato esperado; la CSP no incluye Sentry." >&2
  fi
fi

sed "s|[\$]{NEXORA_CSP_SENTRY_SRC}|$sentry_src|g" "$template" > "$target.tmp"
if grep -q 'NEXORA_CSP_SENTRY_SRC' "$target.tmp"; then
  rm -f "$target.tmp"
  echo "No se pudo generar el snippet de cabeceras de seguridad." >&2
  exit 1
fi
mv "$target.tmp" "$target"
