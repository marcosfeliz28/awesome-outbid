# Norexos · Inicio, Punto de venta y actualización

Probé el commit `00eb16a158fbb141468923a6792208288aeaa67b` de `dot/inicio-pos-pwa-integrado-17nov` en Windows, con Edge 157, API local y PostgreSQL descartable con datos ficticios. El build web terminó correctamente. Guardé **13 capturas reales** y cerré los navegadores y los servicios que inicié.

## Recorrido y cotejo visual

- **Inicio.** Confirmé la marca Norexos, Reportes por teclado, cambio de idioma, temas y una sola acción «Punto de venta» en el menú móvil. Medí 0 px de desborde horizontal. Los accesos empiezan en y=681 a 390 px y en y=807 a 1440 px. En escritorio se necesita desplazar la pantalla para verlos completos. El efecto de las tarjetas se detuvo con movimiento reducido.
- **Punto de venta.** Pasaron F2, F4, agregar por código y abrir y cerrar Cobrar a 1440 y 390 px. Con cinco artículos y etiquetas largas, la primera tarjeta y Cobrar quedaron visibles a 1280×720, 1366×768, 1536×864 y 1024×768, con 0 px de desborde. A 1280×720 se ven dos filas completas y en los otros tres tamaños se ven tres. El carrito y Cobrar todavía tienen etiquetas accesibles en español cuando se elige inglés. En las pruebas del POS hubo cero solicitudes de venta y cero errores de página.
- **Actualización.** Provoqué un cambio real de service worker con una revisión de su archivo en el servidor local. La pestaña libre se recargó y la ocupada conservó durante 16 segundos el documento, artículo, total e indicador «Caja abierta». Esta prueba usa los mismos recursos web en ambas versiones. Quedaron pendientes la transición entre dos compilaciones distintas, verificar el mismo turno por su ID y la recuperación de cobros sin conexión. Pasaron 21 pruebas focales de actualización y borrador de carrito.

## Fallos reproducidos

1. **Bloquea el CI.** En [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44202825523/job/134461031738) aprobaron `windows-installer` y `render-images`. `verify` falló en `pnpm check`. Las anotaciones señalan [tests/e2e-higiene.test.ts, línea 118](https://github.com/marcosfeliz28/awesome-outbid/blob/00eb16a158fbb141468923a6792208288aeaa67b/tests/e2e-higiene.test.ts#L118). En esta PC se reprodujo la misma aserción con 10 casos correctos y uno fallido. La prueba nueva de actualización importa `test` directamente de Playwright y el repositorio exige el auxiliar común `./apoyo`. El paso que instala Chromium y el que corre `scripts/verify.mjs` quedaron omitidos en esa ejecución.
2. **Prueba del navegador de Dot.** Ejecuté el archivo de la rama sin modificaciones en Chromium de Playwright. Falló en la [línea 124](https://github.com/marcosfeliz28/awesome-outbid/blob/00eb16a158fbb141468923a6792208288aeaa67b/tests/e2e/pwa-update-real.spec.ts#L124) en la primera ejecución y en las tres repeticiones. La evaluación del contador ocurre mientras la pestaña libre navega y pierde su contexto de JavaScript. El comando nunca alcanzó las comprobaciones siguientes de carrito y modal de pago. La prueba independiente sobre la aplicación real sí completó la comprobación de carrito. Para corregir el caso automatizado, corresponde usar el auxiliar común y sincronizar la recarga con el cambio de documento antes de leer el contador. El segundo sondeo que espera otra recarga merece la misma revisión.

## Capturas

Las imágenes de Inicio incluyen la página completa. La tabla indica el tamaño de la ventana usada para cada captura.

| Vista | Resolución | Claro | Oscuro |
| --- | --- | --- | --- |
| Inicio | 1440 × 900 | [PNG](inicio/inicio-1440-claro.png) | [PNG](inicio/inicio-1440-oscuro.png) |
| Inicio | 390 × 844 | [PNG](inicio/inicio-390-claro.png) | [PNG](inicio/inicio-390-oscuro.png) |
| Punto de venta | 1440 × 900 | [PNG](pos/pos-1440-claro.png) | [PNG](pos/pos-1440-oscuro.png) |
| Punto de venta | 390 × 844 | [PNG](pos/pos-390-claro.png) | [PNG](pos/pos-390-oscuro.png) |
| Carrito | 390 × 844 | [PNG](pos/carrito-390-claro.png) | [PNG](pos/carrito-390-oscuro.png) |

[Carrito de cinco artículos](pos/carrito-1366-cinco-articulos.png) · [Aviso de actualización en la pestaña libre](actualizacion/actualizacion-pestana-libre.png) · [Carrito después de la actualización](actualizacion/carrito-despues-de-actualizar-otra-pestana.png)

[Mediciones de Inicio](inicio/comprobacion-integrada.json) · [Mediciones de Punto de venta](pos/comprobacion-integrada.json) · [Mediciones de actualización](actualizacion/comprobacion-integrada.json)

[Comparación anterior con las dos láminas aprobadas](https://github.com/marcosfeliz28/awesome-outbid/blob/3c636604a087964d0cc58b20e26758ec0406a335/docs/validacion/capturas-dot-7bf3ef77/inicio-y-punto-de-venta/COMPARACION.md). Este candidato conserva las diez fotos de aquella integración. La aprobación visual de Marcos sigue pendiente.
