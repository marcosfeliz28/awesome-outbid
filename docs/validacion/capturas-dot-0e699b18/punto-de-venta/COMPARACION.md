# Punto de venta · primera versión funcional

La prueba local de PC terminó el 17 de noviembre de 2026 a las 20:57 UTC. Corresponde al commit
`0e699b1810cab9992a29c34b89b3243371aa01c0` de `dot/caja-higgsfield-fase2-17nov`. Se ejecutó con datos ficticios y API local.
La lámina de Punto de venta seguía en revisión. Estas son las capturas de la primera versión para
el cotejo visual de las siguientes entregas. [Commit probado](https://github.com/marcosfeliz28/awesome-outbid/commit/0e699b1810cab9992a29c34b89b3243371aa01c0).

## Lo comprobado

| Comprobación | Resultado |
| --- | --- |
| 1440 × 900, claro y oscuro | La primera tarjeta de producto y el botón «Cobrar» terminan a 920 px. Los últimos 20 px quedan bajo la primera pantalla. «Cobrar» comienza a 856 px y el panel del carrito termina a 1030 px. |
| 390 × 844, claro y oscuro | La primera tarjeta comienza a 754 px. La barra fija queda entre 766 y 832 px. El atajo de la barra lleva al carrito en ambos temas. |
| Ancho | El desbordamiento horizontal del documento mide 0 px en los dos tamaños y temas. |
| Teclado y cobro | F2 enfoca la búsqueda, F4 permite seleccionar cliente y al introducir un SKU se añade una unidad. F12 en escritorio y el botón de cobro en móvil abren el diálogo, que se cerró sin confirmar. Se registraron 0 solicitudes de venta. |
| Inglés | Al elegir inglés con el carrito armado, el nombre accesible de «Cobrar» queda en español en ambos tamaños. «Ver carrito» también queda en español en móvil. |
| Movimiento | La tarjeta sube 2 px con una transición de 150 ms al pasar el puntero. Con movimiento reducido, el desplazamiento y la duración son 0. |

El recorrido no registró errores de JavaScript. Se cerraron el navegador y los servicios de prueba.
Pasaron las siete pruebas de la corrida separada con API simulada. En el
[JSON de mediciones y huellas](comprobacion-integrada.json), los rectángulos se expresan como
`[izquierda, arriba, derecha, abajo]` en píxeles.

## Capturas reales

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Punto de venta · 1440 × 900 | [Captura](pos-1440-claro.png) | [Captura](pos-1440-oscuro.png) |
| Punto de venta · 390 × 844 | [Captura](pos-390-claro.png) | [Captura](pos-390-oscuro.png) |
| Carrito desde la barra fija · 390 × 844 | [Captura](carrito-390-claro.png) | [Captura](carrito-390-oscuro.png) |

## Controles de este commit

En `0e699b18`, GitHub marcó `render-images` en verde y canceló `verify` y
`windows-installer` al avanzar la rama a `ee46d85d`. Las mediciones y capturas quedan
asociadas al SHA probado. [Ejecución de GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44173533458).
