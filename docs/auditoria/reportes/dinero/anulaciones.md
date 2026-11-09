# anulaciones

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** OK con Bajo (dinero-05)

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** 25 anuladas / 151 287,80 = facturas voided en /sales (25, misma suma). Motivo es texto libre: el mismo motivo escrito distinto parte las filas.

**Guía:** `/reportes/anulaciones/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/anulaciones/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
