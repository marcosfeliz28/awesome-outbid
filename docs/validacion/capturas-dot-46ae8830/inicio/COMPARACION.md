# Comprobación de los importes de Inicio

Probé `46ae88300414f18285fa81818a547b6cd546bc53` de `dot/inicio-kpi-responsive-17nov` en Edge el 17 de noviembre
de 2026. El recorrido terminó a las 20:15 UTC. La aplicación usó su API y PostgreSQL locales con datos
ficticios. [Ajuste de Dot](https://github.com/marcosfeliz28/awesome-outbid/commit/46ae88300414f18285fa81818a547b6cd546bc53).

## Lo comprobado

En `1d0d0dcd`, «Ventas del período» y «Ganancia bruta» partían el último dígito en Oscuro a 1440 px.
En `46ae8830`, medí los cuatro indicadores en cada captura. Los 16 valores quedaron completos en una
línea, dentro de sus tarjetas, a 1440 y 390 px en claro y oscuro.
[Captura del problema](https://github.com/marcosfeliz28/awesome-outbid/blob/7cadda5b985f563af4c64425f24a3eaacbf2bcc0/docs/validacion/capturas-dot-1d0d0dcd/inicio/inicio-1440-oscuro.png),
[mediciones del ajuste](comprobacion-integrada.json).

El acceso a Reportes siguió funcionando con Enter en ambos tamaños. En escritorio, el botón subió
3 px al pasar el puntero y bajó 1 px al pulsarlo. Con movimiento reducido, el desplazamiento y la
duración quedaron en cero. Oscuro, Negro y los acentos funcionaron. Las consultas de Inicio
respondieron HTTP 200 y el navegador no registró errores de JavaScript. Cerré los servicios de prueba
y comprobé que sus puertos quedaron libres.

## Pendiente de uso en móvil

En la ventana de 390 × 844 px, los cuatro indicadores comienzan a 1046 px y «Accesos rápidos» a
2309 px. El panel empezaba a 2116 px en la versión anterior. Apilar las tarjetas deja las cifras
legibles y coloca los accesos 193 px más abajo. [Captura móvil](inicio-390-oscuro.png),
[mediciones anteriores](https://github.com/marcosfeliz28/awesome-outbid/blob/7cadda5b985f563af4c64425f24a3eaacbf2bcc0/docs/validacion/capturas-dot-1d0d0dcd/inicio/comprobacion-integrada.json).

## Cuatro capturas del commit

| Ventana | Claro | Oscuro | Tamaño de cada PNG |
| --- | --- | --- | --- |
| 1440 × 900 | [Captura](inicio-1440-claro.png) | [Captura](inicio-1440-oscuro.png) | 1440 × 4239 |
| 390 × 844 | [Captura](inicio-390-claro.png) | [Captura](inicio-390-oscuro.png) | 390 × 8695 |

A las 20:17 UTC, `verify` estaba en curso, `windows-installer` aprobado y `render-images` aprobado.
[Controles del commit](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44164527303).

Queda pendiente cotejar la pantalla con el archivo original de la segunda lámina de Higgsfield aprobada
por Marcos.
