# dias-inventario
**Veredicto:** HALLAZGO Bajo · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 236 filas. Ej.: Chaleco con Brasier XS · Tienda 0 · Casa 0 · vendidas 1 · venta diaria 0.03 · 0 días.
2. **Recálculo independiente:** Tienda/Casa de las 236 filas coinciden 100 % con /reports/inventory-value (0 diferencias). Días = 34 (1-oct a 3-nov).
3. **Lógica / casos borde:** Solo lista productos vendidos en el período (236 de 967); la guía no lo decía. Texto añadido. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/dias-inventario/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/dias-inventario/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** inv-03
