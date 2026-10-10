#!/bin/sh
# Genera el snippet `geo` con las redes desde las que Nginx acepta la IP del
# cliente que fija el borde (CF-Connecting-IP); ver nginx.conf.template.
#
# En Render, Nginx sólo recibe conexiones del proxy de Render (red interna),
# nunca directamente de Internet. NEXORA_TRUSTED_EDGE_CIDRS lista esas redes
# separadas por espacios o comas; por defecto, las privadas y la de CGNAT.
# Con "none" no se confía en ninguna: la API ve la IP de la conexión, como
# antes de S-01 (seguro, pero la IP queda colapsada en la del borde).
#
# Uso: render-trusted-edge.sh <destino>
set -eu

target=${1:?Falta el destino del snippet}
cidrs=${NEXORA_TRUSTED_EDGE_CIDRS-10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10 fc00::/7}

tmp="$target.tmp"
: > "$tmp"
if [ "$cidrs" != "none" ]; then
  for cidr in $(printf '%s' "$cidrs" | tr ',' ' '); do
    # Sólo IPv4/IPv6 con prefijo: el valor acaba dentro de una directiva de
    # Nginx y no puede contener `;`, espacios ni comillas.
    if printf '%s' "$cidr" | grep -Eq \
      '^(([0-9]{1,3}\.){3}[0-9]{1,3}/[0-9]{1,2}|[0-9A-Fa-f:]*:[0-9A-Fa-f:]*/[0-9]{1,3})$'; then
      printf '%s 1;\n' "$cidr" >> "$tmp"
    else
      echo "NEXORA_TRUSTED_EDGE_CIDRS contiene un valor no válido." >&2
      rm -f "$tmp"
      exit 1
    fi
  done
fi
mv "$tmp" "$target"
