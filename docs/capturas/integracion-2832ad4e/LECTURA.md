# Categorías de Punto de venta y diálogo de cierre · 2832ad4e

Candidato `2832ad4e0a884efa2496718b6b970368ce5a0966` de `dot/15areas-sobre-prod-18nov`. Comparamos el acabado con `adb789cb` en 1440 y 390 px, claro y oscuro. Las pruebas usan datos ficticios y registran 10 capturas. Punto de venta y Caja y turnos se documentan por separado.

## Punto de venta

- La categoría activa pasó de violeta a verde con borde dorado en las cuatro combinaciones de tamaño y tema. El texto de Suplementos tiene un contraste calculado de 10,77:1 a 17,89:1 sobre los extremos del degradado. Suplementos mide 44 px de alto y el filtro cambió el catálogo de 60 a 12 productos sin desborde horizontal de la página.
- Con colores forzados y movimiento reducido a 390 px, el sistema aplicó su color de selección con texto blanco y retiró el degradado. El programa conserva la paleta del sistema en este modo.
- En los dos tamaños en oscuro, el foco sigue cayendo en el documento al cerrar Cobrar y el buscador con Escape. El carrito y su total se conservaron. [Comparación y capturas](punto-de-venta/LECTURA.md)
- En la lámina aprobada de Punto de venta (2688 × 1520, SHA-256 `9555ca20584c15ec1fd61d461c3d348b19fcaf4952ea9bca8220539698b89dbc`), la selección combina verde y dorado y la venta actual está a la derecha. Esos elementos coinciden con la captura. El relieve de la lámina es más marcado y muestra tres columnas de catálogo frente a las dos observadas a 1440 px. La lámina es de escritorio.

## Caja y turnos

- Abrir, recorrer y cancelar el diálogo de cierre pasó en 4/4, con la aplicación real y API simulada. La acción de cierre usa el degradado dorado y su texto tiene contraste mínimo de 8,54:1. El diálogo se mantiene dentro del ancho de pantalla a los dos tamaños.
- En móvil el diálogo mide 366 × 776 px y el contenido tiene 2.190 px de altura. Llegamos a Cancelar mediante desplazamiento interno. El control X de la parte superior mide 44 × 44 px. Se registraron cero escrituras y ningún cierre confirmado. El cotejo de esta área se hizo contra el CSS anterior. Sigue pendiente una copia verificable de la lámina de Caja y turnos. [Seis capturas y mediciones](caja-y-turnos/LECTURA.md)

## Fotos y controles

El candidato y su merge anterior `7b9348dc` conservan las 316 fotos WebP de `ee78690c`, incluidas las dos fotos de tenis pendientes. Los árboles de `apps/web/public` y `apps/api` coinciden con esa base. El recorrido de esta entrega cubrió los dos cambios del CSS de Punto de venta y Caja. [Diferencias respecto del merge](https://github.com/marcosfeliz28/awesome-outbid/compare/7b9348dc...2832ad4e)

Los tres controles de GitHub de `2832ad4e` pasaron. `verify` cerró a las 17:11:51 UTC. El resultado del recorrido de foco de Punto de venta sigue abierto. En local pasaron 4/4 pruebas focales de presentación. El merge `7b9348dc` y el candidato anterior `adb789cb` terminaron 3/3. [CI actual](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44350425176) · [CI del merge](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44345889385)

La rama de ensayos `dot/qa-visual-pilot-2832-18nov` se creó en `93fff762`. Los árboles de aplicación y de componentes de interfaz coinciden con `2832ad4e`. El ensayo usa datos simulados y un control de capturas propio. El CI de referencia de la aplicación sigue siendo la ejecución de `2832ad4e`.

## Siguiente entrega de Dot

Conservar las 316 fotos y el acabado comprobado. Completar el retorno del foco y los detalles de idioma de Mercancía y Compras registrados en la entrega anterior. Adjuntar rama, SHA, los tres controles y demostración privada. [Informe del candidato anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/608b3fb2f47fb4ef5f8644daee880af566c666d6/docs/capturas/integracion-adb789cb/LECTURA.md)

Se cerraron los navegadores y procesos iniciados para la prueba.
