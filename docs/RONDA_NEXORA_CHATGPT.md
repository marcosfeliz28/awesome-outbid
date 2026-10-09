# Ronda de correcciones y verificación Nexora

**Fecha de revisión:** 8 de octubre de 2026  
**Rama y base de trabajo:** `nexora-chatgpt` con cambios locales de la ronda en progreso, sobre `origin/nexora-cloud` (`7b29966`).
**Alcance:** sólo código local y datos ficticios. No se conectó ni modificó producción, Render, S3 o cuentas de negocio.

## A. Antecedentes históricos de correcciones

Esta sección conserva evidencia de rondas anteriores. No atribuye al diff actual
cambios en `deploy/render`, `render.yaml`, el empaquetador o las rutas de
coordinación que ya formaban parte de la base recibida.

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
**5 pruebas pasan**. Antes, en el commit base, una comprobación de sus fuentes
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
`pnpm check` — 203 pruebas pasan y 1 queda omitida; typecheck, lint y build
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

## B. Antecedentes históricos del paquete y límites de validación

Los datos de esta sección describen el paquete y las validaciones acumuladas de
rondas anteriores. El alcance y la evidencia específicos del diff congelado se
documentan en la sección C.

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
Nexora comprobada está en `7b29966`. La otra punta comprobada es
`origin/claude/facturacion-app-architecture-a3bz90` en
`5073599c8aface24cb2f6f635b0f87abe9afbcd9`. Los dos historiales no tienen
ancestro común en las referencias locales; por eso no se presenta una falsa
comparación de commits “ahead/behind”. La comparación de árboles con Git
detectó **444 renombres/movimientos**, **62 archivos nuevos**, **85 retirados y
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
- Pruebas unitarias/locales: **203 pasan y 1 queda omitida**.
- `pnpm audit --prod --json`: **0 vulnerabilidades**.
- Las 22 migraciones, incluida la versión final de `discountApprovedBy` y la
  identidad canónica de lotes, se
  aplicaron correctamente en una base PostgreSQL 18 nueva, descartable y
  aislada. La base temporal se detuvo y eliminó. No se tocó la base instalada
  ni Render.
- La regresión focal A06 contra esa base pasó.
- La corrida integral de integración no constituye todavía un resultado de
  aceptación: arrojó **74 pases y 83 fallos de 157 pruebas en 107.30 s**. Ya no
  hubo contaminación por hot reload ni `ECONNREFUSED`; los fallos restantes se
  concentran en fixtures antiguos de contraseña temporal y expectativas
  históricas sobre cliente obligatorio, arqueo ciego y orden de validaciones.
  La focal aislada `R9-seguridad-2 | D1 + O1` sí terminó con **3 pases y 154
  omisiones**. La integración completa debe sanearse y repetirse antes de
  publicar; no se presenta como aprobada.

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
Test Files  2 passed (2)
Tests       19 passed (19)

pnpm check
Typecheck y ESLint: pasan
Vitest: 203 pasan, 1 omitida (204)
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
una advertencia de chunk JavaScript de 988.56 kB (313.42 kB gzip). No se subió,
desplegó ni envió nada a Sentry.

## C. Lote actual: L1, C2, F1, F2, I1, K1, D1 y O1; N2 sólo propuesta

Esta sección registra únicamente resultados observados en la rama
`nexora-chatgpt`. No reemplaza los resultados históricos de las secciones
anteriores ni declara que la suite integral o el despliegue de producción estén
aprobados. No se tocó Render ni ninguna base de producción.

### C1. Estado resumido

