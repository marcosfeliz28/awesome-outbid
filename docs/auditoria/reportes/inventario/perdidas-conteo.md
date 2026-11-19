# perdidas-conteo
**Veredicto:** HALLAZGO Medio · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 2 filas (2026-10): Corrección de conteo 856 uds RD$ 572,187.28; Salida real 78 uds RD$ 91,321.42.
2. **Recálculo independiente:** Coincide con /dashboard/summary: countCorrections 572,187.28 e inventoryLoss 91,321.42 (0 diferencias). Código: INVENTORY_LOSS_SQL / COUNT_CORRECTION_SQL de inventory.ts.
3. **Lógica / casos borde:** El nombre «Pérdidas…» sugiere RD$ 663,508.70 perdidos, pero 86 % es corrección de conteo que NO baja la ganancia neta; y solo cuenta salidas (no sobrantes encontrados). Guía reescrita; título y cifras NO cambiados (dinero → visto bueno de la dueña si quiere renombrar). Solo lectura: no se propone tocar mercancía. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/perdidas-conteo/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/perdidas-conteo/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** inv-02, inv-06
