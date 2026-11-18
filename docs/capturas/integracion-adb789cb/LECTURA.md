# Escape, foco y cola sin conexión · adb789cb

Candidato `adb789cb43f950398d3ab6ecf4de0f29979eb3f1` de `dot/15areas-sobre-prod-18nov`, comparado con `e9a738bb`. Ejecutamos la aplicación en esta PC a 1440 y 390 px, en claro y oscuro y con datos ficticios. Punto de venta usó Edge con API y base descartable. La revisión de Mercancía y Compras se hizo con API simulada. La evidencia incluye 12 capturas y mediciones.

## Punto de venta y teclado

- **Corregido.** El primer Escape cierra el buscador y mantiene abierta Cuenta en 4/4 y el menú móvil en 2/2. El segundo Escape cierra la capa inferior y devuelve el foco a su botón en 6/6. En el candidato anterior, la primera pulsación cerraba las dos.
- **Pendiente.** Tras el primer Escape se pierde el foco en 6/6. El buscador directo sigue sin devolverlo en 4/4 y Cobrar en 8/8. El carrito conservó los tres artículos de prueba y su total. La revisión de navegación por teclado sigue abierta. [Comparación y seis capturas](navegacion/LECTURA.md)
- Cotejé la captura de escritorio contra la lámina aprobada de Punto de venta, PNG original 2688 × 1520 con SHA-256 `9555ca20584c15ec1fd61d461c3d348b19fcaf4952ea9bca8220539698b89dbc`. Coinciden la disposición con navegación lateral, catálogo y venta actual, y la posición del total y Cobrar con F12. La cuadrícula visible tiene dos columnas a 1440 px y la lámina muestra tres. El fondo, el volumen y los acabados metálicos difieren. La lámina es de escritorio y el recorrido móvil valida uso, foco y accesos.

## Mercancía y Compras

- En 4/4 combinaciones la cola simulada mostró «Pendiente · Entrada» y «Requiere revisión · Salida», con sus equivalentes en inglés. A 390 px el panel aparece después del formulario y requiere desplazamiento desde el inicio. El caso comprueba presentación de la cola con datos aislados. La sincronización real queda pendiente.
- En inglés la fecha de la cola conserva formato español. También siguen en español los motivos de salida y el nombre accesible «Cerrar» del editor de orden. [Seis capturas y mediciones](mercancia-compras/LECTURA.md)

## CI y fotos

El candidato pasó los tres controles de GitHub: `verify`, `windows-installer` y `render-images`. El control `verify` terminó a las 16:17:52 UTC, con `pnpm check` y `node scripts/verify.mjs` aprobados. Los fallos de foco descritos arriba siguen comprobados en el recorrido manual. En local pasaron 3/3 focales de Escape y etiquetas y comprobé las 25 citas de `App.tsx`. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44339189628)

`e9a738bb` terminó con instalador e imágenes verdes y `verify` falló en `node scripts/verify.mjs`; la anotación pública muestra código de salida 1. En la versión anterior se observaron dos diferencias con las expectativas de pruebas: Escape cerraba ambas capas y el rótulo de la cola esperaba «Pendiente · Entrada» con esa capitalización. El informe del CI público no permite atribuirle cada caso. [Verify anterior](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44332519806/job/134900465117)

La base `ee78690c` pasó los tres controles. Conserva 316 WebP. El candidato mantiene sus 314 WebP iguales a `e9a738bb` y al árbol de fotos de `2d87290b`. Para llegar a 316 faltan `asics-ak-negros.webp` y `nb-1906r-blanco-negro-amarillo.webp`. El árbol de API coincide con la base actual. [CI de la base](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44332633156) · [Comparación de fotos](https://github.com/marcosfeliz28/awesome-outbid/compare/adb789cb...ee78690c)

## Siguiente entrega de Dot

Devolver el foco a la capa que siga abierta, al botón del buscador o al campo desde el que se invocó el atajo y al botón Cobrar. Localizar la fecha de la cola, los motivos de salida y el nombre del cierre del editor de orden en inglés. Conservar las dos fotos adicionales de la base. Entregar rama, SHA, los tres controles y una demostración privada.

Los recorridos terminaron sin ventas, cobros, compras ni movimientos de inventario. Cerramos los navegadores y servicios de prueba y revisamos que sus puertos quedaran libres.
