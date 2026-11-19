# margen-por-categoria

Rango 2026-10-01..2026-10-31, leído 2-nov ~12:20 hora RD, solo GET.

1. **Qué dice:** Categoría · Unidades · Venta · Costo · Utilidad · Margen %. 5 filas: Suplementos 34.5 %, Maquillaje 61.6 %, Fajas 56.1 %, GV Cursos 100 %, Tenis 34.3 %.
2. **Recálculo independiente:** Suma = total del mes. GV Cursos 100 % porque el curso no tiene costo.
3. **Lógica:** fórmula (precio − costo)/precio sin restar ITBIS; ventas netas de devoluciones (opción A, mismo período de la venta); solo facturas `completed`; hora RD.
4. **Entendible 18–70:** guía no disponible (`/reportes/margen-por-categoria/guia` da 404 hasta el despliegue de las 9:00); pendiente de revisar.
5. **PDF/Excel:** `/reports/margen-por-categoria/export` da 404 (aún no desplegado); pendiente.
6. **Veredicto:** HALLAZGO margen-02.
