# Ventas por marca (`ventas-por-marca`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Marca": "Sin marca", "Facturas": 270, "Unidades": 808, "Ventas netas": 956250, "% del total": 65.2}
- {"Marca": "Dymatize", "Facturas": 29, "Unidades": 39, "Ventas netas": 169300, "% del total": 11.5}
- {"Marca": "Optimum Nutrition", "Facturas": 39, "Unidades": 78, "Ventas netas": 156570, "% del total": 10.7}

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
- **ventas-04** (Medio, abierto): 65.2 % de las ventas (RD$ 956,250, 808 piezas) caen en «Sin marca»: el reporte no sirve para decidir compras. Dato maestro de productos, no error de cálculo.
- **ventas-05** (Bajo, abierto): «Facturas» no se puede sumar hacia abajo (una factura con 2 marcas cuenta en ambas: suma 422 vs 356 reales) y no hay fila de total.
