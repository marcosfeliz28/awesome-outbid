# Caja y turnos · verificación de la aplicación

Verifiqué `dot/caja-turnos-integrado-18nov` en `0dda9c31c64036a0676f0347973f2554def2c8b7`. Abrí Caja (`/#cash`) en Microsoft Edge 157.0.4341.60 con la API local y PostgreSQL descartable. Usé la semilla de demostración del proyecto y preparé dos turnos abiertos y tres históricos antes del recorrido. Las 14 capturas conservan los PNG originales con su dimensión y SHA-256 comprobados. [Mediciones y hashes](comprobacion-integrada.json)

## Capturas

| Estado | 1440×900 claro | 1440×900 oscuro | 390×844 claro | 390×844 oscuro |
| --- | --- | --- | --- | --- |
| Gerencia con turno abierto | [PNG](gerencia-abierta-1440-claro.png) | [PNG](gerencia-abierta-1440-oscuro.png) | [PNG](gerencia-abierta-390-claro.png) | [PNG](gerencia-abierta-390-oscuro.png) |
| Cajera con turno abierto | [PNG](cajera-abierta-1440-claro.png) | [PNG](cajera-abierta-1440-oscuro.png) | [PNG](cajera-abierta-390-claro.png) | [PNG](cajera-abierta-390-oscuro.png) |
| Administración sin turno propio abierto | [PNG](administracion-cerrada-1440-claro.png) | [PNG](administracion-cerrada-1440-oscuro.png) | [PNG](administracion-cerrada-390-claro.png) | [PNG](administracion-cerrada-390-oscuro.png) |
| Acciones del historial | | | [PNG](historial-caja-390-claro.png) | [PNG](historial-caja-390-oscuro.png) |

## Controles comprobados

- **Gerencia con turno abierto.** Aparecieron el efectivo esperado y sus cuatro indicadores. «Movimiento» y «Cerrar y arquear» abrieron sus diálogos y se cancelaron en ambos tamaños.
- **Cajera con turno abierto.** Apareció el aviso de arqueo ciego en la vista normal. Las dos filas del historial mostraron «—» en Efectivo esperado y Diferencias por método. «Movimiento» y «Cerrar y arquear» abrieron sus diálogos y se cancelaron.
- **Administración sin turno propio abierto.** «Abrir caja» mostró el formulario de fondo inicial, la API respondió `200` a la sugerencia de fondo y se canceló el formulario. El historial de la sucursal conservó las filas de otros turnos.
- **Cuadre del historial.** En los tres perfiles y ambos tamaños se abrió la vista previa de una caja cerrada, con respuesta `200`. «Listo» la cerró sin imprimir. En todo el recorrido se observaron 0 errores JavaScript y 0 solicitudes operativas de caja, venta o roles. Al terminar quedaron cerrados el navegador, la API, la aplicación web y PostgreSQL.

## Mediciones y pendientes

- **Acciones.** En 12 combinaciones de ancho, tema y estado se midieron 140 botones del historial. Todos quedaron contenidos en su celda, apilados y alcanzables al pulsar su centro tras desplazarse. En móvil midieron como mínimo 264 × 45 px. El menor tamaño de escritorio fue 145,23 × 45 px. Tanto el documento como el panel principal tuvieron 0 px de desbordamiento horizontal. [Acercamiento móvil](historial-caja-390-claro.png) · [Mediciones](comprobacion-integrada.json)
- **Acceso al historial.** El resumen de gerencia entra en el primer cuadro de escritorio (y 286,80–597,48). En 390 × 844 mide y 354,38–1129,58 y requiere desplazamiento para ver todos los indicadores. La tabla comienza en y 2296,81 en gerencia, 1586,08 px en cajera y 2050,67 px en administración a 390 px. El historial está debajo de los bloques operativos. [Mediciones](comprobacion-integrada.json)
- **Concepto.** La captura confirma superficies con relieve, bordes dorados y tratamiento verde en los temas probados. El cotejo visual exacto queda pendiente de recuperar la lámina aprobada `norexos-caja-turnos-higgsfield-01.png`. [Entrega de diseño](https://github.com/marcosfeliz28/awesome-outbid/blob/0dda9c31c64036a0676f0347973f2554def2c8b7/docs/diseno/caja-turnos/ENTREGA_17NOV.md)
- **CI de la rama de Dot.** El push `44221344146` de `0dda9c31` terminó con `verify`, `render-images` y `windows-installer` en verde. [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44221344146)
