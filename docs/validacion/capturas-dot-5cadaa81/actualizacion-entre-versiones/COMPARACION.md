# Norexos · primera actualización con dos compilaciones

Compilé la web de `7bf3ef770f1ce474633e00421bfaefd19ad2345f` y `5cadaa81d9f440e8dadf31adc70f20df5e1c626c` por separado. Probé el paso de la primera versión a la segunda en Edge 157 sobre Windows, con dos pestañas de 1440 × 900, una API local y PostgreSQL descartable con datos ficticios.

1. Inicio y Punto de venta cargaron el archivo principal de la primera compilación. La caja de demostración estaba abierta, el carrito vacío y sin formulario de operación o cobro abierto.
2. El servidor aislado mantuvo el mismo origen y pasó a servir el resultado completo de la segunda compilación. El archivo del service worker y el JavaScript principal eran distintos. Pulsé «Actualizar ahora» en Inicio.
3. Se recargaron las dos pestañas y ambas cargaron el archivo principal de la segunda compilación. Punto de venta mostró «Caja abierta» y el carrito conservó su estado vacío. Agregué un artículo de demostración y el botón Cobrar volvió a estar disponible.
4. Hubo cero solicitudes de venta y cero errores de JavaScript. Cerré el navegador, la API, PostgreSQL y los dos servidores de vista previa.

Verifiqué el indicador visible de caja. Quedaron pendientes la identidad persistente del turno, la actualización entre compilaciones con una venta en curso y el reintento de un cobro sin conexión. La revisión anterior prueba el carrito ocupado con los mismos recursos web y dos revisiones del service worker. Git confirma que el código de aplicación de `00eb16a1` y `5cadaa81` es idéntico. [Capturas de Inicio y Punto de venta en claro y oscuro y prueba anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/1791fadf1ecc0ae7335febdfb2e772c4d75046af/docs/validacion/capturas-dot-00eb16a1/inicio-pos-y-actualizacion/COMPARACION.md)

## Controles del commit

- `windows-installer` y `render-images` aprobaron. `verify` pasó `pnpm check` y terminó en rojo en `node scripts/verify.mjs`. El resumen público muestra código de salida 1. [Resultado de GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44203635956/job/134463863428)
- En esta PC, `e2e-higiene.test.ts` pasó 11/11. Por separado, Chromium falló 3/3 en [pwa-update-real.spec.ts:124](https://github.com/marcosfeliz28/awesome-outbid/blob/5cadaa81d9f440e8dadf31adc70f20df5e1c626c/tests/e2e/pwa-update-real.spec.ts#L124) cuando el test consulta el contador durante la recarga. Falta confirmar cuál aserción falló en GitHub.

[Antes de actualizar](antes-de-actualizar.png) · [Punto de venta con la compilación nueva](punto-de-venta-en-version-nueva.png) · [Carrito de prueba en la versión nueva](carrito-de-prueba-en-version-nueva.png) · [Mediciones y SHA-256](comprobacion-integrada.json)
