# Clientes nuevos por mes

Rango usado: 2026-01-01 → 2026-11-02 (hora RD), leído 2-nov ~08:25 RD, solo GET. Sin datos personales (solo nº de factura).

## 1. Qué dice
Mes, clientes registrados ese mes, cuántos ya compraron. Oct: 356 / 340; Nov: 2 / 2.

## 2. Recálculo independiente
- `/customers` (358) agrupado por mes RD: oct 356, nov 2 ✓.
- Compradores con venta vigente: 342 únicos; creados en oct = 340, nov = 2 ✓.

## 3. Lógica
Correcto. Pero el sistema arrancó el 8-oct: todos los clientes cargados caen en octubre y parece un récord (356) que es carga inicial.

## 4. Entendible 18–70
Guía clara. Falta avisar que el primer mes incluye la carga inicial.

## 5. PDF y Excel
`/reports/clientes-nuevos-por-mes/export` y `/reportes/clientes-nuevos-por-mes/guia` dieron 404 (aún no desplegados). Reintento al final; ver AVANCE-clientes.md. La guía del código (`apps/api/src/reportes/guia.ts`) sí se leyó.

## 6. Veredicto
OK en datos. CLI-05 (Bajo, texto).
