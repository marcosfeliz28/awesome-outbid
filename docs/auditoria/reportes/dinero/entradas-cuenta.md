# entradas-cuenta

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** HALLAZGO Medio (dinero-04)

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** Total 1 247 754,50 contra 1 092 104,50 de formas-pago-mes (efectivo+transf.+tarjeta): la diferencia, 155 650, son exactamente los abonos (40 pagos: 82 950 + 64 200 + 8 500). Es correcto por diseño, pero ni título ni nota lo dicen y parece una discrepancia.

**Guía:** `/reportes/entradas-cuenta/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/entradas-cuenta/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
