# DIS-01 · Distinguir carga, error y cero en el resumen

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `apps/web/src/KpiStrip.tsx:19-48`: `KpiStrip` consume el resumen diario y entrega ceros al modelo aun cuando la consulta todavía no resolvió.
- `apps/web/src/kpiStripModel.ts:19-53`: `buildKpiStripModel` normaliza ventas, facturas y alertas ausentes a `0`.
- `apps/web/src/YearPie.tsx:39-49,77-116`: `YearPie` convierte la ausencia de datos en «Sin ventas» sin distinguir carga o error.
- `apps/web/src/ZeroCost.tsx:20-27`: `ZeroCost` devuelve `null` tanto sin alerta real como durante carga/error.
- `apps/web/src/helpers.tsx:177-207`: `QueryState` ya ofrece el patrón común de carga, error y reintento.

## Cambio mínimo

Pasar los estados de React Query a cada visualización y reutilizar `QueryState`. Mientras carga, mostrar un esqueleto con nombre accesible; ante error, mensaje breve y `Reintentar`; solo después de una respuesta válida se permite mostrar `0`, «Sin ventas» u ocultar `ZeroCost`. No cambiar endpoints ni cálculos.

Pseudocódigo: `pending -> skeleton; error -> QueryState; success -> current model/data`.

## Regresión nueva

Crear `tests/dashboard-query-states.test.tsx`. Con consultas controladas, debe comprobar: carga no dice «RD$ 0.00» ni «Sin ventas»; error expone alerta y reintento; respuesta válida con ceros sí muestra cero/sin ventas; `ZeroCost` solo desaparece tras éxito sin casos. Debe fallar hoy porque los componentes no separan esos estados y pasar después.

Pruebas de texto que pueden romperse: `tests/f2-02-kpi-strip.test.ts` lee el modelo; no hay prueba existente que lea `YearPie.tsx` o `KpiStrip.tsx` por nombre. `tests/accessibility-contract.test.ts` puede verse afectada si se reutilizan primitivas accesibles.

## Casos límite y marcha atrás

- Datos parciales: no sustituir un campo ausente por error global si la API respondió correctamente con el contrato vigente.
- Reintentos y modo sin conexión: conservar el último dato exitoso mientras se indica actualización; no presentarlo como cero nuevo.
- Lectores de pantalla: el esqueleto no debe anunciar cifras falsas; el error debe tener `role="alert"`.
- Marcha atrás: retirar solo las ramas visuales y la prueba; las consultas y el modelo quedan intactos.
