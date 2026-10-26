# Auditoría del módulo GV · Claude PC · 26-oct-2026 (solo lectura)

**Código auditado:** `origin/claude/modulo-gv` en `a97f8fa7` (7 commits, 21 archivos, 3 migraciones). Incluye lo de citas: `claude/modulo-gv-citas` no tiene ningún commit que `modulo-gv` no tenga.
**Cómo se hizo:** seis auditores en paralelo, uno por área, leyendo código y pruebas; el de migraciones además hizo un **ensayo en una base temporal**. Verifiqué yo en el código los hallazgos marcados con ✔. No se tocó el código de GV, ni Render, ni la tienda.
**Ejecución de pruebas y compilación:** entregada, ver la sección «Ejecución» al final. Resultado: sin regresiones atribuibles a GV.

## Veredicto: APROBADO PARA EL DESPLIEGUE DE HOY, **con 4 puntos URGENTES** que se resuelven con una línea de código o con un procedimiento

| Área | Veredicto |
|---|---|
| Aislamiento del rol `gv` | **Aprobado** |
| Montos y saldos | Aprobado con reservas (nada bloquea hoy) |
| Importación (`POST /gv/import`) | **Corregir** (dos arreglos pequeños hoy) |
| Transferencias y bitácora | **Corregir** (un hueco urgente: la importación no deja rastro por pago) |
| Migraciones | **Aprobado** (ensayo en base temporal sin cambios en tablas existentes) |
| Separación de Macgen | **Aprobado** |

## URGENTE (antes del despliegue de hoy)

1. **`?dryRun` falla hacia lo peligroso ✔.** `gv.ts:622`: `dryRun = dryRunQuery === "1" || dryRunQuery === "true"`. Cualquier otro valor (`TRUE`, `yes`, `0`, una errata, o `1&dryRun=1`, que llega como arreglo) **ejecuta la importación real**. **Arreglo de una línea:** devolver 400 si el parámetro está presente y no es `0`, `1`, `true` o `false`. **Prueba:** `dryRun=TRUE` y `dryRun=yes` no escriben nada (hoy tampoco hay prueba de que `dryRun` no deje filas de bitácora).
2. **La importación no deja bitácora por pago ✔.** Escribe pagos (también transferencias ya `verified`) sin ninguna fila de bitácora por pago, inscripción o curso: solo un resumen `gv_import` (`gv.ts:789`). La carga inicial del Excel creará pagos verificados sin rastro de cuál ni de cuánto. **Arreglo:** `audit()` por pago, inscripción y curso dentro de la transacción (`gv_payment_import`, con antes y después). **Plan B si no cabe hoy:** copia (snapshot) de las tablas de GV antes y después de importar.
3. **Límite de 100 kb en el cuerpo ✔.** La importación va por JSON, no por archivo, y el límite global es `jsonBodyParser({ limit: "100kb" })` (`main.ts:42`). Alcanza para unas 300 inscripciones con pagos; el esquema acepta hasta 5.000. Un Excel grande daría error 413. **Hoy:** confirmar el tamaño del archivo real o subir el límite solo para `POST /gv/import`.
4. **Reimportar pisa datos (procedimiento).** El `upsert` sobrescribe `agreedPrice`, `status`, asistencia, notas, teléfono, `courseId` y reembolsos (`gv.ts:746`, `762-771`; `gv-citas.ts:267`) sin `checkGvOwnerEdit`, y el tope «pagos ≤ total» (`gv-money.ts:311`) suma solo los pagos del archivo, no los que ya están en la base. Ejemplo: la base tiene 80 verificados, el archivo trae precio 50 y sin pagos; queda total 50 con 80 pagados y `max(0,…)` esconde los 30 de exceso. También puede reabrir una inscripción `reembolsada`. Además hay una carrera: el plan y la validación se leen antes de la transacción y del bloqueo (`gv.ts:650-703`), así que verificar una transferencia durante la importación puede ser pisado. **Para hoy:** importar **una sola vez**, con un `dryRun` válido antes, y **no registrar ni verificar pagos mientras corre**. No reimportar después de usar la pantalla. **Arreglo de código (siguiente ciclo):** en el `update`, comparar con lo comprometido en la base, respetar los estados finales y mover el plan dentro de la transacción tras el bloqueo.

