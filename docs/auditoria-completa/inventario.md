# Auditoría completa — Inventario y almacenes

Fecha: 2026-10-18  
Base revisada: `origin/nexora-cloud` (`cf6f7022ab9682db45327558e5dd18946a7b1473`)  
Alcance: inventario, almacenes Casa/Tienda, transferencias, kardex, stock negativo, ventas/devoluciones, costo promedio, kits, importación Excel, lotes/vencimiento y concurrencia serializable. Revisión de solo lectura; no se modificó código de aplicación, migraciones ni datos de Casa.

## Hallazgos

### I-01 — Alto (estático, SIN REPRODUCIR): categorías con control de vencimiento pueden vender stock sin lote ni fecha

Evidencia:

- `apps/api/src/catalog.ts:237-240` permite crear independientemente `requiresExpiry: true` y `requiresLot: false`.
- `apps/api/src/inventory.ts:1592` rechaza el conteo directo solo cuando `requiresLot` es verdadero; por tanto, en esa configuración el conteo puede introducir existencia sin lote/fecha.
- `apps/api/src/inventory.ts:532` entra al consumo FEFO únicamente si `requiresLot` o si ya existen lotes. Si no existe ninguno, `apps/api/src/inventory.ts:559-560` registra toda la venta como stock sin lote. La rama de consumo no exige fecha para una categoría `requiresExpiry` sin lotes.

Reproducción mínima propuesta (no ejecutada: requiere PostgreSQL/API aislados): crear categoría con `{requiresLot:false, requiresExpiry:true}`, crear variante sin lotes, registrar y aplicar un conteo positivo para ella, y luego vender una unidad. El código permite contar esa existencia y la ruta de venta cae en la rama de stock sin lote. Resultado esperado: impedir que el conteo agregue stock sin lote/vencimiento o bloquear la venta; resultado observado estático: ambas rutas aceptan el caso. No afirmo reproducción dinámica.

Parche propuesto, no aplicado: imponer la invariante `requiresExpiry => requiresLot` al crear categorías y en cualquier import/actualización; además, en conteos y `takeStock`, exigir lotes con vencimiento cuando `requiresExpiry` esté activo, sin fallback a stock no trazado. Añadir una regresión PostgreSQL que haga el flujo anterior y espere rechazo antes de mutar stock.

## Revisado y con controles visibles en código

- Los ajustes y recepción de mercancía usan transacciones serializables con reintentos acotados; los ajustes bloquean la variante y validan saldo/cantidad antes de registrar movimiento. `inventory.ts`, `merchandise.ts`.
- Transferencias de almacén validan sucursal, almacenes activos, saldo de origen y lotes; son serializables, usan bloqueo por `operationId` y registran movimientos enlazados sin alterar el costo promedio. `warehouses.ts`.
- Recepciones de órdenes registran movimientos/lotes, separan unidades dañadas y recalculan costo ponderado con el costo de mercancía recibida. `merchandise.ts`.
- Ventas bloquean variantes/componentes; devoluciones reponen según las asignaciones originales y evitan reponer lotes vencidos. Kits no anidados y con cantidades derivadas de sus componentes. `sales.ts`, `catalog.ts`.
- La importación de Casa está separada del stock vendible, usa vista previa/huella, transacción y bitácora; no se ejecutó sobre datos reales ni se modificó Casa.
- Las pruebas puras de importación y resiliencia serializable pasaron (salida abajo). No prueban la persistencia ni la concurrencia real de PostgreSQL.

## Pruebas y límites de verificación

- `pnpm install --frozen-lockfile`: terminó con código 0.
- `pnpm db:generate`: terminó con código 0. No se leyó `.env` ni se consultó `DATABASE_URL`.
- `pnpm exec vitest run tests/inventory-resilience.test.ts tests/inventory-import-core.test.ts`: pasó, 2 archivos y 15 pruebas.

Salida:

```text
✓ tests/inventory-import-core.test.ts (8 tests) 95ms
✓ tests/inventory-resilience.test.ts (7 tests) 586ms
Test Files  2 passed (2)
Tests       15 passed (15)
```

`pnpm check`, `tests/warehouses-postgres.test.ts`, pruebas API PostgreSQL y `tests/e2e/almacenes.spec.ts` NO ejecutadas: no hay base descartable provisionada; no se usó ni inspeccionó ninguna configuración/credencial existente. No se intentó iniciar PostgreSQL ni conectar a Render/producción. Por ello, transferencias concurrentes reales, conteos/importaciones persistidos, migraciones y flujo UI móvil quedan SIN REPRODUCIR.

**Actualización de la auditoría integrada (2026-10-18):** en el worktree principal se ejecutó `pnpm check` sobre el mismo SHA base (`cf6f7022`), cuyo Vitest incluye `tests/warehouses-postgres.test.ts`: **4 pruebas pasaron**. La variable externa `NEXORA_TEST_PG_URL` no estaba definida; el test crea y destruye su PostgreSQL embebido temporal. Esto confirma esa suite focalizada de almacenes, pero no ejecuta `tests/e2e/almacenes.spec.ts` ni reproduce I-01.

## Pendiente

Reproducir I-01 y ejecutar la suite PostgreSQL/E2E solo cuando exista una base local desechable confirmada y aislada, usando los puertos reservados por la orden. No se aplicaron parches ni se desplegó nada.
