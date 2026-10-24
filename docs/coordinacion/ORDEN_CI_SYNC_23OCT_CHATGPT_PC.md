# Orden para ChatGPT PC: CI rojo tras la sincronización del 23-oct (`dd10ebd`)

**Rama:** `producto-nexora`. No toques `nexora-cloud`, Render ni la base de la tienda.

## Qué falla

[Ejecución 40012350665](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/40012350665): `windows-installer` y `render-images` verdes; `verify` rojo, 1 prueba de 482:

- `tests/gv-servicios-api.test.ts` › «GV · tasa del dólar del día» › «guarda la tasa y recalcula solo los precios en dólares».
- `apps/api/src/usd-rate.ts:31` y `:38` usan `settings.findUnique/update({ where: { id: branchId } })`. En el producto `Settings` solo es único por `tenantId_id`, y Prisma lo rechaza.

Excluir `UsdRateWorker` del módulo en modo producto no basta: la función `applyUsdRate` también se llama desde la ruta de GV y desde las pruebas.

## Qué hacer

1. En `usd-rate.ts` cambia las búsquedas y actualizaciones de `Settings` por id a `tenantUnique("id", branchId)`, como ya hiciste en la línea 91. Revisa el resto del archivo y de los archivos que trajo la sincronización (`git diff 07e5515 dd10ebd --stat`) buscando más `findUnique`/`update`/`upsert` por clave global.
2. No cambies la prueba. Reprodúcela antes y después con PostgreSQL desechable.
3. Corre `pnpm check` y la integración, y espera los 3 trabajos de CI en verde en el último SHA.
4. Anota el resultado en `RESULTADOS_CHATGPT.md`. Después sigue con la fase 1 (`ORDEN_FASE1_CHATGPT_PC.md`).
