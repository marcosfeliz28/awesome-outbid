# utilidad-bruta-por-mes

Rango 2026-10-01..2026-10-31, leído 2-nov ~12:20 hora RD, solo GET.

1. **Qué dice:** Mes · Facturas · Venta · Costo · Utilidad · Margen %. 2026-10: 356 facturas, 1,465,804.50 / 777,664.04 / 688,140.46 / 46.9 %.
2. **Recálculo independiente:** Venta y costo = dashboard revenue y costTotal. Utilidad ≠ dashboard grossProfit (464,543.21). 1–15 oct: dashboard 357,124.50 vs reporte 357,124.50 (igual); utilidad 71,014.45 vs 125,491.08.
3. **Lógica:** fórmula (precio − costo)/precio sin restar ITBIS; ventas netas de devoluciones (opción A, mismo período de la venta); solo facturas `completed`; hora RD.
4. **Entendible 18–70:** guía no disponible (`/reportes/utilidad-bruta-por-mes/guia` da 404 hasta el despliegue de las 9:00); pendiente de revisar.
5. **PDF/Excel:** `/reports/utilidad-bruta-por-mes/export` da 404 (aún no desplegado); pendiente.
6. **Veredicto:** HALLAZGO margen-01 (Alto, dinero).
