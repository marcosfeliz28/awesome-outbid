# Resultados móvil (orden de la dueña, 6-nov) · rama `claude-pc/movil-todo`

Auditoría con Playwright a 390×844 y 360×740 sobre la base local de pruebas (datos falsos del seed, sin credenciales ni datos reales). Capturas en `docs/diseno/capturas/movil-6nov/` (`antes/`, `despues/`, `despues-360/`, `escritorio-1366-antes|despues/`).

## Cambios (solo presentación; ≤ 768 px)
- `viewport-fit=cover` + `padding-top: env(safe-area-inset-top)` en la cabecera y el menú lateral; `safe-area-inset-bottom` en el menú (las barras inferiores ya lo usaban).
- Tablas como tarjetas etiqueta/valor: `DataTable` (Productos, Inventario, Clientes, Ventas, Compras, Gastos…) y, por `apps/web/src/mobileTables.ts`, todas las demás tablas del contenido (Resumen, Almacenes, Desglose del mes, Reportes).
- Imágenes con `max-width:100%`.

## Pantalla → estado (390 y 360 px)
| Pantalla | Estado |
|---|---|
| Login, Punto de venta, Mercancía, Caja, Promociones, Alertas, Incentivos, GV, Configuración, Anulaciones, Conciliar, Envíos | Sin desbordamiento (ya estaban bien) |
| Productos, Inventario (stock y almacenes), Clientes, Ventas, Compras, Gastos | Arreglada: tarjetas, se ve existencia y precio |
| Resumen | Arreglada la tabla «Top productos». El mapa de calor (24 horas, 888 px) conserva su scroll horizontal dentro de la tarjeta, ahora con sombras laterales que avisan que hay más |
| Desglose del mes, Reportes (listado) | Arreglada |
| Reportes (1 por cada uno de los 7 grupos: Ventas, Caja y pagos, Contraentregas, Clientes, Inventario, Vendedoras, Margen) con botones Excel/PDF | Arreglada: los botones Excel/PDF salían 77 px fuera del ancho (antes); ahora envuelven. Capturas `antes-reportes/` y `despues-reportes/`. Los reportes con gráficos propios (Resumen, Desglose) no desbordan |
| Barra de estado iPhone | Arreglada en CSS; **sin probar en iPhone real** (Chromium no simula `env()`) |

Botones y campos del contenido ≥ 44 px de alto en ≤ 768 px; textos de Incentivos y Caja a 14 px. Quedan fuera: las etiquetas de los gráficos SVG (11 px, escalan con el gráfico) y un `span` oculto del `body`.

## Pruebas
- e2e nueva `tests/e2e/movil-sin-desborde.spec.ts` (390 px, 16 pantallas): pasa.
- `pnpm typecheck` y eslint sobre lo tocado: OK. Escritorio 1366 px: capturas antes/después iguales salvo el estado hover del puntero.
- Seguridad-20: sin endpoints, datos ni dependencias nuevas; solo CSS y un observador DOM de lectura (puntos de entrada de datos, permisos, secretos: no aplican).

## SHA y CI
