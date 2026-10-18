# Área 7 — Infraestructura y despliegue

**Fecha:** 2026-10-18  
**Base revisada:** `origin/nexora-cloud` `cf6f7022ab9682db45327558e5dd18946a7b1473`  
**Rama de auditoría local:** `codex/audit-infra-20261018`  
**Alcance:** `render.yaml`, Dockerfiles, Compose, Nginx, preparación de variables cloud, workflows y pruebas relacionadas. Solo lectura sobre esos artefactos; no se abrió `.env`, no se consultó Render ni producción, no se iniciaron contenedores ni servicios.

## Comandos y resultado

- `pnpm install --frozen-lockfile` — terminó correctamente, 925 paquetes instalados/reutilizados, sin modificar archivos versionados.
- `pnpm exec vitest run tests/cloud-deploy.test.ts --reporter=verbose` — **33 pasaron, 3 omitidas, 0 fallaron** (1 archivo). Las omisiones son CSP por shell Unix, generación de snippets de CIDR por shell Unix y el ensayo de Nginx real; las dos primeras están condicionadas a Windows en `tests/cloud-deploy.test.ts:421,712`, y Nginx real se omite si no existe el binario (`:788-792`).
- No corrí `pnpm check`, Docker, migraciones, API ni pruebas con PostgreSQL: no son necesarios para este examen estático y no se configuró/consultó una base.

## Hallazgos

| ID | Severidad | Archivo:línea | Estado | Qué pasa / reproducción mínima | Parche propuesto | Prueba que debería fallar hoy |
|---|---|---|---|---|---|---|
| INF-01 | BAJO | `deploy/render/render-trusted-edge.sh:38-40` | **SIN REPRODUCIR** | El filtro de CIDR verifica forma textual, pero no rangos numéricos: acepta sintácticamente octetos IPv4 de 1–3 dígitos y prefijos de 1–2 dígitos, así que entradas de configuración como `999.999.999.999/99` pasan el `grep` y se escriben en el snippet. No ejecuté el generador ni Nginx en este host Windows; por tanto no confirmé que el Nginx del contenedor rechace la configuración ni que causaría indisponibilidad. El defecto potencial requiere que un operador ponga una CIDR malformada; los valores por defecto/repo inspeccionados no muestran ese caso. | Validar CIDR con un parser que compruebe octetos y prefijo IPv4/IPv6, o validar el snippet con `nginx -t` antes de reemplazar el destino; conservar el último snippet válido ante error. | Ampliar la prueba de `tests/cloud-deploy.test.ts` que invoca `render-trusted-edge.sh`: `999.999.999.999/8`, `10.0.0.0/99` y IPv6 con prefijo fuera de rango deben retornar error y conservar el archivo anterior. Ejecutar además `nginx -t` en Linux con las entradas aceptadas/rechazadas. |

**No hay hallazgos confirmados** de exposición pública de la base/API ni de migraciones ejecutadas sin el gate declarado a partir de los archivos revisados. INF-01 queda como riesgo de entrada de configuración, no como incidente observado.

## Controles comprobados en el repositorio

- `render.yaml:12-21,38-50,75-89`: web pública separada de API `pserv`; API y web con `autoDeployTrigger: off`; migración Prisma antes del arranque API; Postgres 17, `ipAllowList: []`, plan/disco declarados. La referencia oficial de Render describe `ipAllowList: []` para Postgres como solo conexiones internas ([Blueprint YAML Reference](https://render.com/docs/blueprint-spec)). Esto solo confirma el Blueprint versionado, no el estado real de un recurso en el panel.
- `render.yaml:58-71` y `deploy/render/with-cloud-env.mjs:65-105`: conexión obtenida por referencia a la base, conversión a TLS/UTC, límites de pool, timeouts para migraciones y eliminación de `RENDER_DATABASE_URL` antes de entregar el entorno al proceso. Los mensajes de error evitan imprimir URLs con credenciales.
- `deploy/render/Dockerfile.api:2-65`: Node fijado a versión concreta, dependencias congeladas, cliente `pg_dump/pg_restore` de PostgreSQL 17 fijado por digest, runtime como `node`, healthcheck live y heap acotado.
- `deploy/render/Dockerfile.web:2-35`: Node y Nginx fijados a versiones concretas; solo `PORT`/`API_UPSTREAM` pasan por `envsubst`; `start-nginx.sh` valida el destino antes de generar configuración.
- `deploy/render/start-nginx.sh:25-105` y `nginx.conf.template:46-171`: web arranca aun si API no resuelve y responde 502 explícito; re-resuelve DNS cada 10 s, actualiza upstream y recarga Nginx; separa liveness de readiness profunda, no bufferiza eventos y establece límites/tiempos de proxy.
- `.github/workflows/ci.yml:1-7`: permisos de GitHub Actions restringidos a `contents: read`; acciones fijadas por SHA. Los jobs corren PostgreSQL 17 fijado por digest, `pnpm check`, Playwright, restauración, build de imágenes y smoke local; el flujo no publica imágenes (`:82-99`). `windows-installer` se ejecuta por separado.
- `.github/workflows/post-deploy-check.yml:1-29`: workflow manual de solo GET; `contents: read` y `persist-credentials: false` en checkout.
- `compose.audit.yaml:1-65`: red Docker `internal`, publicación web ligada a `127.0.0.1` y secretos de sandbox requeridos por variables de entorno (no están definidos con valores en el YAML).

## No verificado / límites

- No se consultó Render: no confirmo que el panel coincida con `render.yaml`, estado de auto-deploy, listas de IP reales, variables configuradas, dominios ni recursos vivos.
- No se construyeron/arrancaron imágenes ni se ejecutó `deploy/render/ci-smoke.sh`; el job de smoke en GitHub está definido, pero su resultado remoto no forma parte de esta inspección.
- La prueba integrada de Nginx y las dos pruebas que invocan `sh` se omitieron en Windows. No se verificó resolución DNS real de Render, rotación de IP ni comportamiento de Nginx ante configuración inválida.
- No se inspeccionó el contenido de archivos `.env` ni se usaron secretos o credenciales.
- El Dockerfile raíz usa etiquetas móviles `node:24-bookworm-slim` y `nginx:1.27-alpine`; Render y CI declaran usar `deploy/render/Dockerfile.api` y `deploy/render/Dockerfile.web`, que fijan versiones concretas. No lo clasifiqué como hallazgo de despliegue porque el manifiesto versionado apunta a los Dockerfiles específicos; el build genérico local no fue auditado dinámicamente.
