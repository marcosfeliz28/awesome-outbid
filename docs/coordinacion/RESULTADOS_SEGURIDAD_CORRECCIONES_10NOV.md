# Resultados: correcciones de seguridad (10-nov)

Rama `claude-pc/seguridad-correcciones-10nov`, desde `origin/nexora-cloud`. Sin despliegue, sin PR.

## Hecho (TDD: prueba roja, luego arreglo)

| # | Hallazgo | Arreglo | Prueba |
|---|---|---|---|
| 1 | `scripts/rutas-permisos.mjs` atribuía mal el `@Permit` | Busca ±4 líneas sin cruzar al método vecino; entiende `@Get([...])`; resuelve constantes (`INVENTORY_IMPORT_PERMISSION` a `inventory:import`); documento regenerado | `tests/rutas-permisos-script.test.ts` |
| 2 | `safe()` no ocultaba `SupplierPayment.amount` | Se oculta `amount` si hay `supplierId` y no `saleId` (sin `profit:read`) | `tests/seguridad-correcciones-10nov.test.ts` |
| 3 | `editableSale` bloqueaba la venta sin `branchId` | `AND "branchId" = actor.branchId` en el `FOR UPDATE` | ídem |
| 4 | Categorías y marcas sin filtro de sucursal | `GET /categories` y `GET /brands` filtran por `actor.branchId`; `Brand.branchId` (default `main`); migración `202611100001_marca_por_sucursal` | `tests/seguridad-correcciones-catalogo.test.ts`, `tests/seguridad-10nov-migraciones-postgres.test.ts` |
| 5 | `GET /settings` devolvía todo | Sin `sale:manage` solo se entrega la lista blanca del POS (`POS_SETTINGS_KEYS` en `admin.ts`, armada leyendo `POS.tsx`, `Tienda.tsx`, `Prints.tsx` y las reglas de crédito de `@fitstore/shared`) | `tests/seguridad-correcciones-catalogo.test.ts` |
| 6 | Número de factura/devolución chocaba entre sucursales | `@@unique([branchId, number])` en `Sale` y `SaleReturn`; `documentNumber()` agrega prefijo solo fuera de `main`; migración `202611100002_numeracion_por_sucursal` | `tests/seguridad-correcciones-10nov.test.ts`, `tests/seguridad-10nov-migraciones-postgres.test.ts` |

### Cambios de unicidad (migraciones, sin borrar filas)
- `Brand`: se crea `Brand_branchId_name_key` y se suelta `Brand_name_key` (el `@unique` simple de `name`).
- `Sale`: se crea `Sale_branchId_number_key` y se suelta `Sale_number_key`.
- `SaleReturn`: se crea `SaleReturn_branchId_number_key` y se suelta `SaleReturn_number_key`.
- Las tres llevan `SET LOCAL lock_timeout = '5s'`. Ninguna fila se modifica.

### Formato de numeración
- `main` queda exacto: `FS-0000001`, `NC-000001`.
- Otra sucursal: `FS-<últimos 4 caracteres alfanuméricos de branchId>-0000001`. Dos sucursales con los mismos 4 últimos caracteres se parecerían en pantalla; la base las separa por `branchId`.

### Efectos secundarios a conocer
- `tests/ventas-caja-ciega-postgres.test.ts` usaba `findUniqueOrThrow({ where: { number } })`; ahora `findFirstOrThrow` porque `number` ya no es único por sí solo. No hay otro uso en `apps/`.
- `docs/sistema` se re-ancló con `pnpm docs:citas` (cambian números de línea de las citas).

## No se tocó (decisión pendiente de la dueña)
- **`Role` global (sin `branchId`) y `DriveBackup` de una fila `main`**: son así por diseño actual. Solo importan si varias empresas comparten una misma base (decisión SaaS: base por cliente o compartida). Sin cambios de código.
- **Login de `seller` sin equipo aprobado**: `apps/api/src/auth.ts:502`, `if (user.role.name !== "seller" && !terminalId)`. Es decisión operativa (podría bloquear cajeras reales si sus equipos no están aprobados hoy). Necesita confirmación de la dueña antes de tocarlo. Sin cambios de código.

## Bloqueado
Nada bloqueado.

## Verificación local
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: verdes.
- `pnpm test` (con Postgres embebido como usuario no root): verde tras el arreglo de citas y de `ventas-caja-ciega`.
- Integración contra API y base reales (`vitest.integration.config.ts`), incluidas `api.test.ts`, `dinero-*`, `desglose-suma-api`, `devoluciones-heredadas-api`: sin fallos atribuibles a estos cambios. `tests/drive-backup.test.ts` falla en este entorno (`Primero conecta Google Drive.`); no toca ventas ni marcas y el CI lo confirma o no.
