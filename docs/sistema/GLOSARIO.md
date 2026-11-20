# Glosario del negocio y del sistema

Rama `cola-n26` (= `nexora-cloud`). Orden alfabético. Cada término lleva su cita; los que son jerga de la dueña sin cita en el código se marcan «uso interno».

**Abono** — Pago posterior a una venta que quedó con saldo (crédito/contraentrega). Se guarda como `Payment` con `entryType = "installment"` (`apps/api/src/sales.ts:4796`). Pantalla: Ventas › «Registrar abono» (`apps/web/src/Management.tsx:3574`).

**Aprobar con PIN / PIN de gerente** — Código de 6 dígitos de un usuario con `sale:manage` que autoriza una operación de riesgo (descuento grande, crédito grande, descuadre, vale…). No puede ser el de quien pide, salvo la dueña (`apps/api/src/security.ts:113-168`). Ver `ROLES_Y_PERMISOS.md` §5.

**Arqueo / «Cerrar y arquear»** — Contar el dinero de la caja y compararlo con lo que el sistema espera (`apps/web/src/Management.tsx:1813`).

**B01 / B02** — Tipos de comprobante fiscal que se pueden _solicitar_ si la «Preparación de NCF» está activa: B01 «Crédito fiscal» (pide RNC o cédula) y B02 «Consumidor final». El sistema solo prepara la solicitud; no emite el comprobante (`apps/web/src/POS.tsx:2697-2725`).

**Caja** — Dos significados: (1) la **pantalla** «Caja» para abrir/cerrar el turno (`App.tsx:262`); (2) la **sesión de caja** (`CashSession`) de una persona, de apertura a cierre (`apps/api/prisma/schema.prisma:673`). Una persona solo puede tener una abierta.

**Caja ciega / arqueo ciego / conteo ciego** — Mientras la caja está abierta, y al cerrar, la cajera **no ve** cuánto se espera que tenga; declara lo que contó y el sistema compara después. «Arqueo ciego activo: mientras la caja está abierta no ves los montos esperados» (`apps/web/src/managementMessages.ts:37-44`). Solo ven los esperados `profit:read` o `sale:manage` (`apps/api/src/common.ts:75-77`). Además existe una bandera para ocultar importes de las ventas a quien no ve esperados, **apagada por defecto**: `NEXORA_VENTAS_CAJA_CIEGA` (`apps/api/src/sales.ts:146-159`).

**Casa** — Almacén de la mercancía guardada fuera de la tienda (`kind=home`, no vendible). Solo se mueve con instrucción expresa de la dueña (`.claude/skills/mercancia/SKILL.md:33`; `apps/api/prisma/migrations/202610240401_warehouses/migration.sql:56`).

**Cierre de emergencia** — Un gerente/administrador cierra la caja de otra persona; queda «cerrada por X en nombre de Y» (`apps/web/src/Tienda.tsx:345-352`; `apps/api/src/cash.ts:1388-1403`).

**Conciliar** — Comparar las transferencias del sistema con el estado del banco antes de verificarlas. Pantalla «Conciliar transferencias» (`apps/web/src/TransferReconciliation.tsx:195-203`).

**Conteo** — Contar físicamente la existencia. En el sistema: Inventario › «Contar» crea un conteo pendiente que un gerente aprueba con «Aprobar ajuste» (`apps/web/src/Management.tsx:1043`, `:1007`). Los conteos contra el sistema se verifican **4 veces** (`CLAUDE.md` punto 6).

**Consumidor final** — Cliente genérico para ventas sin datos; si existe en la lista, sale primero al elegir cliente (`apps/web/src/POS.tsx:369-386`). Las facturas deben identificar a una persona o empresa (`requireCustomer`, `apps/api/src/admin.ts:132-134`). También es el tipo B02.

**Contraentrega (`cod`)** — Venta que sale con la mercancía y se cobra cuando el mensajero trae el dinero. En la base es lo mismo que el crédito (método `cod`); solo cambia la etiqueta estadística (`apps/web/src/POS.tsx:1895-1901`, `:2661-2666`).

**Costo promedio (`costAvg`)** — Costo de una variante, recalculado en cada entrada (`apps/api/prisma/schema.prisma:120-135`). Con él se calcula el margen.

**Crédito** — Venta a cuenta del cliente: la mercancía sale ahora, se cobra después. Pantalla: «Créditos pendientes» dentro de Caja (`apps/web/src/Tienda.tsx:649`). Reglas de PIN: `packages/shared/src/index.ts:451`.

**Cuadre** — El resultado del cierre de caja: lo contado contra lo esperado por método (efectivo, tarjeta, transferencia, dólares), con diferencias; se imprime al cerrar (`apps/web/src/Management.tsx:2235-2245`; `apps/api/src/cash.ts:1163`). **Descuadre** = diferencia distinta de cero; exige justificación y el PIN de otra persona (`apps/api/src/cash.ts:1301-1353`).

