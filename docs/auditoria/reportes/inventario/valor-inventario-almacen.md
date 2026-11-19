# valor-inventario-almacen
**Veredicto:** OK · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 6 filas. Ej.: Fajas/Tienda 226 uds RD$ 323,300; Fajas/Casa 478 uds RD$ 688,680; Maquillaje/Tienda 2,269 uds RD$ 855,320.41.
2. **Recálculo independiente:** Σ valor = RD$ 4,459,832.20 = /dashboard/summary inventoryCost (4,459,832.20) y = Σ «Valor» de inventory-value. Σ uds 8,610 = Tienda 3,664 + Casa 4,946. inventoryRetail (11,067,295) no está en el reporte: no es error.
3. **Lógica / casos borde:** Sin diferencias de cifras. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/valor-inventario-almacen/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/valor-inventario-almacen/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** —
