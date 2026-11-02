# Ranking de cajeras (`ranking-cajeras`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Puesto": 1, "Cajera": "Lizbeth Peguero", "Facturas": 191, "Unidades": 667, "Ventas netas": 635880, "Ticket promedio": 3329.21, "% del total": 43.4}
- {"Puesto": 2, "Cajera": "Farianelis Rodríguez", "Facturas": 82, "Unidades": 173, "Ventas netas": 402890, "Ticket promedio": 4913.29, "% del total": 27.5}
- {"Puesto": 3, "Cajera": "Wendy del Rosario", "Facturas": 45, "Unidades": 58, "Ventas netas": 175000, "Ticket promedio": 3888.89, "% del total": 11.9}

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
