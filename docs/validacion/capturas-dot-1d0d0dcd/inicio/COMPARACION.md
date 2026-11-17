# Primera comprobación del rediseño de Inicio

Probé `1d0d0dcdfcbb1bf45cfd3164f8145d337a7419a4` de `dot/inicio-higgsfield-fase1-17nov` en la laptop
el 17 de noviembre de 2026. El recorrido con la API local terminó a las 20:00 UTC. La web se compiló
para ese SHA. La API usó una base temporal con datos ficticios y su código coincide con el de la
comprobación anterior. [Entrega de Dot](https://github.com/marcosfeliz28/awesome-outbid/blob/1d0d0dcdfcbb1bf45cfd3164f8145d337a7419a4/docs/diseno/higgsfield-fase1/ENTREGA_17NOV.md).

## Lo comprobado en la aplicación

- Resumen muestra el nuevo relieve de las tarjetas, la gráfica y el panel de accesos rápidos. Las
  ventanas de 1440 y 390 px midieron 0 px de desbordamiento horizontal.
- El acceso rápido «Reportes» abrió la pantalla correspondiente al pulsar Enter en los dos tamaños.
  Volví a Inicio y también abrí Reportes desde el botón del banner.
- Los controles de tema diferenciaron Oscuro de Negro en los dos tamaños. Probé los acentos
  Esmeralda y Zafiro y cambié Inicio de español a inglés y de vuelta a español.
- A 1440 px, «Reportes» subió 3 px y encendió el borde al pasar el puntero. Al pulsarlo bajó 1 px
  respecto del reposo. La transición duró 160 ms. Con movimiento reducido, el desplazamiento y la
  duración quedaron en cero. Estas mediciones corresponden a ese acceso rápido.
- Las consultas de Inicio respondieron HTTP 200. El navegador no registró errores de JavaScript.
  Al terminar, cerré el navegador, la API, PostgreSQL y los dos servidores web de prueba y comprobé
  que sus puertos quedaron libres.

Los 11 casos visuales de Dot pasaron en Edge con su API simulada. Usé un puerto local libre porque el
de su configuración estaba ocupado por otra sesión. Los casos abarcan los dos tamaños, claro y oscuro,
verde y azul, teclado, idioma, movimiento reducido y el tema Negro. [Mediciones de ambas comprobaciones](comprobacion-integrada.json).

## Hallazgos para la siguiente revisión

| Prioridad | Observación | Evidencia |
| --- | --- | --- |
| 1 | A 1440 × 900, en Oscuro con Esmeralda, «Ventas del período» y «Ganancia bruta» mandan el cero final de los centavos a una segunda línea. La regla del importe permite partirlo en cualquier posición. | [Captura](inicio-1440-oscuro.png), [regla de tamaño y ajuste](https://github.com/marcosfeliz28/awesome-outbid/blob/1d0d0dcdfcbb1bf45cfd3164f8145d337a7419a4/apps/web/src/fusion-higgsfield.css#L190) |
| 2 | En móvil, los cuatro indicadores principales comienzan a 1046 px y «Accesos rápidos» a 2116 px en una ventana de 844 px de alto. Ambos quedan fuera de la primera pantalla. | [Captura móvil](inicio-390-oscuro.png), [medición](comprobacion-integrada.json) |

## Capturas de la aplicación

| Ventana | Claro | Oscuro | Tamaño de cada PNG |
| --- | --- | --- | --- |
| 1440 × 900 | [Captura](inicio-1440-claro.png) | [Captura](inicio-1440-oscuro.png) | 1440 × 4301 |
| 390 × 844 | [Captura](inicio-390-claro.png) | [Captura](inicio-390-oscuro.png) | 390 × 8480 |

[Capturas de la versión anterior `1d62b760`](https://github.com/marcosfeliz28/awesome-outbid/blob/edb5eb4645c3a3b738ac6fb863719c3252e64eda/docs/validacion/capturas-dot-1d62b760/inicio/COMPARACION.md).

## Estado de GitHub y aceptación visual

A las 20:03 UTC, para el commit revisado.

| Control | Estado |
| --- | --- |
| `verify` | en curso |
| `windows-installer` | aprobado |
| `render-images` | aprobado |

[Controles del commit](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44163007730).

La entrega de Dot identifica la segunda lámina de Higgsfield en su Biblioteca. La comparación con el
archivo original de esa lámina y la aceptación visual de Marcos quedan pendientes.