## Antes de desplegar, confirmar (no se pudo verificar desde aquí)
- Los roles `manager` y `gv` existen con ese nombre exacto en la base real. Si `manager` se llama distinto, los `UPDATE` de la migración afectan 0 filas **sin error** y nadie recibe permisos de GV.
- La cuenta de Clary tiene **exactamente** el rol `gv`.
- Hay copia de seguridad o instantánea de Render antes de aplicar las migraciones.
- La conexión de la aplicación usa el dueño de las tablas (lo usual en Render); las migraciones no incluyen `GRANT`.
- No hay otras migraciones entre `202610250401` y `202610260901` en otras ramas que vayan a la misma base.
- Que **gerencia apruebe el equipo** donde entrará Clary antes de que ella lo use (ver M1 abajo).

## Hallazgos medios
- **Verificar después de reembolsar o cancelar.** `reviewPayment` (`gv.ts:384-436`) no revisa el estado del dueño del pago. Ejemplo: inscripción de 100 con 60 verificados, reembolso de 60 (queda `reembolsada`); luego se verifica una transferencia de 40 que estaba por verificar. Ingreso verificado 100, reembolsos 60, neto 40, pero la clienta recuperó todo lo que había pagado. **Arreglo:** `bad()` si el dueño está cerrado, o permitir solo rechazar. Falta prueba.
- **Equipo de Clary (M1).** Su equipo se registra como pendiente en «Equipos» de Macgen y a ella le sale «Este equipo necesita aprobación», donde podría teclear un PIN de gerente (con límite de intentos, `verifyPinAttempt`). GV no usa `@RequireTerminal`, así que no le impide trabajar. **Arreglo:** que gerencia lo apruebe antes, o no mostrar `DeviceGate` ni registrar terminal sin `catalog:read`.
- **Ruta de revisión sin `@RequireTerminal`.** A diferencia de `sales.ts:2686`, la bitácora de verificar o rechazar puede quedar sin terminal (no se comprobó si el campo admite nulo).

## Hallazgos bajos
- El motivo de rechazo exige solo 3 caracteres (`gv.ts:396`); conviene 10.
- `moneyAmount` acepta `0.1 + 0.2` con tolerancia 1e-6; redondear a 2 decimales en el esquema.
- La propina (`tip`) queda fuera del total: una propina cobrada como pago excedería el saldo.
- Los teléfonos no se normalizan: «809-555» y «8095550» son clientas distintas.
- Una clave de importación distinta para la misma clienta crea dos filas; la idempotencia depende de que el Excel genere claves estables (`externalId`, con `@@unique([branchId, externalId])` en cursos, inscripciones, pagos, citas e interesadas).
- La bitácora no es de solo agregar (la aplicación puede modificar filas, igual que en la tienda) y guarda nombres y teléfonos de clientas sin purga.
- `GET /audit-log` devuelve las últimas 300 filas sin filtrar por entidad: la actividad de GV puede empujar eventos de Macgen fuera de esa ventana. Filtrar por acción o paginar.
- `GET /staff` lista a las usuarias `gv` en el cambio de usuario del POS (cosmético).
- Al entrar sin ruta se monta primero el Resumen (no dispara llamadas: exige `reports:read`); el flujo de eventos reintenta con 403 en bucle; la barra dice «Tienda principal» y la ayuda habla de F2/F12.
- Una cancelación deja el pagado verificado como ingreso sin registrar reembolso (solo `reembolsada` lo registra); documentar la política para la dueña. En un rango de fechas el neto puede salir negativo (reembolsos por fecha de reembolso, pagos por fecha de pago).

