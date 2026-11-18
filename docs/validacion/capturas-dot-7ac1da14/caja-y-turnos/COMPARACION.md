# Caja y turnos · revisión de la integración

Verifiqué `dot/caja-sobre-ventas-18nov` en `7ac1da1437d221410fe04e3ca491b472a8a8cfae` sobre la base `0ed250e501bb04c13156776973fb1c446906f9e7`. El recorrido se hizo en Edge 157.0.4341.60, con la API local y PostgreSQL descartable en una sesión de gerencia con datos ficticios. [Cambios sobre la base](https://github.com/marcosfeliz28/awesome-outbid/compare/0ed250e501bb04c13156776973fb1c446906f9e7...7ac1da1437d221410fe04e3ca491b472a8a8cfae)

Comparé la función `Cash`, el CSS de Caja y turnos y su prueba visual con `e34d2309f34e299c986aa2e40897eef0b74b84b3`. Coinciden en contenido. Frente a la base, el cambio web añade esa hoja de estilos, la clase de Caja y la presentación del historial. El recorrido vuelve a confirmar las mediciones de importes del candidato anterior. [Seguimiento anterior](https://github.com/marcosfeliz28/awesome-outbid/blob/97c56fe4173ee1cf2d30c7a7178e575883c6417b/docs/validacion/capturas-dot-4aaf5952/caja-y-turnos/COMPARACION.md)

## Capturas reales

| Pantalla | 1440 × 900 claro | 1440 × 900 oscuro | 390 × 844 claro | 390 × 844 oscuro |
| --- | --- | --- | --- | --- |
| Gerencia con caja abierta | [PNG](gerencia-abierta-1440-claro.png) | [PNG](gerencia-abierta-1440-oscuro.png) | [PNG](gerencia-abierta-390-claro.png) | [PNG](gerencia-abierta-390-oscuro.png) |
| Historial con importes largos | [PNG](historial-importes-1440-claro.png) | [PNG](historial-importes-1440-oscuro.png) | [PNG](historial-importes-390-claro.png) | [PNG](historial-importes-390-oscuro.png) |
| Historial desplazado hacia acciones | [PNG](historial-acciones-1440-claro.png) | [PNG](historial-acciones-1440-oscuro.png) | Acciones en la captura del historial | Acciones en la captura del historial |

## Importes y controles

| Importe ficticio de la fila cerrada | Texto mostrado |
| --- | --- |
| Efectivo esperado | `RD$ 123,456,789,012.34` |
| Efectivo contado | `RD$ 987,654,321,098.76` |
| Diferencia de efectivo | `RD$ 864,197,532,086.42` |
| Diferencia de tarjeta | `RD$ -100,000,000,000.00` |
| Diferencia de transferencia | `RD$ 200,000,000,000.00` |

- En ambos temas, a 1440 px los cinco importes quedaron completos en una línea, incluidos moneda, signo y centavos. La tabla tuvo **152 px de desplazamiento horizontal interno** y 0 px de desbordamiento de página. En el extremo derecho se ven completos Cuadre, Venta diaria y Por forma de pago. La columna Equipo queda angosta con estos importes y divide palabras. [Acciones en escritorio](historial-acciones-1440-oscuro.png) · [Inicio de la tabla](historial-importes-1440-oscuro.png)
- A 390 px se mantuvieron juntos los dígitos y centavos, incluido el signo negativo. `RD$` quedó en la línea anterior. La página y la tabla tuvieron **0 px de desplazamiento horizontal** y los botones aparecieron apilados. La tabla empieza en y=2.298,98 px, debajo del primer cuadro. [Historial móvil](historial-importes-390-oscuro.png)
- Se comprobaron 60 centros de botones entre las cuatro vistas. Todos quedaron alcanzables al desplazarse. A 390 px el menor botón del historial midió 264 × 45 px. En ambas anchuras se abrieron y cancelaron Movimiento y Cerrar y arquear, y se abrió la vista previa de Cuadre y se cerró con Listo. Los servicios y el navegador quedaron cerrados. Se registraron 0 operaciones enviadas y 0 errores de página.

La guía identifica el concepto de Caja y turnos como `norexos-caja-turnos-higgsfield-01.png`. Queda pendiente cotejar el PNG aprobado cuando se recupere el archivo verificable. [Referencia en la entrega](https://github.com/marcosfeliz28/awesome-outbid/blob/7ac1da1437d221410fe04e3ca491b472a8a8cfae/docs/diseno/caja-turnos/ENTREGA_17NOV.md)

## CI

Para `7ac1da14`, `windows-installer`, `render-images` y el paso `pnpm check` pasaron. `verify` terminó rojo en `node scripts/verify.mjs`. GitHub muestra código de salida 1 en la vista pública. Ese fallo corresponde al primer intento. GitHub inició a las 04:43 UTC un [segundo intento](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44234873053/attempts/2) de `verify` para el mismo SHA. El segundo intento de `verify` terminó correctamente. Instalador e imágenes también están verdes para el mismo SHA. La causa específica del primer fallo queda sin confirmar. El 18 de noviembre comprobé que `7ac1da14` es ancestro de `nexora-cloud` `a85627a6` y que los árboles de `apps/web/src`, `apps/api` y `packages/ui` coinciden. La rama base añadió fotos y documentos. [Segundo verify](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44234873053/job/134582942048) Los tres trabajos de `e34d2309` habían pasado. [CI del candidato](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44234873053) · [CI de e34d2309](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44231045958)

## Integridad de los PNG

Capturados el `2026-11-18T04:23:10.089Z`.

| Captura | Dimensiones | SHA-256 |
| --- | --- | --- |
| [gerencia-abierta-1440-claro.png](gerencia-abierta-1440-claro.png) | 1440 × 900 | `6029bad883e06b1d96e4b47fc81b428b8193a056e543f36e81d550af1d510ccf` |
| [historial-importes-1440-claro.png](historial-importes-1440-claro.png) | 1440 × 900 | `1a23e6597c00c4a41fe17a14757d53e100cfd0943c52b6649f0e776c9bb7cc3f` |
| [historial-acciones-1440-claro.png](historial-acciones-1440-claro.png) | 1440 × 900 | `6d5d2969ad0d3bdf62fda4f0473164807e38fac84286cf20396b4fc812b3c9c6` |
| [gerencia-abierta-1440-oscuro.png](gerencia-abierta-1440-oscuro.png) | 1440 × 900 | `800105050ee7bd6bc767edc1a8efbc6480857a1cab8ae12275ef72492f47c92f` |
| [historial-importes-1440-oscuro.png](historial-importes-1440-oscuro.png) | 1440 × 900 | `96877e0587eebe32b76c0814de4a96cb10b6197853cf6bae900cdcd8b0bfb3c2` |
| [historial-acciones-1440-oscuro.png](historial-acciones-1440-oscuro.png) | 1440 × 900 | `c7d7fa1df12c4e31cd3ddfc698fa20854402b3061eaf05e54fdef6115ebb3dce` |
| [gerencia-abierta-390-claro.png](gerencia-abierta-390-claro.png) | 390 × 844 | `b0149d9eaa4ae40bd73992a5f82dd13231215077068941283bd611f38d1abb7d` |
| [historial-importes-390-claro.png](historial-importes-390-claro.png) | 390 × 844 | `b5fdcbf804e44c7ce7f3c8d80e4dbd5724345a79b1c11243e3d23ceea97d1046` |
| [gerencia-abierta-390-oscuro.png](gerencia-abierta-390-oscuro.png) | 390 × 844 | `3c01ce322029ebe83bd1cd05abed689d48f72b918d6f66ac27c4021cfe528a5e` |
| [historial-importes-390-oscuro.png](historial-importes-390-oscuro.png) | 390 × 844 | `511681360c1a08aa5c9bec2531416472620c48657840d1c113b1e9691f32bd2a` |
