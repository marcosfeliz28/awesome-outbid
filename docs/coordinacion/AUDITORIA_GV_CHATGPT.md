# Auditoría del módulo GV

**Fecha:** 26 de octubre de 2026  
**Ramas auditadas:** `claude/modulo-gv` (`52a95b1`) y `claude/modulo-gv-citas` (`a74b8ee`, contiene la anterior)  
**Método:** revisión estática de código, migraciones y pruebas; ejecución de las pruebas GV sobre PostgreSQL desechable. No se modificó código de la aplicación, no se tocó producción y no se usaron secretos.

## Veredicto

El módulo usa `Decimal(14,2)` y sus rutas principales están separadas de las de Macgen, pero **no debe ponerse en uso todavía**. Hay fallos altos en la separación de datos locales, la aprobación de transferencias, el cálculo de deuda y la reimportación de pagos. En particular, una empleada GV puede aprobar su propia transferencia y una reimportación puede cambiar un pago ya verificado.

## Hallazgos

### GV-01 — Alta — El cambio de usuario conserva costos y otros datos locales de Macgen

**Evidencia:** `apps/web/src/App.tsx:1293-1303`, `apps/web/src/api.ts:63-77`, `apps/web/src/api.ts:282-291`, `apps/web/src/Merchandise.tsx:523-565`.

El cambio rápido por PIN limpia React Query, pero no IndexedDB. Una recepción pendiente conserva `unitCost`, usuario, sucursal y el resto de la operación; la tabla es común a todas las sesiones del navegador. Una persona que entra luego con rol `gv` puede leer esos datos locales del navegador, aunque la API le niegue inventario y costos.

**Arreglo propuesto:** separar o cifrar las colas por usuario, limpiar toda caché recuperable al cambiar de usuario y bloquear el cambio si hay operaciones sensibles sin sincronizar. Añadir una prueba de cambio `admin/warehouse → gv` que confirme que GV no puede leer catálogo, ajustes, ventas ni mercancía de la sesión anterior.

### GV-02 — Media — GV puede abrir directamente la ruta visual de Configuración

**Evidencia:** `apps/web/src/App.tsx:729-736`, `apps/web/src/App.tsx:923-944`, `apps/web/src/Management.tsx:3973-4008`.

La navegación exceptúa expresamente `#settings` del control de páginas permitidas. La API devuelve 403 y no entrega valores, pero GV sí puede abrir la pantalla «Configuración del administrador», contra la regla de que no vea configuración.

**Arreglo propuesto:** no exceptuar `settings`; exigir que la página esté en `allowed` y añadir una prueba de navegación directa como GV.

### GV-03 — Media — Las respuestas GV revelan nombres de usuarios de Macgen

**Evidencia:** `apps/api/src/gv.ts:285-330`, `apps/api/src/gv.ts:546-552`, `apps/api/src/gv.ts:590-596`.

Los detalles y reportes GV consultan la tabla global `User` y devuelven el nombre de quien creó o verificó cada movimiento. Si actuó una persona administrativa de Macgen, su nombre queda visible para GV.

**Arreglo propuesto:** devolver solo identidades autorizadas para GV o una etiqueta operativa neutra. No resolver para el rol `gv` usuarios ajenos a ese módulo.

### GV-04 — Media — Una instalación con un rol `gv` preexistente puede conservar permisos excesivos

**Evidencia:** `apps/api/prisma/migrations/202610260901_gv/migration.sql:87-90`; permisos esperados en `packages/shared/src/index.ts:759-784`.

La migración usa `ON CONFLICT (name) DO NOTHING`. Si ya existe un rol llamado `gv` con permisos de costos, usuarios o configuración, la migración no los elimina. En una base nueva el rol sí queda correctamente limitado a `gv:read`, `gv:write` y `gv:reports`.

**Arreglo propuesto:** hacer una migración correctiva que fije explícitamente la lista permitida del rol reservado `gv`, con prueba sobre una base que ya contenga ese nombre.

### GV-05 — Alta — La misma empleada que registra una transferencia puede aprobarla o rechazarla

**Evidencia:** `apps/api/src/gv.ts:412-464`, `apps/web/src/Gv.tsx:757-815`. Macgen exige terminal y administración en `apps/api/src/sales.ts:2685-2688` y `apps/api/src/sales.ts:2821-2824`.

`POST /gv/payments/:id/review` exige únicamente `gv:write`, permiso incluido en el rol ordinario `gv`. No hay separación entre quien registra y quien concilia.

**Arreglo propuesto:** permiso separado de conciliación, limitado a administración/gerencia autorizada, terminal aprobado y bitácora equivalente a Macgen. La empleada GV puede registrar el pago, pero no aprobarlo.

### GV-06 — Alta — La revisión acepta métodos y transiciones inválidos y tiene una carrera

**Evidencia:** `apps/api/src/gv.ts:480-496`, esquema sin restricción de coherencia en `apps/api/prisma/migrations/202610260901_gv/migration.sql:47-73`. Referencia correcta: bloqueos y estados de Macgen en `apps/api/src/sales.ts:2690-2708` y `apps/api/src/sales.ts:2831-2847`.

