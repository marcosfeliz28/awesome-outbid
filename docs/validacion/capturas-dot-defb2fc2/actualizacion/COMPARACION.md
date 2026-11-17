# Actualización de Norexos durante una venta

Probé `defb2fc2e3a6ee0c11194c5c1f79ed17c1e33d6d` de `dot/pwa-actualizacion-segura-17nov` en Edge 157 sobre Windows, con dos pestañas a 1440 × 900, API local y PostgreSQL de demostración.

1. Agregué un artículo ficticio en Punto de venta y dejé otra pestaña libre. Serví una segunda versión del archivo del service worker cambiando únicamente un comentario en el servidor local. El navegador instaló el archivo y mostró la opción «Actualizar ahora».
2. Elegí «Actualizar ahora» en la pestaña libre y confirmé que se recargó. La pestaña con el carrito recibió el cambio de controlador y mantuvo el mismo documento durante los 16 segundos observados después del cambio.
3. En esa pestaña se conservó el artículo, el total y el indicador «Caja abierta». El caso registró cero solicitudes de venta y cero errores de página. Cerré el navegador, la API, PostgreSQL y los servidores web de prueba. Pasaron 21 pruebas focales de las reglas del actualizador y del carrito.

La comprobación usa los mismos recursos de aplicación antes y después de la actualización. Quedaron fuera el cambio entre dos compilaciones distintas, la verificación del identificador persistente del turno y la recuperación de cobros sin conexión. La protección vive en una rama aparte de la integración Inicio y Punto de venta `7bf3ef77`.

Los tres controles, `verify`, `windows-installer` y `render-images`, terminaron en verde para este SHA. [CI de la protección de actualización](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44197874395)

[Antes de actualizar en la pestaña libre](actualizacion-pestana-libre.png) · [Carrito conservado en la segunda pestaña](carrito-despues-de-actualizar-otra-pestana.png) · [Mediciones y huellas SHA-256](comprobacion-integrada.json)
