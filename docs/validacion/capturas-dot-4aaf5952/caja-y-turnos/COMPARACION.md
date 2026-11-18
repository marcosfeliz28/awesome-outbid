# Caja y turnos · importes largos en el historial

Verifiqué `4aaf59529b79bf968a30151d84ce6d3c29346b61` de `dot/caja-turnos-live-18nov` contra `0dda9c31c64036a0676f0347973f2554def2c8b7`. Ejecuté ambos commits en Edge 157.0.4341.60 con la API local, la sesión de gerencia y dos bases PostgreSQL descartables con la misma semilla ficticia. La primera fila cerrada incluyó efectivo esperado, efectivo contado y diferencias de efectivo, tarjeta y transferencia con 12 dígitos enteros y dos decimales. Los PNG conservan sus dimensiones y SHA-256 comprobados. [Mediciones](mediciones.json)

## Capturas

| Tamaño y tema | `0dda9c31` | `4aaf5952` |
| --- | --- | --- |
| 1440 × 900 claro | [PNG](antes-1440-claro.png) | [PNG](despues-1440-claro.png) |
| 1440 × 900 oscuro | [PNG](antes-1440-oscuro.png) | [PNG](despues-1440-oscuro.png) |
| 390 × 844 claro | [PNG](antes-390-claro.png) | [PNG](despues-390-claro.png) |
| 390 × 844 oscuro | [PNG](antes-390-oscuro.png) | [PNG](despues-390-oscuro.png) |

## Resultado

- **Escritorio.** En `0dda9c31` los cinco importes ocupaban dos líneas de dígitos y tres contando `RD$`. Con `4aaf5952` cada importe ocupa **una sola línea con moneda, signo, dígitos y centavos**, también para el negativo de tarjeta. Se leen completos en claro y oscuro al recorrer la tabla. La regla nueva empieza en 769 px. [Antes](antes-1440-oscuro.png) · [Después](despues-1440-oscuro.png) · [CSS](https://github.com/marcosfeliz28/awesome-outbid/blob/4aaf59529b79bf968a30151d84ce6d3c29346b61/apps/web/src/fusion-caja-turnos.css#L385)
- **Móvil.** En ambos commits los cinco números mantienen juntos sus dígitos y centavos. `RD$` queda en la línea anterior. El negativo conserva el signo en la línea del número. [Antes](antes-390-oscuro.png) · [Después](despues-390-oscuro.png)
- **Desplazamiento.** La página y el panel principal tuvieron 0 px de desbordamiento horizontal en las cuatro vistas. En `4aaf5952`, la tabla de escritorio tuvo 152 px de recorrido horizontal interno y la de móvil 0 px. Los 60 centros de botones del historial que se comprobaron en el commit nuevo quedaron despejados y alcanzables tras desplazarse hasta ellos. Movimiento, Cerrar y arquear y la vista previa de Cuadre abrieron y cerraron. El recorrido registró 0 errores de página y 0 solicitudes operativas. Navegador y servicios de prueba quedaron cerrados. [Mediciones](mediciones.json)
- **Detalle visual.** Con el caso de 12 cifras, la columna Equipo de escritorio queda estrecha y divide palabras como «Terminal» y «gerencia». Los controles de la derecha se ven completos al desplazar horizontalmente la tabla. [Captura de escritorio](despues-1440-oscuro.png)

A las 03:25 UTC del 18 de noviembre, `windows-installer` y `render-images` habían pasado y `verify` seguía en ejecución para `4aaf5952`. [GitHub Actions](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44229736753)

## Seguimiento del 18 de noviembre

- **CI de `4aaf5952`.** `verify` terminó cancelado. `windows-installer` y `render-images` terminaron correctamente. [Ejecución 44229736753](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44229736753)
- **Regresión de `e34d2309`.** El único archivo cambiado es `tests/visual-caja-turnos-higgsfield.spec.ts`. La prueba mide las líneas de `98,765,432.17` directamente en el navegador. Pasaron **8 de 8 casos en 12,8 s** en Edge 157.0.4341.60, con API simulada, caja abierta de gerencia y caja cerrada, a 1440 × 1000 y 390 × 1000 en claro y oscuro. Ejecuté las aserciones del commit en una copia externa con la escritura de PNG desactivada. Cero solicitudes operativas y procesos de prueba cerrados. [Prueba en e34d2309](https://github.com/marcosfeliz28/awesome-outbid/blob/e34d2309f34e299c986aa2e40897eef0b74b84b3/tests/visual-caja-turnos-higgsfield.spec.ts#L156)
- **CI de `e34d2309`.** `verify`, `windows-installer` y `render-images` terminaron correctamente en el push de ese commit. [Ejecución 44231045958](https://github.com/marcosfeliz28/awesome-outbid/actions/runs/44231045958)
