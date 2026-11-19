# bajo-minimo
**Veredicto:** HALLAZGO Medio · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 555 filas. Ej.: Adidas Campus Crema Size 7 · Tienda 0 · Casa 0 · Mínimo 5 · Faltan 5.
2. **Recálculo independiente:** 555 filas = las 555 de /reports/low-stock (mismos SKU, 0 diferencias). Tienda/Casa = inventory-value.
3. **Lógica / casos borde:** «Faltan» mira solo Tienda; productos con Casa 8–20 (Mota de Sarias, Amave Liquid Foundation 03) salen «Faltan 5/1» aunque hay en la Casa. Guía aclarada: pasar de Casa antes de comprar. Abierto (Bajo): lista incluye productos sin existencia ni ventas (tenis) — decisión de la dueña. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/bajo-minimo/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/bajo-minimo/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** inv-05
