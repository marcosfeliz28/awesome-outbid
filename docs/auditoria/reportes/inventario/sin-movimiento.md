# sin-movimiento
**Veredicto:** HALLAZGO Bajo · rango 2026-10-01 a 2026-11-02, leído 2-nov ~08:20 RD (solo GET).

1. **Qué dice:** 0 filas.
2. **Recálculo independiente:** Recalculado a mano: el producto más antiguo del sistema tiene menos de 30 días y todo lo con existencia se vendió/creó en octubre, así que vacío es correcto.
3. **Lógica / casos borde:** Pantalla vacía sin explicación → una cajera puede pensar que falla. Texto añadido a la guía. Devolución: se restan las devueltas (`qty − returnedQty`). Zona horaria RD en fechas.
4. **Entendible 18–70:** la guía en producción (`/reportes/sin-movimiento/guia`) da 404 (API desplegada anterior al código); se leyó `guia.ts`. Mejorada donde dice «Guía aclarada».
5. **PDF/Excel:** NO COMPROBADO — `/reports/sin-movimiento/export` da 404 en producción (se despliega ~9:00 AM RD).
6. **Hallazgos:** inv-04
