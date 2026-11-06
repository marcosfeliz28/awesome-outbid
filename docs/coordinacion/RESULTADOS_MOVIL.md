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
| Resumen | Arreglada la tabla «Top productos». **Pendiente:** el mapa de calor (888 px) sigue con scroll horizontal controlado dentro de su tarjeta; no se rediseñó |
| Desglose del mes, Reportes (listado) | Arreglada |
| Reportes individuales con gráficos y botones PDF/Excel | **Pendiente de revisar uno por uno**: solo se auditó el listado; el botón «table-actions» salía 77 px fuera del ancho antes del cambio |
| Barra de estado iPhone | Arreglada en CSS; **sin probar en iPhone real** (Chromium no simula `env()`) |

Botones < 44 px y texto < 14 px siguen presentes en varias pantallas (p. ej. íconos de acciones en tarjetas, Alertas 257 elementos): no se tocaron para no alterar escritorio; queda para un segundo lote.

## Pruebas
- e2e nueva `tests/e2e/movil-sin-desborde.spec.ts` (390 px, 16 pantallas): pasa.
- `pnpm typecheck` y eslint sobre lo tocado: OK. Escritorio 1366 px: capturas antes/después iguales salvo el estado hover del puntero.
- Seguridad-20: sin endpoints, datos ni dependencias nuevas; solo CSS y un observador DOM de lectura (puntos de entrada de datos, permisos, secretos: no aplican).

## SHA y CI
Ver el comentario final al pie (se completa tras el CI).
