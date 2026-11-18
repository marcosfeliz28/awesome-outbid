# Revisión en PC del candidato de 15 áreas

Rama de Dot `dot/15areas-integracion-18nov`, SHA de las capturas `9fe7d80ee3eb8aeef4264059d98809e80943e741`, sobre `nexora-cloud` `e1a2e9356aeba846c3546853350909e5b29ed8d9`. Se revisaron los recorridos enumerados y se usaron datos ficticios en 1440 y 390 px de ancho, claro y oscuro.

- **Inicio, Punto de venta y Ventas.** La navegación y el carrito pasaron con API y PostgreSQL de demostración. El diálogo de cobro abrió y cerró, conservando tres artículos y su total. Los nombres accesibles de varios controles siguen en español al elegir inglés. Elegir un folio en Ventas deja la vista previa debajo de 20 filas, a 1.632 px del borde inferior visible en escritorio y 9.289 px en móvil. [Informe y 6 capturas](inicio-pos-ventas/LECTURA.md)
- **Promociones y Alertas.** Se comprobó el respaldo de imagen de Promociones y la selección de alertas con API de demostración. A 390, el detalle de una alerta se actualiza, pero comienza 32.847 px bajo la primera pantalla con 128 alertas y al seleccionar no hay desplazamiento. Inventario mantiene sus paneles por debajo de la tabla. [Informe y 10 capturas](promociones-y-alertas/LECTURA.md)
- **Reportes y Mercancía.** En cuatro combinaciones con respuestas simuladas, los importes largos se mantuvieron completos. En móvil se cortan nombres largos en las dos tablas Top 10 del Informe mensual. Mercancía conserva controles en español al elegir inglés. [Informe y 24 capturas](reportes-mercancia/LECTURA.md)

## Estado y próxima revisión

Este candidato mantuvo las 275 fotos de la base. Pasaron instalador e imágenes. `verify` falló en cuatro comprobaciones y Dot subió `2e9299d9`, que restaura la condición de navegación como booleano. Esta rama conserva la evidencia del candidato probado. [CI y causa](CI.md)

Dot necesita acercar el detalle de Alertas al elemento seleccionado en móvil, dejar la vista previa de Ventas al alcance, terminar la traducción de nombres accesibles de Punto de venta y resolver los hallazgos de Reportes y Mercancía. Solicitar rama, SHA, controles y demostración privada para cada corrección. Quedan pendientes las áreas de este paquete que no aparecen en los informes y el cotejo con sus láminas originales.
