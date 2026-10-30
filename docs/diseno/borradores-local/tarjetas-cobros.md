Borrador sin verificar, hecho por Claude (sesión Norexos 4, Revisor) porque el modelo local no está disponible en esta sesión. Fuente: `docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md`. Tarea N37. Cada tarjeta lleva su cita; lo que la entrada marca como **aún no desplegado** lo dice la tarjeta.

# Tarjetas «Si pasa X, haz Y» — cobros

**1. Si el cliente se lleva la mercancía sin pagar…** elige el cliente (es obligatorio), pulsa «Vender a crédito (queda pendiente)» o los botones «Contraentrega» / «Crédito» y confirma con «Sí, vender a crédito». (`apps/web/src/POS.tsx:2046-2049`, `:2466-2473`, `:2542-2548`, `:2530`)

**2. Si el crédito es grande…** pide el PIN de un gerente: pasa del umbral (RD$ 1,000 por defecto), la deuda abierta del cliente lo supera, o lo dejado por cobrar en el turno pasa de RD$ 3,000. (`packages/shared/src/index.ts:403-444`)

**3. Si no hay internet…** el crédito y la contraentrega no se pueden hacer: necesitan conexión. (`apps/web/src/POS.tsx:2004-2009`, `:2177-2180`)

**4. Si el cliente viene a pagar una venta pendiente en efectivo…** ve a Caja › «Créditos pendientes», pulsa «Registrar cobro» y guarda con «Guardar cobro»; el efectivo entra a tu caja abierta. (`apps/web/src/Tienda.tsx:602-614`, `:752-756`, `:1230-1232`, `:1090-1095`)

**5. Si pagan con tarjeta o transferencia un crédito…** lo registra un gerente (`sale:manage`), no la cajera: tarjeta pide «Referencia del voucher»; transferencia, «Banco» y «Referencia». (`apps/api/src/sales.ts:4181-4195`, `:4371`, `:4383-4389`)

**6. Si el cobro es más que el saldo…** el sistema lo rechaza: «El cobro supera el saldo pendiente.» Se puede cobrar una parte y el resto después. (`apps/api/src/sales.ts:4353-4366`; `apps/web/src/Tienda.tsx:1218-1219`)

**7. Si cobras un crédito sin caja abierta…** no puedes recibir efectivo: abre tu caja o registra solo tarjeta o transferencia. (`apps/web/src/Tienda.tsx:1090-1095`)

**8. Si cobraste con transferencia…** el pago queda «por verificar» y se crea una alerta alta; en un abono, no descuenta la deuda hasta verificarse. (`apps/api/src/sales.ts:1377-1405`, `:4424-4440`)

**9. Si llegó el dinero del banco…** la administración (`*`) lo verifica: en «Conciliar transferencias» marca las facturas, escribe el «Total del banco (RD$)» y pulsa «Verificar seleccionadas», o usa «Verificar» desde la factura en Ventas. (`apps/web/src/TransferReconciliation.tsx:396-428`; `apps/web/src/Management.tsx:3445-3532`; `apps/api/src/sales.ts:2749-2810`)

**10. Si el dinero de una transferencia no llegó…** la administración pulsa «Rechazar» con motivo; si era de una venta, el importe pasa a cuenta por cobrar del cliente. (`apps/web/src/Management.tsx:3589-3604`; `apps/api/src/sales.ts:2885-2995`, `:2878-2884`)

**11. Si el banco o la referencia están mal escritos…** la administración usa «Corregir banco y referencia» con un motivo; no cambia el importe ni el estado. (`apps/web/src/Management.tsx:3605-3637`; `apps/api/src/sales.ts:2812-2884`)

**12. Si verificas una transferencia después de cerrar la caja…** el sistema recalcula el cuadre y deja auditoría «verified_after_close». (`apps/api/src/sales.ts:2790-2806`; `apps/api/src/cash.ts:229-258`)

**13. Si el método de pago de una venta quedó mal marcado (máximo 7 días)…** la administración usa Ventas › factura › «Corregir factura» › «Cambiar método de pago». (Desplegado.) (`apps/web/src/SaleEditPanel.tsx:80-190`; `apps/api/src/sales.ts:2192-2368`)

**14. Si un cobro (abono) quedó con el método equivocado…** **NO está desplegado todavía**: la corrección está en la rama `claude/ajustes-cobros` (commit `54d8ca1c`), solo en la API y sin pantalla. Hoy no se puede corregir. (entrada §6.2; `sales.ts:2198` en esa rama)

**15. Si una transferencia ya verificada fue un error…** **NO está desplegado todavía**: «des-verificar» (`POST /payments/:id/unverify`) está solo en `claude/ajustes-cobros`, sin pantalla. (entrada §6.2; `sales.ts:2849` en esa rama)

**16. Si un cobro cayó en la caja equivocada…** **NO está desplegado todavía**: «mover un pago de caja» (`POST /payments/:id/move-cash-session`) está solo en `claude/ajustes-cobros`, sin pantalla. (entrada §6.2; `sales.ts:2942` en esa rama)

**17. Si la venta ya tiene cobros registrados…** no se puede anular ni corregir su método; las devoluciones reducen primero el saldo pendiente. (`apps/web/src/Management.tsx:3320-3327`; `apps/api/src/sales.ts:2239-2241`, `:3340-3347`)

## Qué NO comprobé
Las tarjetas resumen la entrada; no se contrastaron con el código en vivo ni con la rama `claude/ajustes-cobros`.
