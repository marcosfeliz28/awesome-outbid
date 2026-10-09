# Decisiones de implementación

1. Se conserva NestJS + Prisma + PostgreSQL, React/TypeScript/Vite, pnpm y paquetes compartidos. Nest organiza permisos y transacciones; PostgreSQL es la autoridad del stock y los números financieros.
2. RD$, ITBIS 18% incluido, FEFO, costo promedio, una sucursal y descuento de vendedor de 10%, según sección 18. Precios, costos y cantidades usan Decimal; nunca float en cálculos contables.
3. NCF/e-CF se reservan para integración fiscal futura. Los recibos de demostración dicen «Documento interno — no fiscal».
4. Conflicto de inventario offline: conservar la venta local como «requiere revisión», con stock negativo desactivado por defecto y habilitable explícitamente para productos sin lote obligatorio. UUID único permite reintentos idempotentes. La numeración definitiva sólo se asigna en una transacción exitosa.
5. Se incluyen datos ficticios y cuatro usuarios; ninguna comunicación se envía automáticamente. WhatsApp/correo abren un borrador para el operador.
6. Cron de alertas en proceso evita Redis en una tienda de cinco usuarios. Respaldos y programación diaria se proveen como scripts; requieren operador de infraestructura.
7. Devolución predeterminada: 30 días. Suplementos/maquillaje abiertos o dañados son merma y nunca stock vendible. Las ventas a crédito están desactivadas por defecto y el administrador puede habilitarlas, con cliente y vencimiento.
8. Los adaptadores nativos se entregan configurados. Firmas, compilación iOS/macOS y conexiones a hardware dependen de sistemas y credenciales externos.
9. Contraentrega (D-01): es una cuenta por cobrar y usa la aprobación del crédito (`receivableNeedsApproval`, compartida por la caja y la API). Quien no tiene `sale:manage` necesita PIN de gerente sobre `creditApprovalThreshold`, o siempre si `allowCreditSales` está desactivado. El límite 0 del cliente sigue siendo «sin límite» para el crédito; para la contraentrega el umbral de aprobación se aplica siempre.
