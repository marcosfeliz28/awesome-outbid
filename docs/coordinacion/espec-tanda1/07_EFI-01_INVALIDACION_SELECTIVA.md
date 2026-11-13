# EFI-01 · Refresco selectivo después de vender

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `apps/web/src/POS.tsx:2300-2360`: después de cobrar, limpia carrito y espera `client.invalidateQueries()` global.
- `apps/web/src/POS.tsx:2393-2402`: el conflicto de precio ya tiene un refresco explícito de catálogo, promociones y ajustes.
- `apps/web/src/api.ts:409-430`: el catálogo se carga por páginas y una invalidación global puede volver a descargarlo completo.
- `apps/web/src/api.ts:432-484`: existe actualización local de existencias en vivo.
- `apps/web/src/realtime.tsx:179-222`: `ready` aún invalida todo; `stock.changed` actualiza catálogo/cache y refresca claves concretas.

## Cambio mínimo

Extraer una función de postventa que invalide solo datos derivados de la venta (`sales`, `cash-sessions`, `pending-sales`, `cod-pending`, `customers`/cuentas, `dashboard`, `alerts`) y no `catalog`, `categories`, `settings` ni `promotions`. Lanzar refrescos en paralelo sin retener la pantalla de recibo; el stock llega por `stock.changed`. Mantener el refresco explícito de catálogo solo para conflicto de precio o variante desconocida.

La lista final debe verificarse contra consumidores existentes antes de implementar; no sustituir consistencia del servidor por optimismo de dinero.

## Regresión nueva

Crear `tests/pos-post-sale-refresh.test.ts`: con un `QueryClient` espía, una venta exitosa invalida únicamente las claves aprobadas, nunca `catalog`, y muestra/permite cerrar el recibo sin esperar respuestas de red. Un conflicto de precio sí conserva el `refetchQueries` de catálogo/promociones/settings. Falla hoy por la invalidación global esperada y pasa después.

Pruebas existentes que leen estas fuentes: `tests/accessibility-contract.test.ts`, `tests/caja-web-ticket.test.ts`, `tests/compliance.test.ts`, `tests/f2-03-pos-visual.test.ts`, `tests/impacto.test.ts`, `tests/promociones-paridad.test.ts`, `tests/recibo-envio.test.ts`, `tests/management-messages.test.ts`, `tests/seguridad-menor.test.ts` y `tests/web-privacy.test.ts`. No hay prueba de texto actual para `realtime.tsx`.

## Casos límite y marcha atrás

- Sin conexión: no invalidar como si el servidor ya conociera la venta; conservar cola y caché local.
- Evento SSE retrasado/desconectado: si no llega stock en un plazo definido, permitir refresco focalizado de catálogo, no global.
- Crédito/contraentrega debe refrescar deuda y pendientes; efectivo debe refrescar caja.
- Error de una invalidación no revierte ni repite la venta idempotente.
- Marcha atrás: volver a la invalidación global; retirar helper sin tocar API ni datos.
