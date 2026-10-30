# Datos y modelos (base de datos)

Rama `cola-n26` (= `nexora-cloud`). Fuente: `apps/api/prisma/schema.prisma` (PostgreSQL, Prisma). Las migraciones están en `apps/api/prisma/migrations/`. Esta página explica en lenguaje simple lo que una sesión necesita para leer la base. **No se leyó ni se tocó ningún dato real**; solo el esquema y el código.

Convenciones: dinero en `Decimal(14,2)` (centavos exactos, nunca decimales flotantes); cantidades en `Decimal(14,3)` (tres decimales); `branchId` identifica la sucursal (en la tienda es `"main"`) y casi toda tabla lo trae; fechas en UTC y se muestran en `America/Santo_Domingo`.

## 1. Personas y acceso

| Modelo | Qué es | Campos que importan | Línea |
|---|---|---|---|
| `Role` | Rol con lista de permisos (`permissions String[]`). Nombres: `admin`, `manager`, `seller`, `warehouse`, `gv`. | `name`, `permissions` | `schema.prisma:10` |
| `User` | Usuario del sistema. | `username` (lo que escribe para entrar), `email`, `passwordHash`, `pinHash` (PIN de gerente), `roleId`, `active`, `mustChangePassword`, `cashierNumber` (ej. 1031), `failedAttempts`/`lockedUntil` | `:18` |
| `Terminal` | Equipo (computadora) registrado. | `name`, `approvedAt` (aprobado o no), `revokedAt`, `registerNumber`/`registerName` (caja que sale en el cuadre, ej. «4012») | `:843` |
| `AuthSession`, `RefreshToken`, `AuthAttempt` | Sesiones y límites de intentos. | | `:834`, `:50`, `:822` |
| `AuditLog` | **Bitácora**: quién hizo qué, con `before` y `after`. Casi toda acción de dinero escribe aquí. | `action`, `entity`, `entityId`, `userId`, `terminalId` | `:792` |
| `Settings` | **Configuración** de la sucursal en un solo JSON (`data`). Ahí viven: nombre del negocio, tasa del dólar `usdRate`, `transferAccounts` (cuentas de banco), `cardTerminals`, `sellerDiscountLimit`, `lowMargin`, `creditApprovalThreshold`, `receivableShiftLimit`, `cashDifferenceLimit`, `autoPrintReceipt`, `allowOfflineSales`, `allowCreditSales`, `ncfMode`, `taxIncluded`, `receiptWidth`… | definido en `apps/api/src/admin.ts:77-143` | `:811` |
| `Counter` | Contadores de numeración: ventas `FS-`, devoluciones `NC-`, órdenes de compra. | `key`, `value` | `:817` |

## 2. Catálogo e inventario

| Modelo | Qué es | Notas | Línea |
|---|---|---|---|
| `Category` | Categoría. | `requiresLot` y `requiresExpiry` (lote y vencimiento obligatorios), `color`. Categorías de fábrica: Suplementos, Ropa deportiva, Fajas, Accesorios de gym, Maquillaje (`packages/shared/src/index.ts:789-795`). | `:60` |
| `Product` | Producto (la ficha). | `sku`, `brand`, `taxRate` (18), `minStock`, `unit` (si es `"servicio"` no tiene existencia: `packages/shared/src/index.ts` `isService`), `isKit` | `:94` |
| `Variant` | **Lo que realmente se vende**: una variante concreta (talla, color, sabor). | `sku`, `barcode`, `attributes` (JSON), `costAvg` (costo promedio), `price`, `wholesalePrice`, **`stock` = existencia en Tienda** | `:120` |
| `KitComponent` | Componentes de un combo. | `qty` | `:158` |
| `Lot` | Lote de una variante. | `lotNumber`, `expiryDate`, `qty`, `cost` | `:170` |
| `Warehouse` | Almacén: **Tienda** (`kind=store`, vendible) y **Casa** (`kind=home`, no vendible). | `sellable` solo puede ser verdadero en `store` | `:230` |
| `VariantStock`, `LotStock` | Existencia de una variante/lote **por almacén** (para Casa). | `qty` | `:246`, `:256` |
| `InventoryMovement` | **Kardex**: cada cambio de existencia. | `type`, `qty` (+/−), `balanceAfter`, `reason`, `userId`, `warehouseId` | `:207` |
| `StockTransfer`, `StockTransferLine` | Traspaso entre almacenes y sus renglones. | `fromId`, `toId`, `reason`, `operationId` (idempotencia) | `:265`, `:280` |
| `InventoryCount` | Conteo físico (`items` JSON). | `status`: `pending` → `applied` | `:661` |
| `Promotion` | Oferta automática que aplica la caja (no cambia el precio). | `type`: `percent`, `amount`, `special_price`, `nxm`, `second_half`; `scope` (variante, producto, categoría o marca), `startsAt`/`endsAt`, `isClearance` | `:750` |

