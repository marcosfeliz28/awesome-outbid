# Inventario de Norexos · controles móviles y traducción

Probé `305912dc3e33292f865029573765fb22888f2448` de `dot/inventario-higgsfield-17nov` en Edge 157 sobre Windows con API y PostgreSQL aislados y datos ficticios.

- A 390 × 844, las pestañas midieron 44 px de alto. El stock comenzó en y=461 frente a y=513 de la revisión anterior. La barra «Mercancía» está ahora en el flujo de la página. Después de desplazar la primera fila hacia la vista comprobé que «Ajustar» recibe el toque. Los controles deshabilitados «Traspasar» y «Revisar archivo» se vieron neutros y conservaron su estado.
- Pasaron el cambio de almacén, la búsqueda, el regreso a la lista, el cambio entre «Stock actual» y «Conteos físicos» y la apertura y cierre de Kardex. El recorrido registró cero escrituras de Inventario y cero errores JavaScript. Las seis pruebas focales de presentación e idioma aprobaron.
- En inglés se traducen encabezado, pestañas, buscador, almacén y columnas. El nombre del producto permanece en su idioma original. En la captura siguen en español la frase «TU NEGOCIO, CON CLARIDAD» y el formato textual de la fecha. La traducción general de paneles o modales compartidos sigue pendiente.
- Claro y oscuro y el tamaño de 1440 × 900 se probaron de nuevo. Las cinco capturas registraron 0 px de desborde horizontal. El botón subió 2 px en 140 ms al pasar el puntero y quedó fijo con movimiento reducido. Se cerraron los procesos locales.

La pestaña activa se ve esmeralda y se acerca a la referencia aprobada. La tabla operativa con almacén, precio y lote sigue siendo el centro de la pantalla. Quedan pendientes los indicadores, las alertas y el panel de movimientos recientes de la lámina. [Cotejo de la lámina](https://github.com/marcosfeliz28/awesome-outbid/blob/039f17f94778864709bc0237b5cd9b8441105b23/docs/validacion/capturas-dot-0248bc89/inventario/COMPARACION.md)

El instalador y las imágenes pasaron en GitHub. `verify` terminó en rojo el 17 de noviembre a las 23:15 UTC. Pasó `pnpm check` y el paso `node scripts/verify.mjs` salió con código 1. La información pública no muestra la prueba ni la aserción que falló. [CI de Inventario](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44192830997/job/134426586155)

## Capturas reales

| Ventana | Claro | Oscuro |
| --- | --- | --- |
| 1440 × 900 | [PNG](inventario-1440-claro.png) | [PNG](inventario-1440-oscuro.png) |
| 390 × 844 | [PNG](inventario-390-claro.png) | [PNG](inventario-390-oscuro.png) |

[Inventario móvil en inglés](inventario-390-ingles-oscuro.png) · [Mediciones y huellas SHA-256](comprobacion-integrada.json)
