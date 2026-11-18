# Configuración, Incentivos y encuesta · 0d1e00cc

Candidato `0d1e00ccfedf2db6e5e082a5f1c40a84198dc49c` de `dot/15areas-sobre-prod-18nov`. La revisión visual usó la aplicación local con respuestas simuladas y datos ficticios a 1440 y 390 px, en claro y oscuro, español e inglés. Las vistas comprobadas se documentan con 10 capturas.

## Configuración

En 8/8 combinaciones se localizaron «Negocio y reglas», el resumen de impuesto incluido, el ancho del recibo, los plazos de las reglas y las etiquetas de cajas y cajeros. El rótulo inglés de la pestaña ocupa dos líneas a 390 px. Los ocho recorridos mantuvieron el contenido dentro del ancho de la pantalla. [Cuatro capturas y mediciones](negocio-y-reglas/LECTURA.md)

## Incentivos y encuesta

- Las tarifas y el resumen de encuesta muestran en inglés sus encabezados y controles. La consulta del mes de Incentivos y la apertura y cancelación de su diálogo terminaron en las ocho combinaciones. El cuestionario de Preguntas abrió y cerró en ocho combinaciones. Las respuestas, tarifas y cierres permanecieron sin confirmar.
- **Prioridad media.** En móvil oscuro, «Recibo PDF» tiene contraste 2,91:1 y «UNIDADES POR CATEGORÍA» se corta dentro de las palabras. Mejorar el contraste y el ancho de la etiqueta.
- **Prioridad media.** Al elegir inglés, el cuestionario completo y el nombre accesible del botón Preguntas siguen en español. El cierre de Incentivos conserva título y acción en español y el nombre accesible del PDF también.
- [Seis capturas y mediciones de Incentivos, tarifas y encuesta](incentivos-preguntas/LECTURA.md)

## Respaldo y consumo de IA

Comprobé en el código el cambio de idioma de estados y acciones de Respaldo y encabezados y estados de Consumo de IA. Pasó la prueba estática seleccionada para las etiquetas ES/EN. Estos dos módulos quedan pendientes de validación en navegador. [Cambios de interfaz desde Reportes](https://github.com/marcosfeliz28/awesome-outbid/compare/f5cb900a...0d1e00cc)

## Fotos y controles

Pasaron cuatro pruebas estáticas seleccionadas de idioma. En GitHub pasaron instalador, imágenes y `pnpm check`. La base `dcf61af2` pasó los tres controles. Su `verify` terminó a las 18:13:58 UTC. El candidato `0d1e00cc` mantiene instalador e imágenes aprobados y `verify` en curso al corte de las 18:19 UTC. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44364498009) · [CI de la base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44362984444)

La base `dcf61af2` tiene 318 fotos WebP. El candidato conserva las 316 anteriores, con las mismas imágenes y API. Faltan `adidas-samba-blancos-real.webp` y `adidas-campus-gris-real.webp`. [Comparación con la base](https://github.com/marcosfeliz28/awesome-outbid/compare/0d1e00cc...dcf61af2)

El arreglo de pérdida de foco de Punto de venta sigue pendiente de un nuevo cambio. Los archivos principales que manejan el cierre del buscador y Cobrar son iguales a los de la comprobación anterior. [Recorrido anterior de foco](https://github.com/marcosfeliz28/awesome-outbid/blob/3786dfab2151cf019590ca2c86d62e29f05d1668/docs/capturas/integracion-2832ad4e/LECTURA.md)

## Ensayo visual de Dot

La rama de ensayos `dot/qa-config-incentivos-0d1e-18nov`, SHA `4922796fd09b78a7da0b4119c38fc9a7569cdf88`, conserva exactamente los árboles de aplicación y componentes de `0d1e00cc`. Su único control visual pasó a las 18:00:49 UTC. Configura 16 casos de Configuración e Incentivos en dos anchos, temas e idiomas, con datos simulados. Incluye abrir y cancelar el editor de configuración. [Ejecución del ensayo](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44364699567)

El artefacto publicado requiere acceso autenticado. Sus capturas y resultados individuales quedan pendientes de inspección. El ensayo comprueba carga, dibujo, ausencia de desborde y una muestra de movimiento. Los hallazgos de contraste, idioma y foco descritos en los recorridos independientes siguen abiertos.

## Siguiente entrega de Dot

Corregir el contraste y la partición de etiquetas de Incentivos, completar los textos de interfaz en inglés y el retorno de foco. Conservar las dos fotos nuevas, entregar el resumen por pantalla del ensayo general y adjuntar rama, SHA, tres controles y demostración privada.

Se cerraron los navegadores y servicios que se abrieron durante la revisión.
