# Ventas · verificación de la aplicación

Verifiqué la rama `dot/ventas-integrada-18nov` en `8edc2b8e3bb4d5c9929ec96f98655d718ddbb937`. Usé la ruta `/#sales` en Edge 157.0.4341.60, con sesión de gerencia y API/PostgreSQL locales cargados con datos ficticios. Las 12 capturas tienen dimensiones y SHA-256 comprobados. [Mediciones y hashes](comprobacion-integrada.json)

Igualé la referencia por SHA-256 antes de cotejarla. `norexos-ventas-higgsfield-01.png` mide 2688 × 1520 y su SHA-256 es `4ccc1a6c101e34f55bc3b782476af5d39a7a6590144864d5fb54ce8ac90b766a`.

## Capturas

| Pantalla | 1440 × 900 claro | 1440 × 900 oscuro | 390 × 844 claro | 390 × 844 oscuro |
| --- | --- | --- | --- | --- |
| Historial al entrar | [PNG](ventas-1440-claro.png) | [PNG](ventas-1440-oscuro.png) | [PNG](ventas-390-claro.png) | [PNG](ventas-390-oscuro.png) |
| Vista previa tras desplazarse | [PNG](previa-1440-claro.png) | [PNG](previa-1440-oscuro.png) | [PNG](previa-390-claro.png) | [PNG](previa-390-oscuro.png) |
| Ficha completa | [PNG](ficha-1440-claro.png) | [PNG](ficha-1440-oscuro.png) | [PNG](ficha-390-claro.png) | [PNG](ficha-390-oscuro.png) |

## Recorrido

- La consulta inicial devolvió 100 registros ficticios, 100 completados y 0 anulados. Los tres contadores coincidieron con la respuesta y la primera página mostró 20 filas. El folio exacto devolvió 1, la búsqueda inexistente devolvió 0 y vació la previa, y el filtro por fecha local devolvió las 3 ventas de la fecha probada. Los tres filtros respondieron `HTTP 200` en ambos anchos. [Mediciones](comprobacion-integrada.json)
- El clic y el toque seleccionaron el folio y actualizaron la previa a «Venta seleccionada». «Ver detalle completo» abrió la ficha con artículos, pagos y total, y se pudo cerrar en las cuatro vistas. No se enviaron operaciones de venta, edición o roles. Se registraron 0 errores de página y quedaron cerrados los servicios y el navegador de prueba. [Ficha móvil](ficha-390-oscuro.png) · [Mediciones](comprobacion-integrada.json)

## Hallazgos y cotejo

| Prioridad | Hallazgo |
| --- | --- |
| Alta · 390 × 844 | Tocar el primer folio produjo 0 px de desplazamiento automático en ambos temas. La previa iniciaba en y=10.527,94 px, a 9.683,94 px del borde inferior del primer cuadro, después de 20 tarjetas. En la prueba anterior quedó a 8.986 px. El ticket mide 116 × 116 px y usa 22 px de margen arriba y abajo, para un total de 160 px verticales. Tras desplazarse, «Ver detalle completo» mide 320 × 48 px. [Previa móvil](previa-390-oscuro.png) · [Revisión anterior](https://github.com/marcosfeliz28/awesome-outbid/tree/af2ea73a9387ae8c196625bc98685805610cdcd4/docs/validacion/capturas-dot-5f7d61eb) |
| Alta · 1440 × 900 | La lámina sitúa el detalle al lado de la lista. En la aplicación el detalle empieza debajo de la primera página, en y=2.531,83 px, a 1.631,83 px del borde inferior del primer cuadro. Seleccionar el primer folio también desplazó 0 px. [Historial](ventas-1440-oscuro.png) · [Estilos](https://github.com/marcosfeliz28/awesome-outbid/blob/8edc2b8e3bb4d5c9929ec96f98655d718ddbb937/apps/web/src/fusion-ventas.css#L227) |
| Visual | Coinciden la familia verde y dorada, el relieve de los paneles, la tabla de ventas y la presencia del ticket. La aplicación usa iconos lineales y tres conteos de filas cargadas. La lámina tiene iconos dorados en relieve, cuatro tarjetas de período, filtros de estado y forma de pago, una gráfica y artículos dentro de la previa. En la aplicación los artículos y pagos aparecen al abrir la ficha. [Entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/8edc2b8e3bb4d5c9929ec96f98655d718ddbb937/docs/diseno/ventas-integrado/ENTREGA.md) |
| Tabla | Se midieron 0 px de desbordamiento de página y del panel principal en ambos anchos. En 1440 px la tabla tiene 57 px de desplazamiento interno y la celda de acciones conserva posición fija dentro de la tabla. En 390 px la lista tiene 0 px de desplazamiento horizontal. [Mediciones](comprobacion-integrada.json) |

El CI de `8edc2b8e` seguía pendiente a las 03:00 UTC del 18 de noviembre. `verify` estaba en cola y `windows-installer` y `render-images` estaban en ejecución. [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44226648117)
