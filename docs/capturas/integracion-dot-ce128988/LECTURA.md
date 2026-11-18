# Productos e Inventario de Norexos · ce128988

Se verificó la aplicación del commit `ce128988eb7ad6ab83ad12ce0674c796a95fac7b` en una PC aislada y se publicaron 27 capturas de la demostración. Las dos revisiones usaron datos ficticios y comprobaron que no se registrara ninguna operación.

- **Productos.** La ficha móvil aparece antes de la lista. El selector superior actualiza el producto y la foto local de ejemplo aparece. El catálogo sustituye una imagen rota. «Import inventory» ya se traduce y el formulario interno avisa que está en español. La barra fija de Mercancía aún cubre hasta 43 px de «Ver ficha» en la medición de 390 px. Se probaron las cuatro combinaciones de escritorio y móvil con API simulada. [Informe y capturas de Productos](productos/LECTURA.md)
- **Inventario.** Con PostgreSQL y API de demostración, los indicadores coinciden, «Ver movimientos» abre el Kardex de la variante y cerrar conserva la búsqueda. Los vencimientos se muestran en inglés al elegirlo. Alertas y Movimientos aún quedan a 10.284 y 11.301 px, respectivamente, debajo del primer cuadro a 390. [Informe y capturas de Inventario](inventario/LECTURA.md)

## Integración y fotos

`ce128988` recupera las 66 WebP que faltaban y su árbol de 274 WebP coincide con `a85627a6`. `nexora-cloud` avanzó a `e1a2e935`, que contiene el mismo código y pruebas y añade `INV-1639.webp` y una nota del sistema. Ambos SHA pasaron los tres controles de GitHub. En `ce128988` también pasaron 42 pruebas focales locales. [CI de Dot](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44270785569) · [CI de la rama base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44278668088)

## Siguiente revisión para Dot

En Productos, comprobar a 390 px que «Ver ficha» y la búsqueda permanecen pulsables cuando está visible la barra de Mercancía. En Inventario, dejar accesos visibles a Alertas y Movimientos desde la primera pantalla sin perder el filtro al volver. Para el cotejo final aún faltan las láminas originales verificables de ambas áreas. Adjuntar rama, SHA, tres controles y demostración privada del siguiente candidato.
