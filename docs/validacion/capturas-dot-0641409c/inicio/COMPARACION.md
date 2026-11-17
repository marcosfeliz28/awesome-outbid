# Inicio de Norexos · revisión con los tres controles aprobados

Candidato de Dot `dot/norexos-marca-canonica-17nov`, commit `0641409cc82f81df01337a72cded4061f1f560a5`. Lo ejecuté en Edge 157 sobre Windows con API y PostgreSQL locales y datos ficticios. Marcos aprobó el concepto visual de Inicio y confirmó la marca Norexos.

## Comprobaciones

- En escritorio y móvil, el lateral y el diálogo «Acerca de» mostraron Norexos. En móvil, el menú «Punto de venta» se encontró una sola vez y llevó a la pantalla correcta. Los accesos rápidos se anunciaron como «Ir a Punto de venta», «Ir a Inventario» e «Ir a Reportes».
- El saludo apareció en ambas resoluciones. Comprobé el acceso con Enter a Reportes, la acción del panel de bienvenida, los temas, acentos, cambio de idioma y movimiento reducido. El navegador no registró errores JavaScript.
- Los cuatro importes quedaron en una sola línea dentro de sus tarjetas. A 390 × 844, el encabezado del panel de accesos se ve a partir de y=681 y el primer botón termina en y=890. A 1440 × 900, el panel empieza en y=807 y el primer botón en y=913. La primera pantalla todavía puede compactarse para mostrar los accesos completos.
- GitHub aprobó `verify`, `windows-installer` y `render-images` en este commit. El control general registró 1088 pruebas unitarias aprobadas, 3 omitidas, 656 de integración y 155 de navegador aprobadas. [Ejecución de GitHub](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44175161578)

El [cotejo anterior con la lámina aprobada de Higgsfield](https://github.com/marcosfeliz28/awesome-outbid/blob/7d10ffbcaddbb676d1967b2960d2abc5d6868d3f/docs/validacion/capturas-dot-eb20caab/inicio/COMPARACION.md) documenta la diferencia de altura del primer encuadre. Las seis capturas de abajo son de esta revisión con el nombre definitivo. Cerré los procesos propios.

## Capturas reales

| Ventana | Claro | Oscuro | Acerca de |
| --- | --- | --- | --- |
| 1440 × 900 | [Página completa](inicio-1440-claro.png) | [Página completa](inicio-1440-oscuro.png) | [Diálogo](acerca-de-1440.png) |
| 390 × 844 | [Página completa](inicio-390-claro.png) | [Página completa](inicio-390-oscuro.png) | [Diálogo](acerca-de-390.png) |

[Mediciones y huellas SHA-256](comprobacion-integrada.json)