**Tipos de movimiento de kardex** (`InventoryMovement.type`) que escribe el código: `sale` (venta; `apps/api/src/sales.ts:1186`), `void` (anulación; `sales.ts:2523`), `return` y `return_waste` (devolución al stock o a merma; `sales.ts:3238`, `:3250`), `purchase` (recepción de compra; `apps/api/src/inventory.ts:1284`), `count` (conteo aplicado; `inventory.ts:450`, `:1648`), `adjustment`/`waste`/`supplier_return` (ajustes manuales; `inventory.ts:816`, tipos en `Management.tsx:1044`), `transfer_out` y `transfer_in` (`apps/api/src/warehouses.ts:326-358`). Las entradas y salidas de la pantalla «Mercancía» las guarda `apps/api/src/merchandise.ts:343` con el motivo elegido. DUDOSO: no se enumeró cada literal de `type`; confirmar con `grep -rn "stockChange(" apps/api/src` antes de citar uno nuevo.

## 3. Clientes y ventas

| Modelo | Qué es | Campos que importan | Línea |
|---|---|---|---|
| `Customer` | Cliente. | `name`, `phone`, `email`, `legalId` (RNC/cédula), `creditLimit` (0 = sin límite de crédito), `anonymizedAt` (un cliente no se borra: se anonimiza) | `:292` |
| `Sale` | **Venta / factura al cliente** (número `FS-0000123`). | `status`, `total`, `subtotal`, `discountTotal`, `taxTotal`, `costTotal`, `creditBalance` (lo que falta por cobrar), `receivableKind`, `courierFee`/`courierName`/`courierPaidAt` (envío aparte), `wholesale`, `offlineUuid` (evita duplicados), `cashSessionId`, `sellerId`, `ncfType`/`ncf`, `fiscalStatus` | `:312` |
| `SaleItem` | Renglón de la venta. | `qty`, `returnedQty`, `unitPrice`, `unitCost`, `discount`, `tax`, `lineTotal`, `lotId`, `promotionName` | `:433` |
| `Payment` | **Un pago**. Una venta puede tener varios. | ver §4 | `:458` |
| `SaleVoidRequest` | Solicitud de anulación de una cajera. | `status`: `pending`, `approved`, `rejected`, `cancelled`; `reasonCode`, `reason`, `resolutionNote` | `:384` |
| `SaleReturn` | **Devolución** (número `NC-000000`). | `refundMethod` (`cash`, `card`, `transfer`, `credit_note`), `refundAmount`, `wasteQty`, `items` JSON | `:511` |
| `CreditNote` | **Nota de crédito**: saldo a favor del cliente creado por una devolución. | `redemptionCode` (código de 32 caracteres que se presenta en caja), `amount`, `balance`, `customerId` | `:542` |
| `Quote` | Venta en espera o cotización. | `type`: `held` o `quote`; `items` JSON | `:555` |
| `CourierPayout`, `CourierPayoutItem` | Pago al mensajero por varios envíos. | `total`, `fee` | `:408`, `:422` |
| `CreditAllocationOperation` | Cobro por cliente repartido entre varias ventas (idempotente). | | `:499` |

Estados de una venta (`Sale.status`): **`completed`** y **`voided`** (anulada) (`apps/api/prisma/schema.prisma:314-318` comentario CHECK `sale_status_valid`).

