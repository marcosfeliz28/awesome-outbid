# Fechas de Alertas y Promociones · 2e9299d9

Código probado `2e9299d95533399af59ec34baf51d9cc1cf534ba`. Recorrido local con API/PostgreSQL y seed ficticio, Edge 1440 × 900 y 390 × 844, ES/EN. Se bloquearon escrituras operativas y destinos externos; no hubo errores JS. Los procesos terminaron.

En Alertas, la fecha de la primera fila y su detalle coincidieron en ambos tamaños: ES «18 nov de 2026» y EN «Nov 18, 2026». La categoría de una alerta de ventas bajas continuó mostrando «Ventas bajas» en inglés; no se comprobó el catálogo completo de tipos ni mensajes del servidor.

Al seleccionar la primera alerta de una lista de 128 elementos, su detalle quedó en escritorio a y=368 px y en móvil a y=33.691 px del documento. En móvil quedó 32.847 px debajo del viewport inicial en ES (scroll 0), por lo que se desplazó manualmente hasta el detalle para capturarlo; al repetir en EN estaba a 32.720 px bajo el viewport con scroll previo 127. No se marcó ni resolvió ninguna alerta.

«Mis promociones» / «My promotions» no tenía registros en el seed; no fue posible comprobar fechas de promociones existentes sin crear datos adicionales. Cuatro PNG muestran el detalle desplazado a la vista, no la posición inmediatamente posterior al clic. Datos completos en `comprobacion-integrada.json`. Se comprobó exclusivamente la pantalla de demostración con un rol autorizado.

## Controles y revisión siguiente

El candidato conserva los 275 WebP y la API de la base. Pasaron 7 de 7 comprobaciones focales, incluidas las cuatro aserciones que fallaron en el cambio anterior. Se revisaron 716 citas con destinos válidos. GitHub ya aprobó `pnpm check`, instalador e imágenes. El `verify` completo sigue en curso. [GitHub Actions del SHA exacto](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44303408416)

El detalle requiere acceso visible al seleccionar una alerta a 390 px, y la categoría «Ventas bajas» debe seguir el idioma elegido. Adjuntar la demostración con una lista larga y la navegación al detalle.
