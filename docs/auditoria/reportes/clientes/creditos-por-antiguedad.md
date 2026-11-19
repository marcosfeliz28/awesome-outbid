# Créditos y contraentregas por antigüedad

Rango usado: 2026-01-01 → 2026-11-02 (hora RD), leído 2-nov ~08:25 RD, solo GET. Sin datos personales (solo nº de factura).

## 1. Qué dice
Filas «Resumen» por tramo (0-15, 16-30, 31-60, >60 días) + una fila por factura abierta (Tipo, Fecha, Vence, Días, Saldo). Hoy: 10 facturas abiertas; 0-15 días = 6 (68,050), 16-30 = 4 (159,850), 31-60 y >60 = 0.

## 2. Recálculo independiente
- Suma resumen = suma detalle = **227,900** (10 facturas).
- `/credit-accounts` (pantalla de créditos): total **227,900**.
- `/sales` por día (1-oct→2-nov, 383 ventas, 358 vigentes): suma de `creditBalance` > 0 = **227,900**, 10 facturas, las mismas.
- Edad de las 10 facturas recalculada a mano en hora RD (hoy − fecha local de la venta): **10/10 iguales**, incluidas FS-0000116/117/359 vendidas 21:01–21:45 RD (ya es el día siguiente en UTC): el reporte las deja en el día RD correcto. Cortes de tramo (15/16, 30/31, 60/61) correctos.

## 3. Lógica
Con «hasta» en el pasado muestra las ventas hasta esa fecha pero con el **saldo de hoy** (atajo documentado en código y guía). `from` no filtra. Prueba: hasta=18-oct → 6 facturas, 198,050.

## 4. Entendible 18–70
La guía dice «saldos de hoy» y explica Resumen/detalle. Claro. Sugerencia: aclarar que «desde» no se usa.

## 5. PDF y Excel
`/reports/creditos-por-antiguedad/export` y `/reportes/creditos-por-antiguedad/guia` dieron 404 (aún no desplegados). Reintento al final; ver AVANCE-clientes.md. La guía del código (`apps/api/src/reportes/guia.ts`) sí se leyó.

## 6. Veredicto
OK en datos y edades. Ver CLI-02 y CLI-03.
