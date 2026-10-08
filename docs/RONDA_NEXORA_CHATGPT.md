# Ronda de correcciones y verificación Nexora

**Fecha de revisión:** 8 de octubre de 2026  
**Rama y base de trabajo:** `main` con cambios locales de la ronda en progreso, sobre `origin/nexora-cloud`.  
**Alcance:** sólo código local y datos ficticios. No se conectó ni modificó producción, Render, S3 o cuentas de negocio.

## A. Correcciones

### A1. Forzar la rotación de contraseñas temporales

- Se agrega `User.mustChangePassword` mediante migración expandible; el valor
  predeterminado es `false`, sin cambiar ninguna cuenta automáticamente.
- Login responde con una señal de cambio obligatorio y no emite sesión normal.
  El guard bloquea también sesiones antiguas marcadas para cambio. La pantalla
  solicita contraseña temporal, clave nueva y confirmación en el mismo acceso.
- La clave nueva debe tener 12–128 caracteres, no exceder 72 bytes UTF-8 para
  compatibilidad con bcrypt y contener mayúscula, minúscula, número y símbolo.
- Cambiar la contraseña revoca sesiones/tokens viejos e incrementa la versión
  de autenticación. Crear un usuario o restablecerle la contraseña desde la
  administración también requiere cambio al iniciar.
- `apps/api/scripts/require-password-change.ts` marca cuentas temporales ya
  existentes usando una lista proporcionada al ejecutar una tarea puntual. No
  contiene nombres, IDs ni claves reales. Valida todas las cuentas antes de
  modificar y hace todo en una transacción; requiere la confirmación
  `ROTATE_TEMPORARY_PASSWORDS`.

Pruebas: `tests/auth-username.test.ts` cubre claves cortas/débiles, longitud,
política, endpoint, migración, bloqueo del guard y pantalla. Resultado:
**4 pruebas pasan**. Antes, en el commit base, una comprobación de sus fuentes
mostró: `FALLO ANTES A1: User.mustChangePassword y POST /auth/change-password no existen.`

La migración y la marca no se han aplicado a Render. Para afectar cuentas ya
existentes, primero se debe publicar esta migración y luego ejecutar el comando
administrativo en el servicio correcto con los nombres aprobados por el dueño.

### A2. Cabeceras del sitio cloud

