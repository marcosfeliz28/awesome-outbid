#!/bin/sh
# Genera los snippets `geo` con las redes en las que Nginx confía para tomar
# la IP del cliente de CF-Connecting-IP; ver nginx.conf.template. La cabecera
# sólo se acepta si se cumplen LAS DOS condiciones (N-04, auditoría de
# seguridad v2):
#
# 1. La conexión llega del proxy de Render (red interna). Render entrega a
#    Nginx por su red privada 10.0.0.0/8; NEXORA_TRUSTED_EDGE_CIDRS lista
#    esas redes separadas por espacios o comas (por defecto sólo 10.0.0.0/8).
#    Con "none" no se confía en ninguna: la API ve la IP de la conexión, como
#    antes de S-01 (seguro, pero la IP queda colapsada en la del borde).
# 2. Ese proxy vio la conexión de Cloudflare: el último salto de
#    X-Forwarded-For (lo añade Render, el cliente no lo controla) está en las
#    redes publicadas de Cloudflare (cloudflare-ips.txt). NEXORA_CLOUDFLARE_CIDRS
#    las reemplaza; "any" desactiva esta segunda comprobación (sólo si Render
#    no añadiera el salto; dejaría la protección en la condición 1).
#
# Uso: render-trusted-edge.sh <destino-borde> [<destino-cloudflare>
#      [<lista-cloudflare>]]
set -eu

edge_target=${1:?Falta el destino del snippet}
cloudflare_target=${2:-}
cloudflare_source=${3:-/etc/nginx/nexora/cloudflare-ips.txt}
cidrs=${NEXORA_TRUSTED_EDGE_CIDRS-10.0.0.0/8}

# Escribe "<cidr> 1;" por red válida en el destino. Sólo IPv4/IPv6 con prefijo:
# el valor acaba dentro de una directiva de Nginx y no puede contener `;`,
# espacios ni comillas. Se escribe a un temporal y se mueve al final, así
# nunca queda un snippet a medias.
emit() {
  name=$1
  list=$2
  target=$3
  tmp="$target.tmp"
  : > "$tmp"
  for cidr in $list; do
    if printf '%s' "$cidr" | grep -Eq \
      '^(([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}|[0-9A-Fa-f:]*:[0-9A-Fa-f:]*/[0-9]{1,3})$'; then
      printf '%s 1;\n' "$cidr" >> "$tmp"
    else
      echo "$name contiene un valor no válido." >&2
      rm -f "$tmp"
      exit 1
    fi
  done
  mv "$tmp" "$target"
}

if [ "$cidrs" = "none" ]; then
  edge_list=
else
  edge_list=$(printf '%s' "$cidrs" | tr ',' ' ')
fi
emit NEXORA_TRUSTED_EDGE_CIDRS "$edge_list" "$edge_target"

if [ -n "$cloudflare_target" ]; then
  if [ -n "${NEXORA_CLOUDFLARE_CIDRS-}" ]; then
    if [ "$NEXORA_CLOUDFLARE_CIDRS" = "any" ]; then
      cf_list="0.0.0.0/0 ::/0"
    else
      cf_list=$(printf '%s' "$NEXORA_CLOUDFLARE_CIDRS" | tr ',' ' ')
    fi
  else
    if [ ! -r "$cloudflare_source" ]; then
      echo "No se puede leer la lista de redes de Cloudflare ($cloudflare_source)." >&2
      exit 1
    fi
    cf_list=$(grep -Ev '^[[:space:]]*(#|$)' "$cloudflare_source" | tr '\n' ' ')
  fi
  emit NEXORA_CLOUDFLARE_CIDRS "$cf_list" "$cloudflare_target"
fi
