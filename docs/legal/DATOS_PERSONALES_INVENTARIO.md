# Inventario de datos personales - Nexora POS (BORRADOR)

Elaborado a partir de la lectura del código (rama nexora-cloud). No es asesoría legal; debe revisarlo un abogado. Referencias: `apps/api/prisma/schema.prisma`, `apps/api/src/admin.ts`, `apps/api/src/sales.ts`, `packages/shared/src/index.ts`.

## 1. Clientes (modelo Customer)

| Campo | Obligatorio | Para qué se usa | Observación |
|---|---|---|---|
| name | Sí (2-120) | Identificar al cliente, ventas a crédito, recibo | Necesario |
| phone | No | Contacto; se imprime en el recibo PDF y se busca por él | Útil para cobro de crédito/contraentrega |
| email | No | Ninguna función encontrada (no se envían correos) | SOBRA: se pide y no se usa |
| legalId (cédula/RNC) | No | Recibo y comprobante fiscal | Necesario solo si pide NCF con RNC; la venta guarda su copia en `Sale.recipientLegalId` |
| birthday | No (solo API) | Ninguno. La interfaz web no lo pide ni lo muestra | SOBRA: eliminar del esquema y de la API (también deja abierto el tema de menores) |
| notes | No (hasta 1000) | Texto libre | Riesgo: pueden escribirse datos sensibles; advertir al personal |
| creditLimit | No (solo gerente) | Crédito | Dato financiero |
| createdBy, branchId, createdAt | Auto | Trazabilidad | - |
| Dirección | No existe en el modelo | - | La dirección que se menciona en la lista NO se guarda por cliente (solo la del negocio en Settings) |

Derivados mostrados en pantalla: total gastado, número de compras, última compra (perfil de compra; finalidad interna).

## 2. Empleados (modelo User y relacionados)

| Dato | Obligatorio | Uso |
|---|---|---|
| name, username/usernameKey, email | Sí (email único) | Acceso y atribución de ventas |
| passwordHash, pinHash | Sí | Autenticación (solo hash; no se guarda en claro) |
| cashierNumber | No | Número visible en cuadre y reportes |
| failedAttempts, lockedUntil | Auto | Protección contra fuerza bruta |
| RefreshToken (hash), AuthSession, AuthAttempt | Auto | Sesión; expira a los 7 días |
| Terminal (name, secretHash, lastUserId, registerName) | Auto | Equipos autorizados |
| AuditLog (userId, ip opcional, before/after, terminalId) | Auto | Auditoría de acciones |
| IP | - | `AuditLog.ip` existe en el esquema pero `audit()` en `common.ts` no la rellena (siempre vacío). La IP sí se usa en memoria para límite de intentos (`rate-limit.ts`, claves auth-account:IP) |

## 3. Ventas y pagos

- Sale: customerId, sellerId, `recipientLegalId` (RNC/cédula del comprador para NCF), ncf, `notes` (texto libre), montos. Conservación fiscal obligatoria.
- Payment (SENSIBLE): `cardLast4` (últimos 4), `cardBrand`, `cardType`, `approvalCode`, `bank`, `reference` (transferencias), **`proofUrl`**: foto de comprobante almacenada como `data:image/...;base64` dentro de la fila (máx. 2 MB; solo para abonos `installment`). No hay PAN completo ni CVV (correcto).
  - `cardLast4` y `approvalCode` son obligatorios para pagos con tarjeta (`sales.ts` líneas ~450 y ~1804). Se justifica para conciliar con el cierre del banco; los últimos 4 no son dato de pago completo, pero sí identificador.
- SaleReturn, CreditNote, Quote (customerId, notes libres), CashSession/CashMovement (userId, notas).
- Proveedores (Supplier: name, legalId, phone, email): son datos de personas jurídicas o físicas comerciantes; mismas reglas de conservación contable.
- InvoiceAttachment (bytes del documento del proveedor) y comprobantes de gasto (`Expense.receiptUrl`): pueden contener datos personales de terceros.

