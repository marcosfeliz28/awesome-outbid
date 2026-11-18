# Norexos · Inicio integrado y regresión de carrito

Probé `92d131f8847c1bd338b48c34231bf3c6ae82cb5b` de `dot/inicio-premium-integrado-18nov` en Edge 157 sobre Windows. Usé una API y bases PostgreSQL locales descartables con datos ficticios. La compilación web y las 46 pruebas focales aprobaron. La prueba automatizada de actualización pasó las tres repeticiones en Chromium. Ese caso usa un carrito y un cuadro de pago simulados y no comprueba el borrador real que conserva la aplicación.

## Bloqueo reproducido en la aplicación

1. Cargué la compilación `5cadaa81` en Inicio y en Punto de venta. Añadí un artículo de demostración con el catálogo y conservé la otra pestaña libre.
2. Cambié el servidor local para servir la compilación de `92d131f8`. Los archivos JavaScript, CSS y service worker de ambas compilaciones eran distintos. Pulsé «Actualizar ahora» en Inicio. La pestaña de Punto de venta conservó el artículo y el total durante los 16 segundos observados.
3. Quité el último artículo con el botón de la fila. La pestaña se recargó, cargó los recursos de `92d131f8` y restauró el artículo quitado y su total. El aviso mostró «Se recuperó tu venta en curso (1 artículo)». Hubo cero solicitudes de venta y cero errores de JavaScript.

El resultado coincide con las dos reproducciones de la revisión anterior. `92d131f8` incorpora el acabado de Inicio y espera la navegación en la prueba automatizada. Los archivos de actualización y persistencia del carrito son idénticos a `01772bf1`. El borrado del borrador vacío sigue programado después de que la suscripción del actualizador pueda pedir la recarga. El escenario faltante debe comprobar que quitar el último artículo deja el carrito vacío después de cambiar de compilación. [Comparación con el commit anterior](https://github.com/marcosfeliz28/awesome-outbid/compare/01772bf1...92d131f8) · [Reproducciones anteriores](https://github.com/marcosfeliz28/awesome-outbid/blob/c6581f61c08f67f68182276297a71ab778e4192e/docs/validacion/capturas-dot-01772bf1/inicio-y-actualizacion/COMPARACION.md)

[Aviso en la pestaña libre](actualizacion/actualizacion-en-inicio.png) · [Carrito conservado durante el cambio](actualizacion/carrito-conservado-version-anterior.png) · [Artículo restaurado después de quitarlo](actualizacion/pos-tras-quitar-ultimo-articulo.png) · [Mediciones y SHA-256](actualizacion/comprobacion-integrada.json)

## Inicio

El acabado mantiene los medallones dorados, los bordes finos y el relieve de la segunda lámina Higgsfield. Comprobé teclado, cambio de acento, idioma, alto contraste y movimiento reducido. En móvil, Mercancía mantuvo el material de Inicio y los importes quedaron en una línea, sin desborde horizontal. El recorrido usó el código visual idéntico al del cotejo anterior. Inicio se capturó de nuevo para el commit integrado.

| Ventana | Claro | Oscuro |
| --- | --- | --- |
| 1440 × 900 | [PNG](inicio/inicio-1440-claro.png) | [PNG](inicio/inicio-1440-oscuro.png) |
| 390 × 844 | [PNG](inicio/inicio-390-claro.png) | [PNG](inicio/inicio-390-oscuro.png) |

[Mediciones de Inicio](inicio/comprobacion-integrada.json) · [Cotejo de la lámina](https://github.com/marcosfeliz28/awesome-outbid/blob/c6581f61c08f67f68182276297a71ab778e4192e/docs/validacion/capturas-dot-01772bf1/inicio-y-actualizacion/COMPARACION.md#acabado-de-inicio)

## Controles de GitHub

En el evento push de `92d131f8` terminaron en verde `verify`, `windows-installer` y `render-images`. En la prueba de la aplicación completa permanece el bloqueo de restauración del carrito. [Ejecución del commit integrado](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44214105682)

El commit de diseño se preparó antes de `bb379731`. La comparación de archivos muestra 38 WebP más en `origin/nexora-cloud` que en `92d131f8`. La siguiente integración debe conservar esas 38 fotos. [Fotos incorporadas a la base](https://github.com/marcosfeliz28/awesome-outbid/commit/bb379731)

Quedan pendientes corregir la restauración indebida, comprobar la identidad persistente del turno y el reintento de cobro sin conexión. Cerré los navegadores y servicios de prueba.
