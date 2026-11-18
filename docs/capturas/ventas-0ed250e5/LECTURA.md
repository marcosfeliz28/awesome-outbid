# Ventas: recorrido visual del candidato 0ed250e5

Código probado: `0ed250e501bb04c13156776973fb1c446906f9e7`. Base de esta rama de evidencia: `origin/nexora-cloud` `67e682788ecb046f355a943b61eca8bbe391352b`. No contiene código del candidato.

Se arrancó PostgreSQL, API y web de demostración en loopback; se aplicaron migraciones y el seed ficticio. Edge probó 1440 × 900 y 390 × 844, con tema claro y oscuro y movimiento reducido. No se envió ninguna operación de venta: el registro observó cero escrituras operativas y cero errores JavaScript en ambos tamaños. Se cerraron navegador y servicios locales.

En español, las 12 capturas muestran listado, previa y ficha para cada tamaño/tema. La búsqueda por número, búsqueda sin resultados, filtro por fecha, apertura/cierre de ficha y selección pasaron en ambos tamaños. No hubo desbordamiento horizontal global.

En inglés, se cambió el idioma desde el control real de Inicio: título, buscador, previa y ficha aparecieron en inglés a 1440 y 390. Las cuatro capturas `ventas-en-*` corresponden al tema oscuro; no se capturó inglés claro. Nombres y variantes de productos son datos de demostración, no traducciones de interfaz.

## Hallazgo de uso y fidelidad

La lámina original `norexos-ventas-higgsfield-01.png` muestra el comprobante junto al listado en escritorio. Al seleccionar una venta en la aplicación, la previa queda debajo de 20 filas: a 1440 px comienza 1.631,83 px por debajo del borde inferior del viewport; a 390 px, 9.683,94 px. El clic/toque no desplaza la página (delta 0). El detalle sí se abre tras desplazarse hasta la previa. La captura de lámina es un concepto, no un requisito para inventar cifras; el diseño implementado usa tres conteos de resultados cargados.

No se verificaron el aviso de caja ni el formulario de anulación: hacerlo requería llevar la sesión a estados que no se ejercitaron. No se verificaron contraste cuantitativo ni lector de pantalla.

La coordinación informó por separado que la regresión A12 pasó en este SHA y que la ejecución de CI es `44230587628`; no se verificó aquí su resultado final. Véase `comprobacion-integrada.json` para medidas y estado de cierre.