## Lo que está bien
- **Aislamiento ✔.** El rol `gv` tiene exactamente `gv:read`, `gv:write` y `gv:reports` (`shared/index.ts:785`); la migración 903 lo fuerza. El guardia global deniega toda ruta sin permiso declarado (`common.ts:737-743`), así que `/settings`, `/users`, reportes, caja, inventario, ventas, alertas, incentivos, copias, búsqueda y clientes dan 403. El flujo de eventos exige `catalog:read`. El menú, la paleta Ctrl+K y los atajos usan la misma lista permitida y cualquier ruta no permitida redirige a GV. `POST /gv/import` es `@Permit("*")`. En sentido contrario, la vendedora y el almacén reciben 403 en GV.
- **Montos.** `Decimal(14,2)` en todos los campos de dinero, aritmética con `Decimal` de punta a punta, salida con `toFixed(2)` como texto, sin `Number` ni `parseFloat` en el servidor. `pendiente = max(0, total − Σ verificados)` se calcula al leer (no se guarda, sin desajuste). Sobrepago bloqueado. Rechazada deja el saldo disponible. Verificada no se puede rechazar (y un `CHECK` lo respalda). Cuotas 33.33 + 33.33 + 33.34 cuadran a 0.00. `FOR UPDATE` sobre la inscripción y `operationId` idempotente: el doble clic devuelve el mismo pago. No hay rutas para editar o borrar un pago.
- **Transferencias.** Verificar y rechazar exigen `gv:verify` (solo gerente; el rol `gv` no se aprueba a sí mismo); no verifica quien registró (salvo `*`); la fila se bloquea; rechazar un verificado o verificar un rechazado da 400; la bitácora se escribe en la misma transacción con el motivo. La bitácora de GV solo la ve `*` y los reportes de Macgen filtran por acción.
- **Migraciones ✔ (ensayo).** `202610260901_gv`, `…902_gv_citas` y `…903_gv_auditoria` solo crean tablas nuevas, índices sobre tablas nuevas, restricciones y claves foráneas entre tablas de GV, y tocan únicamente las filas de `Role`. Sin `DROP`, `ALTER COLUMN TYPE`, `RENAME`, `TRUNCATE`, `DELETE`, disparadores, RLS ni `GRANT`. **Ensayo:** base PostgreSQL 18.4 temporal con las 53 migraciones de `nexora-cloud` y datos de prueba (2.000 clientes, 5.000 ventas, 5.000 pagos, 20.000 filas de bitácora); instantánea de conteo y `md5` por fila de las 58 tablas existentes antes y después: **57 idénticas**, solo cambió `Role` (rol `gv` nuevo y `manager` con los permisos de GV). Aplicación: unos 140 ms de SQL (4,1 s con el arranque de la herramienta). `migrate status` limpio; una segunda aplicación no hace nada; ejecutar los SQL dos veces seguidas no da error; la comparación con el esquema no muestra diferencias. Observaciones opcionales: usar `COALESCE("permissions", '{}')`; la migración 903 sobrescribe un rol `gv` personalizado a mano (improbable); los `CHECK` de transferencia (banco y referencia) y de dueño único se disparan como 500 si la API no valida antes. No se forzó un fallo para probar la atomicidad.
- **Separación ✔.** GV usa tablas propias (`GvCourse`, `GvEnrollment`, `GvPayment`, `GvAppointment`, `GvLead`) y no lee ni escribe `Sale`, `Payment`, `Customer`, `Product`, `Variant`, `Category`, `CashSession`, `Alert`, `Settings` ni `RealtimeEvent`; solo escribe `AuditLog` y lee `User`/`Role`. Las transferencias de GV pendientes no aparecen en «Conciliar transferencias» ni en el esperado del cierre. No usa la numeración de ventas, NCF ni recibos y no toca datos fiscales. No genera avisos, Telegram ni eventos para el personal de Macgen. El menú de GV no cambia la caja (`gv.css` limita sus selectores a `.gv-*`).

## Pruebas existentes que conviene ampliar (después del despliegue)
- Un barrido que recorra todas las rutas de Nest y falle si el rol `gv` acepta alguna con un permiso que no sea `gv:*` o `authenticated` (el que más conviene).
- Bitácora al rechazar, rollback si falla la auditoría, dueño cerrado, longitud del motivo, bitácora de la importación y `dryRun` con valores raros.
- Carrera de importación contra verificación; reimportación después de editar en pantalla; el límite de 100 kb.
- Que el cuadre, el tablero y `pending-transfers` de la tienda queden idénticos con GV activo y con un pago de GV pendiente; que `GET /customers` no incluya a las clientas de GV.

## Lo que no se verificó
Ejecución de pruebas y del servidor (pendiente el informe de ejecución), tamaño y tráfico de las tablas vivas, la versión real de PostgreSQL en producción (el SQL necesita 13 o superior por `gen_random_uuid()`), `drive-backup.ts:1481` (ruta pública, no leída en detalle), nginx y el proxy, la interfaz en un navegador y la lógica de propinas y citas con detalle.

