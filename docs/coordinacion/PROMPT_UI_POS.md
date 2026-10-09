# Lote 5 · Rediseño de la pantalla de caja (POS.tsx)

**Estado: EN COLA. No empezar hasta que se cumplan las tres condiciones de abajo.**

## Condiciones para empezar
1. Integración completa en verde (157/157) en `nexora-cloud` y en tu rama, y CI «FitStore checks» en verde.
2. B0–B6 y O1/S1–S4 ya fusionados en `nexora-cloud` (tocan `POS.tsx` y un rediseño en paralelo genera conflictos y oculta regresiones).
3. Entrega en un PR aparte («Lote 5 – UI caja»), sin mezclar con correcciones de lógica.

## Origen y correcciones al prompt original
El prompt original (de Gemini) es válido en su intención. Se corrige esto:
- **El archivo es `apps/web/src/POS.tsx`** (2220 líneas), no `Pos.tsx`. En Linux/CI distinguen mayúsculas; un archivo nuevo `Pos.tsx` duplicaría el componente.
- **El color del botón de cobro NO es el verde vibrante `--green`.** Con texto blanco da 3.77:1 y falla AA. Usa `--success-strong` / `#047857` (5.48:1) como en G10. Contraste AA en tema claro y oscuro con script de comprobación.
- **No ocultes las barras de desplazamiento** (`scrollbar-width: none`): en la laptop con ratón se pierde la señal de que hay más artículos. Usa barra fina (`scrollbar-width: thin`) con color de `--border`.
- **`.top-bar` es nombre nuevo pero la app ya tiene una barra superior global** en `App.tsx` (se cuidó para caber en 320 px). No la dupliques ni la rompas: la barra de la caja es una fila local con otro nombre (`pos-toolbar`).
- **Si eliminas `page-heading`, deja un `<h1 class="sr-only">`** para lectores de pantalla y orden de encabezados.
- **`active:scale-[0.98]` y `transition-all`** sólo si el componente ya usa clases Tailwind; si no, CSS normal `:active{transform:scale(.98)}` y `@media (prefers-reduced-motion: reduce)` que lo desactive. No uses `transition: all`: sólo `transform` y `box-shadow`.
- `font-variant-numeric: tabular-nums` en precios y totales: sí.

## No negociable (no tocar)
- Estado global Zustand (`useStore`), `lineTotals`, `money`, `formatMoney`, `operationId`, `offlineUuid`, la cola de ventas sin conexión, el repreciado/descarte (O1), la comprobación de `[role=dialog]` en los atajos F4/F8/F12 (G11), el foco del lector de códigos, F2 buscar, los permisos por rol.
- Cualquier cambio de estructura debe mantener los selectores de `tests/e2e/store.spec.ts` y demás e2e, o actualizarlos en el mismo commit. Debe haber un e2e nuevo del estado vacío («Carrito vacío. Escanea o busca un artículo»).

## Qué construir (del prompt original, ya corregido)
- **Fila local de herramientas** (`pos-toolbar`): título a la izquierda, búsqueda al centro con la etiqueta visual `F2`, «En espera» y «Escanear» a la derecha; una sola fila, sin texto introductorio.
- **Catálogo:** grid con `minmax`; tarjetas con sombra suave al pasar el ratón y hundimiento táctil; precios con cifras tabulares.
- **Panel de venta:** ancho fijo 380–400 px; estado vacío centrado con `ShoppingCart` en `--muted`; `.cart-items` con desplazamiento funcional y barra fina.
- **Jerarquía financiera:** `.cart-total` es el texto más grande (Plus Jakarta Sans 28–32 px, negrita); botón de cobro F12 al 100 % de ancho, alto mínimo 56 px, variante `success` con contraste AA, icono `CreditCard`.
- **Temas:** contraste AA claro y oscuro (`:root[data-theme="dark"]`); sin colores fijos que no cambien con el tema (ver el caso de `.alert-counter` en el comentario v1 del PR #1).
- **Accesibilidad:** foco visible en todo; objetivos táctiles ≥ 44 px; sin `outline:none` sin reemplazo.

## Entrega
`POS.tsx` y el CSS de `styles.css` en un solo commit por parte, capturas antes/después en claro y oscuro a 1366×768 y 390×844, resultado de `pnpm check`, integración y e2e, y los contrastes calculados.
