# Inventario de Norexos · primera revisión visual

Probé el commit `0248bc89b271d4dfe851d3e81e84b599b52d829b` de `dot/inventario-higgsfield-17nov` en Edge 157 sobre Windows, con API y PostgreSQL aislados y datos de demostración.

## Resultado en la aplicación

- Capturé el stock a 1440 × 900 y 390 × 844 en claro y oscuro. Las pestañas y el panel quedaron dentro del ancho visible. El documento y el contenedor de tabla midieron 0 px de desborde horizontal en las cuatro capturas. En móvil, el buscador empezó en y=452 y la primera tarjeta del stock en y=513.
- Alterné «Conteos físicos» y «Stock actual» con Enter y clic. Probé cambiar el almacén y volver a «Todos», buscar por código y limpiar la búsqueda. El código de prueba coincidió con dos variantes porque la búsqueda admite coincidencias parciales. Abrí y cerré el Kardex. Se registraron cero escrituras de Inventario y cero errores JavaScript.
- El botón de stock subió 2 px al pasar el puntero, con transición de 140 ms. Con movimiento reducido quedó fijo. Pasaron las dos pruebas focales de presentación. Cerré el navegador y los servicios de prueba.

## Cotejo con el concepto aprobado

Revisé en el visor de «Your dot» la cuarta lámina aprobada del conjunto de Higgsfield, que la [entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/0248bc89b271d4dfe851d3e81e84b599b52d829b/docs/diseno/inventario/ENTREGA_PRESENTACION_17NOV.md) identifica como `norexos-inventario-higgsfield-01.png`. El cotejo visual usa la captura oscura de escritorio.

| Elemento | Lámina | Aplicación |
| --- | --- | --- |
| Superficies y navegación | Fondo esmeralda, ribetes dorados y navegación con relieve. | El encabezado y el panel presentan esos acentos. El elemento seleccionado del menú y la pestaña activa conservan detalles violetas. |
| Existencias | Tabla compacta con miniaturas, mínimo y estado en la primera pantalla. | Tabla operativa con variante, precio, costo, almacén, lote, vencimiento y acciones. En móvil, cada fila se muestra como tarjeta. |
| Resumen y alertas | Cuatro indicadores y una columna de alertas y movimientos recientes. | Este corte conserva la tabla como vista principal. Quedan pendientes los indicadores, las alertas de stock y el panel de movimientos recientes de la referencia. |

Al guardar el informe, GitHub aprobó el instalador y las imágenes. `verify` seguía en curso. [CI de Inventario](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44189533542)

## Capturas reales

| Ventana | Claro | Oscuro |
| --- | --- | --- |
| 1440 × 900 | [PNG](inventario-1440-claro.png) | [PNG](inventario-1440-oscuro.png) |
| 390 × 844 | [PNG](inventario-390-claro.png) | [PNG](inventario-390-oscuro.png) |

[Mediciones y huellas SHA-256](comprobacion-integrada.json)
