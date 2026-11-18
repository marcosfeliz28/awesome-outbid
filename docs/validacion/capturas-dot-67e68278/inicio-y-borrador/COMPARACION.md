# Norexos · carrito vacío tras actualización, con Inicio y fotos

Validé `67e682788ecb046f355a943b61eca8bbe391352b` de `dot/pwa-draft-flush-18nov` en Edge y Chromium sobre Windows, con API local y PostgreSQL descartable. Pasaron 53 pruebas focales y las nueve ejecuciones de Chromium. Estas últimas repiten tres casos, incluido eliminar el último artículo con el borrador persistido y conservar una revisión más nueva de otra pestaña.

## Resultado en Punto de venta real

- **Antes del arreglo.** En `92d131f8`, quitar el último artículo durante una actualización provocaba que el artículo y el total reaparecieran después de recargar. [Evidencia del fallo](https://github.com/marcosfeliz28/awesome-outbid/blob/fa6ae3cb44c037383be2146e7cac99a5b5ac8b49/docs/validacion/capturas-dot-92d131f8/inicio-y-actualizacion/COMPARACION.md).
- **Con el arreglo ya cargado.** Compilé el mismo `67e68278` dos veces, en modo normal y en un modo local de prueba. Comprobé que los JavaScript principales y los service workers tenían archivos distintos. La pestaña libre se actualizó. La ocupada conservó el artículo y el total durante 16 segundos. Al quitar el último artículo en Punto de venta, la pestaña cargó la segunda compilación y quedó en cero artículos. La caja siguió mostrando «Caja abierta».
- **Primera actualización desde el código anterior.** Con `92d131f8` cargado y el carrito vacío en las dos pestañas, seleccioné «Actualizar ahora» para pasar a `67e68278`. Las dos pestañas abrieron la compilación nueva. Punto de venta seguía indicando caja abierta y permitió agregar un artículo ficticio. La protección empieza cuando se carga el código nuevo. En una corrida separada del mismo cambio, inicié la actualización con un artículo en la pestaña antigua. Cuando lo quité, la pestaña recargó y restauró el artículo y su total. Para la primera actualización desde esa versión, la comprobación favorable requiere que todas las pestañas estén libres antes de activar el cambio.
- Cero solicitudes de venta y cero errores JavaScript. Cerré las pestañas, navegadores, procesos y bases de prueba. El caso de cobro real sin conexión y la identidad persistente del turno siguen sin comprobarse.

| Comprobación | Evidencia |
| --- | --- |
| Carrito activo con la corrección cargada | [Aviso](actualizacion/actualizacion-en-inicio.png) · [Artículo conservado mientras la otra pestaña cambia](actualizacion/carrito-conservado-version-anterior.png) · [Carrito vacío tras quitar el artículo y recargar](actualizacion/pos-tras-quitar-ultimo-articulo.png) · [Mediciones](actualizacion/comprobacion-integrada.json) |
| Primera actualización con el carrito vacío | [Aviso antes del cambio](primera-actualizacion/antes-de-actualizar.png) · [Punto de venta en la versión nueva](primera-actualizacion/punto-de-venta-en-version-nueva.png) · [Artículo agregado después del cambio](primera-actualizacion/carrito-de-prueba-en-version-nueva.png) · [Mediciones](primera-actualizacion/comprobacion-integrada.json) |

| Primera actualización con la pestaña antigua ocupada | [Aviso](pestana-antigua/actualizacion-en-inicio.png) · [Carrito conservado](pestana-antigua/carrito-conservado-version-anterior.png) · [Artículo restaurado tras quitarlo](pestana-antigua/pos-tras-quitar-ultimo-articulo.png) · [Mediciones](pestana-antigua/comprobacion-integrada.json) |

## Inicio y fotos

Confirmé los cuatro medallones dorados, el acabado de bordes en claro y oscuro, alto contraste, movimiento reducido, idioma, acento y acceso a Reportes por teclado. En móvil no hubo desborde horizontal. El acabado corresponde al cotejo con la segunda lámina aprobada de Higgsfield. Verifiqué que la carpeta de fotos de productos coincide con `bb379731` y que siguen presentes las 38 imágenes adicionales. [Cotejo visual anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/c6581f61c08f67f68182276297a71ab778e4192e/docs/validacion/capturas-dot-01772bf1/inicio-y-actualizacion/COMPARACION.md#acabado-de-inicio)

| Ventana | Claro | Oscuro |
| --- | --- | --- |
| 1440 × 900 | [PNG](inicio/inicio-1440-claro.png) | [PNG](inicio/inicio-1440-oscuro.png) |
| 390 × 844 | [PNG](inicio/inicio-390-claro.png) | [PNG](inicio/inicio-390-oscuro.png) |

[Mediciones de Inicio](inicio/comprobacion-integrada.json)

Instalador e imágenes pasaron. `verify` seguía en curso al guardar el informe. [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44221333410)
