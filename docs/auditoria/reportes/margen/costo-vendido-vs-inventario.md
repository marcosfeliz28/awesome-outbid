# costo-vendido-vs-inventario

Rango 2026-10-01..2026-10-31, leído 2-nov ~12:20 hora RD, solo GET.

1. **Qué dice:** Costo vendido · Valor inventario · Días · Costo/día · Días de cobertura · Inventario/costo. 777,664.04 · 4,459,832.20 · 31 · 25,085.94 · 178 · 5.73.
2. **Recálculo independiente:** Valor del inventario = suma de Valor en /reports/inventory-value (4,459,832.20, 967 filas): exacto. Costo vendido = dashboard costTotal.
3. **Lógica:** fórmula (precio − costo)/precio sin restar ITBIS; ventas netas de devoluciones (opción A, mismo período de la venta); solo facturas `completed`; hora RD.
4. **Entendible 18–70:** guía no disponible (`/reportes/costo-vendido-vs-inventario/guia` da 404 hasta el despliegue de las 9:00); pendiente de revisar.
5. **PDF/Excel:** `/reports/costo-vendido-vs-inventario/export` da 404 (aún no desplegado); pendiente.
6. **Veredicto:** HALLAZGO margen-04 (merma).
