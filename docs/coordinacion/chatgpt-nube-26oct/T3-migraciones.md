# T3 · Migraciones posteriores a la base desplegada

Fecha: 2026-10-26  
Base desplegada usada para comparar: `2f147d2d`  
Producto auditado: `origin/claude/producto-mezcla-4` en `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`  
GV auditado: `origin/claude/modulo-gv-citas` en `a74b8eef07892be04b59b892a877cb7bdd5cc6bd`  
Método: auditoría estática; no se aplicó ninguna migración ni se tocó una base real.

## URGENTE · Veredicto de despliegue

No recomiendo aplicar todavía el conjunto completo sobre una base viva. Hay cuatro riesgos altos: dos migraciones pueden quedar marcadas como aplicadas sin instalar la garantía pretendida, una FK de pagos de plataforma permite cruces entre empresas y un rol `gv` preexistente puede conservar permisos administrativos.

## Resultado por migración

| Migración | Datos reales y aditividad | Bloqueos | Orden y repetición | Veredicto |
|---|---|---|---|---|
| `202610250301_pago_dolares` | Añade tres columnas; pagos existentes quedan como DOP. Una instalación parcialmente modificada puede fallar al crear el `CHECK`. | El `CHECK` examina `Payment` bajo bloqueo de tabla. | Depende solo de `Payment`; repetición normal segura. | Aceptable; preferible `NOT VALID` y validación posterior. |
| `202610250401_courier_name_sin_default` | No cambia datos, solo el valor por defecto. | `ALTER TABLE` exige un bloqueo breve de `Sale`. | Depende de `202610250001_courier_fee`; repetible. | Correcta. |
| `202610280024_product_base_roles_customer` | Inserta roles y cliente por empresa; no corrige roles existentes. Dos ejecuciones concurrentes pueden duplicar «Consumidor final». | Lee `Tenant` e inserta filas; riesgo bajo. | Depende de multiempresa y del índice único de roles; repetición secuencial segura. | Aceptable con riesgo bajo de concurrencia. |
| `202610280025_ia08_ai_pack_reference` | Si encuentra referencias duplicadas, omite el índice y deja la base sin la garantía. | El índice normalizado recorre y bloquea escrituras de `AiPackCredit`. | Prisma no vuelve a intentar si se omitió. | **Alta: no desplegar sin corregir.** |
| `202610290001_sold_by_unit` | Añade columna y reclasifica productos; conserva los que tienen historia fraccionaria. | El `UPDATE` consulta `Variant`, `SaleItem` e `InventoryMovement` y puede retener bloqueos. | Dependencias correctas; repetir sobre datos nuevos puede reclasificar otra vez. | Media. |
| `202610290002_platform_payment_void` | Columnas e índice aditivos, pero la FK permite cruzar empresas. | FK e índice examinan `PlatformPayment`. | Depende de `202610280023`; repetición normal segura. | **Alta por integridad multiempresa.** |
| `202610300001_ncf_coherencia` | Si detecta filas inválidas omite el `CHECK`; la migración queda aplicada y las filas nuevas siguen sin protección. | Hasta tres recorridos de `Sale`; agregar `CHECK` bloquea la tabla. | Dependencias fiscales correctas; requiere intervención manual si omite restricciones. | **Alta: usar `NOT VALID`.** |
| `202610300002_pla02_platform_payment_operation` | Columnas nulas e índice único; históricos no chocan. | Índice completo de `PlatformPayment`. | Depende de la tabla previa; repetible. | Correcta con ventana de bloqueo. |
| `202610310001_cashier_survey` | Tabla nueva; `userId` no tiene FK ni garantiza que usuario y encuesta pertenezcan a la misma empresa. | Bajo. | Depende del rol y funciones de `202610260001_product_tenant`; repetible si quedó completa. | Media. |
| `202611010001_tenant_fk_indice` | Reemplaza una función y elimina el cast que impedía usar índices. | No reescribe tablas. | Debe ir después de `202610260001`; triggers existentes usan la función reemplazada. | Correcta. |
| `202610260901_gv` | Crea tablas y rol; un rol `gv` preexistente conserva permisos excesivos. Las FK no garantizan igualdad de sucursal. | Bajo por tablas nuevas; actualización breve de `Role`. | Correcta en la tienda después de `202610250401`; no sirve sin adaptación para producto multiempresa. | **Alta por permisos conservados.** |
| `202610260902_gv_citas` | Añade citas e interesadas y completa propiedad de pagos. Puede fallar si entre migraciones aparecieron pagos sin dueño o con dos dueños. | `ALTER GvPayment` examina todas las filas. | Depende estrictamente de `202610260901_gv`; repetible solo si la instalación anterior quedó completa. | Media. |

