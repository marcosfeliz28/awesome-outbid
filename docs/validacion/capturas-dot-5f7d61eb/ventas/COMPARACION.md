# Ventas de Norexos · evidencia del primer corte

Candidato de Dot `dot/ventas-higgsfield-17nov`, commit `5f7d61eba2bfd5ce82d299e44b5d47ce04f20c7b`. Comprobé el Historial de ventas en Edge 157 y Windows, con API y PostgreSQL aislados y el catálogo de ventas ficticias del proyecto. La [entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/5f7d61eba2bfd5ce82d299e44b5d47ce04f20c7b/docs/diseno/ventas-integrado/ENTREGA.md) identifica el PNG de Higgsfield aprobado. Abrí esa lámina en «Your dot» y la cotejé con la captura oscura de escritorio. Marcos aprobó los conceptos de Caja y turnos, Ventas, Productos e Inventario juntos para su implementación por fases.

## Funcionamiento comprobado

- El historial mostró 100 resultados cargados, 100 completadas y 0 anuladas, con 20 filas en la primera página. Los contadores conservaron esos valores al cambiar de página y respondieron al filtro.
- Seleccioné el primer folio con Enter. Su total en la vista previa coincidió con la tabla. «Ver detalle completo» abrió el diálogo existente y Escape lo cerró. Pasaron las búsquedas por número y fecha. La búsqueda sin coincidencias mostró cero resultados y ocultó la vista previa de la venta filtrada.
- Los temas claro y oscuro funcionaron a 1440 × 900 y 390 × 844. En escritorio la vista previa empezó a y=351. En ambos tamaños la página se mantuvo dentro del ancho de la ventana. A 1440, la tabla interna tenía 308 px de contenido desplazable horizontalmente.
- La tarjeta se elevó 2 px en 180 ms al pasar el puntero. Con movimiento reducido se quedó fija. Al cambiar a inglés, el historial, la vista previa y su botón principal actualizaron sus etiquetas.
- El recorrido se hizo con datos ficticios y registró cero escrituras de ventas y cero errores JavaScript de página. Los procesos propios quedaron cerrados.

## Hallazgos por prioridad

| Prioridad | Evidencia | Pendiente |
| --- | --- | --- |
| Bloqueo de entrega | `verify` falló en `pnpm check` por `'console' is not defined` en el [script de verificación de Ventas, línea 19](https://github.com/marcosfeliz28/awesome-outbid/blob/5f7d61eba2bfd5ce82d299e44b5d47ce04f20c7b/docs/diseno/ventas-integrado/verificar-ventas.mjs#L19). El instalador y las imágenes pasaron. | ESLint pasó en la revisión siguiente. Siguen en curso los tres controles de la nueva revisión. [Trabajo fallido](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44178098199/job/134374777583) |
| Alta · móvil | Al tocar el primer folio a 390 × 844, el desplazamiento automático fue de 0 px en ambos temas. La vista previa comenzó en y=9830, a 8986 px del borde inferior visible en ese momento, después de 20 tarjetas. | Dot debe hacer visible la vista previa al seleccionar el folio y preservar un regreso claro a la lista. |
| Media · escritorio | En la primera pantalla a 1440 × 900 hay 308 px de tabla fuera del ancho de su panel y «Ver detalle completo» queda más abajo que el total. | Revisar qué columnas se ven primero y mantener a la vista la acción principal del resumen. |
| Media · idioma | Con el historial en inglés, la fila seguía mostrando «Completada» y el lema «TU NEGOCIO, CON CLARIDAD» quedó en español. | Completar las etiquetas propias del historial en el cambio de idioma. |

## Cotejo visual con Higgsfield

La segunda imagen adjunta de la serie, `norexos-ventas-higgsfield-01.png`, comparte con esta pantalla las superficies verde oscuro, el filo dorado y el resumen a la derecha. La lámina concentra filtros, cuatro indicadores, tabla, gráfica de tendencia y comprobante en el mismo encuadre. En la aplicación, el menú general conserva su estilo y el historial muestra tres contadores de resultados cargados, filtro de folio y fecha, y un resumen sin artículos. Los artículos se consultan en el detalle completo. El relieve está presente, con un icono lineal en la vista previa frente al comprobante ilustrado de la lámina. La densidad y la visibilidad de la acción principal son las diferencias que más afectan el recorrido.

La entrega de Dot documenta que faltan el gráfico de tendencia y los filtros de período, estado y método dibujados. Los importes de la maqueta son ilustrativos. Los contadores que probé se limitan a los registros cargados por la API.

## Capturas reales de la aplicación

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Historial 1440 × 900 | [PNG](ventas-1440-claro.png) | [PNG](ventas-1440-oscuro.png) |
| Historial 390 × 844 | [PNG](ventas-390-claro.png) | [PNG](ventas-390-oscuro.png) |
| Vista previa 390 × 844 tras bajar | [PNG](vista-previa-390-claro.png) | [PNG](vista-previa-390-oscuro.png) |
| Diálogo de detalle 1440 × 900 | — | [PNG](detalle-completo-1440-oscuro.png) |

El [registro de mediciones](comprobacion-integrada.json) contiene las dimensiones y la huella SHA-256 de las siete capturas.

## Actualización del candidato

Dot publicó `334e44da7a5dd385cc8eaec529fdaf9627073dc6` en la misma rama. El único archivo cambiado es el script de verificación. Importa `log` de `node:console` y pasó ESLint localmente. Comparé `apps/` entre ambos commits y los árboles coinciden. Las siete capturas y el problema de la vista previa móvil describen el mismo código de aplicación. GitHub reportó un fallo documental en la nueva revisión. [Nueva ejecución de GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44183427539)

### Resultado del CI de `334e44da`

`verify` se detuvo en `pnpm check`. La prueba de citas perdió el anclaje `Management.tsx:3316` y GitHub omitió la etapa de navegador. El ancla conserva el fragmento `label: "Saldo pendiente",` de una columna cuyo encabezado se tradujo. La cita de `docs/sistema/FLUJO_CAJA_POS.md:135` describe la acción «Solicitar anulación», que ahora está en `Management.tsx:3418–3433`, y su formulario, en `Management.tsx:3739–3772`. [Fallo anotado en GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44183427539/job/134393515392)

Reproduje el fallo local en `pnpm exec vitest run tests/docs-sistema-citas.test.ts`. En una copia descartable sustituí ambas referencias antiguas por `Management.tsx:3418-3433` y `Management.tsx:3739-3772`. Pasaron las cuatro pruebas. Dot puede incorporar esas citas y regenerar las anclas con `node scripts/citas-reanclar.mjs`. Restauré la copia de prueba tras la comprobación. La vista previa móvil sigue pendiente.

### Ventas `d3e311a4`

En `d3e311a42364468a1f2df6a6d230f458612e9cc1`, Dot corrigió la referencia al botón «Solicitar anulación» y su ancla. Repetí la prueba de citas y pasaron las cuatro. La referencia abreviada del formulario aún indica `:3555-3587`; el formulario está en `Management.tsx:3739-3772`. Las únicas diferencias desde `334e44da` son documentales. Las siete capturas y la distancia a la vista previa móvil siguen correspondiendo al código de aplicación.

En GitHub, el instalador y las imágenes pasan. `verify` superó `pnpm check` y falló después en `node scripts/verify.mjs`. La anotación pública da código 1 sin identificar pruebas; queda pendiente ese diagnóstico. [CI de Ventas](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44185035628/job/134399170803)
