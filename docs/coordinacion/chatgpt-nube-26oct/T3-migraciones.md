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