`deploy/render/security-headers.conf` añade CSP, HSTS, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy` y Permissions Policy. La
CSP admite assets propios, worker `blob:` para PWA, API del mismo origen,
ingesta Sentry, datos/blob de imágenes y hojas de estilo inline existentes; la
cámara sigue permitida en el propio origen. El snippet se incluye también en
locations Nginx que reemplazan la herencia de `add_header`.

Prueba: `tests/cloud-deploy.test.ts` comprueba todas las cabeceras y las
directivas de worker, cámara y Sentry. Resultado: **14 pruebas cloud pasan**.
En el commit base la regresión era: `FALLO ANTES A2: falta CSP/cabeceras de seguridad.`
No fue posible validar Nginx ejecutándose ni hacer recorrido manual de PWA,
cámara y offline: este equipo no tiene Docker ni Nginx instalados. No se afirma
una validación dinámica que no se ejecutó.

### A3. IP de cliente frente a cabeceras falsificadas

El hallazgo de Claude es válido: `CF-Ray` es reenviable y no autentica por sí
mismo que `CF-Connecting-IP` sea confiable. Se cambió el mapa Nginx para que
use sólo `$remote_addr`; Nginx reemplaza las dos cabeceras de IP hacia la API y
no conserva las que envía el cliente. La API aún declara un salto de proxy.
Render recomienda `X-Forwarded-For` para obtener la IP cliente, pero la fuente
consultada no garantiza que el borde la sobrescriba siempre; por prudencia no
se confía en ella. Esto significa que la IP vista puede corresponder al proxy
inmediato, no al usuario. La limitación debe aceptarse antes de usar IP como
señal individual de seguridad.

La nueva regresión envía a la vez `CF-Ray`, `CF-Connecting-IP` y
`X-Forwarded-For` falsificados, y exige que Nginx derive el valor sólo de
`$remote_addr`. La prueba de texto/configuración no sustituye una ejecución de
Nginx real. Docker y Nginx no están disponibles en este equipo, así que esa
prueba dinámica queda declarada pendiente.

### A4. Respaldos y restauración

El recurso de `render.yaml` es PostgreSQL pagado `0.1c-256mb`. Ese tamaño no
indica el plan del workspace. En el panel de Render se verificó que el
workspace está en **Hobby**; no se cambió el plan ni la configuración. La documentación
oficial consultada el 8-oct-2026 declara PITR continuo en PostgreSQL pagado,
con ventana de **3 días para Hobby** y **7 días para Pro o superior**; exports
lógicos iniciados manualmente duran **7 días**. Free no incluye esas
recuperaciones. Fuente: [Render Postgres Recovery and Backups](https://render.com/docs/postgresql-backups).

Se añadió a `docs/DEPLOY-RENDER.md` una guía que recomienda PITR hacia una nueva
instancia; para export `.dir.tar.gz`, restauración `pg_restore --format=directory`
a una base vacía; validar salud y datos antes de cambiar `RENDER_DATABASE_URL`;
y conservar intacta la base de origen durante la comprobación. El respaldo
privado diario Render → bucket → laptop sigue siendo una propuesta que no está
activada ni asociada a un bucket.

**Restauración cloud no probada.** No se ejecutó contra Render ni una base
descartable porque Docker, `pg_restore` y `pg_dump` no están disponibles aquí.
Las pruebas locales existentes de restauración con inyección de fallos sí
pasaron, pero sólo simulan la lógica del instalador Windows; no equivalen a
restaurar un export de Render. El paso operativo pendiente se indica sin
presentarlo como probado.

### A5. No reutilizar contraseña temporal

`POST /api/auth/change-password` ahora rechaza una clave nueva idéntica a la
contraseña temporal, además de validar su fortaleza y confirmación. Se añade
una regresión unitaria para igualdad/desigualdad y para asegurar que el endpoint
usa esa validación. La prueba nueva falló antes porque la función de validación
y la regla no existían; ahora la regresión pasa. Resultado del conjunto:
`pnpm check` — 174 pruebas pasan y 1 queda omitida; typecheck, lint y build
también pasan.

### A6. CSP de Sentry por host exacto

La política CSP permite el origen exacto del DSN configurado en
`apps/web/src/monitoring.ts`, en lugar de permitir cualquier subdominio de la
región `us`. La regresión deriva el origen desde el DSN y comprueba que esté
permitido. Una futura migración del DSN a otra región debe actualizar el
snippet y su prueba.

### A7. Paquete completo de auditoría

El empaquetador ahora incluye `render.yaml`, `docs/DEPLOY-RENDER.md`, el script
de instalación silenciosa, el código fuente de `deploy/render/backup/` y las
notas Markdown de rondas anteriores. Mantiene excluidos los dumps y copias
reales (incluidas extensiones de respaldo), secretos, archivos de entorno no
ejemplo, salidas binarias, dependencias y artefactos de compilación. La prueba
de inclusión/exclusión falló antes para `render.yaml` y el código del respaldo.
Se generaron los ZIP completo y de cambios, con manifiestos SHA-256 y un archivo
`.excluidos.txt` junto al ZIP completo; enumera las rutas Git omitidas y el
motivo. Se verificó que ambos ZIP abren, que incluyen los artefactos requeridos
y que su SHA-256 coincide con los manifiestos. El validador rechazó cualquier
archivo de texto que contuviera los patrones de secretos configurados.

Salida comparativa de regresiones (modo focal antes y después de aplicar las
correcciones):

```text
ANTES — código de la ronda antes de corregir:
Test Files  3 failed (3)
Tests       5 failed | 41 skipped (46)
Fallos observados: origen Sentry no permitido por CSP; mapa Nginx aún dependía
de CF-Ray/CF-Connecting-IP; caso conjunto de cabeceras falsas no cubierto;
render.yaml excluido del paquete; regla contra reutilizar contraseña ausente.