**Datáfono / verifón / lote del verifón** — Terminal de tarjeta. «Cerrar el lote» antes de cerrar la caja para que los cobros caigan al día siguiente; el número de lote es obligatorio si hubo tarjeta (`apps/web/src/Tienda.tsx:353-356`, `:399-412`; `apps/api/src/cash.ts:1247-1261`).

**Descuento** — Rebaja a una línea (% o RD$) o global (%). Siempre con motivo; sobre el límite del vendedor pide PIN. La caja aplica el mayor entre el descuento manual y el de la promoción (`apps/web/src/POS.tsx:349-362`).

**Dueña** — Marcos/Grupo MacGen, usuaria con permiso `*` (`docs/proyecto/PLAN_MAESTRO_NOREXOS.md:2`). Sus órdenes fechadas están en `CLAUDE.md` y en `.claude/skills/comunicacion/SKILL.md`.

**Entregado / Dejado en caja** — Al cerrar: «Entregado» es el efectivo que se le da a la dueña; «Dejado en caja» es lo que queda y será el fondo sugerido de la próxima apertura (`apps/web/src/Tienda.tsx:417-428`; `packages/shared/src/index.ts:740-753`).

**Envío / mensajero** — Cobro del envío que paga el cliente junto con la transferencia o la tarjeta. Va **aparte** del total (no es venta, ganancia ni ITBIS) y se le paga luego al mensajero (por defecto «Addison») en «Envíos del mensajero» (`apps/web/src/POS.tsx:2974-3019`; `apps/web/src/CourierPayouts.tsx:31`; `packages/shared/src/index.ts` `courierCharge`).

**Equipo / terminal** — Computadora registrada. Un equipo nuevo necesita aprobación de un gerente (`apps/web/src/realtime.tsx:517-520`).

**En espera** — Carrito guardado para seguir después (F8). **Cotizar** lo guarda como cotización. Ambos son `Quote` (`apps/web/src/POS.tsx:465-497`).

**Factura (venta)** — En la tienda, «factura» es el número de una **venta** al cliente. **FS-0000123** (siete dígitos) es el número de venta (`apps/api/src/sales.ts:1316`). Ojo: el recibo dice «documento no fiscal»; no es factura fiscal (`apps/web/src/Prints.tsx:508-510`). La **factura del proveedor** (la que llega con la mercancía) es otra cosa: `supplierInvoice`.

**FEFO** — «Primero vence, primero sale»: la venta descuenta primero del lote que vence antes (`apps/api/src/inventory.ts:573`, texto «Venta FEFO»).

**Fondo / «Efectivo inicial»** — Dinero con el que se abre la caja (`apps/web/src/Management.tsx:2155`).

**Génesis / Macgen** — Nombres de las dos empresas/grupos de cuentas bancarias. En GV, las cuentas se agrupan «Grupo Génesis» y «Grupo Macgen» según si el nombre contiene «génesis» (`apps/api/src/gv-money.ts:164-176`). Los cobros de GV caen en cuentas de Génesis (`docs/coordinacion/MODULO-GV.md:3`).

**Grupo MacGen** — La empresa dueña de la tienda: suplementos, fajas, tenis y ropa deportiva, accesorios de gym y maquillaje (`apps/web/src/App.tsx:303-331`, `:349`).

**GV / GV Makeup Studio** — Empresa hermana de cursos y servicios de maquillaje. Ver `GV.md`.

**ITBIS** — Impuesto a la transferencia de bienes y servicios (18 %). Por defecto los precios **incluyen ITBIS** (`taxIncluded`); en el recibo y la caja sale «ITBIS incluido» (`apps/web/src/POS.tsx:1231-1235`; `apps/api/prisma/schema.prisma:104`). **El margen NO resta el ITBIS** (`packages/shared/src/index.ts:488-491`).

**Kardex** — Historial de movimientos de una variante (`InventoryMovement`); se abre con el ícono del ojo en Inventario (`apps/web/src/Management.tsx:831`).

**Lote / vencimiento** — Partida de una variante con número y fecha de vencimiento. Obligatorios según la categoría (`Category.requiresLot`/`requiresExpiry`) (`apps/api/prisma/schema.prisma:60-72`).

**Margen** — `(precio − costo) / precio × 100`, **sin restar ITBIS**, con el precio tal como se cobra. **Mínimo 15 %** («Margen bajo»). Ver `README.md` §4.

**Merma** — Pérdida de mercancía (dañada, vencida, muestra…). Motivo de salida en «Mercancía» (`apps/web/src/Merchandise.tsx:77-84`) y tipo de ajuste en Inventario (`Management.tsx:1144`). No confundir con corrección de conteo: las mermas restan a costo en el Resumen, los conteos no (`apps/web/src/Dashboard.tsx:738-745`).

