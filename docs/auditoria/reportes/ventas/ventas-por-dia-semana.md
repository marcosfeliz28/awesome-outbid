# Ventas por día de la semana (`ventas-por-dia-semana`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Día": "Lunes", "Facturas": 27, "Ventas netas": 130300, "Ticket promedio": 4825.93, "% del total": 8.9}
- {"Día": "Martes", "Facturas": 36, "Ventas netas": 155194.5, "Ticket promedio": 4310.96, "% del total": 10.6}
- {"Día": "Miércoles", "Facturas": 68, "Ventas netas": 262810, "Ticket promedio": 3864.85, "% del total": 17.9}

## 2. Recálculo independiente
Total oct = **RD$ 1,465,804.50 en 356 facturas**, igual por 4 caminos: suma de `sale.total` de /sales (día por día), suma de líneas netas, `/dashboard/summary.revenue` y la suma de este reporte. Reagrupado a mano (hora −4 h, día, semana, cajera, cliente, rangos de piezas) coincide al centavo. Marca/categoría suman el mismo total.

## 3. Lógica
Estado `completed`, devolución restada en la venta original (opción A), zona RD UTC−4. Sin devoluciones en octubre (no se probó ese borde con datos reales).

## 4. Entendible 18–70
Guía leída del código (el endpoint /guia aún da 404 en producción). Ver hallazgos.

## 5. PDF y Excel
Descargados PDF y Excel (2-nov ~10:25 RD, mismo rango): abren bien, tildes correctas, gráfica legible y nada cortado; las cifras coinciden con la pantalla. Hojas del Excel: Resumen, Detalle y Guía. El texto de la guía exportada es el desplegado antes de la corrección (ITBIS/envío): saldrá con el próximo despliegue. Total al final: ver hallazgo ventas-08.

## 6. Veredicto
HALLAZGO
- **ventas-01** (Medio, corregido): La guía no dice que «Ventas netas» incluye ITBIS ni que el envío del mensajero (RD$ 15,799.93 en 45 facturas de octubre) queda fuera.