## Hallazgos

### Alta · La coherencia fiscal puede quedar omitida permanentemente

**Archivo:** `apps/api/prisma/migrations/202610300001_ncf_coherencia/migration.sql:31-37`.

**Cómo reproducirlo:** dejar una venta con `fiscalStatus = 'issued'` y sin NCF, aplicar la migración y luego insertar directamente otra venta con la misma inconsistencia. La migración emite un `NOTICE`, termina con éxito y la segunda fila se acepta porque el `CHECK` nunca se instaló.

**Arreglo propuesto:** crear siempre los `CHECK` como `NOT VALID`, de modo que protejan filas nuevas; sanear los históricos y ejecutar después `VALIDATE CONSTRAINT`.

### Alta · Duplicados históricos desactivan la unicidad de referencias de IA

**Archivos:** `apps/api/prisma/migrations/202610280025_ia08_ai_pack_reference/migration.sql:7-15` y `apps/api/prisma/migrations/202610280014_pc24_ai_pack_credit/migration.sql:21-27`.

**Cómo reproducirlo:** insertar previamente referencias `ABC 123` y `abc123` y ejecutar la migración. El despliegue finaliza sin índice y una tercera referencia equivalente todavía puede insertarse. La inmutabilidad de la tabla impide además la corrección ordinaria.

**Arreglo propuesto:** instalar primero una defensa `BEFORE INSERT` que rechace nuevos duplicados, registrar los históricos para conciliación administrativa y crear el índice después de resolverlos.

### Alta · Una anulación de plataforma puede apuntar a un pago de otra empresa

**Archivo:** `apps/api/prisma/migrations/202610290002_platform_payment_void/migration.sql:4-10`.

**Cómo reproducirlo:** crear un pago de la empresa B e insertar una anulación con `tenantId` de A y `voidsPaymentId` del pago de B. La FK simple acepta la fila.

**Arreglo propuesto:** clave única y FK compuesta `(tenantId, voidsPaymentId) -> (tenantId, id)`, manteniendo también la validación de aplicación.

### Alta · Un rol `gv` preexistente conserva permisos peligrosos

**Archivo:** `apps/api/prisma/migrations/202610260901_gv/migration.sql:87-90`.

**Cómo reproducirlo:** crear antes un rol `gv` con `permissions = ARRAY['*']` y aplicar la migración. `ON CONFLICT DO NOTHING` conserva el acceso administrativo.

**Arreglo propuesto:** reservar el nombre y reemplazar sus permisos por la lista exacta `gv:read`, `gv:write`, `gv:reports`, registrando el valor anterior en bitácora.

### Media · La reclasificación de productos puede bloquear una base grande

**Archivo:** `apps/api/prisma/migrations/202610290001_sold_by_unit/migration.sql:5-13`.

**Cómo reproducirlo:** poblar muchos productos con millones de movimientos y ventas fraccionarias y aplicar la migración mientras la caja vende. El `UPDATE` correlacionado mantiene bloqueadas las filas modificadas.

**Arreglo propuesto:** medir en copia, comprobar índices en `Variant.productId`, `SaleItem.variantId` e `InventoryMovement.variantId`, definir `lock_timeout` y ejecutar por lotes o en una ventana controlada.

### Media · Algunas comprobaciones buscan la restricción solo por nombre global

**Archivos:**

- `apps/api/prisma/migrations/202610250301_pago_dolares/migration.sql:10-17`.
- `apps/api/prisma/migrations/202610290002_platform_payment_void/migration.sql:8-15`.
- `apps/api/prisma/migrations/202610310001_cashier_survey/migration.sql:15-20`.
- `apps/api/prisma/migrations/202610260902_gv_citas/migration.sql:53-61`.

