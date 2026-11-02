# Avance A6 · Sincronía (2-nov)

- Fuentes cruzadas: `/dashboard/summary`, breakdown, year, los 43 `/reports/<name>`, profit/income-statement/by-seller/by-payment,
  informe formal, income-by-day y `reportes.py` (diario ×31 y mensual). Rangos: hoy, mes actual, mes anterior, año, ayer.
- Matriz: `sincronia/MATRIZ.md`. Hallazgos: `HALLAZGOS-sincronia.jsonl` (19: 6 Alto, 10 Medio, 3 Bajo).
- Ventas netas, ITBIS, descuentos, envíos, formas de pago, inventario y facturas **cuadran** en todas las fuentes y rangos; sin corrimiento UTC/RD.
- Contradicción principal: «ganancia bruta» 464,543.21 (sin ITBIS) vs 688,140.46 (regla de la dueña) y la tarjeta del panel con margen 46.95 % que no corresponde a su cifra (S-01, S-02). **No se tocó: requiere visto bueno de la dueña.**
- PDF mirados como imagen: 14 del exportador nuevo (generado local con filas reales; en producción aún 404), 14 del PDF viejo, formal y cierre diario.
- Corregido con prueba: S-04..S-15 (formal opción A, categorías, corte de créditos, nombres de caja; reportes.py devoluciones, etiquetas y fecha en español;
  exportador PDF: montos cortados, tablas anchas, hoja en blanco, columnas de dinero y gráficas; título del PDF viejo).
  S-04, S-05, S-06 y S-08 cambian cifras cuando haya devoluciones o créditos posteriores: **requieren visto bueno de la dueña antes de desplegar.**
- Pruebas: tests/reportes-export.test.ts (4 nuevas), tests/credito-api.test.ts «3z-sincronía» (roja con el código anterior), docs/coordinacion/claude-nube/test_reportes.py.
  Locales: unitarias 905 ok (11 fallan solo por permisos de initdb del entorno), integración credito/desglose/dinero 69/69, reportes-* 229/232 (3 de api.test.ts fallan igual sin estos cambios: dist sin compilar y orden de pruebas).
- seguridad-20: sin endpoints ni permisos nuevos; consulta de terminales filtrada por sucursal; sin datos de entrada nuevos; sin dependencias nuevas; sin secretos.

## Segunda vuelta (2-nov, «Procede arreglarlo»)

- S-01: el panel muestra Ganancia bruta = ventas con ITBIS − costo (octubre 688,140.46, 46.95 %), la misma de «Utilidad bruta por mes». El estado de resultados queda fiscal y dice «ventas sin ITBIS − costo» (464,543.21).
- S-02: «Utilidad por producto» con ventas con ITBIS; en cada fila Margen = Utilidad/Ventas; su total de ventas = panel.
- S-16: formas-pago-mes, descuentos-cajera y por-mayor-detalle restan la devolución en el mes de la venta (opción A). Guías corregidas (también la del informe anual, que decía lo contrario del código).
- S-17: ingresos por día se queda como flujo de dinero (sirve al cuadre de caja); el informe formal y la guía lo explican.
- S-18 corregido, S-19 aceptado, S-20 totales agregados. Abierto solo: encabezados y total del PDF viejo (Bajo).
- Prueba «3z-sincronía» ampliada (roja con el código anterior). Integración en base limpia: crédito, dinero-auditoría, reportes-dinero/margen, caja-ciega-margen y desglose 100/100.
