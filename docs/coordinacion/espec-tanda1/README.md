# Primera tanda · orden y dependencias

Especificaciones levantadas sobre `origin/nexora-cloud` `511d223f0c0c512f54b900265b2c6c1e59d4c560`. Las siete primeras pueden construirse en el orden indicado por Norexos 1. Las piezas 8–10 tocan dinero o decisiones de precio y quedan en diseño hasta confirmación expresa de la dueña.

| Orden | Pieza                 | Construcción               | Depende de                                     | Comprobación principal                                |
| ----: | --------------------- | -------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
|     1 | DIS-01                | Autorizada                 | `QueryState` existente                         | carga/error/cero inequívocos                          |
|     2 | EST-03                | Autorizada                 | helper de monitoring saneado                   | menú y carrito sobreviven a error de página           |
|     3 | COM-08                | Autorizada                 | filas de créditos ya autorizadas               | búsqueda local sin nueva exposición API               |
|     4 | COM-03 margen visible | Autorizada, solo indicador | `margin` compartido y ajuste de umbral         | 14/15/16 % sin restar ITBIS                           |
|     5 | MOD-08                | Autorizada                 | bootstrap previo a React                       | sistema oscuro sin destello; preferencia manual vence |
|     6 | DIS-02                | Autorizada                 | guardia opcional de `Modal`                    | no perder pagos ni conteos al cerrar                  |
|     7 | EFI-01                | Autorizada                 | eventos de stock y mapa cerrado de claves      | postventa no recarga catálogo global                  |
|     8 | EST-02                | **Solo diseño**            | decisión de promociones por lote y combinación | paridad POS/offline/API al centavo                    |
|     9 | COM-04                | **Solo diseño**            | EST-02 para promociones por cantidad           | cantidad, stock, descuento, mayoreo e ITBIS           |
|    10 | COM-03 aviso          | **Solo diseño**            | pieza 4 y decisión aviso/PIN/bloqueo           | fórmula y mínimo 15 %                                 |

## Secuencia recomendada

Mantener 1–7 en el orden de la tabla para limitar conflictos. La pieza 4 crea el indicador reutilizable para la 10. Construir 8 antes de 9 evita duplicar otra vez la regla de promociones cuando la cantidad editable cruza 2x1/3x2. Construir 10 al final, después de que la dueña elija el nivel de bloqueo.

Cada implementación debe añadir la regresión descrita en su página, demostrar que falla contra esta base antes del cambio y pasa después, ejecutar las pruebas de texto enumeradas y finalizar con `pnpm check`. Ninguna especificación autoriza despliegue, mezcla, migración, cambio de precios ni acceso a datos reales.
