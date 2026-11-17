# Punto de venta de Norexos · comprobación del botón «Cobrar»

Rama de Dot `dot/caja-higgsfield-fase2-17nov`, commit `292910889821bee22640110defc86bdf0f570b4b`. Prueba del 17 de noviembre de 2026 en Edge 157 sobre Windows, con la web, la API y PostgreSQL locales del entorno de pruebas. Sucursal, clienta, inventario y carrito de demostración. Marcos aprobó el concepto visual de Punto de venta y confirmó la marca Norexos. La disposición que se comprobó conserva el catálogo a la izquierda y la venta a la derecha en escritorio, con los tonos verde y dorado del concepto.

## Resultado en pantalla

En la [comprobación de `2e75ca92`](https://github.com/marcosfeliz28/awesome-outbid/blob/c6f672af2f8a18ef9350db08a97dfda8417c9343/docs/validacion/capturas-dot-2e75ca92/punto-de-venta/COMPARACION.md), el botón «Cobrar» terminaba en y=910 dentro de una ventana de 900 px de alto. En este commit termina en y=842 a la misma resolución y se ve entero en los cuatro tamaños probados con un producto en el carrito. El nombre del artículo quedó dentro de su columna y la página quedó dentro del ancho de la ventana.

| Ventana | Botón de cobro, borde superior e inferior | Margen hasta el borde de la ventana |
| --- | --- | --- |
| 1024 × 768 | y=629 a 677 | 91 px |
| 1180 × 757 | y=629 a 677 | 80 px |
| 1366 × 768 | y=629 a 677 | 91 px |
| 1440 × 900 | y=778 a 842 | 58 px |

- A 390 × 844 la primera tarjeta empieza en y=582, frente a y=756 en la revisión anterior. La barra de carrito se ve en claro y oscuro, abre el carrito y permite abrir y cerrar el diálogo de cobro conservando el artículo. El catálogo largo queda accesible mediante desplazamiento.
- F2 enfoca la búsqueda, F4 permite elegir cliente y un código de producto agrega una unidad. F12 abre el diálogo de cobro en escritorio. Se registraron cero envíos de venta y cero errores JavaScript de página.
- «Apariencia e idioma» empieza cerrado. Se comprobaron tema claro y oscuro y el cambio a inglés con un artículo en el carrito. La tarjeta sube 2 px en 150 ms al pasar el puntero y queda inmóvil con la preferencia de movimiento reducido.
- Menú, título y «Acerca de Norexos» muestran la marca correcta. En Inicio móvil el botón de menú «Punto de venta» se encuentra una sola vez y abre la pantalla. El acceso rápido se anuncia como «Ir a Punto de venta».

Una segunda ejecución aislada usó la misma revisión con API simulada. Pasaron 12 de 12 pruebas de navegador, incluidas preferencias y movimiento reducido, cantidades y descuentos, atajos, y visibilidad del botón en cuatro escritorios compactos. Este resultado y el recorrido con API real tienen datos y alcances distintos. Los navegadores y procesos propios de ambos recorridos quedaron cerrados.

## Pendientes observados

| Prioridad | Observación |
| --- | --- |
| Media | El total usa Georgia a 390 × 844 (28 px) y 1280 × 900 (25,6 px). La [prueba U1](https://github.com/marcosfeliz28/awesome-outbid/blob/292910889821bee22640110defc86bdf0f570b4b/tests/e2e/u1-pos.spec.ts#L18-L38) exige Plus Jakarta Sans y 28–32 px. La altura de la medición a 1280 difiere de la prueba U1. |
| Media | Al pasar la pantalla a inglés, la acción visible cambia de idioma y el lector de pantalla sigue recibiendo «Cobrar» y, en móvil, «Ver carrito». |
| Baja | El contador visible dice «1 artículos» con una unidad. El texto de ayuda de búsqueda aparece cortado a 1440 × 900. Ambos detalles se ven en la captura de escritorio. |

Al guardar esta evidencia, los controles del instalador y de imágenes pasaron. La verificación general seguía en curso. [Ejecución de GitHub del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44177247852)

## Capturas de la aplicación

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Punto de venta 1440 × 900 | [PNG](pos-1440-claro.png) | [PNG](pos-1440-oscuro.png) |
| Punto de venta 390 × 844 | [PNG](pos-390-claro.png) | [PNG](pos-390-oscuro.png) |
| Carrito abierto 390 × 844 | [PNG](carrito-390-claro.png) | [PNG](carrito-390-oscuro.png) |

El [registro de mediciones](comprobacion-integrada.json) contiene las dimensiones, las huellas SHA-256 de cada captura y los controles realizados.
