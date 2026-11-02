# Ventas por hora del día (`ventas-por-hora`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Hora": "00:00", "Facturas": 1, "Ventas netas": 2500, "% del total": 0.2}
- {"Hora": "07:00", "Facturas": 1, "Ventas netas": 12384.5, "% del total": 0.8}
- {"Hora": "09:00", "Facturas": 28, "Ventas netas": 59620, "% del total": 4.1}

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