| Hallazgo | Estado de esta ronda                 | Evidencia disponible                                                                                                                            | Límite de la evidencia                                                                                           |
| -------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| L1       | Implementado y verificado            | Las pruebas cubren separación por cuenta, cardinalidad hostil, límites por sesión y rotación de IP sin reiniciar el contador.                   | La integración completa se ejecutó, pero aún no es una aceptación verde; véase B4.                               |
| C2       | Implementado y verificado            | Se verifican la denegación de reportes financieros, la restricción a reportes propios cerrados y la redacción de montos en alertas.             | La integración completa se ejecutó, pero aún no es una aceptación verde; véase B4.                               |
| F1       | Implementado y verificado            | POST y GET de evidencia aplican propietario de caja o permiso `sale:manage`.                                                                    | La integración completa se ejecutó, pero aún no es una aceptación verde; véase B4.                               |
| F2       | Implementado y verificado            | El historial de cajera usa una lista blanca y no expone costos ni datos internos de merma.                                                      | La integración completa se ejecutó, pero aún no es una aceptación verde; véase B4.                               |
| I1       | Implementado y verificado focalmente | Dos pruebas de integración focales pasan; seis pruebas unitarias de normalización y reintento pasan; migración ensayada sobre base descartable. | No sustituye una prueba prolongada de carga y concurrencia productiva.                                           |
| K1       | Implementado y verificado focalmente | Reintentos acotados de conflictos de serialización ejercitados en pruebas unitarias e integración.                                              | No sustituye una prueba de carga prolongada.                                                                     |
| D1       | Implementado y verificado focalmente | La corrida aislada de R9-seguridad-2, D1 y O1 terminó con 3 pruebas aprobadas y 154 omitidas.                                                   | No se atribuye aquí un resultado de suite completa.                                                              |
| O1       | Implementado y verificado focalmente | La focal aislada pasó y `offline-policy` aporta 23 pruebas sobre resolución y reprecificación contable.                                         | No se atribuye aquí un resultado de suite completa.                                                              |
| N2       | Propuesta, no implementada           | Se documentó el enfoque, pero no se modificó Nginx.                                                                                             | `deploy/render` estaba reservado por otro frente de trabajo; no existe prueba ni despliegue de N2 en esta ronda. |

### C2. I1 — identidad canónica de lote

La identidad comercial quedó definida por variante y código de lote
normalizado; el vencimiento no crea una identidad distinta. El código se
normaliza con compatibilidad Unicode, espacios exteriores/interiores
normalizados y comparación sin distinguir mayúsculas de minúsculas.

Reglas cubiertas:

- un segundo vencimiento comercial distinto para la misma identidad devuelve
  `400`;
- un lote existente sin vencimiento puede completar su fecha en una recepción
  posterior;
- variantes del mismo código por mayúsculas o espacios convergen en el mismo
  lote;
- la comparación de fechas conserva el día comercial dominicano.

Evidencia antes de la corrección, en un worktree temporal basado en
`origin/nexora-cloud` en `7b299668771065bf7b8e63e47bb9c98cc9ca24e4`, con
solamente las pruebas nuevas aplicadas:

```text
I1: estados observados [201, 500, 201, 500]; se esperaban recepciones válidas
    y el rechazo comercial explícito correspondiente.
K1: estados observados [201, 500]; se esperaba [201, 400].
Resultado focal: 2 pruebas fallaron.
```

El `afterAll` antiguo también falló al consultar `current.expected.cash`; ese
fallo pertenecía a una limpieza preexistente y no se contabilizó como evidencia
de I1 o K1. El worktree y la base temporal se eliminaron después de capturar la
salida.

Evidencia después de la corrección:

```text
pnpm exec vitest run --config vitest.integration.config.ts -t "I1 \+ K1"
Test Files  1 passed
Tests       2 passed | 155 skipped

tests/inventory-resilience.test.ts
Tests       6 passed

Prisma validate: pasa
Typecheck API: pasa
ESLint: pasa
git diff --check: pasa
```

La prueba manual de migración en una base descartable confirmó que un registro
sin fecha y otro con una única fecha se fusionan conservando la fecha, cantidad
total `5` y costo ponderado `16`. También confirmó que se reescriben tanto
`InventoryMovement.lotId` como los `lotId` contenidos en el JSONB
`SaleItem.stockAllocations` antes de eliminar duplicados. Dos fechas comerciales
no nulas distintas abortaron con el mensaje esperado:

```text
No se pueden fusionar lotes con el mismo código y vencimientos distintos
```

