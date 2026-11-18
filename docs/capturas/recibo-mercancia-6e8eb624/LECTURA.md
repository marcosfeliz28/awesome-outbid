# Punto de venta, recibo y Mercancía · 6e8eb624

Candidato `6e8eb624ede4d1544be615e7ebc22277fe2c67da` de `dot/15areas-integracion-18nov`. Revisión en copia local, con datos ficticios a 1440 y 390 px, claro y oscuro.

- **Punto de venta y recibo.** El logo dorado y el color de la opción activa aparecen en los dos temas. Cobrar abre y cierra conservando tres artículos y su total. El degradado de los botones del recibo y su alternativa en colores forzados se comprobaron con una muestra rotulada. La prueba de Punto de venta terminó al cerrar el diálogo de cobro. [Informe y seis capturas](punto-de-venta/LECTURA.md)
- **Mercancía.** Los textos de confirmación de entrada y salida y la ayuda del documento cambian con el idioma. El botón Sumar mide 45 px en escritorio y 57 px en móvil. Al elegir inglés siguen en español varios campos de documento, el buscador, algunos estados vacíos y los motivos de salida. [Informe y ocho capturas](mercancia/LECTURA.md)

## CI y fotos

El predecesor `6d8caee0` pasó los tres controles. En `6e8eb624` pasaron 11/11 pruebas focales, instalador, imágenes y `pnpm check`. El `verify` completo sigue en curso en el candidato y en la base `2d87290b`. Los 275 WebP anteriores coinciden byte por byte. La base añade 39 WebP de tenis que el candidato aún debe incorporar. El árbol de API coincide. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44326097801) · [CI de la base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44326058976)

La siguiente entrega de Dot debe mantener las 39 fotos y completar las etiquetas de Mercancía con los valores de operación existentes. Adjuntar SHA, controles y una demostración privada. Las capturas del recibo cubren su aspecto en pantalla. La emisión y la impresión quedan pendientes de verificación.
