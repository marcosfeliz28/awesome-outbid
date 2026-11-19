# por-mayor-detalle

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** OK

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** 351 + 5 facturas = 356; 1 298 254,50 + 167 550 = 1 465 804,50 = dashboard. El campo wholesale no sale en /sales, por eso las 5 «por mayor» no se pudieron reconfirmar una a una.

**Guía:** `/reportes/por-mayor-detalle/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/por-mayor-detalle/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