La transacción se revirtió por completo en ese caso: no quedó la columna nueva
y se conservó el índice anterior. Las 22 migraciones y el seed también se
aplicaron sobre una base nueva y descartable.

### C3. K1 — reintentos acotados de inventario

Los ajustes, conteos y recepciones usan un helper común con un máximo de cinco
intentos y espera aleatoria inferior a 150 ms para conflictos de serialización
identificados como SQLSTATE `40001` o errores Prisma equivalentes `P2010` y
`P2034`. Los errores ajenos a concurrencia no se reintentan. La evidencia focal
es la misma corrida de I1 + K1 y las seis pruebas unitarias descritas en C2.

### C4. L1 — límites de autenticación, PIN y ventas

Las pruebas focales existentes verifican:

- instalación única del parser JSON;
- que 61 intentos sobre una cuenta no bloqueen otra;
- que 10,001 identificadores o usuarios inexistentes no creen cubos sin límite;
- separación de los límites de PIN y ventas entre sesiones autenticadas.

Una revisión adversarial intermedia encontró que PIN y ventas combinaban sesión
e IP, por lo que rotar la IP podía reiniciar el contador. La identidad se
corrigió para depender de la sesión validada, y la prueba final confirmó que la
misma sesión continúa limitada aunque cambie la IP, sin afectar a otra sesión.

La salida final congelada del frente fue:

```text
pnpm check
Exit code   0
Vitest      14 archivos, 203 passed, 1 skipped
Typecheck   pasa
ESLint      pasa
Build web   pasa
Build API   pasa

Pruebas focales L1/C2/I1-K1/offline/Claude 2
Tests       46 passed (46)
```

### C5. C2, F1 y F2 — privacidad y autorización

C2 cubre tres rutas de fuga indirecta del arqueo: reporte financiero genérico,
consulta de reportes de caja y alertas por diferencia. Para una cajera, la
respuesta queda restringida a sus reportes cerrados permitidos y las alertas no
revelan el monto de la diferencia.

F1 exige la misma regla de acceso para subir y descargar evidencia de pago: ser
propietario de la caja correspondiente o tener `sale:manage`. F2 construye el
historial de venta para cajera mediante campos permitidos en vez de serializar
el registro interno completo, evitando costos y datos de merma.

Estas validaciones forman parte de las 46 pruebas focales aprobadas descritas en
C4. La revisión adversarial final no encontró regresiones en F1 o F2. Para C2,
confirmó además que un rol sin `profit:read` o `sale:manage` no recibe montos
`expected` ni `difference` en reportes o alertas.

### C6. D1 y O1 — compatibilidad y resolución offline

La prueba focal aislada conjunta con la regresión de seguridad terminó así:

```text
R9-seguridad-2 | D1 + O1
Tests     3 passed | 154 skipped (157)
Duration  22.05 s
```

D1 conserva la compatibilidad de una venta offline heredada mediante un motivo
de descuento controlado y mantiene la resincronización idempotente, sin relajar
la obligación de motivo para ventas online nuevas. O1 registra de forma
auditable la decisión de reprecificar o descartar. Durante esta validación se
reprodujo un error 500 y se corrigió la inyección de `Database` en
`offline-sales.ts`.

La revisión adversarial final corrigió además la contabilidad de la
reprecificación: no se inventa ni se retira efectivo ya recibido. Una subida de
precio sólo puede cubrirse con crédito o contraentrega ya existentes; de lo
contrario exige volver a cobrar. Una bajada conserva el efectivo recibido y
calcula el cambio correspondiente. `tests/offline-policy.test.ts` contiene
**23 pruebas** para estas reglas y la resolución de la cola.

### C7. N2 — resolución DNS del upstream Nginx

N2 quedó únicamente como propuesta debido a la reserva de archivos de
`deploy/render` por otro frente de trabajo. No se modificó la configuración de
Nginx, no se construyó su imagen y no se ejecutó una prueba de cambio de IP del
upstream. Por tanto, N2 no debe figurar como implementado ni validado en esta
ronda.