DESPUÉS — regresiones focales:
Test Files  3 passed (3)
Tests       46 passed (46)
```

## B. Paquete de auditoría y límites de validación

### B1. Ambiente separado

Se preparó `compose.audit.yaml` con PostgreSQL 17, API y web; sólo la web publica
`127.0.0.1:4173`. Red interna privada, volumen con nombre propio
`nexora_audit_pgdata`, base `nexora_audit` y servicio de datos sin puerto
publicado. `scripts/Start-NexoraAuditSandbox.ps1` genera secretos efímeros en
memoria para el proceso local. El seed rehúsa ejecutarse si no coinciden el
marcador local, host y nombre de base; crea un usuario auditor y un cajero con
claves aleatorias y las muestra en la consola local sólo durante el primer
seed. No emplea `.env` ni URL de Render.

**Preparado, no ejecutado:** Docker no está instalado/disponible, así que no se
construyeron las imágenes ni se inició este ambiente. No se generaron ni
mostraron credenciales de auditoría.

### B2. Comparación de ramas y referencia canónica

El SHA solicitado `9f0a67bc3d50dde10d358a00d8c6d8e464f38854` sí existe y forma
parte de la historia de `origin/nexora-cloud`; no es el HEAD actual. La rama
Nexora comprobada está en `c28cb8c`. La otra punta comprobada es
`origin/claude/facturacion-app-architecture-a3bz90` en
`5073599c8aface24cb2f6f635b0f87abe9afbcd9`. Los dos historiales no tienen
ancestro común en las referencias locales; por eso no se presenta una falsa
comparación de commits “ahead/behind”. La comparación de árboles con Git
detectó **446 renombres/movimientos**, **60 archivos nuevos**, **68 retirados y
2 modificados**. La mayoría de los movimientos son el código que el otro árbol
vuelve a agrupar bajo `fitstore-pos/`; además allí aparecen archivos de
comunidad/website (por ejemplo `.github/ISSUE_TEMPLATE/`, `best-practices/`,
`data/boards.yml`) que no forman parte del POS.

Los servicios/API, migraciones, instalador, PWA y el despliegue Render del POS
se mantienen canónicos desde la raíz de `origin/nexora-cloud`, no desde la
copia reubicada de la otra rama. Antes de combinar, se debe comparar la
funcionalidad modificada, no fusionar automáticamente dos raíces sin base
común.

La revisión de los pendientes A06–A12 quedó implementada en el árbol local:

- **A06:** recepción exige `operationId`, maneja reintentos de serialización y
  recupera la misma recepción ante una repetición concurrente. La regresión
  focal de integración pasó y obtuvo el mismo identificador en ambas respuestas.
- **A07:** el cierre exige confirmar que se contaron efectivo, tarjeta y
  transferencia; un campo vacío se envía como cero. La interfaz no muestra ni
  autocompleta los montos esperados. API, respuesta de cierre y cuadre ocultan
  esperado y diferencias a quien no tenga `profit:read` o `sale:manage`. Una
  diferencia por encima del límite en cualquiera de los tres medios requiere
  explicación y crea una alerta con el desglose.
- **A08:** los listados de ventas, contraentregas y reportes dejaron de transportar
  la evidencia base64. Devuelven sólo metadatos y el comprobante se solicita, con
  autenticación y alcance por sucursal/caja, mediante `/payments/:id/proof`.
- **A09:** la cabecera IP cloud queda limitada a la dirección observada por Nginx,
  con la limitación de proxy explicada en A3.
- **A10:** `pnpm audit --prod` quedó en **0 vulnerabilidades conocidas** después
  de fijar versiones compatibles mediante overrides; Prisma vuelve a generar el
  cliente correctamente con `effect` 3.20.0.
- **A11:** los comprobantes distinguen monto entregado, monto aplicado y cambio,
  tanto en la impresión web como en el PDF del servidor.
- **A12:** el motivo del descuento es obligatorio; se persisten regla, usuario
  autorizador, nombre y rol, se audita para cualquier nivel permitido y esos datos
  aparecen en el comprobante. Incluye la migración
  `202610130002_discount_audit`.

Estos cambios no han sido desplegados en Render ni aplicados a producción.

### B3. Instalador Windows 11

| Comprobación                         | Resultado observado                                                                                                                                                                                                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versión de Node                      | `v24.21.0`                                                                                                                                                                                                                                                                                     |
| Versión de pnpm                      | `11.19.0`                                                                                                                                                                                                                                                                                      |
| Identidad del sistema según registro | `Windows 10 Pro`, `25H2`, build `26200.9550` (el rótulo/build es atípico; no lo renombro como Windows 11 sin evidencia)                                                                                                                                                                        |
| `pnpm instalador:validar`            | Pasa: 4/4 pruebas web, sintaxis PowerShell 26 archivos, 9 estados de actualización y 27 controles del instalador                                                                                                                                                                               |
| `Transaction-FaultInjection.ps1`     | Pasa: 9 estados de actualización protegidos                                                                                                                                                                                                                                                    |
| `Restore-FaultInjection.ps1`         | Pasa: base activa simulada intacta y temporales eliminados                                                                                                                                                                                                                                     |
| `Windows-Smoke.ps1`                  | **No ejecutado**: exige elevación y apunta a una instalación/cluster local existente; genera una copia en la carpeta de respaldos instalada y consulta la base activa. Sin una instalación de pruebas claramente aislada, ejecutarlo incumpliría la regla de no tocar datos fuera del sandbox. |

Por lo tanto no se presenta un resultado de Smoke ni se afirma que las pruebas
se ejecutaron en Windows 11. El build y UBR se recogen del registro del sistema
de esta máquina; el dato de ProductName no dice Windows 11.

### B4. Validación final de esta entrega

- `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm build`: pasan.
- Pruebas unitarias/locales: **174 pasan y 1 queda omitida**.
- `pnpm audit --prod --json`: **0 vulnerabilidades**.
- Las 21 migraciones, incluida la versión final de `discountApprovedBy`, se
  aplicaron correctamente en una base PostgreSQL 18 nueva, descartable y
  aislada. La base temporal se detuvo y eliminó. No se tocó la base instalada
  ni Render.
- La regresión focal A06 contra esa base pasó.
- La corrida integral de integración no constituye todavía un resultado de
  aceptación: arrojó 75 pases, 72 fallos y 6 omisiones porque su preparación
  compartida no completa la nueva rotación obligatoria de contraseña y luego
  propaga fallos de usuario, equipo y sesión. Debe repararse esa preparación y
  repetirse toda la integración antes de publicar en producción. No se oculta ni
  se presenta esa corrida como aprobada.

### B4. Accesos y variables

Rutas `@Public()` encontradas en el código (no requieren sesión):

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/change-password` — sólo cambia una cuenta que tenga la marca
  de cambio obligatorio y conozca su contraseña actual
