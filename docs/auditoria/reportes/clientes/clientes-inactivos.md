# Clientes inactivos (60 días sin comprar)

Rango usado: 2026-01-01 → 2026-11-02 (hora RD), leído 2-nov ~08:25 RD, solo GET. Sin datos personales (solo nº de factura).

## 1. Qué dice
Clientes con última compra hace más de 60 días. Hoy vacío (primera venta 8-oct: nadie llega a 61 días antes del 7-dic).

## 2. Recálculo independiente
- Con hasta=2026-12-31: 340 clientes; «Días sin comprar» = 61 para última compra 31-oct (31-dic − 31-oct) ✓ en días RD.
- Excluye anonimizados (`anonymizedAt IS NULL`).

## 3. Lógica
Solo lista clientes con al menos una compra. Vacío = no es error.

## 4. Entendible 18–70
Guía clara. Una tabla vacía sin mensaje puede parecer rota.

## 5. PDF y Excel
`/reports/clientes-inactivos/export` y `/reportes/clientes-inactivos/guia` dieron 404 (aún no desplegados). Reintento al final; ver AVANCE-clientes.md. La guía del código (`apps/api/src/reportes/guia.ts`) sí se leyó.

## 6. Veredicto
OK. CLI-06 (Bajo, texto: mensaje de vacío).
