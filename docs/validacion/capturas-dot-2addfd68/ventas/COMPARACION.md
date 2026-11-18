# Ventas · recorrido de la revisión 18-nov

Comprobé `2addfd688a4bc3029b4b61c8e1b35845ce8ea695` en Edge sobre Windows con API y PostgreSQL locales descartables. La base se preparó con ventas ficticias. El recorrido en español registró cero escrituras operativas y cero errores de página. Cerré los servicios de prueba.

- En 1440 y 390 px funcionaron el filtro por folio, la búsqueda sin resultados, el filtro por fecha y la apertura y cierre de la ficha.
- Al elegir un folio, la posición de la página quedó en 0 px. Con 20 filas, la vista previa se situó 9683,94 px por debajo del borde inferior inicial en móvil y 1631,83 px por debajo en escritorio, en ambos temas. El botón de detalle quedó disponible tras desplazar la pantalla manualmente. El ticket mide 116 × 116 px, con márgenes verticales de 22 px.
- Cotejé el PNG aprobado de Ventas por su SHA-256 `4ccc1a6c101e34f55bc3b782476af5d39a7a6590144864d5fb54ce8ac90b766a`. El verde, dorado y relieve siguen la lámina. La vista previa de escritorio queda debajo de la lista y la lámina la coloca a la derecha. El clic solo actualiza la selección y el CSS usa una columna hasta 1600 px. [Selección](https://github.com/marcosfeliz28/awesome-outbid/blob/2addfd688a4bc3029b4b61c8e1b35845ce8ea695/apps/web/src/Management.tsx#L3311) · [Composición](https://github.com/marcosfeliz28/awesome-outbid/blob/2addfd688a4bc3029b4b61c8e1b35845ce8ea695/apps/web/src/fusion-ventas.css#L228)
- Las 33 comprobaciones estáticas, las 15 pruebas de citas e higiene y el tipado web pasaron. En CI, instalador e imágenes aprobaron y `verify` falló en `pnpm check`. Reproduje localmente la aserción de la línea 78 de `tests/claude-round2.test.ts`. La prueba busca el literal «Autorizó:». El código construye ese mismo texto en español y concatena los dos puntos fuera de la selección de idioma. [Fallo en GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44229216750/job/134549834130) · [Rótulo en el código](https://github.com/marcosfeliz28/awesome-outbid/blob/2addfd688a4bc3029b4b61c8e1b35845ce8ea695/apps/web/src/Management.tsx#L3647)
- Queda pendiente el recorrido de los avisos de caja y los formularios de operación. La rama se separó antes de la corrección del borrador del carrito en `67e68278`. La integración debe conservar ese arreglo y las 38 fotos de la base.

| Ventana y tema | Historial | Vista previa tras desplazar | Ficha |
| --- | --- | --- | --- |
| 1440 × 900 claro | [PNG](ventas-1440-claro.png) | [PNG](previa-1440-claro.png) | [PNG](ficha-1440-claro.png) |
| 1440 × 900 oscuro | [PNG](ventas-1440-oscuro.png) | [PNG](previa-1440-oscuro.png) | [PNG](ficha-1440-oscuro.png) |
| 390 × 844 claro | [PNG](ventas-390-claro.png) | [PNG](previa-390-claro.png) | [PNG](ficha-390-claro.png) |
| 390 × 844 oscuro | [PNG](ventas-390-oscuro.png) | [PNG](previa-390-oscuro.png) | [PNG](ficha-390-oscuro.png) |

[Mediciones y SHA-256 de las capturas](comprobacion-integrada.json)

## Inglés en pantalla

Cambié el idioma desde Inicio en ambos anchos. Confirmé título, búsqueda, selección de folio, «Sale details», «View full details» y la ficha abierta. La ficha mostró «Courier delivery», «Recorded payments», «Received», «Applied» y «Change». Los nombres y atributos de los artículos ficticios conservaron su idioma. Cero escrituras operativas y errores de página. Cerré los procesos.

[Vista previa en 1440](ventas-en-previa-1440.png) · [Ficha en 1440](ventas-en-ficha-1440.png) · [Vista previa en 390](ventas-en-previa-390.png) · [Ficha en 390](ventas-en-ficha-390.png) · [Mediciones y huellas](comprobacion-ingles.json)
