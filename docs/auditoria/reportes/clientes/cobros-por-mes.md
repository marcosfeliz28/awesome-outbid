# Cobros recibidos por mes y forma de pago

Rango usado: 2026-01-01 → 2026-11-02 (hora RD), leído 2-nov ~08:25 RD, solo GET. Sin datos personales (solo nº de factura).

## 1. Qué dice
Abonos a crédito/contraentrega verificados (status ok) por mes y forma. Oct: efectivo 26 = 82,950; transferencia 11 = 64,200; tarjeta 3 = 8,500. Total **155,650**.

## 2. Recálculo independiente
- `/sales` (abonos `entryType=installment`, status ok, mes RD): mismos 3 grupos y montos.
- Puente de deuda: pagos originales de crédito/contraentrega (383,550) − deuda abierta (227,900) = **155,650** = total de cobros ✓.

## 3. Lógica
Correcto: ignora abonos pendientes/rechazados y agrupa por fecha del cobro (RD). Ojo: el pago original de crédito/cod queda `pending` aunque la factura ya se cobró completa (40 de 50 facturas): `pending` NO sirve para medir deuda.

## 4. Entendible 18–70
Guía clara.

## 5. PDF y Excel
`/reports/cobros-por-mes/export` y `/reportes/cobros-por-mes/guia` dieron 404 (aún no desplegados). Reintento al final; ver AVANCE-clientes.md. La guía del código (`apps/api/src/reportes/guia.ts`) sí se leyó.

## 6. Veredicto
OK. CLI-02 (Medio, sincronía).
