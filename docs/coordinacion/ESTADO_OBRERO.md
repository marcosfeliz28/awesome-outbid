
## Revisión del desglose del mes a 390 px (Norexos 8, 30-oct, base de pruebas local, build de nexora-cloud 1e25909)
Capturas: `docs/coordinacion/capturas-desglose/` (1 mayo tras «Ver detalle del mes»; 3 mes en curso; 4 top 10 por monto).
- OK: tocar un mes del panel anual → `#month-report?from=2026-05-01&to=2026-05-31`, abre el desglose (no Mercancía). Sin desborde horizontal de la página.
- OK: «Mes anterior» mayo→abril (01–30), «Mes siguiente» vuelve; en octubre (mes en curso, 01–30) «Mes siguiente» queda apagado. Abril de la base de pruebas no tiene ventas (todo en 0, «Sin pagos en estas fechas»): es la base, no un fallo.
- OK: «Top 10 por categoría» aparece con selector, «Por unidades»/«Por monto» y 10 filas; «Cobros por banco» aparece bajo el gráfico de formas de pago. Las filas «Banco A/B xxxxxx» son de mis pruebas de integración en esa base, no del seed.
- **DEFECTO a 390 px (mío, paso 3):** la cabecera del panel «Top 10 por categoría» (título + selector + 2 botones) no baja de línea: el selector queda cortado a la izquierda y la tabla se sale del panel (hay que desplazarla). Arreglo propuesto: `flex-wrap: wrap` en esa cabecera (o poner el selector y los botones en su propia fila) y `table-scroll` en el contenedor; ~3 líneas de CSS/JSX en `MonthReport.tsx`. No lo apliqué porque la orden era solo notas.
- Aviso menor, ya existente: la barra morada «Mercancía» queda fija encima del contenido al pie de la pantalla en la captura de página completa; es del menú móvil, no del desglose.
- «Formas de pago» con muchas filas «Transferencias por verificar · <banco>» hace larga la lista a 390 px si hay muchos bancos; con los bancos reales (pocos) no debería ser problema.