## Ejecución (pruebas y compilación, en una copia limpia de `a97f8fa7` con base PostgreSQL temporal propia)
**Veredicto: sin regresiones atribuibles a GV.** Nada URGENTE por este lado.

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile`, `db:generate`, `typecheck`, `lint`, `build` (web y API) | todo con código de salida 0 |
| Migrar y sembrar una base nueva, incluida `202610260903_gv_auditoria` | código 0 |
| `gv-unit`, `accessibility-contract`, `rutas-permiso` (la única prueba de matriz de rutas y roles) | 32 de 32 |
| `gv-modulo-api`, `gv-citas-api`, `gv-servicios-api` | 9/9, 6/6 y 4/4 |
| Pruebas unitarias completas | 76 archivos pasan, 2 fallan por tiempo agotado bajo carga (`rate-limit-l1` a 60 s y `promociones-paridad`); **las dos pasan solas (29 de 29)** |
| Pruebas de integración completas | 30 archivos pasan y 4 fallan (ver abajo) |
| e2e de la caja (`pos-pantalla` y `u1-pos`) | **18 de 18**: caja, productos, mercancía, resumen, configuración y sin desbordes |

Los 4 archivos de integración que fallaron, clasificados:
- **`drive-backup.test.ts` (16 fallos):** «el servidor no tiene `pg_dump` instalado». Es de la máquina de pruebas, no de GV. **No se pudo validar el flujo de respaldo a Drive**; confirmar que el servidor real tiene `pg_dump`.
- **`reportes-dinero-api` y `SEC-03` de `api.test.ts`:** error 503 de base de datos por la carga de la corrida larga; pasan solos.
- **`api.test.ts` («Tienda-4cajas») y `auth-lockout` (N-02):** fallan solos en la rama de GV **y también igual en `origin/nexora-cloud` en `53bf1e8b`**, con una base nueva. Ya fallaban antes; no los causó GV, pero conviene revisarlos aparte.

**Cosa que el ejecutor reconoció:** reutilizó una copia de trabajo de otra auditoría para instalar dependencias y escribió ahí un `.env` temporal que luego borró (si ya había uno, lo sobrescribió). No cambió ningún archivo versionado. Todo lo demás se hizo en copias propias, ya eliminadas, con los puertos 3189, 4189 y 55189 libres; no se tocaron 3001, 5432 ni 5434, ni Render ni bases reales.

## Verificación de los arreglos (Claude PC, 07:23 UTC, sobre `origin/nexora-cloud` e890fee2, `claude/modulo-gv` 1069f6c0)
Leído en el código; **no** se volvió a ejecutar la suite sobre esta versión.

| Punto de la auditoría | Estado | Dónde se ve |
|---|---|---|
| URGENTE 1 · `dryRun` fallaba hacia lo peligroso | **Arreglado** | `gv.ts:638-644`: si el parámetro está y no es `0`, `1`, `true` o `false` (una sola vez) responde 400 «dryRun debe ser 0, 1, true o false» |
| URGENTE 2 · la importación sin bitácora por fila | **Arreglado** | `gv-money.ts:422-452`: `audit()` por fila con `gv_import_create` o `gv_import_update` (más el resumen `gv_import`) |
| URGENTE 3 · límite de 100 kb | **Arreglado** | `main.ts:44`: `/api/gv/import` con límite de 4 MB, declarado **antes** del analizador global de 100 kb (el orden importa: el primero que coincide consume el cuerpo) |
| Medio · verificar tras reembolsar o cancelar | **Arreglado** | `gv.ts:412-422`: «Está reembolsada: sus pagos ya no se verifican ni rechazan» |
| URGENTE 4 · reimportar pisa datos y carrera del plan | **Sin confirmar** | No revisé si el `update` respeta lo ya cobrado ni si el plan pasó dentro de la transacción; sigue valiendo el procedimiento: importar una vez, con un `dryRun` válido antes, sin operar pagos durante la corrida |
| Clary: equipo pendiente de aprobación, roles `manager`/`gv` en la base real, respaldo de Render | **Sin verificar desde aquí** | Son comprobaciones del día del despliegue |

Después de mi auditoría entraron cuatro commits en `claude/modulo-gv` (`0bd0ca9f` correcciones de la auditoría, `9697fb90` verificación de ChatGPT nube y migración robusta, `0c390dba` y `1069f6c0`). Los dos últimos tocan, entre otras cosas, la importación y las pestañas en celular. **Pendiente de repasar por mi parte:** que la migración "robusta" siga siendo solo aditiva (el ensayo en base temporal se hizo sobre `a97f8fa7`, no sobre esta versión).