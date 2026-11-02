# Clientes con más deuda

Rango usado: 2026-01-01 → 2026-11-02 (hora RD), leído 2-nov ~08:25 RD, solo GET. Sin datos personales (solo nº de factura).

## 1. Qué dice
Por cliente: facturas abiertas, deuda, factura más antigua y sus días. Hoy 8 clientes, 10 facturas.

## 2. Recálculo independiente
- Σ Deuda = **227,900**, 10 facturas = reporte de antigüedad = `/credit-accounts`.
- Días de la más antigua coinciden con el reporte de antigüedad.

## 3. Lógica
Agrupa solo si existe `customerId`: una factura a crédito/contraentrega **sin cliente** sale en antigüedad («Consumidor final») pero se pierde aquí y los totales dejarían de cuadrar. Hoy hay 0; el cierre diario (`reportes.py`) ya las marca como hallazgo Alta.

## 4. Entendible 18–70
Guía clara («saldos de hoy»).

## 5. PDF y Excel
`/reports/clientes-con-mas-deuda/export` y `/reportes/clientes-con-mas-deuda/guia` dieron 404 (aún no desplegados). Reintento al final; ver AVANCE-clientes.md. La guía del código (`apps/api/src/reportes/guia.ts`) sí se leyó.

## 6. Veredicto
HALLAZGO latente CLI-01 (Medio, cifra de dinero → requiere visto bueno de la dueña).
