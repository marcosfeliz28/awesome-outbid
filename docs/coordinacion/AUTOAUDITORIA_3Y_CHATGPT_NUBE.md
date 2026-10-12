# Autoauditoría 3y · Casa y traspasos

## Comportamiento y límites

- `Variant.stock` y `Lot.qty` siguen representando **Tienda**, único origen vendible. `VariantStock` y `LotStock` guardan el saldo por almacén. Un disparador refleja las escrituras antiguas al saldo de Tienda; la migración copia los saldos históricos sin restarlos ni sumarlos otra vez.
- Un traspaso exige permiso de administración (`*`) y equipo aprobado. Valida sucursal, almacenes distintos y activos, cantidades positivas (máximo 999999 y tres decimales), origen suficiente, lote correspondiente y `operationId`. Una transacción serializable bloquea la variante y registra salida/entrada; no modifica costo promedio.
- Los conteos y ajustes aceptan `warehouseId`. El levantamiento por Excel muestra vista previa del mismo archivo y mismo estado de existencias antes de aplicar; crea artículos nuevos con cero en Tienda y las unidades en Casa. Los artículos que exigen lote se capturan por lote.
- El tablero y el reporte de valor incluyen todos los almacenes. Ventas, FEFO y avisos de poco stock siguen usando Tienda. Los movimientos de traspaso no entran en pérdidas.

## Pruebas ejecutadas en este entorno

- `prisma validate` con URL de ejemplo: pasó.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`: pasaron.
- `pnpm vitest run tests/inventario.test.ts tests/management-messages.test.ts tests/inventory-import-core.test.ts`: 30 pasaron, 1 omitida por la propia suite.
- `tests/reports-memory-postgres.test.ts` tampoco pudo iniciarse aquí: `listen EPERM` al intentar arrancar PostgreSQL. No es un fallo de aserción del reporte.
- `pnpm exec playwright test --list tests/e2e/almacenes.spec.ts`: reconoció la prueba.
- PostgreSQL real: **sin ejecutar aquí**. El entorno niega `bind` TCP y Unix (`EPERM`), incluso al arrancar el servidor embebido. `tests/warehouses-postgres.test.ts` cubre migración con 10 unidades previas, saldos, costo, kardex, reenvío, sucursal ajena y carrera. Debe correrse en CI o una máquina con sockets permitidos.
- E2E real: **sin ejecutar aquí** porque depende de API+PostgreSQL en funcionamiento. La prueba comprueba que ocho unidades iniciales en Casa no aparecen vendibles, y que al mover tres, Tienda=3, Casa=5, total=8; también prueba cantidad excesiva, permiso de almacén y pantalla a 390 px.

## Abusos y efectos revisados

- Reenvío de `operationId`: compara sucursal, usuario, origen, destino, motivo y líneas; misma petición devuelve la operación previa, distinta petición responde conflicto. Un candado consultivo protege envíos simultáneos.
- Sucursal ajena: almacenes y variantes se filtran por `branchId`; lotes también. Origen insuficiente bloquea aun si el producto permite stock negativo para ventas. IDs repetidos en Excel se rechazan.
- No se cambian caja, créditos, incentivos, pagos ni cola de ventas sin conexión. Las ventas siguen leyendo sólo Tienda. Los costos de recepciones y devoluciones ponderan el saldo total; los traspasos no crean ingresos ni costos nuevos.
- Pendiente: validar contra PostgreSQL real y navegador, revisar CI `verify`, `windows-installer` y `render-images` en el SHA final. No desplegar.
