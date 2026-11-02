# Ventas por categoría y mes (`ventas-categoria-mes`)
Rango: 2026-10-01 a 2026-10-31 · consultado 2-nov-2026 ~08:20 RD · solo GET.

## 1. Qué dice · 3 filas reales
- {"Mes": "octubre de 2026", "Categoría": "Suplementos", "Facturas": 133, "Unidades": 303, "Ventas netas": 778814.5, "% del mes": 53.1}
- {"Mes": "octubre de 2026", "Categoría": "Maquillaje", "Facturas": 193, "Unidades": 703, "Ventas netas": 589940, "% del mes": 40.2}
- {"Mes": "octubre de 2026", "Categoría": "Fajas", "Facturas": 27, "Unidades": 27, "Ventas netas": 89200, "% del mes": 6.1}

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
- **ventas-02** (Medio, corregido): La guía da de ejemplo «ropa», categoría que no existe en el negocio.
- **ventas-05** (Bajo, abierto): «Facturas» no se puede sumar hacia abajo (una factura con 2 marcas cuenta en ambas: suma 422 vs 356 reales) y no hay fila de total.
