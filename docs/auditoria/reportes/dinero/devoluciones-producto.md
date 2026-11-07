# devoluciones-producto

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** OK (sin datos)

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** Octubre sin devoluciones (0 filas), igual que returns en /sales. No se pudo comprobar la lógica con datos reales; la cubre tests/reportes-dinero-api.test.ts.

**Guía:** `/reportes/devoluciones-producto/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/devoluciones-producto/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
