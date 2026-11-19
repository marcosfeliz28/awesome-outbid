# MOD-08 · Tema inicial según el sistema

Base de líneas: `origin/nexora-cloud` `511d223f`.

## Superficie actual

- `apps/web/src/api.ts:92-117,154-159`: el store usa `localStorage` o `light` y persiste el cambio manual.
- `apps/web/src/main.tsx:14-15,26-31`: antes del primer render solo se aplica el modo visual, no el tema.
- `apps/web/src/App.tsx:696-698`: el atributo `data-theme` se aplica después de montar React.
- `apps/web/src/App.tsx:1149-1162`: el botón alterna y aplica el tema manualmente.
- `apps/web/index.html:9`: `theme-color` está fijo en `#7C3AED`.

## Cambio mínimo

Antes de montar React, resolver tema: preferencia guardada válida; si no existe, `matchMedia('(prefers-color-scheme: dark)')`; si no está disponible, claro. Aplicar `data-theme` y `color-scheme` de inmediato para evitar destello. El botón sigue siendo una preferencia explícita y persistida. Actualizar el `meta[name=theme-color]` al color de cada tema.

No seguir cambios posteriores del sistema cuando ya existe preferencia manual. Si no existe, sí escuchar el `MediaQueryList` mientras dure la sesión.

## Regresión nueva

Crear `tests/theme-bootstrap.test.ts`: sin almacenamiento + sistema oscuro devuelve oscuro y actualiza DOM/meta antes del render; preferencia clara vence al sistema; valor corrupto cae al sistema; cambio del sistema solo afecta cuando no hay preferencia. Debe fallar hoy porque el fallback siempre es claro.

Pruebas existentes que leen los archivos: `tests/impacto.test.ts:63-67`, `tests/accessibility-contract.test.ts`, `tests/caja-web-ticket.test.ts` y las pruebas PWA que leen `main.tsx`.

## Casos límite y marcha atrás

- `localStorage` o `matchMedia` pueden lanzar/no existir: fallback claro sin romper arranque.
- SSR/pruebas sin `window`: helper puro devuelve claro.
- No guardar automáticamente la preferencia del sistema como elección del usuario.
- Respetar `prefers-reduced-motion`; el cambio no añade animación.
- Marcha atrás: volver al fallback claro y meta fijo; eliminar listener y helper sin migración.