Estado de fiscal: `fiscalStatus` empieza en `"not_issued"`; el sistema **no emite NCF** (`schema.prisma:361`, `apps/web/src/Prints.tsx:508`).

## 4. Pagos: método, estado y tipo de entrada

`Payment` (`schema.prisma:458`):

- **`method`** (cómo se pagó): `cash` (efectivo; con `currency = "USD"` si fue en dólares), `card`, `transfer`, `credit_note`, `cod` (crédito y contraentrega) y `credit` (crédito puro, no lo envía la pantalla de caja) (`packages/shared/src/index.ts:598-605`). En reportes y recibos, `cod` y `credit` se muestran como «Crédito / contraentrega» (`apps/web/src/Prints.tsx:498-505`).
- **`status`** (en qué punto está):
  - **`ok`** — válido y aplicado (efectivo, tarjeta, transferencia verificada, abono aplicado).
  - **`pending_verification`** — **transferencia que nadie ha comprobado en el banco** (venta o abono).
  - **`rejected`** — transferencia que no llegó; no cuenta en caja ni descuenta deuda.
  - **`pending`** — deuda por cobrar (el pago `cod`/`credit` de una venta a crédito).
  Fuente: `apps/api/src/sales.ts:1378-1384`, `:2263-2270`, `:4424-4429`.
- **`entryType`** (de dónde viene el pago):
  - **`sale`** — pago hecho **al vender**.
  - **`installment`** — **abono o cobro posterior** de un crédito/contraentrega (`sales.ts:3756`).
  Un abono `pending_verification` no descuenta `Sale.creditBalance` hasta verificarse (`sales.ts:4430-4440`, `:2775-2790`).
- Otros campos: `amount` (lo **aplicado** a la venta, ya sin cambio), `tendered` (lo **entregado** por el cliente), `change` (vuelto en pesos), `bank` (cuenta o terminal), `reference`, `cardBrand`/`cardLast4`/`approvalCode`/`cardType`, `feeAmount` (comisión de tarjeta: `cardFeePercent`, 2.5 % si no hay configuración, `sales.ts:1370-1376`), `proofUrl` (foto de evidencia), `receivedById` (quién recibió un cobro), `currency`/`amountUsd`/`usdRate` (dólares), `cashSessionId` (a qué caja pertenece), `creditNoteId`.

## 5. Caja

| Modelo | Qué es | Campos que importan | Línea |
|---|---|---|---|
| `CashSession` | **Una caja** (de apertura a cierre) de **una persona**. | `userId`, `registerId` (equipo), `openingAmount`, `openedAt`, `closedAt` (nulo = abierta), `expectedCash/Card/Transfer`, `countedCash/Card/Transfer`, `differenceCash/Card/Transfer`, `difference`, `notes`, `closeDetails` (JSON del cuadre: denominaciones, vales, dólares, `delivered`/`left`, lote del verifón, aprobadores) | `:673` |
| `CashMovement` | Entrada o salida de efectivo durante el turno. | `type`: `in` o `out`, `amount`, `reason`, `operationId` | `:704` |

Reglas: una persona solo puede tener **una caja abierta** (índice único parcial, `apps/api/src/cash.ts:893-920`); el esperado se calcula, no se guarda hasta el cierre (`cash.ts:55-113`); las transferencias del cierre las suma el sistema (`cash.ts:1213`).

## 6. Compras

| Modelo | Qué es | Línea |
|---|---|---|
| `Supplier` | Proveedor (nombre, RNC, plazo de pago, tiempo de entrega). | `:79` |
| `PurchaseOrder`, `PurchaseItem` | Orden de compra. `status`: `ordered` → `partial` → `received` (`apps/api/src/inventory.ts:1302-1306`). | `:571`, `:593` |
| `GoodsReceipt` | **Recepción** de mercancía (de una orden o de una factura): flete, otros costos, `damagedCost`, `invoiceTotal`, `supplierInvoice`, `supplierNcf`. | `:611` |
| `SupplierPayment` | Pago a un proveedor. | `:648` |
| `InvoiceDraft`, `InvoiceAttachment` | Factura de proveedor subida y su revisión antes de confirmar. | `:903`, `:915` |
| `SupplierImportProfile`, `SupplierCode` | Mapeo de columnas y códigos por proveedor. | `:884`, `:893` |
| `MerchandiseOperation` | Operación de entrada/salida de la pantalla «Mercancía» (idempotente). | `:874` |
| `Lot`, `LotIdentityConflict` | Lotes y su historial de duplicados resueltos. | `:170`, `:195` |

