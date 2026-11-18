# Inventario: evidencia del candidato 20c60b2f

Código examinado `20c60b2f19d73d87a252bf44e8abeb02764fe045`; rama de evidencia basada en `nexora-cloud` `0ed250e501bb04c13156776973fb1c446906f9e7`. PostgreSQL, API y web locales con seed ficticio, sin escrituras operativas. Edge a 1440 × 900 y 390 × 844, claro/oscuro, español/inglés y movimiento reducido. Cero errores JS y desborde horizontal global; se cerraron servicios y navegador.

## Identidad de producto y acceso móvil

En la primera variante visible a 390 px, el bloque de producto mide 276 × 62 px y el botón Ajustar 85 × 44 px; no se solapan y el diálogo se abrió y cerró sin guardar en ES y EN. A 1440, el bloque mide 180 × 91 px y Ajustar 49 × 44 px; tampoco se solapan. Son medidas de esa primera fila y este SHA, no una garantía para todos los nombres o variantes. La [evidencia anterior de 8370e195](https://github.com/marcosfeliz28/awesome-outbid/tree/chatgpt-pc/capturas-dot-8370e195/docs/capturas/inventario-8370e195) permite comparación visual; allí no se registraron estas mismas medidas, por lo que no se afirma una diferencia cuantitativa A/B.

## Indicadores, alertas y movimientos

Los indicadores coincidieron con la respuesta de stock ficticio: Tienda, 228 filas, 4.165 unidades, 25 variantes bajas y 0 sin existencia; Casa, 0 unidades, 0 bajas y 228 sin existencia. El filtro de una variante actualizó alcance y cantidad. Las alertas muestran 25 variantes, de las que presentan cinco. Movimientos muestra cinco registros demo de venta, con advertencia de alcance «últimos 5 de hasta 200» de la sucursal.

En la posición inicial, tras 20 filas, ambos paneles comienzan 2.317 px bajo el primer viewport de 1440; en 390, alertas 10.284 px y movimientos 11.301 px por debajo. No se probó un acceso alterno visible. Se observaron 20 imágenes en filas: la primera carga `/products/supplements.svg`, imagen genérica del catálogo demo. No se probó una foto comercial real ni el fallback cuando falla una imagen.

Ruta directa y recarga conservaron azul/negro y ES/EN. EN sigue mostrando fecha de vencimiento en español («11 feb de 2027»); movimientos usan fecha localizada en su propio componente, sin validación independiente de todas las fechas. No se comprobó el lector de pantalla, contraste cuantitativo ni todos los controles. No se encontró la lámina original exacta para cotejo.

Coordinación comunicó 16/16 pruebas focales aprobadas y `verify` rojo por la cita invertida `WarehousesPanel.tsx:316-300` en `docs/sistema/FLUJO_MERCANCIA.md:61`; `render-images` verde. El estado del instalador no se confirmó en este recorrido. No se modificó el candidato ni se realizó despliegue. Mediciones completas: `comprobacion-integrada.json`.