**Cómo reproducirlo:** crear el mismo nombre de restricción en una tabla auxiliar y aplicar la migración; la restricción de la tabla objetivo puede omitirse.

**Arreglo propuesto:** consultar también `conrelid = '"TablaObjetivo"'::regclass` y el esquema.

### Media · `CashierSurvey.userId` admite usuarios inexistentes o de otra empresa

**Archivo:** `apps/api/prisma/migrations/202610310001_cashier_survey/migration.sql:3-18`.

**Cómo reproducirlo:** insertar una encuesta de A con UUID inexistente o con el usuario de B.

**Arreglo propuesto:** clave única en `User(tenantId,id)` y FK compuesta `(tenantId,userId)`.

### Media · GV no garantiza que padre e hijo pertenezcan a la misma sucursal

**Archivos:** `apps/api/prisma/migrations/202610260901_gv/migration.sql:24-73` y `apps/api/prisma/migrations/202610260902_gv_citas/migration.sql:53-60`.

**Cómo reproducirlo:** crear curso en `main`, inscripción en otra sucursal apuntando a ese curso y pago en una tercera. Las FK por UUID lo aceptan.

**Arreglo propuesto:** claves únicas y FK compuestas que incluyan `branchId`.

### Baja · «Consumidor final» puede duplicarse bajo concurrencia

**Archivo:** `apps/api/prisma/migrations/202610280024_product_base_roles_customer/migration.sql:20-26`.

**Cómo reproducirlo:** ejecutar dos copias concurrentes del bloque de backfill para una empresa sin ese cliente; `NOT EXISTS` no serializa ambas inserciones.

**Arreglo propuesto:** índice único por empresa y nombre normalizado, o bloqueo por empresa durante el backfill.

## Orden y alcance

No encontré errores en el orden nominal de dependencias. Las migraciones `202610250301` y `202610250401`, aunque se añadieron después de la base de referencia, dependen de objetos que ya existen y Prisma puede identificarlas como pendientes. Las dos migraciones GV deben permanecer exclusivamente en la línea de la tienda: aplicarlas sin adaptación al producto dejaría tablas GV sin `tenantId` ni RLS.

## Pruebas pendientes antes de producción

1. Restaurar una copia anonimizada de la base desplegada y ejecutar `prisma migrate deploy` con tiempos y bloqueos medidos.
2. Repetir sobre una copia con cada dato hostil descrito arriba.
3. Probar rollback operativo mediante respaldo, ya que Prisma no revierte estas migraciones automáticamente.
4. En la base de tienda, aplicar `202610260901_gv` y `202610260902_gv_citas` juntas y ejecutar pruebas de aislamiento por sucursal.

# T3 · Adenda independiente y pruebas reales de migraciones

2026-10-26. Complementa el T3 ya publicado en `docs/coordinacion/chatgpt-nube-26oct/T3-migraciones.md`; **no lo reemplaza**. Solo se modificó este documento nuevo. Sin cambios de aplicación, migraciones ni configuración; sin producción, Render, commit o push.

## URGENTE · Alta · GV903 puede impedir desplegar también la corrección de permisos

**Fuente nueva:** `a97f8fa73f096be98c31bdd63dc1d9d697eaa157`, `apps/api/prisma/migrations/202610260903_gv_auditoria/migration.sql:21-39`.

**Resultado ejecutado:** dos bases independientes reconstruidas desde la tienda `0c4f5246de1b7fdabd3e53cd69a6796a6b7c6ab7`, con GV901 y GV902 aplicadas, aceptaron estos estados históricos. Al aplicar GV903:

| Dato previo permitido por GV901/902 | Resultado real de GV903 | Consecuencia observada |
|---|---|---|
| Pago `method='transferencia'`, `bank=NULL`, `reference=NULL`, `verified=false`, con inscripción válida. | Salida SQL **1**, `check constraint "gv_payment_transfer_details" of relation "GvPayment" is violated by some row`. | No se instala GV903; un rol previo `gv` con `permissions=ARRAY['*']` sigue con `*`. |
| Pago `method='efectivo'`, `verified=true`, `rejectedAt=now()`, con inscripción válida. | Salida SQL **1**, `check constraint "gv_payment_review_exclusive" of relation "GvPayment" is violated by some row`. | Mismo bloqueo y mismos permisos antiguos. |