**NC-000000 / Nota de crédito** — Dos usos: el **número de la devolución** (`NC-` + 6 dígitos, `apps/api/src/sales.ts:4390`) y la **nota de crédito** = saldo a favor del cliente con un código de 32 caracteres para canjear en caja (`apps/api/prisma/schema.prisma:542`). Se imprime a mano en PDF desde Ventas (`apps/web/src/Management.tsx:3732`).

**NCF / e-CF** — Número de comprobante fiscal (DGII, República Dominicana). **Este sistema no lo emite**: los recibos son internos y solo se puede preparar la solicitud (`apps/web/src/Prints.tsx:508`; `apps/web/src/Management.tsx:4761-4769`). El «NCF del proveedor» sí se guarda en las compras (`apps/web/src/Purchases.tsx:95-105`).

**Norexos / Nexora POS** — Norexos es el nombre nuevo del producto (plan maestro); el código aún muestra «Nexora POS» hasta que se haga el cambio de marca (etapa E1) (`docs/proyecto/PLAN_MAESTRO_NOREXOS.md:1`, `:11`; `apps/web/src/App.tsx:1311`).

**Nexora-cloud / producto-nexora** — Ramas: la primera es la tienda en vivo; la segunda el producto multiempresa. Ver `README.md` §5.

**Offline / sin conexión** — Vender sin internet solo si la configuración lo permite; la venta queda en el equipo y se sincroniza (`apps/web/src/POS.tsx:2243-2304`; `apps/api/src/admin.ts:101`).

**Oferta / promoción** — Descuento automático que aplica la caja; no cambia el precio del producto. Pantalla «Promociones» (`apps/web/src/Management.tsx:2571`).

**Por verificar (`pending_verification`)** — Transferencia que aún no se comprobó en el banco. Ver `FLUJO_COBROS_Y_TRANSFERENCIAS.md` §4.

**Por mayor («al por mayor»)** — Marca que solo reduce el incentivo de la cajera a la mitad; no cambia precios (`apps/api/prisma/schema.prisma` campo `Sale.wholesale`; `apps/web/src/SaleEditPanel.tsx:116-123`).

**Recepción** — Registro de lo que llegó de una orden de compra o factura (`GoodsReceipt`) (`apps/web/src/Purchases.tsx:345-460`).

**Reembolsada (GV)** — Estado final de una inscripción o cita: se devolvió dinero; exige monto y fecha y se resta de los ingresos (`apps/web/src/Gv.tsx:805-814`).

**RNC** — Registro Nacional del Contribuyente (identificación de empresa). Campo `legalId` de cliente, proveedor y del negocio (`apps/api/prisma/schema.prisma:292-300`).

**Sesiones (equipo de trabajo)** — Uso interno: Norexos 1 (decide y despliega), Norexos 2 «Mercancía», Norexos 3 «Taller» (navegador, visual), Norexos 4 «Revisor», Norexos 5 «Director de proyecto», Claude PC (laptop/modelo local) (`.claude/skills/comunicacion/SKILL.md:8`; `docs/proyecto/PLAN_MAESTRO_NOREXOS.md:2`).

**SKU / código de barras** — Códigos únicos de cada variante; la caja busca por ambos sin distinguir mayúsculas (`apps/web/src/POS.tsx:731-748`; `apps/api/prisma/schema.prisma:120-130`).

**Solicitud de anulación** — Pedido de una cajera para anular su venta; la aprueba la administración (`apps/web/src/Management.tsx:3565`, `apps/web/src/VoidRequests.tsx:21`).

**Traspaso** — Mover mercancía entre Casa y Tienda en una sola operación (resta del origen, suma al destino) (`apps/web/src/WarehousesPanel.tsx:132-224`; `apps/api/src/warehouses.ts:112-360`).

**Transferencia** — Pago por banco. Siempre pide cuenta y referencia y queda por verificar hasta que la administración la comprueba.

**Vale de caja** — Comprobante de salida que está en la gaveta al cerrar y compensa efectivo faltante. Exige nota y el PIN de otro gerente, y genera una alerta alta (`apps/web/src/Tienda.tsx:386-392`; `apps/api/src/cash.ts:1190-1216`).

**Variante** — Combinación concreta de un producto (talla, color, sabor) con su propio código, precio y existencia (`apps/api/prisma/schema.prisma:120`).

**Venta (estado `voided`)** — Anulada: se conserva con motivo y usuario, se revierte inventario y deja de contar (`apps/web/src/Management.tsx:3927`). «Cerrar» una cuenta por cobrar = ya se cobró; una factura de prueba se **anula** (`.claude/skills/comunicacion/SKILL.md` lista de órdenes del 29-oct).
