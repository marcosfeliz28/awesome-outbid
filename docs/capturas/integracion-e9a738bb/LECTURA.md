# Navegación, Mercancía y Compras · e9a738bb

Candidato `e9a738bb5eea4bb98a5cc765bf302f57b7b2649c` de `dot/15areas-sobre-prod-18nov`. Las 30 capturas muestran la aplicación ejecutada en esta PC en 1440 y 390 px, con tema claro y oscuro y datos ficticios. La revisión de navegación usó Edge con API y base local descartable. Mercancía y Compras usaron una API simulada. Ningún recorrido confirmó ventas ni modificó inventario.

## Resultados y prioridad

1. **Teclado, prioridad alta.** Escape directo devuelve el foco a Cuenta (4/4) y al menú móvil (2/2). El menú retuvo 37 pulsaciones de Tab y Shift+Tab por tema. Con el buscador encima, Escape cerró ambas capas sobre Cuenta (4/4) y sobre el menú móvil (2/2). Debe cerrar únicamente el buscador y devolver el foco a la capa que siga abierta. [Seis capturas y mediciones](navegacion/LECTURA.md)
2. **Teclado, prioridad alta.** Al cerrar Cobrar, el foco cae en el documento en 8/8 intentos con Escape o Cerrar. Los tres artículos y su total se conservan. Buscar pierde el foco en 4/4 cierres directos. Debe volver a Cobrar, al botón de búsqueda o al campo desde el que se invocó el atajo. [Recorrido y controles](navegacion/LECTURA.md)
3. **Idioma, prioridad media.** En cuatro combinaciones se localizaron el buscador, estados vacíos, historial, documentos y editores habituales. Las seis opciones de motivo de salida siguen en español en EN. Traducir las etiquetas conservando los valores que usa la API. [Capturas y mediciones de Mercancía y Compras](mercancia-compras/LECTURA.md)
4. **Idioma, prioridad baja.** El cierre del editor de orden se anuncia «Cerrar» en EN. Recepción y su comprobante sí anuncian «Close». A 390 px, se midieron 366 px de ancho en los tres diálogos, con cierre de 44 px y desplazamiento interno cuando hacía falta. [Editor de orden](mercancia-compras/390-dark-en-editor-orden.png)

## CI y fotos

Al corte de las 15:26 UTC, el instalador y las imágenes habían pasado en las dos ramas. `pnpm check` pasó y `verify` completo seguía en curso en ambas. Pasaron 13/13 pruebas focales de idioma y CSS sobre el SHA del candidato. [CI de Dot](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44332519806) · [CI de la base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44332633156)

Dot recuperó las 39 fotos de tenis de `2d87290b` y conserva sus 314 WebP idénticos. La base `ee78690c` ya incluye dos fotos adicionales, `asics-ak-negros.webp` y `nb-1906r-blanco-negro-amarillo.webp`, para un total de 316. Ambas faltan en el candidato. El árbol de API coincide. [Diferencia de las dos fotos](https://github.com/marcosfeliz28/awesome-outbid/compare/e9a738bb...ee78690c)

## Siguiente entrega de Dot

Adjuntar el SHA que corrija la prioridad de Escape y la devolución de foco, cierre las dos traducciones pendientes y conserve los 316 WebP de la base comprobada. Adjuntar los tres controles del mismo SHA y una demostración privada. Queda pendiente el cotejo con la lámina aprobada y la aceptación completa de la navegación por teclado.

Se cerraron los navegadores y servicios abiertos por los recorridos. Los puertos de prueba quedaron libres. Esta entrega documenta por separado la navegación de Punto de venta y los recorridos habituales de Mercancía y Compras.
