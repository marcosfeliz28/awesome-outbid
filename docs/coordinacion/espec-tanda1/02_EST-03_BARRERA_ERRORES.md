# EST-03 · Barrera de errores por página

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `apps/web/src/App.tsx:639-698`: `Shell` posee navegación y página activa.
- `apps/web/src/App.tsx:1241-1247`: el contenido de la página se monta dentro de `main`; una excepción de render puede tumbar todo el árbol.
- `apps/web/src/App.tsx:1421-1426`: `App` monta `Shell` y `Toasts` sin barrera.
- `apps/web/src/main.tsx:18-31`: se restaura el carrito y se renderiza la raíz.
- `apps/web/src/monitoring.ts:104-155`: `initMonitoring` inicializa Sentry con saneamiento, pero no hay helper público para capturar una excepción de UI.

## Cambio mínimo

Crear una barrera de clase pequeña alrededor de la página activa, no alrededor de todo `Shell`. Debe conservar menú, cabecera, carrito y toasts; mostrar «Esta pantalla tuvo un problema», botones `Reintentar` y `Volver a Caja`; reiniciarse cuando cambie la clave de página; y enviar error + nombre de página al monitoring sin datos de venta, cliente o carrito.

Pseudocódigo: `<PageErrorBoundary key={page} onError={captureSanitized}><DeviceGate>{pageNode}</DeviceGate></PageErrorBoundary>`.

## Regresión nueva

Crear `tests/page-error-boundary.test.tsx`: un hijo que lanza debe dejar navegación visible, mostrar fallback, registrar una captura saneada una sola vez y recuperarse al cambiar `page` o pulsar reintentar. Debe fallar antes porque no existe barrera y pasar después.

Pruebas existentes que leen estos archivos: `tests/accessibility-contract.test.ts`, `tests/auth-username.test.ts`, `tests/caja-web-ticket.test.ts`, `tests/impacto.test.ts`, `tests/login-animacion.test.ts` y `tests/web-monitoring.test.ts`.

## Casos límite y marcha atrás

- No borrar carrito, borrador ni venta pendiente al fallar una pantalla.
- No atrapar errores de handlers asíncronos como si fueran de render; continúan por sus mensajes actuales.
- Evitar bucle si el fallback falla; `Volver a Caja` debe usar navegación mínima.
- No adjuntar props, texto del DOM ni objeto de error sin sanitizar a monitoring.
- Marcha atrás: quitar el envoltorio y helper de captura; no hay migración ni estado persistido.
