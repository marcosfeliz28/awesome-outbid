# COM-03 · Mostrar margen al editar productos

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `apps/web/src/Management.tsx:270-296`: alta de producto incluye precio y costo, pero no muestra margen calculado.
- `apps/web/src/Management.tsx:635-669`: edición de variante expone precio/costo con el mismo vacío informativo.
- `packages/shared/src/index.ts:482-487`: `margin` es la fórmula canónica `(precio − costo) / precio`, sin restar ITBIS.
- `apps/web/src/Merchandise.tsx:1137-1152`: ya existe presentación de margen bajo, con umbral fijo de 15 %.
- `apps/api/src/alerts.ts:513-522`: alertas usan `margin` y el umbral configurado, cuyo valor por defecto es 15 %.

## Cambio mínimo

En ambos formularios, derivar y mostrar el margen al lado de precio/costo usando `margin` compartido. Estado neutro si falta un valor; verde si es al menos el umbral configurado y advertencia si queda por debajo. Esta pieza solo informa: no bloquea guardado, no cambia precio/costo, no agrega autorización y no recalcula ITBIS.

Pseudocódigo: `valid price/cost -> margin(price,cost); warn when result < lowMarginPercent(default 15)`.

## Regresión nueva

Crear `tests/management-product-margin.test.tsx`: precio 100/costo 85 muestra 15 %, 86 muestra 14 %, 84 muestra 16 %; precio cero o vacío no produce `NaN`; cambiar cualquiera actualiza la vista sin mutar el formulario. Falla hoy porque no hay indicador y pasa después.

Pruebas existentes que leen `Management.tsx`: `tests/accessibility-contract.test.ts`, `tests/caja-web-ticket.test.ts`, `tests/claude-round2.test.ts`, `tests/customer-display.test.ts`, `tests/esqueleto-tabla.test.ts`, `tests/management-messages.test.ts`, `tests/offline-review-web.test.ts` y `tests/ventas-caja-ciega-postgres.test.ts`. La fórmula ya está cubierta por `packages/shared/src/business.test.ts:105-114`.

## Casos límite y marcha atrás

- Costo cero da 100 %; precio cero/inválido no debe aparentar margen válido.
- Costo mayor que precio muestra margen negativo, no lo recorta a cero.
- Mayoreo y variantes: usar los campos visibles de la variante; no inferir un precio alterno.
- Umbral ausente usa 15 %; un umbral configurado solo cambia color/texto, no fórmula.
- Marcha atrás: retirar el indicador derivado; formularios y persistencia quedan intactos.
