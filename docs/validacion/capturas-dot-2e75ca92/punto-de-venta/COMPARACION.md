# Punto de venta con la marca Norexos

Probé `2e75ca92bb6ab397b937131e512671e3be397635` de `dot/caja-higgsfield-fase2-17nov` en Edge con la API local y datos ficticios.
La rama implementa la pantalla de Punto de venta. Marcos aprobó su concepto de Higgsfield en «Your dot».
[Entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/2e75ca92bb6ab397b937131e512671e3be397635/docs/diseno/caja-higgsfield/ENTREGA_17NOV.md).

## Recorrido comprobado

F2 enfocó la búsqueda, el SKU de prueba añadió un artículo y F4 permitió elegir cliente.
El diálogo de cobro abrió desde F12 a 1440 px y desde el botón móvil a 390 px. Cerrarlo conservó
el artículo y el total. Hubo cero solicitudes de alta de venta y cero errores de JavaScript.
Cambiar a inglés, y volver a español, conservó el carrito. En escritorio, una tarjeta subió
2 px en 150 ms al pasar el puntero. Con movimiento reducido quedó inmóvil.

El título de la página, el menú y «Acerca de» muestran Norexos. En el menú móvil de Inicio,
«Punto de venta» se resolvió una sola vez y abrió la pantalla. El acceso rápido se anuncia
como «Ir a Punto de venta». [Mediciones](comprobacion-integrada.json).

## Pendientes que se ven en pantalla

| Comprobación | Resultado |
| --- | --- |
| Primer encuadre en escritorio | A 1440 × 900 px, «Cobrar» comienza a 846 px y termina a 910 px. La primera tarjeta termina a 920 px. |
| Catálogo y carrito en móvil | A 390 × 844 px, las primeras tarjetas empiezan a 756 px. «Ver carrito» abre el carrito desde la barra fija. Los nombres y precios requieren avanzar en el catálogo. |
| Lectura del control en inglés | El botón muestra «Charge» y su nombre accesible sigue empezando por «Cobrar». «Ver carrito» también se anuncia en español. |
| Tipografía del total | En Oscuro, medí 25.6 px a 1280 y 28 px a 390. El navegador usa `Georgia, "Times New Roman", serif` a 1280 y `Georgia, "Times New Roman", serif` a 390. La prueba U1 espera Plus Jakarta Sans y de 28 a 32 px. |

La imagen de Higgsfield concentra el catálogo y el botón completo de cobro en el encuadre.
La aplicación conserva el verde oscuro, los bordes dorados, el catálogo al lado de la venta
y el relieve del botón. Queda pendiente cotejar el PNG aprobado guardado con su huella.
[Contrato de la prueba U1](https://github.com/marcosfeliz28/awesome-outbid/blob/2e75ca92bb6ab397b937131e512671e3be397635/tests/e2e/u1-pos.spec.ts#L35).

## Capturas reales

| Ventana | Claro | Oscuro |
| --- | --- | --- |
| Punto de venta a 1440 × 900 | [Captura](pos-1440-claro.png) | [Captura](pos-1440-oscuro.png) |
| Inicio del catálogo a 390 × 844 | [Captura](pos-390-claro.png) | [Captura](pos-390-oscuro.png) |
| Carrito a 390 × 844 | [Captura](carrito-390-claro.png) | [Captura](carrito-390-oscuro.png) |

El navegador y los servicios de prueba se cerraron. A las 21:09 UTC, `verify` estaba en curso,
`windows-installer` aprobado y `render-images` aprobado.
[Controles del commit](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44175474231).
