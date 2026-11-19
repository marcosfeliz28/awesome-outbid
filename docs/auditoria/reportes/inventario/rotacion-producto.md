# rotacion-producto
**Veredicto:** HALLAZGO Medio · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 967 filas (1-oct a 2-nov). Ej.: Amave Compact Powder 05 · vendidas 67 · inicial 0 · final 259 · promedio 129.5 · rotación 0.52.
2. **Recálculo independiente:** Σ Stock final = 8,610 uds = Σ unidades de valor-inventario-almacen = Tienda 3,664 + Casa 4,946 de /reports/inventory-value. Σ Stock inicial = 0 en las 967 filas.
3. **Lógica / casos borde:** Stock inicial sale 0 en TODOS porque toda la mercancía entró por movimientos dentro del período (puesta en marcha en octubre): el promedio es la mitad de lo actual y la rotación sale inflada (ej. Liquid Foundation 05: 52 vendidas, final 17 → 6.12). Guía aclarada. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/rotacion-producto/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/rotacion-producto/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** inv-01
