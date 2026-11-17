# Punto de venta de Norexos · tarjeta completa

Probé `59d77a175da32e3f383321233e10d9f0edf618b6` de `dot/pos-viewport-w5-17nov` en Edge 157 sobre Windows, con API y PostgreSQL aislados y productos ficticios. Repetí el escenario de cinco artículos, nombre de producto de 120 caracteres y categoría larga.

| Ventana | Borde inferior de primera tarjeta | Filas de carrito completas | Carrito y «Cobrar» visibles |
| --- | ---: | ---: | --- |
| 1280 × 720 | 715 px | 2 | Sí |
| 1366 × 768 | 695 px | 3 | Sí |
| 1536 × 864 | 697 px | 3 | Sí |
| 1024 × 768 | 714 px | 3 | Sí |

La primera tarjeta quedó completa en las cuatro medidas, donde antes aparecía cortada. El buscador tiene ahora su propia fila en escritorio y las miniaturas caben enteras. El área principal y el documento tuvieron 0 px de desborde horizontal. «Cobrar» y la última fila quedaron visibles en los cuatro casos. A 1280 × 720 faltó una fila completa para el mínimo de tres de la prueba combinada. [Mediciones de la revisión anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/4cb9c30193cda91ebd2f86662177d61d2fdc1704/docs/validacion/capturas-dot-243bfdb8/punto-de-venta/COMPARACION.md)

Volví a abrir y cerrar el cobro a 1440 y 390 px. Se conservaron el artículo y el total. El recorrido registró cero envíos de venta y cero errores JavaScript. Pasaron F2, F4, el código y el acceso móvil al carrito. Se conserva el movimiento leve y respeta movimiento reducido. En inglés quedan etiquetas accesibles en español. Los navegadores y servicios propios se cerraron.

Una comprobación independiente con API simulada pasó 15/16. Su único fallo también fue el mínimo de tres filas a 1280 × 720. El instalador y las imágenes aprobaron en GitHub. `verify` estaba en curso al guardar la evidencia. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44191832478)

La composición mantiene los paneles esmeralda y el ribete dorado. Queda pendiente verificar la huella del PNG original de Punto de venta para un cotejo exacto con el concepto.

## Capturas reales

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Punto de venta 1440 × 900 | [PNG](pos-1440-claro.png) | [PNG](pos-1440-oscuro.png) |
| Punto de venta 390 × 844 | [PNG](pos-390-claro.png) | [PNG](pos-390-oscuro.png) |
| Carrito abierto 390 × 844 | [PNG](carrito-390-claro.png) | [PNG](carrito-390-oscuro.png) |
| Cinco artículos a 1366 × 768 | — | [PNG](carrito-1366-cinco-articulos.png) |

[Mediciones y huellas SHA-256](comprobacion-integrada.json)