Se ejecutó cada archivo completo como una orden SQL, conservando su transacción implícita. Tras el error no existía tampoco la columna `GvEnrollment.refundAmount`: se revirtió el archivo completo. **Mover el `UPDATE Role` al principio del mismo archivo no basta si un error posterior revierte esa transacción.** En base sin esos históricos, GV903 sí pasó dos aplicaciones consecutivas.

**Reproducción:** reconstruir la tienda local; aplicar GV901 y GV902; crear un curso y una inscripción válidos; insertar uno de los dos pagos de la tabla anterior; poner en un rol `gv` de prueba `ARRAY['*']`; ejecutar GV903 con `ON_ERROR_STOP=1`; consultar los permisos y `information_schema.columns`. Se usaron UUID ficticios independientes, nunca filas reales.

**Arreglo propuesto:** preflight explícito que enumere los dos conjuntos conflictivos y conciliación administrativa de esos históricos, sin inventar referencias ni decidir cuál aprobación/rechazo prevalece. Desacoplar la corrección de permisos del bloque capaz de fallar, o garantizar que ese bloque no aborte por datos anteriores. Si se elige `CHECK ... NOT VALID`, atender también la limitación de actualizaciones descrita más abajo. Añadir pruebas de actualización sobre una base GV con esos estados anteriores; una prueba en vacío no cubre esta entrega.

**Delta frente al T3 publicado:** el `ON CONFLICT DO NOTHING` de GV901 ya no describe por sí solo el resultado final de la rama nueva. GV903:35-39 sí sustituye los permisos por la lista exacta, **si consigue aplicarse**. El hallazgo de permisos queda condicionado a esta actualización fallida; no se declara resuelto solo por leer ese `UPDATE`.

## Media · Los nuevos CHECK de reembolso aceptan fecha sin monto

**Fuente:** mismo SHA, `202610260903_gv_auditoria/migration.sql:11-19`.

**Prueba ejecutada:** después de aplicar GV903 correctamente, una inscripción válida con `status='reembolsada'`, `refundDate=CURRENT_DATE` y `refundAmount=NULL` se insertó con salida **0**. Consulta final: `reembolsada|2026-10-26|t`, donde `t` significa monto ausente.

**Causa:** la segunda rama del `CHECK` evalúa `NULL > 0`; el resultado desconocido no se rechaza en un `CHECK` PostgreSQL. La misma expresión aparece en citas; en esta revisión se ejecutó el caso de inscripción y se comprobó estáticamente la expresión idéntica de citas.

**Arreglo propuesto:** exigir explícitamente `refundAmount IS NOT NULL` en la rama con fecha, conservando la política de históricos sin ambos datos. Añadir casos con cada combinación de monto/fecha nulos. Esto es una omisión de integridad SQL; no se afirma haber explotado un endpoint.

## Precisión necesaria sobre el arreglo fiscal propuesto en el T3 anterior

**Fuente:** producto `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`, `apps/api/prisma/migrations/202610300001_ncf_coherencia/migration.sql:6-9,31-37`.

Se confirmó que una venta histórica `fiscalStatus='issued'` y `ncf=NULL` hace omitir `sale_issued_has_ncf` sin abortar. También se probó la alternativa sugerida: añadir esa regla como `NOT VALID` **sí bloquea una actualización de la misma fila histórica**, aunque solo cambie `status='voided'`. Resultado SQL: salida **1**, violación del CHECK de prueba.

Por tanto, `NOT VALID` protege las nuevas escrituras, pero **no permite por sí solo seguir anulando o anonimizando históricos inválidos**, objetivo explícito del comentario de la migración. El arreglo necesita limpieza previa o una transición que defina cómo se regularizan esas filas; no presentar `NOT VALID` como solución completa sin probar esos flujos. No se modificó la migración real para demostrarlo: el CHECK experimental solo existió dentro de la transacción descartable que falló.

## Inventario exhaustivo y pruebas independientes

Fuentes fijadas:

