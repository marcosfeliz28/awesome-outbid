# PQ28: cabeceras HTTP de seguridad (solo informe)

Fecha: 1-nov-2026. Base: `origin/nexora-cloud` (3e272476). Rama: `claude-pc/pq-23-28`. Pieza 28 de la cola.

Alcance: lectura de `deploy/render/` y de la API. Comprobación estática del código de configuración. No se hizo ninguna petición HTTP a la web ni a la API desplegadas (la orden prohíbe tocar Render y producción), así que lo que sale en vivo queda como NO COMPROBADO.

## Qué envía hoy cada respuesta

Hay dos fuentes de cabeceras: Nginx (la web y el proxy) y Helmet (la API, detrás del proxy).

### Nginx: web y estáticos

Fuente: `deploy/render/security-headers.conf`. Se copia en la imagen como `/etc/nginx/nexora/security-headers.conf.in` (`Dockerfile.web:31`) y `render-security-headers.sh` genera `/etc/nginx/snippets/nexora-security-headers.conf` al arrancar (`start-nginx.sh:16-17`). Lo incluyen 13 bloques de `nginx.conf.template` (`grep -c` de la línea `include .../nexora-security-headers.conf`: 13 coincidencias, la primera en la línea 59 del bloque `server`).

| Cabecera | Valor | Observación |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`; `base-uri 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; `form-action 'self'`; `script-src 'self'`; `style-src 'self' 'unsafe-inline'`; `img-src 'self' data: blob:`; `font-src 'self' data:`; `connect-src 'self'` (+ Sentry si hay DSN); `worker-src 'self' blob:`; `manifest-src 'self'`; `media-src 'self' blob:`; `frame-src 'self' blob:`; `upgrade-insecure-requests` | Sin `unsafe-eval`. `unsafe-inline` solo en estilos. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Sin `preload`. Opcional. |
| `X-Frame-Options` | `DENY` | Coherente con `frame-ancestors 'none'`. |
| `X-Content-Type-Options` | `nosniff` | Correcta. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` en la web; `no-referrer` en `/api/` (`nginx.conf.template:38-44`, mapa `$nexora_referrer_policy`) | Coherente con la nota de `DEPLOY-RENDER.md`. |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` | El escáner usa la cámara (`@zxing`), por eso `camera=(self)`. |

### Helmet: API (`apps/api/src/main.ts:42`)

- Helmet 8.3.0 con opciones por defecto. Envía, entre otras, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin` y `Origin-Agent-Cluster` (`apps/api/node_modules/helmet/index.cjs:175` y `:191`).
- En `/api/` y `/api/events` Nginx oculta con `proxy_hide_header` solo CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy y Permissions-Policy (`nginx.conf.template:124-129` y `:155-160`). **COOP, CORP y Origin-Agent-Cluster no se ocultan**, así que llegan al navegador.

## Hallazgos

### 1. La web no envía COOP ni CORP (medio)

- `grep -rn -i "cross-origin-"` en el repositorio: solo aparece en `docs/DEPLOY-RENDER.md:212`, que describe el comportamiento de Helmet en `/api`.
- Por tanto, las respuestas de la web (HTML, JS, CSS, fuentes, `sw.js`, `manifest`) no llevan `Cross-Origin-Opener-Policy` ni `Cross-Origin-Resource-Policy`.
- Es el hueco que ya señalaba la orden. Se confirma.
- Riesgo de no tenerlas: bajo para esta app, porque no hay pantallas que la embeban ni que la abran en popup con comunicación entre ventanas. Pero es una defensa estándar frente a ataques de tipo Spectre y de incrustación entre orígenes.

### 2. Riesgo de duplicar cabeceras si se añaden en Nginx (clave)

Si se añade COOP y CORP solo a `security-headers.conf`, en `/api/` y `/api/events` la respuesta llevaría la cabecera dos veces: una de Nginx y otra de Helmet, porque ninguna de las dos está oculta. Por eso, en esa misma propuesta hay que añadir `proxy_hide_header` para ambas, igual que con las demás cabeceras de Helmet.

### 3. Compatibilidad revisada

- COOP `same-origin`: la app no abre popups que se comuniquen con la ventana original. Tienda usa `window.open(..., "noopener,noreferrer")` (`apps/web/src/Tienda.tsx:829`), que no necesita `opener`. La vinculación de Drive usa `window.location.assign` (`apps/web/src/DriveBackup.tsx:122`), es decir, redirección de página completa y no popup. No hay `postMessage` en la web.
- CORP `same-origin` en la web: todos los recursos se sirven desde el mismo origen (`/assets/`, `/api/` por el mismo proxy). Revisar antes de subir si Capacitor (`apps/web/capacitor.config.ts`) carga la web desde una URL remota; si la carga desde el paquete local, no hay problema.
- COEP (`Cross-Origin-Embedder-Policy`): no recomendada ahora. Exige que todos los recursos cumplan CORP o CORS, y Sentry y las fuentes externas quedan afectados. No es necesaria para esta app.

## Propuesta (no aplicada)

En `deploy/render/security-headers.conf`, añadir:

```
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Cross-Origin-Resource-Policy "same-origin" always;
```

En `deploy/render/nginx.conf.template`, en `location = /api/events` y `location ^~ /api/`, añadir junto a los demás `proxy_hide_header`:

```
proxy_hide_header Cross-Origin-Opener-Policy;
proxy_hide_header Cross-Origin-Resource-Policy;
```

Pruebas antes de subir (una pieza propia, con CI y prueba de headers del contenedor):

1. `nginx -t` con la plantilla generada.
2. Prueba de `curl -I` contra el contenedor local en cada tipo de ruta: `/`, `/assets/...`, `/sw.js`, `/manifest.webmanifest`, `/api/health` o similar, `/api/events`, `/healthz`.
3. Verificar que `/api/*` lleva una sola cabecera de cada tipo.
4. Pantalla de inicio de sesión y flujo de Drive con el navegador (redirección).

Mejoras opcionales, de menor prioridad:

- `Origin-Agent-Cluster: ?1` en la web (lo envía Helmet solo en la API).
- `preload` en HSTS, solo después de confirmar que todos los subdominios usan HTTPS.

## Qué se verificó y qué no

| Punto | Estado |
|---|---|
| Contenido de `security-headers.conf` | V, leído completo |
| Inclusión en `nginx.conf.template` y generación del snippet | V (`Dockerfile.web:31`, `start-nginx.sh:16-17`) |
| Helmet activo en la API y valores por defecto | V (`main.ts:42`, `helmet/index.cjs`) |
| Ausencia de COOP y CORP en la web | V (grep en el repositorio) |
| Respuesta real de la web y de la API desplegadas | **NO COMPROBADO en vivo**: la orden prohíbe tocar producción |
| `nginx -t` del template generado | **NO COMPROBADO**: no hay Nginx en este equipo |

## No cambiado

- `deploy/render/*`, `apps/api/src/main.ts`, `render.yaml`: sin cambios.
- No se hizo ninguna petición a la web ni a la API desplegadas.
- No se desplegó nada.