### C8. Seguridad y alcance del lote

Este apartado no contiene contraseñas, claves, DSN, tokens, encabezados de
autorización ni valores de variables de entorno. No se ejecutaron migraciones
contra producción, no se alteró Render y no se modificaron las rutas reservadas
`docs/coordinacion` o `deploy/render`.

## D. Cumplimiento G1, G2, G5, G6, G7, G10 y G11

**Fecha:** 2026-10-08. **Rama:** `nexora-chatgpt`. **Base sincronizada:**
`origin/nexora-cloud` en `8a9e34a`.

### D1. Cambios y commits

| ID | Commit | Resultado |
|---|---|---|
| G1 | `2e04cd7` | Ticket sin NCF con leyenda no fiscal; sin título «FACTURA» ni fila NCF vacía. |
| G2 | `dadcbc5` | Encabezado térmico desde Ajustes, sin RNC ficticio. |
| G5 | `99e2657` | PDF de venta con teléfono/hora/ITBIS y nota de crédito con negocio, fecha y condiciones. |
| G10 | `5cd7538` | Colores AA propuestos, foco y bordes accesibles. |
| G11 | `e383f5a` | F4/F8/F12 ignoradas mientras haya un diálogo abierto. |
| G6 | `56bce04` | Anonimización con permiso, bloqueo por saldos, depuración de PII y conservación contable. |
| G7 | `760e715` | `Customer.birthday` eliminado de esquema, API y migración. |

### D2. Regresiones en rojo y en verde

- G1: antes faltaba la leyenda no fiscal; después pasó la prueba focal.
- G2: antes se encontró `<h2>Grupo Macgen</h2>`; después pasaron 2/2.
- G5: antes el PDF no contenía `business.phone`; después pasaron 3/3.
- G10: antes no existían las variables AA; después pasaron 4/4 y el typecheck web.
- G11: antes: `expected ... to contain 'const modalOpen = document.querySelector...'`; después pasaron 5/5 y el typecheck web.
- G6: antes fallaron 3/3 porque `anonymizeCustomer` y su permiso no existían; después pasaron 3/3 y los typechecks API/web/shared.
- G7: antes: `ENOENT ... 202610150002_remove_customer_birthday/migration.sql`; después pasaron 6/6 de cumplimiento y 3/3 de privacidad.

### D3. Verificación final

- `pnpm check`: correcto; 212 pruebas aprobadas y 1 omitida; typecheck,
  ESLint y builds API/web/PWA correctos.
- `pnpm audit --prod`: 0 vulnerabilidades conocidas.
- Prisma: esquema válido, cliente generado y 24 migraciones aplicadas sobre
  PostgreSQL descartable, incluidas G6 y G7.
- La API compilada inició y expuso `POST /api/customers/:id/anonymize`.
- La suite histórica `tests/api.test.ts` no quedó verde: 77 pasaron, 74
  fallaron y 6 se omitieron. Los primeros fallos fueron conflictos de
  terminal/caja y estado compartido de fixtures, que encadenaron otros. No se
  afirma una integración exitosa ni se mezclan arreglos ajenos a este lote.
- No se usaron datos ni credenciales de producción; no se modificó Render.

### D4. Propuestas pendientes de la dueña, sin implementar

- **G3:** advertencia visible cuando falten nombre legal, dirección, teléfono
  o RNC, sin bloquear el guardado hasta recibir el RNC real. Nunca usar
  un valor ficticio.
- **G4:** `returnPolicyText` y `warrantyDays` configurables; resumen corto en
  el ticket y política completa en la aplicación. Falta confirmar texto y
  días después de revisión legal.
- **G8:** recomendado: Sentry sólo si existe `VITE_SENTRY_DSN` y un interruptor
  de Ajustes está activo, con saneamiento de contraseñas, tokens, contactos,
  RNC y pagos. Alternativa: activación sólo por variable de compilación.

No se implementaron términos para clientes, reseñas, correos masivos,
controles para menores ni banner de cookies. El correo del cliente se conserva
porque sigue siendo un dato de contacto; esta entrega sólo debía quitar la
fecha de nacimiento.

