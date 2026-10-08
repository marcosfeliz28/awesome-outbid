# Monitoreo seguro de la API en Sentry

La API NestJS solo envía errores internos (HTTP 5xx) cuando se configura
`SENTRY_DSN` en el entorno del servicio API. Sin esa variable, el SDK queda
desactivado y no hace llamadas salientes. Esta integración no habilita trazas
de servidor.

## Variables para Render

En el servicio de la API, configurar:

- `SENTRY_DSN`: DSN del proyecto Sentry destinado a la API, guardado como
  variable de entorno privada en Render. No ponerlo en documentos, capturas,
  logs ni en el frontend.
- `SENTRY_ENVIRONMENT`: `production` (opcional; si falta, toma
  `NODE_ENV` y luego `production`).
- `SENTRY_RELEASE`: identificador de release manual opcional. Si falta y
  Render provee `RENDER_GIT_COMMIT`, se construye `nexora-api@<commit>`.

La inicialización ocurre después de cargar dotenv y antes de iniciar NestJS.
Los fallos internos se clasifican solo como `api`, `sales`, `cash` o `startup`.
No se adjuntan cuerpos, query strings, headers, cookies, identidad del usuario,
mensajes literales de error ni datos de Prisma; la sanitización conserva el
stack técnico y reemplaza texto libre por un mensaje genérico. Trazas de
performance permanecen apagadas.

## Alcance y validación

La captura cubre excepciones HTTP 5xx no controladas por las rutas de ventas y
caja, además de errores del proceso de arranque. Los errores esperados de
validación, permisos y conflictos 4xx no se reportan. Tras añadir el DSN al
servicio API, desplegar y provocar un error controlado en un entorno de prueba,
verificar en Sentry que el issue muestre `api.internal_error`, el área permitida
y un stack técnico, pero ningún dato de la petición.
