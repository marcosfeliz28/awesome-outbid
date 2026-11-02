# Ticket promedio por día y por mes (`ticket-promedio`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Tipo": "Día", "Período": "2026-10-11", "Facturas": 4, "Ventas netas": 65050, "Ticket promedio": 16262.5}
- {"Tipo": "Día", "Período": "2026-10-13", "Facturas": 5, "Ventas netas": 52884.5, "Ticket promedio": 10576.9}
- {"Tipo": "Día", "Período": "2026-10-14", "Facturas": 29, "Ventas netas": 114190, "Ticket promedio": 3937.59}

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
- **ventas-06** (Bajo, abierto): Las filas de día muestran 2026-10-11 (formato técnico) y las de mes «octubre de 2026».