## 4. Datos que sobran o conviene reducir

1. `Customer.birthday`: sin uso. Quitar.
2. `Customer.email`: sin uso funcional. Quitar o dejarlo oculto hasta que exista una función real.
3. `AuditLog.ip`: columna sin uso (decidir: no registrar, o registrar con plazo corto).
4. `notes` libres (Customer, Sale, Quote): limitar y avisar al usuario de no escribir datos sensibles.
5. `proofUrl` base64 en base de datos: aumenta el tamaño de respaldos y su exposición; mantener solo mientras haya deuda y fiscalmente necesario, definir plazo.

## 5. Dónde viajan o se copian los datos

| Lugar | Qué contiene | Riesgo / hallazgo |
|---|---|---|
| Audit log (`audit()` en `common.ts`) | Crear cliente guarda la fila completa `after: row` (nombre, teléfono, correo, RNC, cumpleaños, notas) en `AuditLog.after` (admin.ts:160). Editar cliente NO se audita | Copia permanente de PII; una anonimización debe depurar también `AuditLog.before/after` de entity=customer. Falta auditar edición |
| Visualización de audit-log | `GET /audit-log` (permiso `*`, últimas 300 filas) muestra before/after | Solo administración |
| Recibo PDF `sales/:id/receipt.pdf` | Nombre, RNC/cédula, teléfono del cliente; nombre del cajero | Descarga de PDF; no se guarda en servidor |
| Excel | Solo plantilla de productos y reporte de compras (proveedores). Reporte de clientes (`reports.ts:678`) usa nombre | No hay exportación masiva de clientes encontrada |
| Navegador (Dexie `fitstore-pos-v1`) | Tabla `cache` (catálogo por sucursal, sesión: usuario, rol, vencimiento), `sales` (ventas pendientes offline con `input.customerId`, pagos con cardLast4/approvalCode, y `receipt`), `merchandise` | Al cerrar sesión (`endSession` en `api.ts:266`) solo se borra la clave `session`; el resto (catálogo, ventas pendientes y recibos) permanece en el equipo. Si no hay red, solo se vence la sesión. Para una caja compartida es un dato personal residual |
| Respaldos | `scripts/backup.mjs` (pg_dump, retención 30 días), respaldo cloud a S3 con SSE-S3 y ciclo de vida 30 días, exports de Render 7 días | Los respaldos conservan clientes ya anonimizados hasta que expiren: informarlo en el procedimiento |
| Sentry servidor | `monitoring.ts`: elimina request, user, extra, contexts, breadcrumbs; mensaje genérico; sin trazas | Bien (minimización). Solo activo si hay `SENTRY_DSN` |
| Sentry navegador | `apps/web/src/monitoring.ts`: sin DSN fijo; apagado por defecto y solo activo si la web se compila con `VITE_SENTRY_DSN` (G8). Si se activa: borra user, cookies, headers, data; replay con maskAllText/maskAllInputs/blockAllMedia, 5% en errores, trazas 10% en producción | Envía a un tercero (Sentry, EE. UU.) IP del navegador, URL saneada, navegador/SO. Declarar en la política. Recomendado: revisar si el replay es necesario |
| Logs | `console.error` de excepciones 500 (`common.ts:433`) | Podrían incluir texto del error; revisar que no imprima cuerpo de solicitudes |
| Realtime events (`RealtimeEvent`) | Eventos por sucursal | No se confirmó que lleven datos personales; verificar |

## 6. Datos sensibles guardados (resumen)

- Fotos de comprobantes (bases64 en `Payment.proofUrl`).
- Últimos 4 dígitos de tarjeta y código de aprobación.
- RNC/cédula (identificador nacional) de clientes y en ventas con NCF.
- Hashes de contraseña y PIN (no reversibles).

No se guardan: números completos de tarjeta, CVV, huellas, datos de salud ni de menores.