## 7. Gastos, alertas, notificaciones, incentivos

| Modelo | Qué es | Línea |
|---|---|---|
| `Expense`, `ExpenseCategory` | Gastos y presupuesto mensual por categoría. | `:728`, `:721` |
| `Alert`, `AlertRule` | Alertas (`status`: `new`, `seen`, `resolved`; `severity`; `type` como `transfer_pending`, `cash_difference`, `cash_voucher`, `cash_after_close`, `transfer_rejected_loss`, `receivable`). | `:766`, `:784` |
| `NotificationOutbox` | Cola de avisos a Telegram. | `:930` |
| `IncentiveRate`, `IncentiveEntry`, `IncentivePeriodClose`, `IncentiveSettlement` | Incentivos de cajeras por venta/cobro y cierres de mes. | `:951-1003` |
| `DriveBackup` | Respaldos a Google Drive. | `:1029` |
| `RealtimeEvent` | Eventos para refrescar las pantallas abiertas. | `:864` |
| `CashierSurvey` | Encuesta de la caja. | `:1199` |

## 8. GV Makeup Studio

| Modelo | Qué es | Línea |
|---|---|---|
| `GvCourse` | Curso: `type` (automaquillaje, brazilian, personalizado, otro), `date`, `price`, `capacity`, `active`. | `:1061` |
| `GvEnrollment` | Inscripción: `clientName`, `phone`, `instagram`, `agreedPrice`, `status` (`activa`, `no_asistio`, `personalizado`, `cancelada`, `reembolsada`), `attended`, `boughtBrushSet`, `refundAmount`/`refundDate`. | `:1081` |
| `GvPayment` | Pago de GV (de una inscripción **o** de una cita): `concept` (separo, completo, restante, segundo, tercero, otro), `method` (efectivo, transferencia, tarjeta), `bank`, `reference`, `verified`/`verifiedBy`, `rejectedAt`/`rejectReason`. **Efectivo y tarjeta nacen verificados; transferencia nace por verificar.** El pendiente **no se guarda: se calcula** (total − pagado verificado) (`apps/api/src/gv-money.ts:158-180`). | `:1109` |
| `GvAppointment` | Cita de maquillaje: `service`, `artists[]`, `afterHours`, `total`, `tip`, `status` (`agendada`, `realizada`, `cancelada`, `reembolsada`), datos de boda (`weddingQuote`, `venue`, `people`). | `:1149` |
| `GvLead` | Interesada (prospecto): `interest`, `action`, `status` (`por_contactar`, `contactada`, `inscrita`, `descartada`). | `:1180` |

## 9. Cómo se relacionan las cosas más usadas

```
Customer ─┬─< Sale >─┬─< SaleItem >── Variant ── Product ── Category
          │          ├─< Payment  ── CashSession (caja)
          │          ├─< SaleReturn ── CreditNote (saldo a favor)
          │          └─< SaleVoidRequest
          └─< CreditNote
CashSession >─< CashMovement
Variant ─< InventoryMovement (kardex) · VariantStock/LotStock por Warehouse (Tienda/Casa)
PurchaseOrder >─< PurchaseItem · GoodsReceipt · Supplier
```

## 10. Cosas que se calculan (no se guardan como están)

- **Total esperado de caja** (`cashExpected`, `apps/api/src/cash.ts:55-113`).
- **Deuda de un cliente** = suma de `creditBalance` de sus ventas completadas (`apps/api/src/sales.ts:345` `customerOpenDebt`).
- **Margen** = `(precio − costo) / precio × 100` sin restar ITBIS (`packages/shared/src/index.ts:483-486`).
- **Pendiente de GV**, ver §8.
- **Costo promedio** (`Variant.costAvg`) lo actualiza cada entrada con costo y flete repartido (`apps/api/src/inventory.ts:165` `receiptCosts`, `:450-520` `stockChange`).
