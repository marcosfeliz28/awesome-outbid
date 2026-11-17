# Ventas de Norexos · evidencia del primer corte

Candidato de Dot `dot/ventas-higgsfield-17nov`, commit `5f7d61eba2bfd5ce82d299e44b5d47ce04f20c7b`. Comprobé el Historial de ventas en Edge 157 y Windows, con API y PostgreSQL aislados y el catálogo de ventas ficticias del proyecto. La [entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/5f7d61eba2bfd5ce82d299e44b5d47ce04f20c7b/docs/diseno/ventas-integrado/ENTREGA.md) identifica el PNG de Higgsfield aprobado. Las capturas de este informe documentan la implementación en pantalla y queda pendiente el cotejo directo con ese PNG.

## Funcionamiento comprobado

- El historial mostró 100 resultados cargados, 100 completadas y 0 anuladas, con 20 filas en la primera página. Los contadores conservaron esos valores al cambiar de página y respondieron al filtro.
- Seleccioné el primer folio con Enter. Su total en la vista previa coincidió con la tabla. «Ver detalle completo» abrió el diálogo existente y Escape lo cerró. Pasaron las búsquedas por número y fecha. La búsqueda sin coincidencias mostró cero resultados y ocultó la vista previa de la venta filtrada.
- Los temas claro y oscuro funcionaron a 1440 × 900 y 390 × 844. En escritorio la vista previa empezó a y=351. En ambos tamaños la página se mantuvo dentro del ancho de la ventana. A 1440, la tabla interna tenía 308 px de contenido desplazable horizontalmente.
- La tarjeta se elevó 2 px en 180 ms al pasar el puntero. Con movimiento reducido se quedó fija. Al cambiar a inglés, el historial, la vista previa y su botón principal actualizaron sus etiquetas.
- El recorrido se hizo con datos ficticios y registró cero escrituras de ventas y cero errores JavaScript de página. Los procesos propios quedaron cerrados.

## Hallazgos por prioridad

| Prioridad | Evidencia | Pendiente |
| --- | --- | --- |
| Bloqueo de entrega | `verify` falló en `pnpm check` por `'console' is not defined` en el [script de verificación de Ventas, línea 19](https://github.com/marcosfeliz28/awesome-outbid/blob/5f7d61eba2bfd5ce82d299e44b5d47ce04f20c7b/docs/diseno/ventas-integrado/verificar-ventas.mjs#L19). El instalador y las imágenes pasaron. | Dot debe corregir el script y confirmar los tres controles del SHA corregido. [Trabajo fallido](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44178098199/job/134374777583) |
| Alta · móvil | Al tocar el primer folio a 390 × 844, el desplazamiento automático fue de 0 px en ambos temas. La vista previa comenzó en y=9830, a 8986 px del borde inferior visible en ese momento, después de 20 tarjetas. | Dot debe hacer visible la vista previa al seleccionar el folio y preservar un regreso claro a la lista. |
| Media · escritorio | En la primera pantalla a 1440 × 900 hay 308 px de tabla fuera del ancho de su panel y «Ver detalle completo» queda más abajo que el total. | Revisar qué columnas se ven primero y mantener a la vista la acción principal del resumen. |
| Media · idioma | Con el historial en inglés, la fila seguía mostrando «Completada» y el lema «TU NEGOCIO, CON CLARIDAD» quedó en español. | Completar las etiquetas propias del historial en el cambio de idioma. |

## Capturas reales de la aplicación

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Historial 1440 × 900 | [PNG](ventas-1440-claro.png) | [PNG](ventas-1440-oscuro.png) |
| Historial 390 × 844 | [PNG](ventas-390-claro.png) | [PNG](ventas-390-oscuro.png) |
| Vista previa 390 × 844 tras bajar | [PNG](vista-previa-390-claro.png) | [PNG](vista-previa-390-oscuro.png) |
| Diálogo de detalle 1440 × 900 | — | [PNG](detalle-completo-1440-oscuro.png) |

El [registro de mediciones](comprobacion-integrada.json) contiene las dimensiones y la huella SHA-256 de las siete capturas.
