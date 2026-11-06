# margen-por-producto

Rango 2026-10-01..2026-10-31, leído 2-nov ~12:20 hora RD, solo GET.

1. **Qué dice:** Producto · Unidades · Venta · Costo · Utilidad · Margen %. 234 filas. Suma Venta 1,465,804.50 / Costo 777,664.04 / Utilidad 688,140.46 / 1,036 uds.
2. **Recálculo independiente:** Coincide con categoría, empresa, marca, cajera y mes (misma suma exacta) y con dashboard revenue y costTotal. 1 producto con costo 0 (curso) y 2 Maybelline Fit Me vendidos bajo costo (margen −14.3 % y −33.3 %).
3. **Lógica:** fórmula (precio − costo)/precio sin restar ITBIS; ventas netas de devoluciones (opción A, mismo período de la venta); solo facturas `completed`; hora RD.
4. **Entendible 18–70:** guía no disponible (`/reportes/margen-por-producto/guia` da 404 hasta el despliegue de las 9:00); pendiente de revisar.
5. **PDF/Excel:** `/reports/margen-por-producto/export` da 404 (aún no desplegado); pendiente.
6. **Veredicto:** HALLAZGO margen-02 (curso sin costo).