- `GET /api/health/live`
- `GET /api/health` y `GET /api/health/ready`

Variables por **nombre únicamente** declaradas/consumidas para producción:

- Render Blueprint/API: `NODE_ENV`, `PORT`, `ENABLE_SWAGGER`,
  `RENDER_DATABASE_URL`, `WEB_ORIGIN`, `JWT_SECRET`, `ANTHROPIC_MODEL`.
- Web proxy Render: `API_UPSTREAM`, `NGINX_RESOLVER` (esta última se deriva de
  DNS al arrancar el contenedor).
- Opcionales: `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`,
  `VITE_SENTRY_RELEASE`, `RENDER_GIT_COMMIT`, `ANTHROPIC_API_KEY`.
- Primer administrador (variables temporales de proceso, retirar al terminar):
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_PIN`, `ADMIN_NAME`, `ADMIN_MODE`.
- Copia externa opcional no activada: `BACKUP_DATABASE_URL`,
  `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME`,
  `BACKUP_PREFIX`; en laptop, perfil AWS en lugar de clave estática y
  `PG_RESTORE_BIN`.

## Salida de pruebas de esta ronda

```text
pnpm exec vitest run tests/auth-username.test.ts tests/cloud-deploy.test.ts
Test Files  3 passed (3)
Tests       46 passed (46)

pnpm check
Typecheck y ESLint: pasan
Vitest: 174 pasan, 1 omitida (175)
Build web/PWA y API: pasan

pnpm exec vitest run tests/auth-username.test.ts tests/cloud-deploy.test.ts tests/portabilidad.test.ts
Test Files  3 passed (3)
Tests       46 passed (46)

pnpm -r typecheck
packages/ui: Done
packages/shared: Done
apps/api: Done
apps/web: Done

pnpm lint
eslint . — código de salida 0

pnpm instalador:validar
web-server.test.mjs: tests 4, pass 4, fail 0
Sintaxis PowerShell correcta: 26 archivos.
Inyeccion de fallos correcta: 9 estados de actualizacion protegidos.
Fault injection de restauracion correcta: base activa intacta y temporales eliminados.
Validación del instalador correcta: 27 archivos requeridos y controles de seguridad.
```

Pruebas restantes antes de aceptar para producción: Docker/Compose del sandbox,
build Nginx y prueba de cámara/offline, restauración real sobre base descartable
en Render, Smoke del instalador sobre Windows 11 limpio, y rotación de cualquier
credencial temporal compartida por medios externos. El build de Vite conserva
una advertencia de chunk JavaScript de aproximadamente 982 kB. No se subió,
desplegó ni envió nada a Sentry.