- Producto desplegado de referencia: `2f147d2da6d5a60f3c85ef67367658139c83e2c7`.
- Producto mezcla 4 revisado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`.
- GV inicial: `6c292009c3bdfa6dbede396f8cd871ca6f102afb`; citas: `a74b8eef07892be04b59b892a877cb7bdd5cc6bd`; corrección nueva: `a97f8fa73f096be98c31bdd63dc1d9d697eaa157`.
- Tienda para GV: `0c4f5246de1b7fdabd3e53cd69a6796a6b7c6ab7`.

Se obtuvo el inventario de `git diff --name-status 2f147d2d 1e7b1b2 -- apps/api/prisma/migrations`: **10 adiciones, ninguna modificación o eliminación de migraciones anteriores**. Para GV se compararon los árboles de los tres SHA: GV901/902 y, al actualizar la referencia, **una migración adicional GV903**. La lista de ejemplo de la orden no se tomó como exhaustiva.

Se reconstruyeron **67 archivos SQL** de la base de producto y **53 de la tienda** en un PostgreSQL **18.4** propio, puerto **5613**, `/tmp/nexora-cola-t3-db`. Después se aplicaron las 10 nuevas de producto dos veces (**20/20 correctas**), GV901/902 dos veces (**4/4 correctas**) y GV903 dos veces sin datos conflictivos (**2/2 correctas**). La repetición es secuencial; no es una prueba de dos desplegadores concurrentes.

Todas las rutas de la tabla siguiente están bajo `apps/api/prisma/migrations/`; las líneas corresponden a los SHA fijados arriba. El veredicto estático previo se conserva; aquí se añade comprobación ejecutada y se precisa el alcance.

| Migración / línea | Aditividad y datos hostiles o nulos | Bloqueos, dependencias y repetición | Evidencia adicional |
|---|---|---|---|
| `202610250301_pago_dolares/migration.sql:6-17` | Columnas constantes/nulas; los pagos antiguos sin esas columnas pasan como DOP. Un esquema parcial con datos incompatibles sigue siendo un riesgo condicional. | DDL con bloqueo de `Payment` y validación del CHECK; depende de Payment preexistente. Dos aplicaciones limpias correctas. | Incluida aunque su prefijo preceda varias migraciones ya desplegadas. |
| `202610250401_courier_name_sin_default/migration.sql:4` | Solo quita DEFAULT; no borra nombres guardados ni rellena NULL. | Bloqueo DDL de `Sale`; requiere columna creada en `202610250001`. Repetición correcta. | No altera datos históricos de mensajero. |
| `202610280024_product_base_roles_customer/migration.sql:6-26` | Backfill de roles/cliente por Tenant. No elimina duplicados existentes; el NOT EXISTS de clientes no es una garantía concurrente. | Inserciones y lectura de Tenant; requiere índice Role(tenantId,name). Repetición secuencial correcta. | No se ejecutó una carrera de dos migradores; no afirmar que Prisma la permitirá o la serializará a partir de este ensayo SQL. |
| `202610280025_ia08_ai_pack_reference/migration.sql:7-15` | Duplicados normalizados anteriores provocan NOTICE y omisión del índice, como indicaba T3. | Índice normal, no CONCURRENTLY; inspecciona AiPackCredit y bloquea escrituras durante su creación. Repetición limpia correcta. | **Ejecutado:** dos referencias distintas pero equivalentes normalizadas; migración salida0, índice ausente, tercera referencia equivalente aceptada. |
| `202610290001_sold_by_unit/migration.sql:5-13` | Columna default true y reclasificación. | ADD COLUMN y UPDATE histórico en el mismo archivo: no asumir solo bloqueo de filas; el DDL puede retener bloqueo exclusivo durante la transacción. Índices de padres existentes; repetición limpia correcta. | **Ejecutado:** producto con Variant.stock=1.5 quedó soldByUnit=false. No se midió una carga masiva ni concurrencia de ventas. |
| `202610290002_platform_payment_void/migration.sql:4-19` | Columnas NULL; no cambia la bitácora anterior. FK simple no une tenant del padre e hijo. | Requiere PlatformPayment de `202610280023`; FK/índice implican bloqueo y recorrido. Repetición limpia correcta. | **Ejecutado:** fila de anulación de A apuntando al pago de B aceptada por SQL. Confirma el defecto de integridad; no prueba un bypass de la API. |
| `202610300001_ncf_coherencia/migration.sql:15-37` | Conserva históricos inválidos omitiendo reglas. NULL fiscalStatus ya está prohibido por base; NCF/tipo tienen condiciones explícitas. | Recorridos y DDL sobre Sale; reglas se comprueban con tabla/esquema. Repetición limpia correcta. | **Ejecutado:** issued sin NCF deja ausente el CHECK; advertencia sobre NOT VALID reproducida arriba. |
| `202610300002_pla02_platform_payment_operation/migration.sql:4-6` | Dos columnas NULL; históricos no generan conflicto de unicidad por NULL. | Requiere PlatformPayment; índice normal impide escrituras mientras se construye. Repetición limpia correcta. | Sin error en la actualización desde base vacía ni en base con un pago histórico de prueba. No se simularon escrituras concurrentes durante el índice. |
| `202610310001_cashier_survey/migration.sql:3-37` | Tabla nueva y RLS; userId escalar sin FK. | Depende de Tenant, rol runtime y función assign de `202610260001`. Repetición limpia correcta. | **Ejecutado:** encuesta con userId inexistente aceptada por SQL; confirma hallazgo previo. |
| `202611010001_tenant_fk_indice/migration.sql:5-19` | Reemplaza función, sin backfill. | Dependencia correcta sobre guardas existentes; sin recorrido de las tablas hijas por esta migración. Repetición correcta. | **Ejecutado:** intento User de A con Role de B sigue rechazado con `Referencia a otra empresa o registro inexistente`. No se midió velocidad con millones de padres. |
| `202610260901_gv/migration.sql:5-100` | Tablas nuevas y backfill de permisos; no contiene tenantId/RLS de producto. | Solo tienda, FK/índices nuevos y UPDATE Role. Repetición limpia correcta. | La base tienda de referencia contiene Role.name único y las dependencias necesarias. El riesgo de rol antiguo debe reevaluarse junto a903. |
| `202610260902_gv_citas/migration.sql:3-62` | Tablas nuevas y restricciones sobre GvPayment ya existente. Un legado sin dueño/doble dueño o cita inexistente puede bloquear validación. | Requiere901, despuésFK y CHECK sobre pagos. Repetición limpia correcta. | Ensayo limpio ejecutado; el caso hostil específico de propietarios no se ejecutó en esta adenda y sigue descrito estáticamente en T3. |
| `202610260903_gv_auditoria/migration.sql:5-46` | Columnas NULL, CHECK nuevos y corrección de Role. Los dos legados anteriores hacen abortar todo; refundAmount NULL puede eludir la regla nueva. | Requiere901 y902. CHECK recorre pagos; DDL y actualización de Role. Dos repeticiones limpias correctas, dos upgrades hostiles fallan. | Hallazgos nuevos y corrección de estado detallados al inicio. |

## Evidencia y límites

Scripts temporales ejecutados: `/tmp/nexora-cola-t3-audit.py`, `nexora-cola-t3-gv-hostile.py` y `nexora-cola-t3-product-hostile.py`. Resultados: `/tmp/nexora-cola-t3-audit/results.json`, `gv-hostile.json`, `product-hostile.json`. No contienen datos reales ni credenciales. Son evidencia local temporal; este documento incluye las precondiciones y resultados necesarios para revisar la conclusión aunque esos archivos se borren.

Se ejecutó SQL de los SHA indicados, **no** una restauración de producción ni `prisma migrate deploy` con su tabla `_prisma_migrations`. No se certifican los tiempos de PostgreSQL17 de producción, las ventanas de bloqueo con su volumen real, un rollback operativo ni el estado real de sus filas. La prueba confirma compatibilidad SQL limpia y fallos reproducibles con históricos sintéticos permitidos; no sustituye un preflight contra una copia anonimizada.

Una defensa BEFORE INSERT propuesta para referencias IA debe además serializar referencias equivalentes o usar una garantía única: comprobar existencia sin bloqueo también permite carreras. No se ejecutó esa alternativa ni se presenta como una corrección implementada.
