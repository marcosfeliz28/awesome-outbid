# ventas-margen-bajo

Rango 2026-10-01..2026-10-31, leído 2-nov ~12:20 hora RD, solo GET.

1. **Qué dice:** Factura · Fecha · Cajera · Total · Costo · Utilidad · Margen %. 6 facturas <15 %: FS-0000011 8.7 %, 091 10.7 %, 113 10 %, 144 10 %, 163 −3.5 % (pérdida), 166 14.3 %.
2. **Recálculo independiente:** Usa 15 % con la misma fórmula (sin restar ITBIS), solo informa, no bloquea. «Total» es la venta neta de devoluciones (con ITBIS), no dice que lo incluye.
3. **Lógica:** fórmula (precio − costo)/precio sin restar ITBIS; ventas netas de devoluciones (opción A, mismo período de la venta); solo facturas `completed`; hora RD.
4. **Entendible 18–70:** guía no disponible (`/reportes/ventas-margen-bajo/guia` da 404 hasta el despliegue de las 9:00); pendiente de revisar.
5. **PDF/Excel:** `/reports/ventas-margen-bajo/export` da 404 (aún no desplegado); pendiente.
6. **Veredicto:** HALLAZGO margen-03 (texto).
