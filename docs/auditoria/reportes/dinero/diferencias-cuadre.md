# diferencias-cuadre

Rango 1–31 oct 2026, leído 2-nov ~12:20 RD (solo GET).

**Veredicto:** HALLAZGO Medio (dinero-03)

**Recálculo (2 caminos: reporte vs /sales por día + /dashboard/summary):** 70 cajas; efectivo+tarjeta+transferencia = total en cada cajera y = descuadres (85 705,29). Pero «Diferencia total» mezcla faltantes y sobrantes: Lizbeth +121 246,29 con tarjeta +130 300 y 5 cajas con faltante. Tarjeta del mes +169 618 (sobrante enorme): dato a revisar por la dueña, no se tocó.

**Guía:** `/reportes/diferencias-cuadre/guia` dio 404 en producción (aún no desplegada); se revisó el texto en `apps/api/src/reportes/guia.ts`.

**PDF/Excel:** `/reports/diferencias-cuadre/export` dio 404 (exportador sin desplegar); pendiente de re-probar.
