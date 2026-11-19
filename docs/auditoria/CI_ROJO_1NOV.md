# CI rojo desde el 1-nov-2026 (`verify`, tests/dinero-auditoria.test.ts)

Estado: causa encontrada; arreglo de código NO aplicado porque cambia dinero que la dueña ya ve (decisión pendiente).

## Síntoma

`el círculo del año y el desglose del período cuadran con las ventas`: «expected 89439.5 to be close to 89557.5» (diferencia 118) entre `GET /dashboard/year` (mes) y `GET /dashboard/breakdown?from=<día 1>&to=hoy`.

## Causa 1 (ya arreglada en 4f994d7b)

Devolución heredada con `items` vacíos: el año resta `SaleReturn.total`; el desglose sólo restaba líneas devueltas. Ahora sale como fila «Devoluciones sin detalle».

## Causa 2 (esta): la devolución se fecha distinto

- `dashboard/year` (y `dashboard/summary`, `reports/profit`) restan la devolución en el mes/día en que se HIZO (`SaleReturn.createdAt`).
- `dashboard/breakdown` la resta en la fecha de la VENTA (baja `SaleItem.returnedQty` de líneas de ventas del período).

Mientras venta y devolución caen en el mismo mes, ambos cuadran. El 1.º de cada mes, una devolución de una venta del mes anterior resta en el año de este mes y no en el desglose.

Disparador en CI: `tests/api.test.ts` («devolución del período resta costo solo cuando reingresa…») pone `createdAt = ahora − 24 h` a una venta de 118 (FS-…, 31-oct) y la devuelve hoy (1-nov). Reproducido con PostgreSQL 16, Node 24.22.2, pnpm 11.19.0, `db:migrate` + `db:seed` + API en :3001: la devolución NC de esa venta (total 118) hace que el mes del año quede 118 por debajo del desglose (7073.5 vs 7191.5). No tiene que ver con la semilla: las 846 ventas demo cuadran (Sale.total = Σ lineTotal) y la semilla no crea devoluciones. La prueba pasa sola o antes de las 24 h del día 2 en adelante, y falla el día 1.

## Propuesta (decide la dueña)

A. (recomendada, cambia cifras del desglose) `dashboard/breakdown` resta las devoluciones por fecha de devolución, como año/resumen: las líneas devueltas se toman de `SaleReturn.items` (saleItemId, qty, total, cost) con `SaleReturn.createdAt` en el rango, en lugar de `returnedQty`. Cambia el desglose, top y mezcla de pagos de cualquier período que cruce una devolución de otro mes; también `reportes/ventas.ts` y `margen.ts`, que dicen copiar el desglose.
B. (sin cambio de dinero) Que la fixture de `tests/api.test.ts` no cruce de mes (fechar la venta «ayer» sólo si es el mismo mes). Oculta la diferencia en CI pero no la quita de producción.
