# agotados-con-ventas
**Veredicto:** OK · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 69 filas. Ej.: BS Small Set de brochas · Tienda 0 · Casa 0 · 25 vendidas · última venta 2026-10-25.
2. **Recálculo independiente:** Tienda/Casa de las 69 filas coinciden con dias-inventario (0 diferencias); todas con Tienda ≤ 0. 3+ con Casa > 0 (Amave Liquid Foundation 03: Casa 20) → agotado en Tienda pero hay en Casa; la guía ya lo dice.
3. **Lógica / casos borde:** Coherente. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/agotados-con-ventas/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/agotados-con-ventas/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** —
