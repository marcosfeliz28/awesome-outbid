# descuentos-cajera

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** HALLAZGO Medio (dinero-02)

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** Descuento total 291 115,50 y 230 facturas = suma de discountTotal en /sales; por cajera coincide (Lizbeth 140/110 770; Edgar 17/59 690…). Ventas netas suman 1 465 804,50. Problema: el % divide entre la venta YA con descuento: Edgar 38,6 % (real sobre precio de lista 27,9 %), claude 43,4 % (30,3 %).

**Guía:** `/reportes/descuentos-cajera/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/descuentos-cajera/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