## E. Ejecución real independiente del PR #1

**Fecha local:** 2026-10-08. **Commit probado:**
`561e752553e8153a67afab833c2d2f0018d174b2`, obtenido de
`refs/pull/1/head` y coincidente con `origin/nexora-chatgpt`. Las pruebas se
ejecutaron en un worktree temporal separado, no sobre un ZIP.

### E1. Entorno y preparación

- Windows, Node.js `v24.21.0` y pnpm `11.19.0`.
- `pnpm install --frozen-lockfile`: salida 0. Hubo reintentos de red; el paquete
  opcional de PostgreSQL embebido no se materializó y, sólo para la prueba, se
  reutilizó la misma versión `18.4.0-beta.17` ya instalada en el checkout de
  desarrollo. No se modificó el código fuente.
- Un primer `pnpm check`, antes de generar Prisma, falló porque el cliente no
  existía. `pnpm db:generate` generó Prisma Client `6.19` y la repetición fue
  satisfactoria.

```text
pnpm db:generate
Exit code   0

pnpm check
Exit code   0
Vitest      16 archivos, 212 passed, 1 skipped, 0 failed
Typecheck   pasa
ESLint      pasa
Build web   pasa
Build API   pasa
```

El build web emitió una advertencia no fatal por un fragmento de
`989.52 kB` mayor que `500 kB`; la PWA generó 25 entradas de precache
(aproximadamente `2003.88 KiB`).

### E2. Regresiones focales y base descartable

```text
pnpm exec vitest run tests/rate-limit-l1.test.ts tests/cash-privacy.test.ts tests/inventory-resilience.test.ts tests/offline-policy.test.ts tests/claude-round2.test.ts
Exit code   0
Test Files  5 passed (5)
Tests       46 passed (46)
```

En PostgreSQL descartable, puerto local 55432:

```text
pnpm db:migrate
Exit code   0
Migraciones 24/24 aplicadas

pnpm db:seed
Exit code   0
Semilla     60 productos, 228 variantes, 4 usuarios, 3 proveedores, 846 ventas
```

La API compilada arrancó en `http://127.0.0.1:3101/api` y
`GET /api/health` respondió `ok`.

La regresión L1 también se ejecutó por HTTP con un proceso nuevo y contadores
vacíos: 61 intentos inválidos contra la misma cuenta/origen produjeron
60 respuestas 400 y una 429; otra cuenta inició sesión con 201. Luego, 601
usuarios inexistentes produjeron 601 respuestas 400 y otra cuenta legítima
volvió a iniciar sesión con 201. No hubo bloqueo cruzado en esos escenarios.

### E3. Integración completa: resultado no verde

```text
pnpm exec vitest run --config vitest.integration.config.ts --reporter=json --outputFile=test-results/pr1-integration.json
Exit code    1
Duración     ~171 s
Suites       33 total; 9 sin fallos y 24 con fallos
Tests        157 total; 76 passed, 81 failed, 0 skipped
```

No se declara la integración como aprobada. Las primeras causas observadas
fueron:

- cascada dominante de `/sales` con 409 porque la caja quedó abierta en el
  equipo `QA admin`, distinto del terminal usado por los casos posteriores;
- aserciones de estado o valor, entre ellas costo esperado 12 frente a 13;
- accesos a `undefined`/`null` después de fallar fixtures anteriores;
- cierre de caja rechazado porque `countedCard` resultó negativo;
- la prueba de producción esperaba el error de `JWT_SECRET`, pero
  `WEB_ORIGIN` falló primero;
- apertura concurrente de caja: se esperó una operación exitosa y hubo dos;
- umbral de crédito: se esperaba 400 y se recibió 200;
- la regresión O1 de auditoría de cada resolución autenticada falló.

I1, K1 y D1 sí pasaron dentro de la integración.

### E4. Estado del CI de GitHub

