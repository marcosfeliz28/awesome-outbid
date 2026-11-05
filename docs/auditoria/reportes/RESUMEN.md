# Resumen de la auditoría de reportes (2-nov-2026)

Base para la contra-auditoría de ChatGPT PC/nube. Fuente única: `HALLAZGOS_TOTAL.jsonl` (37 hallazgos, ids sin repetir, mismos campos que los archivos por grupo más `grupo`; en `commit` se puso el SHA real donde el original decía «este push» o «ver SHA final»).

## Totales por grupo y severidad
| Grupo | Alta | Media | Baja | Total | Corregidos | Abiertos |
|---|---|---|---|---|---|---|
| Ventas | 0 | 4 | 4 | 8 | 7 | 1 |
| Dinero | 0 | 5 | 2 | 7 | 1 | 6 |
| Clientes | 0 | 3 | 4 | 7 | 0 | 7 |
| Inventario | 0 | 3 | 5 | 8 | 6 | 2 |
| Lenguaje | 1 | 4 | 2 | 7 | 1 | 6 |
| **Total** | **1** | **19** | **17** | **37** | **15** | **22** |

Margen no tiene archivo de hallazgos (solo fichas en `margen/`). Las cifras de dinero revisadas cuadran (ventas de octubre RD$ 1,465,804.50; deuda 227,900; inventario a costo 4,459,832.20).

## Corregido y en qué commit
- `a85e110`: dinero-01 (nota «Ventas netas» fuera de reportes que no son de ventas).
- `ae4e485`: ventas-01, 02, 03 (textos de la guía).
- `b018a79`: inv-01 a inv-06 (rotación, pérdidas, días de inventario, sin movimiento, bajo mínimo; textos).
- `e2e8124`: lenguaje-01 (margen, utilidad, ticket y rotación con ejemplo en pesos).
- Rama `claude-pc/aud-pendientes-bajos`: ventas-05 (Facturas no suma: rótulo «Facturas que la incluyen» y aviso en guía, más total solo de piezas y ventas), ventas-06 (fecha `11/10/2026`), ventas-07 (aviso en pantalla y guía: «Desde» no cambia el resultado), ventas-08 (fila de total en PDF/Excel de 6 reportes). Ninguna cifra cambió.

## Sigue abierto y decisión de la dueña
**Necesitan decisión (tocan cifras de dinero):**
- lenguaje-03 (**Alta**): regla de devoluciones por fecha en formas de pago/descuentos/por mayor no coincide con la guía.
- dinero-02: % de descuento por cajera se divide entre la venta ya descontada (sobrestima: 38,6 % vs 27,9 %).
- dinero-03: «Diferencia total» mezcla faltantes y sobrantes; ¿mostrarlos separados?
- clientes-01 y clientes-02: crédito sin cliente fuera de «clientes con más deuda»; pagos «pending» ya cobrados.
- clientes-03: «hasta» pasado usa saldo de hoy (rehacer con historial si se pide).
- lenguaje-02, 04, 05: «bruta» ya resta devoluciones; vendido sin restar devoluciones; fórmula de diferencia «por confirmar».
- ventas-04: 65,2 % de ventas sin marca (dato maestro, no error de cálculo).

**Sin decisión, solo trabajo pendiente (bajo/medio de texto):** dinero-04 (nota de abonos), dinero-05, dinero-06, clientes-04 a 07, inv-07, lenguaje-06 y 07.

**Por verificar:** dinero-07 e inv-08 (exportador y guía daban 404 en producción el 2-nov; no se comprobó de nuevo en esta pieza).
