# Inventario: evidencia de 860d953b

Código probado `860d953b6c4212f883d81ed6fb03db6d81c07d8e`; rama de evidencia basada en `nexora-cloud` `a85627a6f0737bd6c72d1019ac44aadaa19c7ea7`. Se usaron PostgreSQL, API y web locales, migraciones y seed ficticio. Edge a 1440 × 900 y 390 × 844, claro/oscuro y ES/EN; movimiento reducido, destinos externos y escrituras operativas bloqueados. Cero escrituras operativas, errores JS o desborde global registrados; procesos cerrados.

## Comparación con 20c60b2f

Con los mismos datos de demostración, las medidas de la primera fila son iguales a las registradas en [20c60b2f](https://github.com/marcosfeliz28/awesome-outbid/tree/chatgpt-pc/capturas-dot-20c60b2f/docs/capturas/inventario-20c60b2f): a 390, bloque de producto 276 × 62 y botón Ajustar 85 × 44 px; a 1440, 180 × 91 y 49 × 44 px. No se solapan en ese ejemplo; Ajustar abrió y cerró en español e inglés sin guardar. No es una verificación de todos los nombres.

Las alertas y movimientos también permanecen tras las 20 filas: al inicio, 2.317 px bajo el viewport en 1440; en 390, alertas 10.284 px y movimientos 11.301 px. La prueba no ejercitó un acceso alterno ni el botón «Ver movimientos». El seed mostró 25 variantes alertadas con cinco visibles y cinco movimientos recientes de ventas ficticias.

Las tarjetas coincidieron con cálculo independiente de la respuesta real de stock demo en ambos idiomas y anchos: Tienda 4.165 unidades, 25 variantes bajas y 0 sin existencia (228 filas); Casa 0, 0 y 228. El filtro de una variante actualizó el alcance y su cantidad. Son datos de prueba, no cifras de una tienda.

EN todavía muestra vencimientos en español, por ejemplo «11 feb de 2027». El primer producto muestra la imagen genérica del seed `/products/supplements.svg`; no se probó fotografía comercial real ni fallo de imagen. Ruta directa y recarga conservaron preferencias azul/negro e idioma. No se verificaron todos los diálogos, accesibilidad completa ni contraste cuantitativo; no se encontró la lámina original exacta.

## Integración y CI

Coordinación confirmó los tres trabajos verdes en [44243067884](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44243067884) para este SHA. También identificó 66 WebP nuevos en `nexora-cloud` `a85627a6` ausentes en el candidato; cualquier integración debe conservarlos. Esta rama no modifica fotos, código, producción ni Render. Detalle: `comprobacion-integrada.json`.
