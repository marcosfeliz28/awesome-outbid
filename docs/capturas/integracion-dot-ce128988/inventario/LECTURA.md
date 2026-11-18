# Inventario del candidato integrado ce128988

Código probado: `ce128988eb7ad6ab83ad12ce0674c796a95fac7b`. Edge sobre API y PostgreSQL locales, migraciones y seed ficticio, con solicitudes externas y escrituras operativas bloqueadas. Ocho capturas de pantalla completa en ES/EN, claro/oscuro, 1440 × 900 y 390 × 844, más cuatro de Ajustar y cuatro de Kardex. No hubo errores JavaScript ni desborde horizontal global en las vistas; los servicios propios se cerraron.

La tarjeta de stock se contrastó con la respuesta real de la API demo y coincidió en ambos anchos e idiomas: 228 variantes en Tienda, 4.165 unidades, 25 bajo mínimo y 0 sin existencia. El filtro de una variante y Casa (0, 0, 228) también coincidieron. Son datos ficticios y el indicador explicita que cubre filas cargadas y filtradas.

Respecto de la evidencia de `860d953b`, las distancias son iguales en este conjunto: alertas y movimientos comienzan ambos 2.317 px bajo el primer viewport de 1440; en 390, 10.284 y 11.301 px. No se comprobó un acceso alterno que evite el desplazamiento. La primera fila de 390 conserva bloque de producto 276 × 62 y Ajustar 85 × 44 sin solaparse; no se verificaron todos los nombres.

En ES y EN, escritorio y móvil, se buscó la variante demo `FIT-0009-1`, se abrió «Ver movimientos» desde su alerta, el GET del Kardex usó el identificador de esa variante y respondió 200, y al cerrar con Escape se conservó el filtro. Ajustar abre y cierra sin guardar; la navegación directa y recarga conservaron idioma y apariencia azul/negra.

El vencimiento se muestra como «Feb 11, 2027» en inglés y «11 feb de 2027» en español. El texto capturado confirma el formato en las ocho vistas y coincide con el cambio de idioma en `Management.tsx`. Se vieron cinco movimientos y cinco de 25 alertas del seed. La primera imagen era el SVG genérico de suplementos del catálogo demo; no se verificó foto real ni fallback ante error. No se probaron todas las variantes, acciones, contraste cuantitativo ni lector de pantalla.

Evidencia y medidas: `comprobacion-integrada.json`, `inventario-*`, `dialogo-*` e `inventario-kardex-*` en esta carpeta. La primera ejecución del arnés se detuvo al esperar una petición cacheada; se ajustó el arnés externo para recargar y la segunda corrida finalizó sin error. Los tres controles de GitHub pasaron para el SHA exacto, según la verificación separada. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44270785569)
