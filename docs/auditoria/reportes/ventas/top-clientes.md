# Los 20 mejores clientes (`top-clientes`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Puesto": 1, "Cliente": "annya bello", "Facturas": 3, "Ventas netas": 109300, "Ticket promedio": 36433.33, "% de las ventas": 7.5}
- {"Puesto": 2, "Cliente": "alex roque", "Facturas": 2, "Ventas netas": 46800, "Ticket promedio": 23400, "% de las ventas": 3.2}
- {"Puesto": 3, "Cliente": "Ginette Gómez", "Facturas": 1, "Ventas netas": 30500, "Ticket promedio": 30500, "% de las ventas": 2.1}

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
