# Punto de venta · carrito móvil y cobro

Probé `6d8caee0d6c6894de1c5b182d04c2a91eac34294` de `dot/15areas-integracion-18nov` en Edge 157.0.4341.60, con API y PostgreSQL locales y datos ficticios. Corrí 12 variantes móviles de 390 × 844: 0, 1 y 3 artículos, en claro y oscuro, en español e inglés. [Mediciones y hashes](mediciones.json)

| Artículos | Nombre accesible en español | Nombre accesible en inglés |
| --- | --- | --- |
| 0 | Ver carrito (0 artículos) | View cart (0 items) |
| 1 | Ver carrito (1 artículo) | View cart (1 item) |
| 3 | Ver carrito (3 artículos) | View cart (3 items) |

El contador visible coincidió con esos números y plurales. El acceso fijo al carrito mide **72 × 56 px** y el botón de cobro **286 × 56 px**. Ver carrito desplaza y enfoca el panel; con la semilla utilizada movió la página 11.000 px en español y 10.948 px en inglés. Volver al catálogo dejó el desplazamiento vertical de la página en 0. Con tres artículos la lista interna mide 340 px, tiene 438 px de contenido y se desplaza automáticamente 98 px para mostrar el último agregado. [Carrito vacío](carrito-390-es-claro-0.png) · [Un artículo](carrito-390-en-oscuro-1.png)

Las acciones En espera, Cotizar y Limpiar y sus equivalentes en inglés midieron **102,66–102,67 × 58 px**. En las 12 vistas sus textos quedaron dentro del botón y sus centros dentro de la superficie pulsable, sin intersección con la barra fija. El borde inferior de las acciones quedó en y=537,48 px y la barra fija empezó en y=766 px. La barra de Mercancía se vio en Inicio, donde la de Punto de venta estaba ausente. Al volver a Punto de venta se conservó el carrito de tres artículos y desapareció la barra de Mercancía. [Acciones en español](acciones-390-es-oscuro-3.png) · [Acciones en inglés](acciones-390-en-claro-3.png)

Con un artículo, Enter en View cart llevó el foco al panel y Tab desde el acceso fijo pasó a Cobrar. Con tres artículos, tras situar el foco en la primera acción de la lista, Tab pasó a las otras dos en el orden visual en ambos idiomas y temas. Las acciones internas se midieron sin activarlas. Los cuatro diálogos móviles de cobro se abrieron y cerraron y el carrito conservó sus artículos y total. En inglés la interfaz muestra «Charge» y el nombre accesible de ese botón sigue empezando por «Cobrar». [Código del control](https://github.com/marcosfeliz28/awesome-outbid/blob/6d8caee0d6c6894de1c5b182d04c2a91eac34294/apps/web/src/POS.tsx#L1352)

A 1280 × 720 siguen visibles **dos filas completas**. Con tres artículos se ven las filas 2 y 3, y con cinco se ven las 4 y 5. Tras regresar al inicio de la lista con cinco se ven completas las filas 1 y 2. El botón Cobrar mide 349,39 × 46 px y queda visible entre y=615 e y=661. El clic abrió la ventana y se pudo cerrar conservando el carrito. [Escritorio con tres](escritorio-1280-es-claro-3.png) · [Escritorio con cinco](escritorio-1280-en-oscuro-5.png)

Hubo 0 px de desbordamiento horizontal de página, 0 errores de página y 0 solicitudes operativas. El navegador y los servicios de prueba quedaron cerrados.

## CI e integración

En el SHA exacto `6d8caee0` terminaron en verde `verify`, `windows-installer` y `render-images`. La prueba de navegador incorporada por Dot comprueba los tres botones a 390 × 844, en tema claro y español. Este informe añade la comprobación de teclado, tamaños e idiomas descrita arriba. [CI de Dot](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44320558493)

`6d8caee0` conserva byte por byte las 275 fotos de `e1a2e935` y su API. Mientras se hacía la revisión, `nexora-cloud` reemplazó el conjunto anterior de tenis de `f63e5f39` y avanzó a `00ebc590`. La comparación con el candidato muestra 31 WebP adicionales en la base, que deben conservarse en el siguiente candidato. [Comparación](https://github.com/marcosfeliz28/awesome-outbid/compare/6d8caee0...00ebc590) · [CI de la primera base de 31 fotos](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44324007386)

Queda pendiente que «Cobrar» anuncie «Charge» cuando se elige inglés y aumentar el área útil del carrito de escritorio a 1280 × 720 sin cubrir el cobro. Adjuntar rama, SHA exacto, tres controles y demostración privada.

Seguimiento posterior. La ejecución de `00ebc590` quedó cancelada al avanzar a `2d87290b`, que añade ocho fotos. El candidato de carrito, anterior a los dos lotes, conserva 275 y requiere mantener las 39 fotos de tenis de la rama base. [CI de 2d87290b](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44326058976)
