# PC-19 · Licencia de Nexora POS Local

El perfil `pnpm instalador:producto-local` arranca la API con `PRODUCT_LOCAL_LICENSE=required` y construye la web con `VITE_PRODUCT_LOCAL_LICENSE=required`. La compilación exige `NEXORA_LICENSE_PUBLIC_KEY`, una clave pública Ed25519 PEM (puede tener `\n` literales). La clave de prueba del CI nunca se publica como instalador. La nube SaaS no configura estos interruptores.

## Configuración local

Las actualizaciones deben conservar la misma clave pública, o coordinar la rotación y reemisión antes de instalar: esta versión admite una sola clave pública y una rotación sin transición dejaría la instalación en solo lectura.

- `PRODUCT_LOCAL_INSTALLATION_ID`: identificador persistente y único de esta instalación.
- `PRODUCT_LOCAL_LICENSE_DIR`: directorio persistente bajo ProgramData, accesible solo para la cuenta del servicio y administradores. Debe sobrevivir a las actualizaciones.
- `PRODUCT_LOCAL_LICENSE_PUBLIC_KEY`: clave pública Ed25519 SPKI PEM de la autoridad de licencias. Puede contener `\\n` literales en la variable de entorno.
- `PRODUCT_LOCAL_LICENSE_RENEW_URL`: URL HTTPS del servicio de licencias de Nexora.
- `PRODUCT_LOCAL_LICENSE_RENEW_TOKEN`: credencial del equipo para ese servicio. Se configura fuera del repositorio y nunca se registra en logs.

La clave privada Ed25519 pertenece exclusivamente al servicio de licencias de la nube; no debe llegar al instalador, al equipo ni al repositorio. La nube debe autenticar la credencial, asociarla con `installationId` y con la empresa, consultar el estado de pago y responder con `{ claims, signature }`. `claims` contiene `version: 2`, `tenantId` (empresa), `deviceHash` (SHA-256 de `nexora-device-v1|<MachineGuid de Windows>`, o del nombre del equipo si no se puede leer), `installationId`, `issuedAt`, `expiresAt` y `status` (`active` o `unpaid`); la renovación envía `installationId`, `tenantId` y `deviceHash`. Firma los bytes UTF-8 de `JSON.stringify(["nexora-local-license", version, tenantId, deviceHash, installationId, issuedAt, expiresAt, status])` con Ed25519 y codifica la firma como base64url. `expiresAt` debe ser posterior a `issuedAt` y separarse por un máximo de siete días. Los tiempos usan ISO UTC con milisegundos. Cada respuesta aceptada debe tener `issuedAt` posterior a la anterior.

La API intenta renovar al arrancar y cada hora. Cuando no hay internet conserva la última licencia firmada hasta su vencimiento. Si la nube informa impago, debe emitir una licencia firmada `unpaid`; la API pasa a solo lectura de inmediato. Al vencer o detectar un reloj atrasado más de cinco minutos también bloquea escrituras. No altera la base de datos para imponer el bloqueo. La cola del navegador consulta la API local antes de guardar cada venta; la API vuelve a comprobar la fecha de captura al sincronizar. Si una venta del lote quedó fuera de la vigencia, la API responde por venta: esa pasa a revisión (`conflict`) y las demás se reintentan (`retry`); no se bloquea el lote. Las licencias se conservan 90 días después de vencer (no por cantidad). Una licencia firmada más nueva repara un reloj que estuvo adelantado. Con la licencia en solo lectura la retención no borra nada.

`GET /api/local-license/status` expone solo modo, motivo y vencimiento. El historial firmado y la marca del reloj se guardan en el directorio persistente. Una persona con control administrativo del sistema operativo puede modificar ambos archivos o el ejecutable: esta política protege la operación normal y errores de reloj, pero no pretende resistir la manipulación de un administrador local. No usar datos reales ni claves privadas en pruebas.

El instalador crea un `installationId` aleatorio persistente en `state.json` y un directorio de licencia privado bajo ProgramData con escritura solo para la cuenta de la API y administradores. La clave pública se copia al paquete; la privada nunca sale de la nube. Hasta aprovisionar `PRODUCT_LOCAL_LICENSE_RENEW_URL`, la credencial de renovación y una licencia firmada, la API funciona en **solo lectura** y se puede comprobar su salud, pero no vender.

**Pendiente para distribuir:** la nube debe publicar el servicio de emisión autenticado, aprovisionar la credencial por instalación y probar una renovación real, impago y reloj atrasado en Windows. No se entrega como producto vendible antes de eso.

## Verificación de esta rama

La regresión se ejecutó antes de crear `apps/api/src/local-license.ts`: Vitest falló al resolver ese módulo. Tras la implementación, los 9 casos focales pasan (firma, vinculación con instalación, vencimiento, renovación, reloj, impago, rutas HTTP y cola offline). La primera corrida de `pnpm check` superó tipos y lint, pero una prueba preexistente de rate limiting con Nest agotó su timeout de 60 segundos bajo carga de varios worktrees; se detuvo la corrida completa y se verificaron por separado los componentes modificados.
