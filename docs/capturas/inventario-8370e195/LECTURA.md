# Inventario · evidencia de 8370e195

Código examinado `8370e19564606918ace31404fc97c1c049a24bd0`; esta rama de evidencia se creó desde `nexora-cloud` `0ed250e501bb04c13156776973fb1c446906f9e7`. Recorrido con PostgreSQL, API y web locales, seed ficticio, sin operaciones de negocio ni solicitudes externas. Edge, 1440 × 900 y 390 × 844, claro/oscuro, ES/EN y movimiento reducido. Los procesos terminaron correctamente.

## Indicadores y alcance

Sobre la respuesta real `/api/inventory/stock` de prueba, se calcularon independientemente las unidades, variantes con existencia positiva hasta el mínimo y variantes sin existencia. Para 228 filas, Tienda mostró 4.165 unidades, 25 bajas y 0 sin existencia; coincidió con el cálculo. Al buscar `FIT-0001-1`, el alcance se actualizó a una fila y sus unidades coincidieron. Al seleccionar Casa, los valores mostrados 0, 0 y 228 coincidieron con sus cantidades de almacén del seed. Estas pruebas se repitieron en español e inglés y en ambos anchos; son datos ficticios, no cifras de producción.

Los rótulos explican «artículos cargados que coinciden con tu búsqueda», la cantidad de filas y el almacén efectivo; «Todos» se presenta como «En Tienda», coherente con el stock que usa el cálculo. No se verificó que la API devuelva todo el catálogo en un negocio grande, ni recuentos de ventas u otros permisos.

## Navegación y aspectos pendientes

Ruta directa `/#inventory`, recarga, preferencias azul/negro y diálogo Ajustar/Adjust abren en ambos idiomas y anchos; no se guardó nada. Las ocho capturas de pantalla y cuatro de diálogo incluyen temas y datos de muestra. No hubo desbordamiento horizontal global ni errores JavaScript reportados. En inglés los vencimientos siguen con fecha española, p. ej. «11 feb de 2027»; nombres de productos y almacenes son datos, no etiquetas traducibles. No se evaluaron conteos, kardex, importación, contraste cuantitativo ni lector de pantalla. No se encontró la lámina original exacta en Descargas para compararla.

CI exacto [44237297595](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44237297595): coordinación confirmó que `verify` sigue fallando por `tests/docs-sistema-citas.test.ts:96` y el rango invertido `docs/sistema/FLUJO_MERCANCIA.md:61` (`WarehousesPanel.tsx:316-300`); el rango correcto del historial es `316-348`. Dot debe corregir la cita y reenviar controles. Esta evidencia no cambia el candidato.

El primer intento de compilar API se lanzó mientras se generaba Prisma y falló por tipos ausentes; al concluir generación se repitió y pasó. Build web pasó. Detalle de medidas y cierre en `comprobacion-integrada.json`.
