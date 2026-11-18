# Punto de venta y estilo del recibo

Verifiqué `6e8eb624ede4d1544be615e7ebc22277fe2c67da` de `dot/15areas-integracion-18nov` en Edge 157.0.4341.60 con API y PostgreSQL locales y datos ficticios. Recorrí Punto de venta a 1440 × 900 y 390 × 844 en claro y oscuro. [Mediciones y hashes](mediciones.json)

| Captura | Escritorio | Móvil |
| --- | --- | --- |
| Punto de venta claro | [1440 × 900](pos-1440-claro.png) | [Menú a 390 × 844](pos-390-claro-menu.png) |
| Punto de venta oscuro | [1440 × 900](pos-1440-oscuro.png) | [Carrito a 390 × 844](pos-390-oscuro.png) |
| Muestra DOM del recibo | [1440 × 900 oscuro](recibo-muestra-1440-oscuro.png) | [390 × 844 claro](recibo-muestra-390-claro.png) |

El logo de Norexos midió 35 × 35 px y conservó el degradado dorado con texto oscuro en las cuatro vistas. La opción activa «Punto de venta» usó el degradado verde claro con texto oscuro en tema claro y el degradado verde oscuro con texto claro en tema oscuro. Los colores de acento medidos fueron `#08764b` y `#5ff1a7`, respectivamente. La página tuvo 0 px de desbordamiento horizontal. [Reglas del menú y del logo](https://github.com/marcosfeliz28/awesome-outbid/blob/6e8eb624ede4d1544be615e7ebc22277fe2c67da/apps/web/src/fusion-caja-higgsfield.css#L917)

En las cuatro variantes, el botón «Cobrar» abrió el diálogo y el cierre conservó los tres artículos y el total. El acceso móvil llevó el foco al carrito. Se registraron 0 solicitudes operativas y 0 errores de página. El navegador y los servicios de prueba quedaron cerrados.

Para comprobar el recibo coloqué una muestra DOM inerte directamente en el cuerpo de la página, con la estructura `.modal` y `.sale-success` y un folio ficticio. En ambos anchos y temas, «Imprimir recibo» y «Nueva venta» tomaron el degradado dorado, texto `#241d0b` y borde `#a08036`. Al quitar `.sale-success` del control de comparación desapareció el degradado. Con colores forzados, Edge mostró fondo blanco y texto negro, sin degradado ni sombra. Las dos imágenes del recibo están rotuladas «Muestra DOM del recibo». El recorrido operativo terminó al cerrar Cobrar. [Regla del recibo](https://github.com/marcosfeliz28/awesome-outbid/blob/6e8eb624ede4d1544be615e7ebc22277fe2c67da/apps/web/src/fusion-caja-higgsfield.css#L929)
