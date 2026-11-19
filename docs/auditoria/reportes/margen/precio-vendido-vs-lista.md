# precio-vendido-vs-lista

Rango 2026-10-01..2026-10-31, leído 2-nov ~12:20 hora RD, solo GET.

1. **Qué dice:** Producto · SKU · Unidades · Precio promedio vendido · Precio de lista · Diferencia %. 234 filas; Isopure Zero Carb 4,121.67 vs 5,000 (−17.6 %).
2. **Recálculo independiente:** Compara contra el precio de lista de HOY: si el precio cambió en el mes, la diferencia sale falsa. Maybelline Fit Me 235: vendido 300 vs lista 800.
3. **Lógica:** fórmula (precio − costo)/precio sin restar ITBIS; ventas netas de devoluciones (opción A, mismo período de la venta); solo facturas `completed`; hora RD.
4. **Entendible 18–70:** guía no disponible (`/reportes/precio-vendido-vs-lista/guia` da 404 hasta el despliegue de las 9:00); pendiente de revisar.
5. **PDF/Excel:** `/reports/precio-vendido-vs-lista/export` da 404 (aún no desplegado); pendiente.
6. **Veredicto:** HALLAZGO margen-05 (lógica).
