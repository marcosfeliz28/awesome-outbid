# traspasos
**Veredicto:** OK · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 64 filas. Ej.: 2026-11-01 12:05 · 1977 Flawless Stay Shimmer Veil Champagne Kiss · 18 · Casa → Tienda · claude.
2. **Recálculo independiente:** Código revisado (StockTransfer + líneas, solo lectura). Existencia Tienda/Casa del resto de reportes es coherente entre sí. No cuadré uds netas Casa→Tienda con movimientos: NO COMPROBADO.
3. **Lógica / casos borde:** Motivo muestra texto largo y «-» en los motivos automáticos; Bajo, sin cambio. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/traspasos/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/traspasos/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** —
