# Punto de venta de Norexos · revisión con cinco artículos

Probé el commit `243bfdb81499c93dbee35ea977372ec7089742d0` de `dot/caja-higgsfield-fase2-17nov` en Edge 157 sobre Windows, con API y PostgreSQL de demostración. El catálogo y carrito se capturaron a 1440 × 900 y 390 × 844 en claro y oscuro. La captura de 1366 × 768 usa cinco productos del catálogo de prueba.

## Resultados en la aplicación

- F2, F4, ingreso de código, F12 y «Ver carrito» funcionaron. Abrir y cerrar el cobro preservó artículo y total. El registro mostró cero envíos de venta y errores JavaScript. En inglés siguen anunciándose «Cobrar» y «Ver carrito» en español.
- Con texto de producto y categoría largo, cinco artículos y el carrito desplazado a su última fila, el panel y «Cobrar» quedaron enteros. El documento y su área principal desbordaron 0 px en las cuatro medidas. El total usó Plus Jakarta Sans, 28 px y peso 800.
- A 1366 × 768 se vieron tres filas completas y la de mayor altura midió 85 px. El CI anterior medía solo una completa con una fila de 115 px. [Comprobación anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/76bd1897917c58ad0b69b5c9453ff59999cefb53/docs/validacion/capturas-dot-29291088/punto-de-venta/COMPARACION.md)
- A 1280 × 720 solo cupieron dos filas completas. La primera tarjeta de catálogo quedó parcial a 1280 × 720, 1366 × 768, 1536 × 864 y 1024 × 768. En el escenario anterior de un artículo, «Cobrar» se mantuvo visible en cuatro tamaños y el nombre del producto quedó dentro de su columna.
- La tarjeta se eleva 2 px en 150 ms al pasar el puntero. El movimiento y la duración llegan a cero con movimiento reducido. La composición esmeralda y dorada conserva el catálogo y la venta separados y el CTA como acción principal. Queda pendiente cotejar el archivo original de la lámina de Punto de venta por su huella, así como la compactación de las tarjetas.

## Contraste independiente y CI

El escenario de navegador de Dot con API simulada pasó 12 de 16 pruebas. Los cuatro casos con cinco filas y textos largos repitieron el recorte de la primera tarjeta. A 1280 × 720 también quedaron dos filas completas frente a las tres esperadas. El recorrido con API real y la prueba con API simulada se realizaron en procesos separados, que quedaron cerrados.

GitHub aprobó `windows-installer` y `render-images`. `verify` superó `pnpm check` y falló en `node scripts/verify.mjs`. Dot informó en su chat de cuatro casos con la tarjeta recortada. La anotación pública del CI da código de salida 1 sin detalle de cada caso. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44184570503/job/134397518234)

## Capturas reales

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Punto de venta 1440 × 900 | [PNG](pos-1440-claro.png) | [PNG](pos-1440-oscuro.png) |
| Punto de venta 390 × 844 | [PNG](pos-390-claro.png) | [PNG](pos-390-oscuro.png) |
| Carrito abierto 390 × 844 | [PNG](carrito-390-claro.png) | [PNG](carrito-390-oscuro.png) |
| Cinco artículos a 1366 × 768 | — | [PNG](carrito-1366-cinco-articulos.png) |

[Mediciones y huellas SHA-256](comprobacion-integrada.json)
