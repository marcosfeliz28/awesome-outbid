# T2 · Auditoría de producto-mezcla-4

Fecha: 2026-10-26  
Rama auditada: `origin/claude/producto-mezcla-4`  
Commit auditado: `1e7b1b25d91d0cadab1167e243eaac7d32b2d4a0`  
Base de la mezcla revisada en paralelo: `d0c44ac5862866a64cb0bf3a8abe54f7834381a2`; el único cambio posterior fue `apps/web/src/api.ts`, sin efecto sobre los hallazgos.  
Método: auditoría estática; no se ejecutaron pruebas que requieren PostgreSQL y no se modificó código existente.

## Resumen

La mezcla conserva varias defensas importantes: dinero con `Decimal`, aislamiento RLS para tráfico empresarial, bloqueo de autoaprobación, numeración NCF transaccional y soporte de solo lectura. Encontré dos defectos funcionales en anulaciones y el riesgo arquitectónico de mínimo privilegio ya desarrollado en T6.

## Hallazgos

### Alta · Anular una venta puede dejar el efectivo esperado negativo

**Archivos:**

- `apps/api/src/sales.ts:2443-2477`: bloquea la caja original, pero solo prepara una caja de reembolso cuando la original está cerrada.
- `apps/api/src/sales.ts:2485-2490`: comprueba efectivo disponible únicamente cuando existe `refundCash`.
- `apps/api/src/cash.ts:58-68`: el esperado deja de contar los pagos cuando la venta pasa de `completed` a `voided`.

**Cómo reproducirlo:**

1. Abrir caja con RD$0.
2. Vender RD$100 en efectivo.
3. Registrar una salida de caja de RD$100.
4. Anular la venta mientras esa misma caja continúa abierta.
5. La venta deja de entrar en `cashExpected`, pero la salida permanece; el efectivo esperado pasa a `-RD$100`.

**Arreglo propuesto:** bloquear la caja original y comprobar `cashCollected(sale.payments) <= cashExpected(originalCash).cash` también cuando siga abierta. Añadir una prueba concurrente entre retiro y anulación para confirmar que el candado impide ambas operaciones incompatibles.

### Media · Una transferencia pendiente queda atascada al anular la venta

**Archivos:**

- `apps/api/src/sales.ts:2564-2574`: la anulación cambia la venta, pero no lleva sus transferencias pendientes a estado terminal ni resuelve su alerta.
- `apps/api/src/sales.ts:2687-2693`: el listado pendiente no excluye ventas anuladas.
- `apps/api/src/sales.ts:2793-2796`: verificar exige que la venta siga completada.
- `apps/api/src/sales.ts:2937-2942`: rechazar también exige que la venta siga completada.

**Cómo reproducirlo:**

1. Crear una venta pagada con transferencia en `pending_verification`.
2. Anular la venta.
3. Abrir «Conciliar transferencias»: el pago todavía aparece.
4. Intentar verificarlo y rechazarlo; ambas acciones responden «La venta ya no está completada.».

**Arreglo propuesto:** dentro de la misma transacción de anulación, pasar las transferencias pendientes a un estado terminal explícito, resolver sus alertas y excluir ventas anuladas del listado. Añadir regresiones para listar, verificar y rechazar después de anular. Este defecto ya figuraba en `docs/coordinacion/revision-pesada/2-revision-codigo.md:73-76` y sobrevivió la mezcla.

### Alta arquitectónica · El panel de la operadora evita el mínimo privilegio de PostgreSQL

**Archivos:**

- `apps/api/src/registration.ts:124-128`: `RegistrationService.db` crea un `PrismaClient` con la conexión propietaria.
- `apps/api/src/platform.ts:89-94,156-162` y `apps/api/src/platform-billing.ts:82`: los controladores de plataforma reutilizan ese cliente.

**Cómo reproducirlo:** ejecutar desde un controlador de plataforma una consulta con ese cliente contra `Sale`, `Customer` o `Product`; la cuenta propietaria puede leer todas las empresas y evita RLS. Las respuestas actuales no exponen esos datos, pero la base no limita el alcance de un defecto futuro o una inyección.

**Arreglo propuesto:** implementar el diseño de `T6-rol-plataforma.md`: conexión separada, sin membresía en el rol empresarial y con ejecución exclusiva de funciones cerradas. Agregar pruebas negativas directas contra ventas, clientes, productos, costos y configuración.

## Controles positivos comprobados

- Dinero y vuelto usan `Decimal`; pagos no efectivos no generan cambio: `packages/shared/src/index.ts:359-379`.
- La autoaprobación de solicitudes queda bloqueada para personal: `apps/api/src/security.ts:82-137`; la excepción de la dueña con `*` está documentada expresamente.
- El NCF usa candado por empresa y tipo, incrementa dentro de la transacción y tiene unicidad por empresa: `apps/api/src/ncf-sequences.ts:67-86` y `apps/api/prisma/schema.prisma:437`.
- La regresión existente cubre 12 ventas concurrentes, secuencia consecutiva y conservación del NCF al anular: `tests/product-ncf-por-venta-postgres.test.ts:376-414`.
- El tráfico normal de cada empresa activa el rol RLS y `app.tenant_id`: `apps/api/src/tenant-database.ts:21-31`.
- Soporte tiene permisos fijos de catálogo de solo lectura y se rechazan escrituras: `packages/shared/src/index.ts:837-860` y `apps/api/src/common.ts:803-821`.
- No hay marcadores de conflicto en el árbol auditado y `git diff --check` no señaló errores.

## Regresiones y pruebas pendientes

1. PostgreSQL real: venta en efectivo, salida simultánea y anulación sobre caja abierta.
2. PostgreSQL real: anular venta con transferencia pendiente y comprobar pago, alerta, listado, verificar y rechazar.
3. Prueba negativa del cliente de plataforma contra todas las tablas empresariales.
4. Ejecutar la suite de dinero y NCF de la mezcla completa en CI; esta auditoría no sustituye esas pruebas.