El endpoint no exige `method === "transferencia"`, permite rechazar efectivo, tarjeta o una transferencia ya verificada, y lee/actualiza sin bloqueo de fila. Verificar y rechazar simultáneamente puede dejar `verified=true` junto con `rejectedAt` y dos bitácoras válidas.

**Arreglo propuesto:** máquina de estados exclusiva `pending_verification → ok | rejected`, `SELECT ... FOR UPDATE`, relectura bajo bloqueo, actualización condicional e invariantes en PostgreSQL. Las operaciones repetidas deben ser idempotentes como en Macgen.

### GV-07 — Alta — Banco y referencia no son obligatorios para transferencias

**Evidencia:** `apps/api/src/gv.ts:88-95`, `apps/api/src/gv-citas.ts:104-111`, `apps/web/src/Gv.tsx:716-732`. Macgen los exige en `apps/api/src/sales.ts:952-958`.

Una transferencia puede quedar pendiente como «Sin banco» y sin referencia. Además, `GET /gv/transfers/pending` filtra solo `verified=false`, no el método (`apps/api/src/gv.ts:623-627`), por lo que una importación inconsistente puede incluir efectivo o tarjeta en la conciliación.

**Arreglo propuesto:** esquema discriminado por método, banco y referencia obligatorios para transferencia, filtro explícito por método y restricción defensiva en base de datos.

### GV-08 — Alta — Las transferencias sin verificar reducen la deuda y cuentan como ingreso

**Evidencia:** `apps/api/src/gv.ts:97-115`, `apps/api/src/gv.ts:524-574`; las pruebas consolidan el comportamiento en `tests/gv-unit.test.ts:5-17`. En Macgen, un abono por transferencia reduce la deuda al verificarse: `apps/api/src/sales.ts:2709-2718`.

`gvTotals()` suma todo pago no rechazado, aunque no esté verificado. Por ejemplo, con RD$1,000 acordados y una transferencia pendiente de RD$400 muestra RD$400 pagados, RD$600 pendientes y RD$400 de ingreso.

**Arreglo propuesto:** separar `pagado verificado`, `por verificar` y `pendiente`; excluir lo no verificado de ingresos. Para evitar cobro duplicado puede mostrarse además un «disponible para cobrar», pero no llamar ingreso ni pago confirmado al dinero pendiente de banco.

### GV-09 — Alta — Se aceptan sobrepagos y reducciones del total que producen pendiente negativo

**Evidencia:** altas de pago en `apps/api/src/gv.ts:412-458` y `apps/api/src/gv-citas.ts:431-482`; edición de totales en `apps/api/src/gv.ts:386-409` y `apps/api/src/gv-citas.ts:400-428`; resta en `apps/api/src/gv.ts:106-115`. `tests/gv-unit.test.ts:14-17` incluso espera `-50.00`.

No se compara el pago con el saldo, ni se impide bajar `agreedPrice`/`total` por debajo de lo cobrado. Dos pagos concurrentes también pueden superar el saldo.

**Arreglo propuesto:** bloquear inscripción/cita, sumar con `Decimal` dentro de la misma transacción y rechazar el exceso; validar también las ediciones. Si se admiten saldos a favor, modelarlos por separado. Añadir regresiones secuenciales y concurrentes.

### GV-10 — Alta — La identidad de pagos importados depende de su posición

**Evidencia:** `apps/api/src/gv.ts:681-708`, `apps/api/src/gv.ts:784-815`, `apps/api/src/gv-citas.ts:156-157`, `apps/api/src/gv-citas.ts:247-280`.

Cuando un pago no trae clave, se genera `entidad#posición`. Reordenar, insertar o quitar filas puede sobrescribir otro pago, trasladar su estado de verificación y dejar un pago antiguo todavía contabilizado. Las pruebas actuales solo repiten el mismo archivo en el mismo orden (`tests/gv-modulo-api.test.ts:379`, `tests/gv-citas-api.test.ts:345`).

**Arreglo propuesto:** exigir una clave externa estable por cada pago y definir explícitamente cómo reconciliar filas ausentes; nunca usar el índice como identidad financiera.

### GV-11 — Alta — Reutilizar una clave puede mover un pago a otra inscripción o cita

**Evidencia:** `apps/api/src/gv.ts:791-815`, `apps/api/src/gv-citas.ts:261-280`.

El `upsert` busca solo `branchId + externalId` y luego actualiza `enrollmentId` o `appointmentId`. Reimportar la misma clave bajo otra clienta mueve el pago; en concurrencia gana la última transacción.

**Arreglo propuesto:** comprobar que toda clave existente pertenece al mismo tipo y propietario; abortar la importación completa ante conflicto y serializar por sucursal/importación.

### GV-12 — Alta — Reimportar puede alterar un pago ya verificado sin nueva conciliación

**Evidencia:** `apps/api/src/gv.ts:785-815`, `apps/api/src/gv-citas.ts:253-279`; la importación deja solo una bitácora global en `apps/api/src/gv.ts:824-832`.

