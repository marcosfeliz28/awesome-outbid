# Revisión con IA 05 v2 (interfaz, PWA y caja) · estado en `claude/w3-web`

> **Nota (G13):** revisión automatizada hecha con un modelo de IA. No es una auditoría independiente ni una certificación; no la cites como respaldo ante terceros.

Qué se corrigió en la web (`apps/web`) y qué queda abierto, con el motivo. Las
pruebas nuevas están en `tests/e2e/caja-borrador.spec.ts`,
`tests/e2e/caja-detalles.spec.ts`, `tests/cart-draft-policy.test.ts`,
`tests/offline-review-web.test.ts` y `tests/pwa-update.test.ts`.

## Corregido

| ID            | Qué cambia                                                                                                                                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N1            | El error de escaneo caduca a los 15 s y se quita al teclear, al cobrar, al abrir cualquier ventana y al salir de la caja.                                                                                                              |
| N2            | Un carrito (o cola con internet) sin que nadie toque la pantalla espera como máximo 2 h; luego se pide la contraseña y el carrito se conserva. Las ventas pendientes sin conexión siguen esperando sin tope.                           |
| N3            | El borrador se borra de forma síncrona al registrar la venta, antes del recibo. El `offlineUuid` del cobro viaja con el borrador: si el carrito vuelve, el cobro reutiliza el mismo uuid (la API contesta con la venta ya registrada). |
| N3b           | Un borrador de más de 12 h no se recupera.                                                                                                                                                                                             |
| N4            | «No corresponde al horario de esta caja» ya no se confunde con «ventas sin conexión desactivadas».                                                                                                                                     |
| N5            | Enter en el selector de clientes sólo elige al único cliente que empieza por lo escrito; con varios pide elegir.                                                                                                                       |
| N6            | El aviso de versión nueva va abajo (sobre la barra del carrito en celular) y ya no tapa la búsqueda ni el estado de conexión.                                                                                                          |
| N7            | Todas las pestañas se recargan cuando otra aplica la versión nueva (con carrito vacío, sin ventanas ni formularios).                                                                                                                   |
| N9            | La actualización automática no recarga con una ventana abierta ni con un campo escrito hace menos de 30 min.                                                                                                                           |
| N10           | Las variables de entorno del servidor y la dirección de regreso de Drive van en «Detalle para el técnico».                                                                                                                             |
| M5 (texto)    | El mensaje de Caja deja de decir que los montos «se mostrarán únicamente a administración»: dice lo que pasa (se ven al cerrar).                                                                                                       |
| M9 / B2       | El indicador dice «Sin conexión»; manuales y guías actualizados.                                                                                                                                                                       |
| B1            | Áreas táctiles de 44 px en celular: conexión, cerrar aviso, quitar línea, cuenta.                                                                                                                                                      |
| B4            | La cajera ya no dispara `GET /dashboard/summary` (403) al entrar.                                                                                                                                                                      |
| B9 (parcial)  | «En espera» muestra el cliente de cada venta.                                                                                                                                                                                          |
| B10           | La barra de cobro del celular no muestra `F12`.                                                                                                                                                                                        |
| B11 (parcial) | «Mostrar contraseña» en el inicio de sesión.                                                                                                                                                                                           |

## Sigue abierto

- **N8** (la venta en conflicto no sube su detalle hasta el descarte): es de la API (`sales/sync` y `offline-sale-review.ts`); fuera del alcance de esta rama.
- **B8** (alertas de stock sin variante): el texto sale de `apps/api/src/alerts.ts`.
- **A3, caso carrito vacío sin conexión**: con la cola vacía, el cierre por inactividad sin internet deja a la cajera sin poder entrar (el inicio de sesión necesita al servidor). No se cambió porque exentar el cierre sin internet deja una terminal abierta sin vigilancia: es una decisión de negocio (¿pantalla de bloqueo con PIN local?).
- **M5** (política): después de cerrar, el cuadre impreso sigue mostrando esperado y diferencias a la cajera. Cambiarlo toca la API (`GET cash-sessions/:id/cuadre`) y el manual; el texto de Caja ya no promete lo contrario.
- **M6** (devoluciones de varios artículos, reimprimir ticket, buscar por cliente): es una función nueva, no un arreglo pequeño.
- **B5** (bundle de 1 MB): requiere dividir el código por rutas y revisar el precaché.
- **B6** (F7/F9/F10 sacan del POS): el carrito ya sobrevive a salir de la pantalla; cambiar los atajos es una decisión de uso.
- **B7** («Venta al por mayor»): la palabra está en pruebas y documentos de incentivos; renombrar es decisión de producto.
- **B9** (total en «En espera»): la API guarda artículos y descuentos, no el total; calcularlo con el catálogo actual daría una cifra distinta a la del cobro.
- **B12** (importar factura: variante por código): es de Mercancía y de la API de importación.
- **N2/N3b**: el borrador no distingue «otra sesión de caja»; sólo caduca por tiempo (12 h) y por usuario.
