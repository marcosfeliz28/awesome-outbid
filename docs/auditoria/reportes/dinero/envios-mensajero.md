# envios-mensajero

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** OK

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** 45 envíos / 15 799,93 = suma de courierFee en /sales (45 facturas). 0 pagados, 45 pendientes (courierPaidAt vacío).

**Guía:** `/reportes/envios-mensajero/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/envios-mensajero/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
