> **Borrador sin verificar, hecho por modelo local (cola N37, segundo intento).** Fuente: docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md de origin/nexora-cloud. Revisión de Claude PC: solo el trozo 1 de 4 (4000 caracteres); PARCIAL.

PARCIAL

# Cobros: crédito, contraentrega, abonos y transferencias

Rama `cola-n26` (= `nexora-cloud`) salvo donde dice otra rama. Citas `archivo:línea`.

## 1. Vocabulario rápido

- **Crédito / contraentrega**: la mercancía sale ahora y el dinero se cobra después. En la base es un pago con método `cod` y estado `pending`; el saldo vive en `Sale.creditBalance` (`apps/api/src/sales.ts:1378-1384`, `:1146`). «Crédito» y «Contraentrega» son solo una etiqueta de estadística (`receivableKind`: `credit` o `cod`); tienen las mismas reglas (`apps/api/prisma/schema.prisma`, comentario de `receivableKind`; `apps/web/src/POS.tsx:1798-1802`).
- **Abono / cobro**: un pago posterior sobre una venta con saldo. Se guarda como `Payment` con `entryType = "installment"` (`apps/api/src/sales.ts:4414-4429`). Un pago hecho al vender tiene `entryType = "sale"`.
- **Verificar**: confirmar contra el banco que una transferencia llegó. Estados del pago: `ok`, `pending_verification`, `rejected` y `pending` (deuda sin cobrar) (`apps/api/prisma/schema.prisma` modelo `Payment`, campo `status`).

## 2. Vender a crédito o contraentrega (en la caja)

Pasos exactos en `FLUJO_CAJA_POS.md` §5.1. Resumen:

1. Elegir **cliente** (obligatorio, `apps/web/src/POS.tsx:2046-2049`).
2. En «Todo listo para cobrar» pulsar **«Vender a crédito (queda pendiente)»** (`:2466-2473`) o los botones **«Contraentrega»** / **«Crédito»** (`:2542-2548`).
3. Confirmar con **«Sí, vender a crédito»** (`:2530`). El texto avisa: «El cliente se lleva la mercancía sin pagar esa parte, la caja no recibe ese dinero y solo un administrador podrá cobrarlo.» (`:2510-2511`; ojo: otro texto dice que cualquier cajera puede cobrar en efectivo, ver §3).
4. Reglas de aprobación con **PIN de gerente** (`packages/shared/src/index.ts:403-444`): monto de crédito > umbral (`creditApprovalThreshold`, RD$ 1,000 por defecto); contraentrega de quien no tiene `sale:manage` > umbral o con ventas a crédito deshabilitadas; deuda abierta del cliente + esta venta > umbral; lo dejado por cobrar en el turno > RD$ 3,000 (`receivableShiftLimit`).
5. Límite por cliente: `Customer.creditLimit` (0 = sin límite para crédito): «La venta supera el límite de crédito del cliente.» (`apps/api/src/sales.ts:1015-1025`).
6. Necesita conexión (no se guarda sin internet) (`apps/web/src/POS.tsx:2004-2009`, `:2177-2180`).
7. El recibo imprime «CRÉDITO · PENDIENTE DE PAGO» y «Monto pendiente» (`apps/web/src/Prints.tsx:616-623`; `apps/web/src/POS.tsx:2363-2375`).
8. El incentivo de la cajera por esa parte se acredita **al cobrar**, no al vender (`apps/api/src/sales.ts:1153`, campo `incentiveOnCollection`).

## 3. Cobrar un crédito / contraentrega

### 3.1 Pantalla «Caja» › panel «Créditos pendientes»

- Panel con ícono de camión y texto: «Ventas entregadas sin pago. Cualquier cajera puede cerrarlas en efectivo, de cualquier día: el dinero entra a su caja y lo entrega al cerrar. La tarjeta y la transferencia las registra la administración.» (`apps/web/src/Tienda.tsx:602-614`).
- Pestañas **«Pendientes»** / **«Cerrados»** (`:620-635`). La administración (`*`) además ve **«Por venta»** / **«Por persona»** (`:638-657`); «Por persona» abre el estado de cuenta por cliente (`apps/web/src/CreditAccounts.tsx:36`, API `apps/api/src/sales.ts:3633-3856`, PDF del estado de cuenta `:3792`).
- Cada fila muestra número FS-xxxxxxx, estado (Abierto / Parcial / Cerrado), tipo (Crédito o Contraentrega), días sin cobrar («Lleva N días sin cobrar», «Se cobró el mismo día»), «Total / Cobrado / Pendiente», lo «por verificar», y el historial de cobros con foto (`:569-583`, `:672-747`).
- Botón **«Registrar cobro»** (`:752-756`) abre **«Registrar cobro · FS-…»** (`:1052`).

### 3.2 La ventana «Registrar cobro»

- Se pueden agregar hasta 4 líneas: **«Agregar otra forma de pago»** (`:1194-1203`). Cada línea: «Forma de pago» (Efectivo; Tarjeta y Transferencia solo con `sale:manage`) y «Monto entregado» (`:1105-1134`).
- **Efectivo** entra a la **caja abierta** de quien registra

Qué hice: Resumí el trozo de `docs/sistema/FLUJO_COBROS_Y_TRANSFERENCIAS.md` hasta 4000 caracteres.

Qué NO comprobé: No revisé archivos adicionales ni verifiqué información fuera del trozo proporcionado.

