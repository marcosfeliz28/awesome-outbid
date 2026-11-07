# formas-pago-mes

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** OK

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** Total 1 465 804,50 = /dashboard/summary.revenue = suma de 356 facturas en /sales = Detalle+Por mayor. Efectivo 202 900, Transferencia 562 214,50, Tarjeta 326 990, Crédito+contraentrega 373 700: coinciden con los pagos tipo «venta» de /sales (rechazados cuentan como crédito). Devoluciones octubre = 0 (caso no probable con datos reales).

**Guía:** `/reportes/formas-pago-mes/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/formas-pago-mes/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
