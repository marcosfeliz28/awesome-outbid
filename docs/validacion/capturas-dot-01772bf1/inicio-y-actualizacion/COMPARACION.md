# Norexos · acabado de Inicio y actualización con carrito

Probé `01772bf1d20a38f3cd9e5f2d26c0c1e3bc2ca102` de `dot/inicio-acabado-premium-18nov` en Edge 157 sobre Windows. Usé una API y PostgreSQL locales con registros ficticios. Compilé el sitio y aprobé 14/14 pruebas focales de Inicio.

## Hallazgo que bloquea la actualización

Pasé en el mismo origen de la compilación `5cadaa81` a `01772bf1`. Sus archivos principales de JavaScript, CSS y service worker eran distintos. Las dos compilaciones tienen el mismo código para la actualización y el borrador de carrito.

La pestaña libre cargó la versión nueva y Punto de venta mantuvo el documento anterior, un artículo y su total durante los 16 segundos observados después de activarse el service worker. Al quitar el único artículo con el botón de la fila, Punto de venta se recargó, cargó los recursos de la versión nueva y **volvió a mostrar el artículo quitado y su total**. Ocurrió en las dos ejecuciones en las que añadí el producto con clics de catálogo. En la segunda quedó fotografiado el aviso «Se recuperó tu venta en curso (1 artículo)». Cero solicitudes de venta y cero errores JavaScript. El indicador siguió mostrando «Caja abierta». Quedan fuera la identidad persistente del turno y los cobros sin conexión.

El código ofrece una explicación que Dot puede confirmar con una regresión sobre la aplicación completa. Vaciar el carrito llama a `reloadIfFree()` desde la suscripción del actualizador. La persistencia del borrador en el camino de quitar un artículo espera al menos 600 ms antes de borrar el registro. La recarga puede ocurrir antes de que se borre el borrador anterior. [Suscripción de actualización](https://github.com/marcosfeliz28/awesome-outbid/blob/01772bf1d20a38f3cd9e5f2d26c0c1e3bc2ca102/apps/web/src/pwaUpdate.ts#L218) · [Borrador de carrito](https://github.com/marcosfeliz28/awesome-outbid/blob/01772bf1d20a38f3cd9e5f2d26c0c1e3bc2ca102/apps/web/src/cartDraft.ts#L213)

[Inicio ofrece actualizar](actualizacion/actualizacion-en-inicio.png) · [Punto de venta conserva el carrito durante el cambio](actualizacion/carrito-conservado-version-anterior.png) · [El artículo reaparece tras quitarlo](actualizacion/pos-tras-quitar-ultimo-articulo.png) · [Mediciones y huellas](actualizacion/comprobacion-integrada.json)

## Acabado de Inicio

- La vista real se acerca a la segunda lámina de Higgsfield en el dorado consistente, el filo inferior de paneles, los medallones y el relieve. Mantiene los datos y el menú completo del producto, con menos brillo decorativo que la lámina. Verifiqué la huella SHA-256 de la lámina aprobada `159dc72e708a71cbeb505ba7c0bb12e34b7e38435e25af4d44c0e79fe3aa31dc`.
- Comprobé el dorado en los cuatro medallones visibles en claro y oscuro. El brillo queda fuera de la interacción. Al forzar alto contraste, desaparecieron sombras, filtro de iconos y brillo. Reportes abrió por teclado, funcionaron idioma y acento y se respetó movimiento reducido.
- A 390 px, Mercancía mostró un botón de 52 px con el gradiente nuevo. Accesos rápidos siguió a y=681, los cuatro importes quedaron en una línea y el desborde horizontal fue 0 px. La altura total observada cambió de 8714 a 8758 px en móvil. Desde Productos favoritos, los encabezados medidos quedaron 45 px más abajo. A 1440 px las posiciones comparadas coincidieron. La aprobación visual de Marcos sigue pendiente.

| Ventana | Claro | Oscuro |
| --- | --- | --- |
| 1440 × 900 | [PNG](inicio/inicio-1440-claro.png) | [PNG](inicio/inicio-1440-oscuro.png) |
| 390 × 844 | [PNG](inicio/inicio-390-claro.png) | [PNG](inicio/inicio-390-oscuro.png) |

[Mediciones de Inicio](inicio/comprobacion-integrada.json) · [Capturas de la revisión anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/1791fadf1ecc0ae7335febdfb2e772c4d75046af/docs/validacion/capturas-dot-00eb16a1/inicio-pos-y-actualizacion/COMPARACION.md)

## Estado de GitHub

- En Inicio `01772bf1`, instalador e imágenes pasaron y `verify` terminó en rojo en `scripts/verify.mjs`. El resumen público muestra el código de salida. En esta PC el caso de Chromium de ese commit reproduce el fallo de evaluación durante la navegación en su línea 124. [Controles de Inicio](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44207913931)
- En la rama de pruebas `8ef8ff15`, la espera de navegación corrigió el fallo local. Pasaron 32 pruebas focales y cinco repeticiones en Chromium. Los tres controles del evento push pasaron. En la ejecución del evento pull_request, `verify` falló sin publicar la aserción. Esa revisión cambia el caso automatizado. La aplicación y el almacenamiento del carrito son los mismos. [Ejecución de push](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44208241268) · [Ejecución de pull request](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44208294307)

Cerré los navegadores, la API, PostgreSQL y los servidores de prueba.
