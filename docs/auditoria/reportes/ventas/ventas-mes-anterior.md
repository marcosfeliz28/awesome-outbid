# Mes contra mes anterior (`ventas-mes-anterior`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Mes": "octubre de 2026", "Facturas": 356, "Ventas netas": 1465804.5, "Ticket promedio": 4117.43, "Cambio %": null}
- {"Mes": "septiembre de 2026", "Facturas": 0, "Ventas netas": 0, "Ticket promedio": 0, "Cambio %": null}

## 2. Recálculo independiente
Total oct = **RD$ 1,465,804.50 en 356 facturas**, igual por 4 caminos: suma de `sale.total` de /sales (día por día), suma de líneas netas, `/dashboard/summary.revenue` y la suma de este reporte. Reagrupado a mano (hora −4 h, día, semana, cajera, cliente, rangos de piezas) coincide al centavo. Marca/categoría suman el mismo total.

## 3. Lógica
Estado `completed`, devolución restada en la venta original (opción A), zona RD UTC−4. Sin devoluciones en octubre (no se probó ese borde con datos reales).

## 4. Entendible 18–70
Guía leída del código (el endpoint /guia aún da 404 en producción). Ver hallazgos.

## 5. PDF y Excel
**Pendiente:** /export da 404 (se despliega ~9:00 AM RD).

## 6. Veredicto
HALLAZGO
- **ventas-01** (Medio, corregido): La guía no dice que «Ventas netas» incluye ITBIS ni que el envío del mensajero (RD$ 15,799.93 en 45 facturas de octubre) queda fuera.
- **ventas-03** (Medio, corregido): «Cambio %» sale vacío si el mes de comparación no tuvo ventas y la guía no lo explica (sep-2026 y oct-2025 tienen 0 facturas).
- **ventas-07** (Bajo, abierto): Comparan el mes de la fecha final y no usan «desde»; está en la guía pero un rango parcial (1–15) se compara contra el mes completo.
