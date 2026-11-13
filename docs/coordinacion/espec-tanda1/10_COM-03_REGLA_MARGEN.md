# COM-03 · Diseño del aviso de margen bajo

**Bloqueada para construcción hasta confirmación de la dueña: condiciona decisiones de precio.** Base `511d223f`.

## Regla confirmada

- Fórmula única: `packages/shared/src/index.ts:482-487`, `(precio − costo) / precio × 100`.
- El precio es el que se cobra, **sin restar ITBIS**.
- Mínimo por defecto: **15 %**; `apps/api/src/alerts.ts:513-522` usa el umbral configurado y `apps/web/src/Merchandise.tsx:1137-1152` hoy presenta 15 % fijo.
- Esta pieza es aviso, no cambio automático de precio, descuento, impuesto ni costo.

## Comportamiento recomendado

Mostrar margen calculado en alta/edición y advertir antes de guardar cuando sea menor al umbral efectivo. El mensaje debe incluir precio, costo, porcentaje calculado y mínimo; para continuar, la dueña debe decidir entre aviso confirmable o bloqueo con permiso/PIN. Recomendación: aviso confirmable para rol con `catalog:write`, auditado; no inventar autorización hasta confirmar esa política.

Pseudocódigo: `m = margin(price, cost); if m < threshold -> warning; never recompute price`.

## Matriz de prueba previa a construcción

En `tests/management-product-margin.test.tsx` y una prueba API del guardado elegido:

- precio 100/costo 85 = 15 %: no bajo margen;
- precio 100/costo 86 = 14 %: advertencia;
- precio 100/costo 84 = 16 %: normal;
- tasa ITBIS 0, 18 y otra: mismo margen para igual precio/costo;
- costo 0 = 100 %; costo mayor = porcentaje negativo; precio 0/inválido no permite un resultado engañoso;
- umbral configurado distinto de 15 se respeta, con 15 como fallback;
- variantes/mayoreo no mezclan precios ni costos de otra variante.

La prueba de presencia del aviso falla hoy; la fórmula ya debe seguir verde en `packages/shared/src/business.test.ts:105-114`.

## Decisión y marcha atrás

- La dueña debe confirmar si solo avisa, exige confirmación o bloquea por rol/PIN.
- No usar `(precio sin ITBIS − costo) / precio sin ITBIS`, markup ni utilidad neta.
- Marcha atrás: quitar aviso/confirmación; no hay migración y los valores no se transforman.
