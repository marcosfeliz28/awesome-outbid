# formas-pago-categoria

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** OK

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** Suma de categorías por forma = fila de formas-pago-mes (mismos 4 montos, total 1 465 804,50).

**Guía:** `/reportes/formas-pago-categoria/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/formas-pago-categoria/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