Los dos jobs `windows-installer` del commit probado pasaron. Los dos jobs
`verify` fallaron antes de ejecutar integración: el log de la API muestra
`Nest application successfully started`, pero `scripts/verify.mjs` agotó
90 segundos esperando `http://127.0.0.1:3001/api/health` y terminó el proceso.
Por ese motivo Playwright no se ejecutó en CI. Este resultado no debe
confundirse con la corrida local anterior, donde la API compilada y su health
sí respondieron y la integración alcanzó 157 pruebas.

### E5. Controles no ejecutados

- E2: Docker/Compose dos veces y reinicio de API; Docker no está instalado.
- E3: Nginx real, CSP, cámara y flujo offline dentro del sandbox; sin
  Docker/Nginx y Playwright quedó bloqueado por la integración roja.
- E4: restauración real de una exportación; no se confirmó un artefacto
  exportado utilizable para esta corrida.
- E5: instalador y fallos inyectados en una Windows 11 limpia; el equipo no es
  una VM limpia.
- E6: impresión física de ticket, cuadre y PDF en impresora de 80 mm; no se
  dispuso del hardware.
- E7: migración sobre una copia histórica con datos; sólo se probaron las
  24 migraciones y la semilla sobre una base nueva descartable.

No se usaron credenciales ni datos de producción, y no se modificó Render.

## F. Cierre de B0 y correcciones adversariales posteriores

**Fecha local:** 2026-10-08. **Commit final probado:** `4856bc6`.
No se modificó Render ni se usaron datos de producción.

### F1. Integración completa

Se corrigió el arnés para completar el cambio obligatorio de contraseña
temporal sin relajar la API, se eliminaron clientes implícitos que ocultaban
casos negativos y se aislaron las sesiones de caja de cada prueba. La
idempotencia concurrente de mercancía recupera el resultado confirmado en una
consulta nueva después del rollback y valida usuario, sucursal y hash.

La corrida final utilizó PostgreSQL descartable exclusivo, esquema recreado,
27 migraciones, semilla completa y la API compilada desde `dist`:

```text
pnpm test:integration
Exit code    0
Suites       1 passed
Tests        158 passed, 0 failed, 0 skipped
Duración     169.74 s
Semilla      60 productos, 228 variantes, 4 usuarios, 846 ventas
```

La ejecución incluye cuatro cajas concurrentes, I1/K1, D1/O1, la regresión de
contraseña temporal y seis escenarios de zona horaria. Una corrida previa de
152 pruebas y 6 omitidas se descartó porque el secreto JWT del proceso auxiliar
no cumplía la política endurecida; se corrigió exclusivamente el arnés de
ejecución y se repitió desde cero, sin cambiar código.

### F2. Verificación global y privacidad G6

Después del cierre B0 se reforzó la anonimización contra carreras con ventas,
cotizaciones y ediciones. La depuración de auditoría sustituye valores PII
conocidos sin borrar importes, estados ni notas financieras no personales; el
motivo y la referencia libres de la solicitud no se almacenan.

```text
pnpm check
Exit code    0
Vitest       20 archivos, 242 passed, 1 skipped, 0 failed
Typecheck    pasa
ESLint       pasa
Build web    pasa
Build API    pasa

Focal G6     9/9 passed (incluye PostgreSQL real y 100 AuditLog)
Prisma       generate y validate pasan
```

La migración histórica `202610140001_lot_identity` quedó restaurada sin
reescritura; la reconciliación se mueve a la migración nueva
`202610160002_lot_identity_reconciliation`, probada desde una base donde la
migración histórica ya estaba aplicada. El marcador irreversible de cliente
anonimizado se añade en `202610160003_customer_anonymized_at` con un backfill
restringido al patrón exacto y a campos previamente depurados.

### F3. Lote 5

Se leyó `docs/coordinacion/PROMPT_UI_POS.md` desde `nexora-cloud`. El propio
documento mantiene el Lote 5 **EN COLA** hasta que este PR tenga CI verde, los
cambios de lógica estén fusionados en `nexora-cloud` y exista un PR separado.
Por ello no se mezclaron cambios visuales en esta entrega.
