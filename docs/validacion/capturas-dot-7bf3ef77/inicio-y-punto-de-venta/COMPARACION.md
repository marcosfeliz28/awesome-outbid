# Inicio y Punto de venta de Norexos · comprobación del candidato integrado

Probé `7bf3ef770f1ce474633e00421bfaefd19ad2345f` de `dot/inicio-pos-integracion-segura-17nov` en Edge 157 sobre Windows, con servicios locales y datos ficticios. La aplicación conserva el código de Inicio y Punto de venta de `59d77a17` y el árbol de imágenes de `a732e1f2`, incluidas las diez fotos nuevas. La protección de actualización PWA se revisa en su rama propia. [Preflight de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/7bf3ef770f1ce474633e00421bfaefd19ad2345f/docs/diseno/integracion/PREFLIGHT_INICIO_POS_17NOV.md)

## Resultados

- **Inicio**. La marca Norexos, el alerta de «Acerca de», el acceso por teclado a Reportes, temas y cambio de idioma pasaron. El menú móvil encontró una sola acción «Punto de venta» y abrió su vista. A 390 × 844, el panel de accesos empieza en y=681. A 1440 × 900, empieza en y=807. Los accesos completos todavía requieren desplazarse. [Lámina exacta y comparación anterior de Inicio](https://github.com/marcosfeliz28/awesome-outbid/blob/71cb653e7f1caf063006d49abb26f5cbfed03be3/docs/validacion/capturas-dot-0641409c/inicio/COMPARACION.md)
- **Punto de venta**. Pasaron F2, F4, el ingreso de código y abrir y cerrar «Cobrar» conservando el carrito. El recorrido registró cero envíos de venta. Con cinco artículos y textos largos, la primera tarjeta y «Cobrar» caben en las cuatro resoluciones de escritorio medidas. A 1280 × 720 se ven dos filas completas del carrito y en los otros tres tamaños se ven tres. La lámina pone el catálogo a la izquierda y el cobro a la derecha, como la aplicación. La captura de escritorio muestra dos columnas frente a tres de la referencia. [Cotejo con el PNG de Higgsfield verificado](https://github.com/marcosfeliz28/awesome-outbid/blob/4989cb3fe7d33be2db09547f06b650f90a3880df/docs/validacion/capturas-dot-59d77a17/punto-de-venta/COMPARACION.md)
- **Alcance**. Se probaron claro y oscuro, 1440 y 390 px, y movimiento reducido. Los navegadores registraron cero errores JavaScript. Cerré las dos sesiones de prueba y sus servicios. Los controles de instalador e imágenes aprobaron para este SHA. `verify` seguía en curso. [CI del candidato integrado](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44196714177)

## Capturas reales

| Vista | Claro | Oscuro |
| --- | --- | --- |
| Inicio, ventana 1440 × 900 | [PNG completo](inicio/inicio-1440-claro.png) | [PNG completo](inicio/inicio-1440-oscuro.png) |
| Inicio, ventana 390 × 844 | [PNG completo](inicio/inicio-390-claro.png) | [PNG completo](inicio/inicio-390-oscuro.png) |
| Punto de venta 1440 × 900 | [PNG](pos/pos-1440-claro.png) | [PNG](pos/pos-1440-oscuro.png) |
| Punto de venta 390 × 844 | [PNG](pos/pos-390-claro.png) | [PNG](pos/pos-390-oscuro.png) |
| Carrito abierto 390 × 844 | [PNG](pos/carrito-390-claro.png) | [PNG](pos/carrito-390-oscuro.png) |
| Cinco artículos a 1366 × 768 | — | [PNG](pos/carrito-1366-cinco-articulos.png) |

[Mediciones y huellas SHA-256](comprobacion-integrada.json)