El `upsert` conserva el estado de verificación si el archivo omite `verified`, pero reemplaza monto, método, banco, referencia y propietario. Una transferencia verificada por RD$500 puede reaparecer como RD$5,000 y seguir verificada; efectivo verificado puede convertirse en transferencia verificada.

**Arreglo propuesto:** hacer inmutables los datos financieros de pagos revisados. Cualquier corrección debe pasar por una operación administrativa específica, con motivo, bloqueo y bitácora antes/después. La importación debe devolver conflicto.

### GV-13 — Alta — «Reembolsada» no registra devolución y los estados cerrados siguen aceptando pagos

**Evidencia:** cambios de estado en `apps/api/src/gv.ts:379-409` y `apps/api/src/gv-citas.ts:400-428`; altas de pago en `apps/api/src/gv.ts:412-458` y `apps/api/src/gv-citas.ts:431-482`; ingresos en `apps/api/src/gv.ts:524-574`.

Cambiar a `reembolsada` solo cambia el estado: el importe continúa como ingreso. Una inscripción o cita cancelada/reembolsada aún acepta pagos nuevos.

**Arreglo propuesto:** asiento de devolución inmutable e idempotente, con importe, método, fecha y actor; transiciones de estado explícitas y bloqueo de cobros en estados cerrados.

### GV-14 — Media — El reporte de pendientes no incluye citas

**Evidencia:** `apps/api/src/gv.ts:575-619`; cálculo individual de cita en `apps/api/src/gv-citas.ts:121-136`.

`pendingByClient` consulta únicamente `GvEnrollment`. Una cita abierta sin pagar muestra deuda en su tarjeta, pero no aparece en el reporte general de pendientes.

**Arreglo propuesto:** agregar citas abiertas al reporte con cálculo `Decimal` y una columna que identifique curso o cita.

### GV-15 — Media — Una sesión GV se registra en el subsistema de equipos de Macgen

**Evidencia:** inicio global de tiempo real en `apps/web/src/App.tsx:654-655`, registro automático en `apps/web/src/realtime.tsx:223-228`, endpoint para cualquier autenticado en `apps/api/src/realtime.ts:157-203`.

Al iniciar sesión, GV llama automáticamente `POST /terminals/register`. Puede crear o actualizar un equipo de Macgen y recibe metadatos del terminal, aunque no tenga permisos de caja, inventario ni catálogo.

**Arreglo propuesto:** no iniciar terminales ni sincronización comercial para un usuario exclusivamente GV; exigir un permiso específico y devolver un DTO mínimo.

### GV-16 — Media — Falta la conciliación bancaria disponible en Macgen

**Evidencia:** lista y botones individuales GV en `apps/web/src/Gv.tsx:753-823`; conciliación Macgen en `apps/web/src/TransferReconciliation.tsx:28-282`; corrección auditada de referencia en `apps/api/src/sales.ts:2745-2812`.

GV no ofrece filtro por fecha, agrupación por banco, selección múltiple, total bancario, diferencia, CSV ni corrección administrativa de banco/referencia. La ausencia de esas comprobaciones aumenta el riesgo de aprobar contra el depósito equivocado.

**Arreglo propuesto:** reutilizar el flujo de conciliación y corrección de Macgen con endpoints y datos exclusivamente GV, conservando la separación de permisos descrita en GV-05.

## Controles que sí pasan

- El rol nuevo en una base limpia recibe únicamente `gv:read`, `gv:write` y `gv:reports` (`packages/shared/src/index.ts:759-784`).
- Las pruebas comprueban 403 para productos, ajustes, usuarios, roles, dashboard, ventas, clientes, caja, inventario, transferencias y auditoría de Macgen (`tests/gv-modulo-api.test.ts:128-158`).
- Los importes de cursos, inscripciones, citas y pagos son `Decimal(14,2)` y las sumas del backend usan `Prisma.Decimal`; no se encontró aritmética monetaria con coma flotante.
- Repetir secuencialmente el mismo archivo, con las mismas claves, contenido y orden, no crea filas adicionales gracias a índices únicos y `upsert`.
- Las rutas GV principales filtran por `branchId`; la importación está reservada a `@Permit("*")`.

## Pruebas y límites

- PostgreSQL desechable: 55 migraciones aplicadas correctamente.
- `tests/gv-unit.test.ts`: 2/2 aprobadas.
- `tests/gv-modulo-api.test.ts` y `tests/gv-citas-api.test.ts`: 12/12 aprobadas.
- Las pruebas existentes **no cubren** cambio de usuario con IndexedDB, navegación directa a configuración, sobrepago concurrente, revisión concurrente, pagos reordenados/ausentes, reutilización de claves entre propietarias ni reimportación posterior a verificación.
- La auditoría no modificó el código y no ejecutó acciones sobre la base o el despliegue de la tienda.

## Prioridad de corrección

1. GV-01 y GV-05 a GV-09: separación, aprobación bancaria y dinero.
2. GV-10 a GV-13: importación y estados financieros.
3. GV-02 a GV-04 y GV-14 a GV-16: defensa adicional y completitud operativa.
