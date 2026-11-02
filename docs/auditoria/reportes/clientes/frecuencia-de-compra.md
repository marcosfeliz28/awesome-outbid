# Frecuencia de compra por cliente

Rango usado: 2026-01-01 → 2026-11-02 (hora RD), leído 2-nov ~08:25 RD, solo GET. Sin datos personales (solo nº de factura).

## 1. Qué dice
Compras, ventas netas, promedio de días entre compras y última compra. 342 clientes, 358 compras.

## 2. Recálculo independiente
- Σ Compras = 358 = ventas vigentes; Σ Ventas netas = **1,478,654.50** = ingresos de `/dashboard/summary` (sin devoluciones en el rango).
- Top 3 (compras, neto, promedio) recalculados desde `/sales`: iguales.

## 3. Lógica
340 de 342 clientes compraron una vez: el promedio queda vacío; quienes compraron 2 veces el mismo día muestran **0**. Fórmula (último−primero)/(n−1) en días RD correcta.

## 4. Entendible 18–70
«0» y vacío confunden. Sugerir «mismo día» / «una sola compra».

## 5. PDF y Excel
`/reports/frecuencia-de-compra/export` y `/reportes/frecuencia-de-compra/guia` dieron 404 (aún no desplegados). Reintento al final; ver AVANCE-clientes.md. La guía del código (`apps/api/src/reportes/guia.ts`) sí se leyó.

## 6. Veredicto
OK en datos. CLI-04 (Bajo, texto).
