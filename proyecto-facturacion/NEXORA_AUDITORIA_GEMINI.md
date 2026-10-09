# Paquete de auditoría Nexora POS para Gemini

Generado por Claude el 2026-10-09. Contiene SOLO código y documentación públicos (el repositorio marcosfeliz28/awesome-outbid es público). No hay contraseñas, tokens, datos de clientes ni de producción. Si encuentras alguno, repórtalo sin copiarlo.

## Tu tarea
Audita de forma independiente el PR #1 (rama nexora-chatgpt contra nexora-cloud). Sistema: POS web/PWA para una tienda en República Dominicana, NestJS + Prisma + PostgreSQL 17 + React/Vite con Dexie. Prioriza: (1) integridad financiera y concurrencia; (2) autorización, sesiones y datos; (3) idempotencia de ventas/devoluciones/pagos y sincronización sin conexión; (4) caja, crédito/contraentrega, anulaciones; (5) inventario y lotes; (6) respaldos y migraciones; (7) PWA y accesibilidad; (8) privacidad; (9) dependencias y despliegue.
Los hallazgos de la sección 1 ya existen: CONFIRMA o REFUTA cada uno con archivo y línea, y añade los NUEVOS que encuentres.
No asumas contexto de otros proyectos: este NO usa Heap ni analítica.
Devuelve un archivo de texto con: dictamen (apto / apto con condiciones / no apto para multi-caja), hallazgos P0–P3 (archivo, línea, pasos para reproducir, impacto, corrección mínima, regresión propuesta), lo que no pudiste verificar. Sin parches especulativos; si propones código, en diff unificado aparte.

---
## 1. Cola de hallazgos conocidos (COLA_HALLAZGOS_NEXORA.md)
# Cola de hallazgos Nexora (commit c0b7105)

Origen: 8 revisiones en paralelo de Claude (lectura de código; lo marcado «CONFIRMADO» se comprobó leyendo el código fuente de las dependencias). Orden: se resuelven de arriba abajo. «Prueba» = regresión que debe fallar hoy.

## P1 · bloquea salir a producción

| ID | Hallazgo | Dónde | Corrección | Prueba |
|---|---|---|---|---|
| L1 | **El limitador de login no cuenta nada** (CONFIRMADO). `app.use()` corre antes del parser JSON de Nest, así que `req.body` es undefined y no hay clave por cuenta. Los tests inyectan `body` a mano y no lo ven. | main.ts:33, rate-limit.ts:60 | Mover el límite a un guard o middleware posterior al parser; usar `normalizeUsername` del login; truncar/hashear la clave a ≤120 caracteres; limitar también /auth/pin y /auth/refresh; no expulsar claves legítimas al llenar el mapa. | App real (supertest): 61 logins → 429; 10 001 claves falsas no resetean el cubo de otro usuario. |
| C1 | **Contraentrega esquiva aprobación y límite de crédito.** Un vendedor vende RD$ 5,000 pagando todo en `cod`: sin PIN, sin revisar `allowCreditSales` ni `creditLimit` (límite 0 = ilimitado). DECIDE LA DUEÑA: reglas de COD. | sales.ts:243-244, 491-503 | Tratar `cod` como saldo pendiente igual que crédito: PIN/límite/bandera. Definir qué significa límite 0. | seller + cod 5,000 sin PIN → 400. |
| C2 | **Arqueo ciego filtrable**: el cuadre abierto da fondo, ventas por método y total; el reporte por forma de pago da lo mismo; `POST close` con nota vacía y `movements out` sirven de oráculo (búsqueda binaria). | cash.ts:786-817, 551, 694-705 | Para quien no tiene `profit:read`/`sale:manage`: cuadre/reportes sólo tras cerrar, sin esperados; la nota se exige siempre que haya diferencia, sin revelar su tamaño; "no hay suficiente efectivo" sin cifras. | seller con caja abierta no puede calcular el esperado por ninguna ruta. |
| P1a | **Cambio de usuario por PIN** permite probar PIN de un admin con la sesión de una vendedora; el contador es por solicitante, no por objetivo (3 contadores independientes). DECIDE LA DUEÑA: exigir contraseña o gerente presente. | auth.ts:318-340, cash.ts:592, sales.ts:259, realtime.ts:280 | Contador por `userId` objetivo compartido por los tres flujos; bloquear tras 5 fallos. | 6 intentos contra el mismo objetivo desde cuentas distintas → bloqueo. |
| N2 | **nginx fija la IP de la API al arrancar** (CONFIRMADO). Si la API se reemplaza, la web da 502 hasta reiniciarla; `/healthz` no lo detecta. | start-nginx.sh:32-38, template:9, /healthz | Resolver por nombre con el resolvedor, o recargar el upstream cada 10 s; `/healthz` debe probar la API. | `docker compose restart api` y /api/health vuelve a 200 sin tocar la web. |
| I1 | **Lote existente se mezcla con otro vencimiento** y se vende vencido; lote nulo nunca recibe fecha; "L1" y "l1" son lotes distintos. | inventory.ts:883-912, 564-590; schema.prisma:156 | Rechazar vencimiento distinto para el mismo lote (como merchandise.ts:602); lote sin distinguir mayúsculas. | Recibir L1 con dos vencimientos → 400. |
| O1 | **Venta sin conexión con precio viejo queda en conflicto para siempre** y bloquea el cierre de caja; sólo hay «Reintentar». | POS.tsx:1514-1540, sales.ts:434-438, Management.tsx:1519-1560 | Ofrecer repreciar o descartar (con auditoría) y desbloquear el cierre. | Cola con expectedTotal viejo → se puede repreciar/descartar. |

## P2

| ID | Hallazgo | Dónde |
|---|---|---|
| D1 | Motivo de descuento obligatorio rompe ventas offline ya encoladas y reintentos de ventas guardadas: buscar por `offlineUuid` antes de exigirlo; aceptar vacío en legado. | sales.ts:269-282 |
| F1 | `GET /payments/:id/proof` usa `@Permit("*")` = sólo admin; gerentes pierden la foto. Debe ser `sale:manage` o la caja dueña. | sales.ts ~1628 |
| F2 | `safe()` no oculta `wasteCostTotal` y `GET /sales` incluye returns: fuga de costo a la cajera. Pasar a lista blanca. | common.ts:234-255, sales.ts:903 |
| E1 | Login: usuario inexistente/inactivo responde sin bcrypt (tiempo distinto); `change-password` revela cuentas pendientes. | auth.ts:139-141, 202 |
| E2 | Bloqueo incluye la IP: rotar IP evita el bloqueo por cuenta. DECIDE LA DUEÑA. | auth.ts:148 |
| M1 | Movimientos de caja y vales sin PIN ni tope: una falta se tapa con un `in` o un vale. | cash.ts:532-557, shared index.ts:563 |
| M2 | Dashboard: `revenue` resta devoluciones; daily/sellers/category/payments no. | reports.ts:142-194 |
| K1 | Ajustes y conteos `Serializable` sin reintento: 500 con ventas en paralelo (P2010/40001 no se traduce). | inventory.ts:521,615,1164,1206; common.ts:416 |
| K2 | Códigos únicos sin distinguir mayúsculas sólo en la aplicación; sin índice `lower()`; consulta recorre toda la tabla. | catalog.ts:59-96, schema.prisma:115 |
| S1 | PWA: `skipWaiting` + recarga puede perder el carrito en pleno cobro. | vite.config.ts:41, main.tsx:197 |
| S2 | Cola de ventas huérfana al cambiar vendedor con PIN / cerrar sesión; sin red la caja queda inutilizable. | App.tsx:714,497,819; api.ts:277,479 |
| S3 | `RD$ NaN` y `undefined%` cuando la API oculta campos por permiso; «Editar variante» exige `costAvg` oculto. | Management.tsx:1921-1930,582; Merchandise.tsx:1486 |
| S4 | F8 guarda y vacía el carrito con el modal de cobro abierto. | POS.tsx:357-366 |
| X1 | `.dockerignore` sólo cubre la raíz; `apps/api/.env` iría a la imagen. | .dockerignore:5-6 |
| X2 | API privada sin health check real; el despliegue se da por bueno al abrir el puerto. | render.yaml:32 |
| X3 | Sandbox de auditoría: falla en la 2.ª ejecución (volumen conserva contraseña vieja) y el comando usa rutas de binarios incorrectas. | Start-NexoraAuditSandbox.ps1:10; compose.audit.yaml:30 |
| X4 | Respaldos: nunca se restaura de verdad (sólo `pg_restore --list`); sin poda en S3; errores de pg_dump ocultos. | render-backup.mjs:48,107 |
| W1 | Instalador: instalación «nueva» sobrescribe `secrets.json` aunque haya base. | Install-FitStore.ps1:338-366 |
| W2 | Instalador: respaldos y respaldo final en Documentos públicos legibles por todos. | FitStore.nsi:109,243; Uninstall:83 |
| W3 | Instalador: API y web corren como LocalSystem. | service/*.xml.template |
| W4 | Instalador: marcador de actualización viejo dispara rollback que pisa ventas nuevas. | Preflight:35; FitStore.nsi:147; Rollback:138 |

## P3 (resumen; detalle en los informes de Claude)

Recepción/ajustes: merma con cantidad positiva suma stock (inventory.ts:510); impuestos capitalizados en el costo (merchandise.ts:510); importador sin límite de descompresión (catalog.ts:459); índices faltantes en InventoryMovement/GoodsReceipt. Caja: monto 0.004 o 1e15 en movimientos; reembolso en efectivo sin revisar gaveta; venta de total 0; diferencias se compensan y la alerta sólo mira efectivo; autorizador del descuento mal atribuido si el PIN fue por crédito y promoción sin regla. Auth: logout y refresh sin detección de reutilización; auditoría guarda `proofUrl` base64 y `approvalCode`; `editCustomer` sin auditoría; `roles` acepta permisos arbitrarios; `quotes` sin `branchId`. Web: blob URL sin revocar, `AbortSignal.timeout` en Safari viejo, `navigateFallbackDenylist` ausente, `aria-pressed`, datos de clientes en IndexedDB tras cerrar sesión. Infra: nginx como root, imágenes sin resumen, cabeceras duplicadas en /api, `Cache-Control` ausente en /api, CRLF reescribe schema.prisma. Kardex: devolución valorada distinto a `SaleReturn.costTotal`.

## Pendiente de recibir
- Suite de integración y navegador sobre PostgreSQL real (agente en curso).

## Cumplimiento (lista de 20 puntos; ver docs/legal/CUMPLIMIENTO_20_PUNTOS.md)

Prioridad P1 = antes de imprimir tickets reales a clientes.

| ID | Pri | Hallazgo | Dónde | Corrección | Prueba |
|---|---|---|---|---|---|
| G1 | P1 | **El ticket de 80 mm se titula «FACTURA», tiene «NCF:» vacío y no dice que no es fiscal.** | Prints.tsx:308-309 | Quitar «FACTURA»; imprimir «DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL» si no hay NCF; ocultar la fila NCF vacía. | Render del ticket sin NCF contiene la leyenda y no contiene «FACTURA». |
| G2 | P1 | Nombre y dirección fijos («Grupo Macgen», «Plaza Lope de Vega»); ignora Ajustes. | Prints.tsx:79-80 | Usar `name`, `branchName`, `address`, `phone`, `legalId` de Ajustes. | Cambiar el nombre en Ajustes cambia el ticket. |
| G3 | P2 | `legalId`, `address`, `phone` pueden guardarse vacíos. | admin.ts:58-61 | Obligatorios en Ajustes (DECIDE LA DUEÑA: confirmar datos). | PUT settings sin RNC → 400. |
| G4 | P2 | Sin política de devoluciones/garantía en ticket; `returnDays` sólo valida. | sales.ts:1263 | Campos `returnPolicyText` y `warrantyDays` en Ajustes e impresión en el pie. DECIDE LA DUEÑA: texto y días. | El ticket imprime la política configurada. |
| G5 | P2 | PDF de venta: sin teléfono ni hora; siempre «ITBIS incluido» aunque `taxIncluded` sea falso. PDF de nota de crédito: sin datos del negocio, fecha ni condiciones. | sales.ts:1527-1558, 1852-1938 | Completar encabezados y condiciones. | PDF contiene teléfono, hora y la leyenda de ITBIS correcta. |
| G6 | P2 | No hay forma de anonimizar un cliente; `editCustomer` sin auditoría; el audit-log guarda la ficha completa (teléfono, correo, RNC). | admin.ts:160-186 | `POST /customers/:id/anonymize` con permiso `customers:erase`; rechaza con deuda; conserva ventas y montos; depura AuditLog.before/after. | 403 vendedor; 409 con crédito pendiente; venta conserva total y número; audit-log sin el teléfono. |
| G7 | P2 | `Customer.birthday` y `email` sin uso; `AuditLog.ip` nunca se llena. | schema.prisma, admin.ts | Quitar `birthday` de esquema, API y migración; decidir `email`. | — |
| G8 | P2 | Sentry web siempre activo, DSN fijo, sin interruptor; mensajes de excepción sin sanear. | apps/web/src/monitoring.ts | Interruptor en Ajustes o variable; sanear mensajes. DECIDE LA DUEÑA. | Con el interruptor apagado no hay peticiones a Sentry. |
| G9 | P2 | Al cerrar sesión quedan en el navegador catálogo, ventas offline y datos de pago. | api.ts `endSession` | Limpiar tablas de clientes y caché cuando no haya ventas pendientes. | Tras cerrar sesión, IndexedDB no contiene datos de clientes. |
| G10 | P2 | Contraste bajo AA: botón Cobrar `#059669` (3.77), foco `#a78bfa` en claro (2.72), bordes de campo (1.20/1.34), avisos `#b96c0b`, rojos, gris `#a6aab8`. | styles.css | Valores propuestos en docs/legal/ACCESIBILIDAD.md. | Prueba de contraste (script) y axe en ambos temas. |
| G11 | P2 | F4/F8/F12 se disparan con un modal abierto (junto con S4). | POS.tsx:405-422 | Ignorar atajos si hay `[role=dialog]`. | E2E: F8 con el cobro abierto no vacía el carrito. |
| G12 | P3 | Subida de archivos sólo con mouse; buscador Ctrl+K sin nombre accesible; `listbox` inválido; menú lateral cerrado recibe foco; avisos a 6 s sin pausa; sesión por inactividad sin aviso previo. | Management.tsx:2559, Tienda.tsx:824, App.tsx:741, Merchandise.tsx:~233 | Ver ACCESIBILIDAD.md. | axe sin violaciones críticas. |
| G13 | P3 | Frases sin respaldo: «Lo más seguro», «Anulación auditada», «Respaldos cifrados», docs `AUDITORIA_*` presentados como auditoría independiente, «Facturación» en el manifest, título «Monitoreo seguro». | Management.tsx, docs/ENTREGA.md, SENTRY-API.md, vite manifest | Reescribir según docs/legal/LICENCIAS_Y_AFIRMACIONES.md. | grep de frases prohibidas en CI. |
| G14 | P3 | Faltan avisos de licencia (Inter y Plus Jakarta Sans OFL, lucide ISC, MIT/BSD en el JS compilado); THIRD_PARTY_NOTICES.txt sólo cubre 5 binarios; origen del ícono y de las SVG sin documentar. | public/, instalador/THIRD_PARTY_NOTICES.txt | Añadir avisos y página «Acerca de» con enlace legal. | La app expone /licencias con los avisos. |
| G15 | P3 | Mostrar qué promoción automática se aplicó; promoción sin regla guardada. | sales.ts:370-397 | Guardar y imprimir el nombre de la promoción. | Ticket con promoción la nombra. |


## Mejoras de interfaz (no bloquean producción)

| ID | Pri | Tarea | Condición |
|---|---|---|---|
| U1 | P3 | **Reducido:** casi todo el rediseño ya existe; sólo queda el tamaño del total, barra de desplazamiento fina y capturas (ver `docs/coordinacion/PROMPT_UI_POS.md`). | Sólo después de integración 157/157 y CI en verde, y de fusionar B0–B6 y O1/S1–S4. |

---
## 2. Esquema de base de datos (apps/api/prisma/schema.prisma, rama nexora-cloud)
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Role {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique
  permissions String[]
  users       User[]
  updatedAt   DateTime @updatedAt
}

model User {
  id                 String    @id @default(uuid()) @db.Uuid
  name               String
  // Nombre corto que la persona escribe para entrar (por ejemplo, "E Soto").
  username           String?
  // Versión normalizada, sin acentos y en minúsculas, para buscar sin errores.
  usernameKey        String?   @unique
  email              String    @unique
  passwordHash       String
  mustChangePassword Boolean   @default(false)
  pinHash            String
  roleId             String    @db.Uuid
  role               Role      @relation(fields: [roleId], references: [id])
  active             Boolean   @default(true)
  authVersion        Int       @default(0)
  failedAttempts     Int       @default(0)
  lockedUntil        DateTime?
  branchId           String    @default("main")
  // Número de cajero visible en el cuadre y los reportes (p. ej. 1031).
  cashierNumber      Int?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}

model RefreshToken {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  authVersion Int      @default(0)
  sessionId   String?  @db.Uuid
  hash        String   @unique
  expiresAt   DateTime
  createdAt   DateTime @default(now())
}

model Category {
  id             String    @id @default(uuid()) @db.Uuid
  name           String    @unique
  requiresLot    Boolean   @default(false)
  requiresExpiry Boolean   @default(false)
  color          String    @default("#7C3AED")
  attributes     Json      @default("[]")
  products       Product[]
  branchId       String    @default("main")
  createdBy      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}

model Brand {
  id   String @id @default(uuid()) @db.Uuid
  name String @unique
}

model Supplier {
  id               String   @id @default(uuid()) @db.Uuid
  name             String
  legalId          String?
  phone            String?
  email            String?
  paymentTermsDays Int      @default(30)
  leadTimeDays     Int      @default(7)
  active           Boolean  @default(true)
  branchId         String   @default("main")
  createdBy        String?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Product {
  id          String    @id @default(uuid()) @db.Uuid
  name        String
  sku         String    @unique
  categoryId  String    @db.Uuid
  category    Category  @relation(fields: [categoryId], references: [id])
  brand       String    @default("FitStore")
  supplierId  String?   @db.Uuid
  description String    @default("")
  imageUrl    String?
  taxRate     Decimal   @default(18) @db.Decimal(5, 2)
  minStock    Decimal   @default(5) @db.Decimal(14, 3)
  maxStock    Decimal   @default(80) @db.Decimal(14, 3)
  unit        String    @default("unidad")
  location    String    @default("")
  active      Boolean   @default(true)
  isKit       Boolean   @default(false)
  variants    Variant[]
  branchId    String    @default("main")
  createdBy   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([name])
}

model Variant {
  id             String              @id @default(uuid()) @db.Uuid
  productId      String              @db.Uuid
  product        Product             @relation(fields: [productId], references: [id])
  sku            String              @unique
  barcode        String              @unique
  attributes     Json                @default("{}")
  costAvg        Decimal             @db.Decimal(14, 2)
  price          Decimal             @db.Decimal(14, 2)
  wholesalePrice Decimal?            @db.Decimal(14, 2)
  stock          Decimal             @default(0) @db.Decimal(14, 3)
  active         Boolean             @default(true)
  lots           Lot[]
  movements      InventoryMovement[]
  saleItems      SaleItem[]
  branchId       String              @default("main")
  createdBy      String?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
}

model KitComponent {
  id                 String  @id @default(uuid()) @db.Uuid
  kitVariantId       String  @db.Uuid
  componentVariantId String  @db.Uuid
  qty                Decimal @db.Decimal(14, 3)

  @@unique([kitVariantId, componentVariantId])
}

model Lot {
  id         String              @id @default(uuid()) @db.Uuid
  variantId  String              @db.Uuid
  variant    Variant             @relation(fields: [variantId], references: [id])
  lotNumber  String
  expiryDate DateTime?
  qty        Decimal             @db.Decimal(14, 3)
  cost       Decimal             @db.Decimal(14, 2)
  branchId   String              @default("main")
  createdBy  String?
  createdAt  DateTime            @default(now())
  updatedAt  DateTime            @updatedAt
  movements  InventoryMovement[]

  @@unique([variantId, lotNumber])
  @@index([expiryDate])
}

model InventoryMovement {
  id           String   @id @default(uuid()) @db.Uuid
  variantId    String   @db.Uuid
  variant      Variant  @relation(fields: [variantId], references: [id])
  lotId        String?  @db.Uuid
  lot          Lot?     @relation(fields: [lotId], references: [id], onDelete: Restrict)
  type         String
  qty          Decimal  @db.Decimal(14, 3)
  unitCost     Decimal  @db.Decimal(14, 2)
  balanceAfter Decimal  @db.Decimal(14, 3)
  refId        String?
  reason       String
  userId       String
  branchId     String   @default("main")
  createdAt    DateTime @default(now())

  @@index([lotId])
  @@index([variantId, createdAt])
}

model Customer {
  id          String    @id @default(uuid()) @db.Uuid
  creditLimit Decimal   @default(0) @db.Decimal(14, 2)
  name        String
  phone       String?
  email       String?
  legalId     String?
  birthday    DateTime?
  notes       String    @default("")
  active      Boolean   @default(true)
  branchId    String    @default("main")
  createdBy   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Sale {
  id                     String       @id @default(uuid()) @db.Uuid
  number                 String       @unique
  status                 String       @default("completed")
  offlineUuid            String       @unique @db.Uuid
  requestHash            String       @default("")
  customerId             String?      @db.Uuid
  sellerId               String       @db.Uuid
  cashSessionId          String?      @db.Uuid
  subtotal               Decimal      @db.Decimal(14, 2)
  discountTotal          Decimal      @db.Decimal(14, 2)
  discountReason         String?
  discountRule           String?
  discountApprovedBy   String?      @db.Uuid
  discountApprovedName String?
  discountApprovedRole String?
  taxTotal               Decimal      @db.Decimal(14, 2)
  total                  Decimal      @db.Decimal(14, 2)
  costTotal              Decimal      @db.Decimal(14, 2)
  creditBalance          Decimal      @default(0) @db.Decimal(14, 2)
  creditDueDate          DateTime?
  ncf                    String?      @unique
  ncfType                String?
  recipientLegalId       String?
  fiscalStatus           String       @default("not_issued")
  notes                  String       @default("")
  voidedReason           String?
  voidedBy               String?
  items                  SaleItem[]
  payments               Payment[]
  returns                SaleReturn[]
  branchId               String       @default("main")
  createdAt              DateTime     @default(now())
  updatedAt              DateTime     @updatedAt

  @@index([createdAt])
  @@index([sellerId, createdAt])
}

model SaleItem {
  id               String  @id @default(uuid()) @db.Uuid
  saleId           String  @db.Uuid
  sale             Sale    @relation(fields: [saleId], references: [id])
  variantId        String  @db.Uuid
  variant          Variant @relation(fields: [variantId], references: [id])
  lotId            String? @db.Uuid
  qty              Decimal @db.Decimal(14, 3)
  returnedQty      Decimal @default(0) @db.Decimal(14, 3)
  unitPrice        Decimal @db.Decimal(14, 2)
  unitCost         Decimal @db.Decimal(14, 2)
  discount         Decimal @db.Decimal(14, 2)
  tax              Decimal @db.Decimal(14, 2)
  lineTotal        Decimal @db.Decimal(14, 2)
  stockAllocations Json    @default("[]")

  @@index([variantId])
}

model Payment {
  id             String   @id @default(uuid()) @db.Uuid
  saleId         String   @db.Uuid
  sale           Sale     @relation(fields: [saleId], references: [id])
  cashSessionId  String?  @db.Uuid
  creditNoteId   String?  @db.Uuid
  entryType      String   @default("sale")
  idempotencyKey String?  @unique @db.Uuid
  createdAt      DateTime @default(now())
  method         String
  amount         Decimal  @db.Decimal(14, 2)
  tendered       Decimal  @db.Decimal(14, 2)
  change         Decimal  @default(0) @db.Decimal(14, 2)
  bank           String?
  reference      String?
  cardBrand      String?
  cardLast4      String?
  approvalCode   String?
  cardType       String?
  feeAmount      Decimal  @default(0) @db.Decimal(14, 2)
  status         String   @default("ok")
  proofUrl       String?
}

model SaleReturn {
  id             String   @id @default(uuid()) @db.Uuid
  saleId         String   @db.Uuid
  sale           Sale     @relation(fields: [saleId], references: [id])
  number         String   @unique
  reason         String
  total          Decimal  @db.Decimal(14, 2)
  taxTotal       Decimal  @db.Decimal(14, 2)
  costTotal      Decimal  @db.Decimal(14, 2)
  // Unidades que no volvieron al stock vendible y su costo (merma): se
  // registran aparte para no descontar la utilidad dos veces (R9-A05).
  wasteQty       Decimal  @default(0) @db.Decimal(14, 3)
  wasteCostTotal Decimal  @default(0) @db.Decimal(14, 2)
  refundAmount   Decimal  @default(0) @db.Decimal(14, 2)
  refundMethod   String
  cashSessionId  String?  @db.Uuid
  userId         String
  items          Json
  branchId       String   @default("main")
  // Clave de la operación que envía la interfaz: un reintento devuelve esta fila (R9-A01).
  operationId    String?  @unique @db.Uuid
  createdAt      DateTime @default(now())
}

model CreditNote {
  id             String   @id @default(uuid()) @db.Uuid
  redemptionCode String   @unique
  returnId       String   @unique @db.Uuid
  customerId     String?  @db.Uuid
  amount         Decimal  @db.Decimal(14, 2)
  balance        Decimal  @db.Decimal(14, 2)
  createdAt      DateTime @default(now())
}

model Quote {
  id             String   @id @default(uuid()) @db.Uuid
  type           String   @default("quote")
  customerId     String?  @db.Uuid
  userId         String
  items          Json
  notes          String   @default("")
  globalDiscount Decimal  @default(0) @db.Decimal(5, 2)
  status         String   @default("open")
  branchId       String   @default("main")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PurchaseOrder {
  id              String         @id @default(uuid()) @db.Uuid
  number          String         @unique
  supplierId      String         @db.Uuid
  status          String         @default("ordered")
  expectedDate    DateTime?
  total           Decimal        @db.Decimal(14, 2)
  // Documento del proveedor y condición de pago (opcionales; se completan después).
  supplierInvoice String?
  supplierNcf     String?
  invoiceDate     DateTime?
  paymentType     String?
  creditDays      Int?
  itbis           Decimal?       @db.Decimal(14, 2)
  items           PurchaseItem[]
  receipts        GoodsReceipt[]
  branchId        String         @default("main")
  createdBy       String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model PurchaseItem {
  id          String        @id @default(uuid()) @db.Uuid
  orderId     String        @db.Uuid
  order       PurchaseOrder @relation(fields: [orderId], references: [id])
  variantId   String        @db.Uuid
  qty         Decimal       @db.Decimal(14, 3)
  receivedQty Decimal       @default(0) @db.Decimal(14, 3)
  // Dañadas o rechazadas al recibir: no entran al stock y cierran lo pendiente.
  damagedQty  Decimal       @default(0) @db.Decimal(14, 3)
  unitCost    Decimal       @db.Decimal(14, 2)
}

model GoodsReceipt {
  id                String         @id @default(uuid()) @db.Uuid
  orderId           String?        @db.Uuid
  order             PurchaseOrder? @relation(fields: [orderId], references: [id])
  // Compras sin orden: proveedor, total (líneas + flete + impuestos) y comprobante.
  supplierId        String?        @db.Uuid
  total             Decimal?       @db.Decimal(14, 2)
  attachmentId      String?        @db.Uuid
  operationId       String?        @unique @db.Uuid
  freight           Decimal        @db.Decimal(14, 2)
  otherCosts        Decimal        @db.Decimal(14, 2)
  items             Json
  // Documento del proveedor y condición de pago (para la contable y el 606).
  supplierInvoice   String?
  supplierNcf       String?
  invoiceDate       DateTime?
  paymentType       String?
  creditDays        Int?
  itbis             Decimal?       @db.Decimal(14, 2)
  // Costo de lo dañado o rechazado (fuera del total que se debe).
  damagedCost       Decimal        @default(0) @db.Decimal(14, 2)
  // Total del documento del proveedor tal como se presentó, y la diferencia
  // reconocida: factura − aceptado (total) − dañado (R9-A03).
  invoiceTotal      Decimal?       @db.Decimal(14, 2)
  invoiceDifference Decimal        @default(0) @db.Decimal(14, 2)
  userId            String
  branchId          String         @default("main")
  createdAt         DateTime       @default(now())

  @@index([supplierId, createdAt])
}

model SupplierPayment {
  id         String   @id @default(uuid()) @db.Uuid
  supplierId String   @db.Uuid
  amount     Decimal  @db.Decimal(14, 2)
  method     String
  reference  String?
  branchId   String   @default("main")
  createdBy  String?
  createdAt  DateTime @default(now())
}

model InventoryCount {
  id        String   @id @default(uuid()) @db.Uuid
  items     Json
  status    String   @default("pending")
  userId    String
  appliedBy String?
  branchId  String   @default("main")
  createdAt DateTime @default(now())
}

model CashSession {
  id                 String    @id @default(uuid()) @db.Uuid
  registerId         String    @default("terminal-1")
  userId             String
  openingAmount      Decimal   @db.Decimal(14, 2)
  openedAt           DateTime  @default(now())
  closedAt           DateTime?
  expectedCash       Decimal?  @db.Decimal(14, 2)
  countedCash        Decimal?  @db.Decimal(14, 2)
  expectedCard       Decimal?  @db.Decimal(14, 2)
  countedCard        Decimal?  @db.Decimal(14, 2)
  expectedTransfer   Decimal?  @db.Decimal(14, 2)
  countedTransfer    Decimal?  @db.Decimal(14, 2)
  differenceCash     Decimal?  @db.Decimal(14, 2)
  differenceCard     Decimal?  @db.Decimal(14, 2)
  differenceTransfer Decimal?  @db.Decimal(14, 2)
  difference         Decimal?  @db.Decimal(14, 2)
  notes              String    @default("")
  // Cuadre de la tienda: denominaciones, vales, US$/€ y entregado/dejado.
  closeDetails       Json?
  branchId           String    @default("main")

  @@index([userId, closedAt])
}

model CashMovement {
  id        String   @id @default(uuid()) @db.Uuid
  sessionId String   @db.Uuid
  type      String
  amount    Decimal  @db.Decimal(14, 2)
  reason    String
  userId    String
  createdAt DateTime @default(now())
}

model ExpenseCategory {
  id            String    @id @default(uuid()) @db.Uuid
  name          String    @unique
  monthlyBudget Decimal   @default(10000) @db.Decimal(14, 2)
  expenses      Expense[]
}

model Expense {
  id          String          @id @default(uuid()) @db.Uuid
  categoryId  String          @db.Uuid
  category    ExpenseCategory @relation(fields: [categoryId], references: [id])
  date        DateTime        @default(now())
  amount      Decimal         @db.Decimal(14, 2)
  method      String
  supplierId  String?
  description String
  receiptUrl  String?
  recurring   Boolean         @default(false)
  voided      Boolean         @default(false)
  branchId    String          @default("main")
  createdBy   String?
  createdAt   DateTime        @default(now())
  updatedAt   DateTime        @updatedAt

  @@index([date])
}

model Promotion {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  type        String   @default("percent")
  value       Decimal  @db.Decimal(14, 2)
  startsAt    DateTime
  endsAt      DateTime
  scope       Json
  active      Boolean  @default(true)
  isClearance Boolean  @default(false)
  branchId    String   @default("main")
  createdBy   String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Alert {
  id        String   @id @default(uuid()) @db.Uuid
  key       String   @unique
  type      String
  severity  String
  entityId  String
  message   String
  status    String   @default("new")
  branchId  String   @default("main")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model AlertRule {
  id        String   @id @default(uuid()) @db.Uuid
  type      String   @unique
  threshold Json
  active    Boolean  @default(true)
  updatedAt DateTime @updatedAt
}

model AuditLog {
  terminalId String?  @db.Uuid
  id         String   @id @default(uuid()) @db.Uuid
  userId     String
  action     String
  entity     String
  entityId   String
  before     Json?
  after      Json?
  ip         String?
  branchId   String   @default("main")
  createdAt  DateTime @default(now())

  @@index([createdAt])
}

model Settings {
  id        String   @id @default("main")
  data      Json
  updatedAt DateTime @updatedAt
}

model Counter {
  key   String @id
  value Int    @default(0)
}

model AuthAttempt {
  key            String    @id
  failedAttempts Int       @default(0)
  lockedUntil    DateTime?
}

model AuthSession {
  terminalId     String?  @db.Uuid
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @db.Uuid
  lastActivityAt DateTime @default(now())

  @@index([userId])
}

model Terminal {
  id             String    @id @db.Uuid
  name           String
  branchId       String
  revokedAt      DateTime?
  lastActivityAt DateTime  @default(now())
  createdAt      DateTime  @default(now())
  // Enrolamiento: un equipo nuevo de vendedor/almacén espera aprobación de un gerente.
  approvedAt     DateTime?
  approvedBy     String?   @db.Uuid
  // Hash del secreto que guarda el dispositivo; impide reclamar el ID desde otro equipo.
  secretHash     String?
  createdBy      String?   @db.Uuid
  lastUserId     String?   @db.Uuid
  // Registrado antes de la ronda 4 (sin secreto): requiere aprobación de un gerente.
  legacy         Boolean   @default(false)
  // Caja que se imprime en el cuadre y los reportes (p. ej. 4012 «GPRO STORE RD»).
  registerNumber Int?
  registerName   String?
}

model RealtimeEvent {
  id        BigInt   @id @default(autoincrement())
  branchId  String
  type      String
  data      Json
  createdAt DateTime @default(now())

  @@index([branchId, id])
}

model MerchandiseOperation {
  id          String   @id @db.Uuid
  branchId    String
  userId      String
  terminalId  String?  @db.Uuid
  requestHash String
  result      Json
  createdAt   DateTime @default(now())
}

model SupplierImportProfile {
  id         String @id @default(uuid()) @db.Uuid
  supplierId String @db.Uuid
  branchId   String
  mapping    Json

  @@unique([supplierId, branchId])
}

model SupplierCode {
  id         String @id @default(uuid()) @db.Uuid
  supplierId String @db.Uuid
  branchId   String
  code       String
  variantId  String @db.Uuid

  @@unique([supplierId, branchId, code])
}

model InvoiceDraft {
  id                   String   @id @default(uuid()) @db.Uuid
  branchId             String
  userId               String
  supplierId           String?  @db.Uuid
  lines                Json
  total                Decimal? @db.Decimal(14, 2)
  attachmentId         String?  @db.Uuid
  confirmedOperationId String?  @unique @db.Uuid
  createdAt            DateTime @default(now())
}

model InvoiceAttachment {
  id        String   @id @default(uuid()) @db.Uuid
  branchId  String
  userId    String
  mime      String
  data      Bytes
  createdAt DateTime @default(now())
}
```

---
## 3. Diff del PR #1 (nexora-cloud...nexora-chatgpt), sin lockfile ni documentación de rondas
```diff
diff --git a/apps/api/package.json b/apps/api/package.json
index e18d2cb..cd22a00 100644
--- a/apps/api/package.json
+++ b/apps/api/package.json
@@ -27,6 +27,7 @@
     "cookie-parser": "^1.4.7",
     "dotenv": "^17.2.0",
     "exceljs": "^4.4.0",
+    "express": "^5.2.1",
     "helmet": "^8.1.0",
     "pdfkit": "^0.17.0",
     "reflect-metadata": "^0.2.2",
diff --git a/apps/api/prisma/migrations/202610140001_lot_identity/migration.sql b/apps/api/prisma/migrations/202610140001_lot_identity/migration.sql
new file mode 100644
index 0000000..0dc1aa3
--- /dev/null
+++ b/apps/api/prisma/migrations/202610140001_lot_identity/migration.sql
@@ -0,0 +1,102 @@
+-- I1: dentro de una variante, el código normalizado identifica un solo lote.
+-- El vencimiento puede completar un lote histórico sin fecha, pero no dividir
+-- la identidad en dos registros.
+ALTER TABLE "Lot" ADD COLUMN "lotNumberNormalized" TEXT;
+
+UPDATE "Lot"
+SET "lotNumberNormalized" = upper(
+  regexp_replace(btrim(normalize("lotNumber", NFKC)), '\s+', ' ', 'g')
+);
+
+-- No se decide silenciosamente entre dos días de vencimiento reales. Esta
+-- comprobación ocurre antes de modificar referencias o eliminar duplicados.
+DO $$
+BEGIN
+  IF EXISTS (
+    SELECT 1
+    FROM "Lot"
+    WHERE "expiryDate" IS NOT NULL
+    GROUP BY "variantId", "lotNumberNormalized"
+    HAVING count(DISTINCT to_char("expiryDate" - interval '4 hours', 'YYYY-MM-DD')) > 1
+  ) THEN
+    RAISE EXCEPTION
+      'No se pueden fusionar lotes con el mismo código y vencimientos distintos'
+      USING ERRCODE = '23514';
+  END IF;
+END $$;
+
+-- Conserva el lote más antiguo. El mapa se usa para actualizar todas las
+-- referencias antes de borrar las copias.
+CREATE TEMP TABLE "_LotIdentityMerge" ON COMMIT DROP AS
+SELECT id,
+       first_value(id) OVER (
+         PARTITION BY "variantId", "lotNumberNormalized"
+         ORDER BY "createdAt", id
+       ) AS keeper
+FROM "Lot";
+
+UPDATE "InventoryMovement" AS movement
+SET "lotId" = mapping.keeper
+FROM "_LotIdentityMerge" AS mapping
+WHERE movement."lotId" = mapping.id AND mapping.id <> mapping.keeper;
+
+-- Las devoluciones y anulaciones usan estas asignaciones JSONB para devolver
+-- stock al lote original. Reescribirlas evita referencias a lotes eliminados.
+UPDATE "SaleItem" AS item
+SET "stockAllocations" = (
+  SELECT coalesce(
+    jsonb_agg(
+      CASE
+        WHEN mapping.keeper IS NULL THEN allocation.value
+        ELSE jsonb_set(
+          allocation.value,
+          '{lotId}',
+          to_jsonb(mapping.keeper::text),
+          false
+        )
+      END
+      ORDER BY allocation.ordinality
+    ),
+    '[]'::jsonb
+  ) AS value
+  FROM jsonb_array_elements(item."stockAllocations")
+       WITH ORDINALITY AS allocation(value, ordinality)
+  LEFT JOIN "_LotIdentityMerge" AS mapping
+    ON allocation.value->>'lotId' = mapping.id::text
+)
+WHERE EXISTS (
+  SELECT 1
+  FROM jsonb_array_elements(item."stockAllocations") AS allocation(value)
+  JOIN "_LotIdentityMerge" AS mapping
+    ON allocation.value->>'lotId' = mapping.id::text
+  WHERE mapping.id <> mapping.keeper
+);
+
+WITH totals AS (
+  SELECT mapping.keeper,
+         sum(lot.qty) AS qty,
+         coalesce(
+           sum(lot.qty * lot.cost) / nullif(sum(lot.qty), 0),
+           max(lot.cost)
+         ) AS cost,
+         min(lot."expiryDate") FILTER (WHERE lot."expiryDate" IS NOT NULL)
+           AS "expiryDate"
+  FROM "_LotIdentityMerge" AS mapping
+  JOIN "Lot" AS lot ON lot.id = mapping.id
+  GROUP BY mapping.keeper
+)
+UPDATE "Lot" AS lot
+SET qty = totals.qty,
+    cost = round(totals.cost, 2),
+    "expiryDate" = totals."expiryDate"
+FROM totals
+WHERE lot.id = totals.keeper;
+
+DELETE FROM "Lot" AS lot
+USING "_LotIdentityMerge" AS mapping
+WHERE lot.id = mapping.id AND mapping.id <> mapping.keeper;
+
+ALTER TABLE "Lot" ALTER COLUMN "lotNumberNormalized" SET NOT NULL;
+DROP INDEX "Lot_variantId_lotNumber_key";
+CREATE UNIQUE INDEX "Lot_variantId_lotNumberNormalized_key"
+ON "Lot"("variantId", "lotNumberNormalized");
diff --git a/apps/api/prisma/migrations/202610150001_customer_erasure_permission/migration.sql b/apps/api/prisma/migrations/202610150001_customer_erasure_permission/migration.sql
new file mode 100644
index 0000000..b73ba86
--- /dev/null
+++ b/apps/api/prisma/migrations/202610150001_customer_erasure_permission/migration.sql
@@ -0,0 +1,4 @@
+UPDATE "Role"
+SET "permissions" = array_append("permissions", 'customers:erase')
+WHERE "name" = 'manager'
+  AND NOT ('customers:erase' = ANY("permissions"));
diff --git a/apps/api/prisma/migrations/202610150002_remove_customer_birthday/migration.sql b/apps/api/prisma/migrations/202610150002_remove_customer_birthday/migration.sql
new file mode 100644
index 0000000..4495eb0
--- /dev/null
+++ b/apps/api/prisma/migrations/202610150002_remove_customer_birthday/migration.sql
@@ -0,0 +1 @@
+ALTER TABLE "Customer" DROP COLUMN IF EXISTS "birthday";
diff --git a/apps/api/prisma/schema.prisma b/apps/api/prisma/schema.prisma
index d28bee5..1666114 100644
--- a/apps/api/prisma/schema.prisma
+++ b/apps/api/prisma/schema.prisma
@@ -140,20 +140,21 @@ model KitComponent {
 }
 
 model Lot {
-  id         String              @id @default(uuid()) @db.Uuid
-  variantId  String              @db.Uuid
-  variant    Variant             @relation(fields: [variantId], references: [id])
-  lotNumber  String
-  expiryDate DateTime?
-  qty        Decimal             @db.Decimal(14, 3)
-  cost       Decimal             @db.Decimal(14, 2)
-  branchId   String              @default("main")
-  createdBy  String?
-  createdAt  DateTime            @default(now())
-  updatedAt  DateTime            @updatedAt
-  movements  InventoryMovement[]
-
-  @@unique([variantId, lotNumber])
+  id                  String              @id @default(uuid()) @db.Uuid
+  variantId           String              @db.Uuid
+  variant             Variant             @relation(fields: [variantId], references: [id])
+  lotNumber           String
+  lotNumberNormalized String
+  expiryDate          DateTime?
+  qty                 Decimal             @db.Decimal(14, 3)
+  cost                Decimal             @db.Decimal(14, 2)
+  branchId            String              @default("main")
+  createdBy           String?
+  createdAt           DateTime            @default(now())
+  updatedAt           DateTime            @updatedAt
+  movements           InventoryMovement[]
+
+  @@unique([variantId, lotNumberNormalized])
   @@index([expiryDate])
 }
 
@@ -184,7 +185,6 @@ model Customer {
   phone       String?
   email       String?
   legalId     String?
-  birthday    DateTime?
   notes       String    @default("")
   active      Boolean   @default(true)
   branchId    String    @default("main")
diff --git a/apps/api/prisma/seed.ts b/apps/api/prisma/seed.ts
index 6a0a069..64f7cf9 100644
--- a/apps/api/prisma/seed.ts
+++ b/apps/api/prisma/seed.ts
@@ -2,7 +2,12 @@ import { config } from "dotenv";
 import { randomUUID } from "node:crypto";
 import { PrismaClient } from "@prisma/client";
 import { hash } from "bcryptjs";
-import { permissions, lineTotals, d, money } from "@fitstore/shared";
+import {
+  permissions,
+  lineTotals,
+  d,
+  money,
+} from "@fitstore/shared";
 config({ path: "../../.env" });
 const db = new PrismaClient();
 const id = () => randomUUID();
@@ -480,7 +485,16 @@ async function main() {
           return variant;
         }),
       });
-      await tx.lot.createMany({ data: lots });
+      await tx.lot.createMany({
+        data: lots.map((lot) => ({
+          ...lot,
+          lotNumberNormalized: lot.lotNumber
+            .normalize("NFKC")
+            .trim()
+            .replace(/\s+/g, " ")
+            .toUpperCase(),
+        })),
+      });
       await tx.sale.createMany({ data: saleRows });
       await tx.saleItem.createMany({ data: saleItems });
       await tx.payment.createMany({ data: paymentRows });
diff --git a/apps/api/src/admin.ts b/apps/api/src/admin.ts
index b7a986a..a19f1f4 100644
--- a/apps/api/src/admin.ts
+++ b/apps/api/src/admin.ts
@@ -43,9 +43,12 @@ const customerSchema = z.object({
   phone: z.string().max(30).optional(),
   email: z.string().email().or(z.literal("")).optional(),
   legalId: z.string().max(30).optional(),
-  birthday: z.string().datetime().optional(),
   notes: z.string().max(1000).default(""),
 });
+const anonymizeCustomerSchema = z.object({
+  reason,
+  requestRef: z.string().trim().min(3).max(100),
+});
 const supplierSchema = z.object({
   name: z.string().min(2).max(120),
   legalId: z.string().max(30).optional(),
@@ -152,7 +155,6 @@ export class AdminController {
     const row = await this.db.customer.create({
       data: {
         ...data,
-        birthday: data.birthday ? new Date(data.birthday) : null,
         createdBy: actor.id,
         branchId: actor.branchId,
       },
@@ -173,16 +175,104 @@ export class AdminController {
       !can(actor.permissions, "sale:manage")
     )
       bad("Sólo un gerente puede cambiar el límite de crédito.");
-    await this.db.customer.findFirstOrThrow({
+    const before = await this.db.customer.findFirstOrThrow({
       where: { id: parse(uuid, id), branchId: actor.branchId },
     });
-    return this.db.customer.update({
+    const row = await this.db.customer.update({
       where: { id },
       data: {
         ...data,
-        ...(data.birthday ? { birthday: new Date(data.birthday) } : {}),
       },
     });
+    const changedFields = Object.keys(data).filter(
+      (field) =>
+        JSON.stringify((before as any)[field]) !==
+        JSON.stringify((row as any)[field]),
+    );
+    await audit(
+      this.db,
+      actor,
+      "update",
+      "customer",
+      id,
+      { changedFields },
+      { changedFields },
+    );
+    return row;
+  }
+
+  @Post("customers/:id/anonymize")
+  @Permit("customers:erase")
+  async anonymizeCustomer(
+    @Param("id") id: string,
+    @Body() body: unknown,
+    @CurrentUser() actor: Actor,
+  ) {
+    const customerId = parse(uuid, id);
+    const request = parse(anonymizeCustomerSchema, body);
+    return this.db.$transaction(async (tx) => {
+      await tx.customer.findFirstOrThrow({
+        where: { id: customerId, branchId: actor.branchId },
+      });
+      const [debt, creditNotes] = await Promise.all([
+        tx.sale.aggregate({
+          where: {
+            customerId,
+            branchId: actor.branchId,
+            status: "completed",
+            creditBalance: { gt: 0 },
+          },
+          _sum: { creditBalance: true },
+        }),
+        tx.creditNote.aggregate({
+          where: { customerId, balance: { gt: 0 } },
+          _sum: { balance: true },
+        }),
+      ]);
+      if (
+        Number(debt._sum.creditBalance ?? 0) > 0 ||
+        Number(creditNotes._sum.balance ?? 0) > 0
+      )
+        conflict(
+          "No se puede anonimizar: el cliente tiene crédito, contraentrega o una nota de crédito pendiente.",
+        );
+
+      const marker = { customerId, anonymized: true };
+      await tx.auditLog.updateMany({
+        where: {
+          branchId: actor.branchId,
+          entity: "customer",
+          entityId: customerId,
+        },
+        data: { before: marker, after: marker },
+      });
+      await tx.quote.updateMany({
+        where: { branchId: actor.branchId, customerId },
+        data: { notes: "" },
+      });
+      const row = await tx.customer.update({
+        where: { id: customerId },
+        data: {
+          name: `Cliente anonimizado ${customerId.slice(0, 8)}`,
+          phone: null,
+          email: null,
+          legalId: null,
+          notes: "",
+          creditLimit: 0,
+          active: false,
+        },
+      });
+      await audit(
+        tx,
+        actor,
+        "anonymize",
+        "customer",
+        customerId,
+        undefined,
+        { reason: request.reason, requestRef: request.requestRef },
+      );
+      return row;
+    });
   }
   @Get("suppliers") @Permit("purchase:write") suppliers(
     @CurrentUser() actor: Actor,
diff --git a/apps/api/src/alerts.ts b/apps/api/src/alerts.ts
index 95aac78..d39f3fb 100644
--- a/apps/api/src/alerts.ts
+++ b/apps/api/src/alerts.ts
@@ -28,8 +28,21 @@ import {
   parse,
   uuid,
   audit,
+  canViewCashExpected,
 } from "./common";
 
+const CASH_DIFFERENCE_PRIVATE_MESSAGE =
+  "Se detectó una diferencia en una caja cerrada. Administración debe revisarla.";
+
+export function alertForActor<T extends { type?: string; message?: string }>(
+  alert: T,
+  actor: Actor,
+): T {
+  return alert.type === "cash_difference" && !canViewCashExpected(actor)
+    ? { ...alert, message: CASH_DIFFERENCE_PRIVATE_MESSAGE }
+    : alert;
+}
+
 @Injectable()
 export class AlertEngine {
   private timer: ReturnType<typeof setInterval> | undefined;
@@ -403,7 +416,7 @@ export class AlertsController {
       query,
     );
     await this.engine.evaluate(actor.branchId);
-    return this.db.alert.findMany({
+    const rows = await this.db.alert.findMany({
       where: {
         branchId: actor.branchId,
         ...(filter.status !== "all" ? { status: filter.status } : {}),
@@ -413,6 +426,7 @@ export class AlertsController {
       orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
       take: 200,
     });
+    return rows.map((row) => alertForActor(row, actor));
   }
   @Patch("alerts/:id") @Permit("alerts:write") async state(
     @Param("id") id: string,
@@ -427,7 +441,10 @@ export class AlertsController {
       where: { id: parse(uuid, id), branchId: actor.branchId },
     });
     await audit(this.db, actor, "state", "alert", id, undefined, data);
-    return this.db.alert.update({ where: { id }, data });
+    return alertForActor(
+      await this.db.alert.update({ where: { id }, data }),
+      actor,
+    );
   }
   @Get("promotions/clearance-candidates")
   @Permit("promotions:write")
diff --git a/apps/api/src/app.ts b/apps/api/src/app.ts
index 467d19f..40105ef 100644
--- a/apps/api/src/app.ts
+++ b/apps/api/src/app.ts
@@ -18,6 +18,11 @@ import { AdminController } from "./admin";
 import { CashController } from "./cash";
 import { ReportsController } from "./reports";
 import { AlertEngine, AlertsController } from "./alerts";
+import { OfflineSalesController } from "./offline-sales";
+import {
+  AuthenticatedRateLimitGuard,
+  RequestRateLimitService,
+} from "./rate-limit";
 
 @Controller()
 class HealthController {
@@ -53,11 +58,14 @@ export function createAppModule(secret: string) {
       CashController,
       ReportsController,
       AlertsController,
+      OfflineSalesController,
     ],
     providers: [
       Database,
       AlertEngine,
+      RequestRateLimitService,
       { provide: APP_GUARD, useClass: AuthGuard },
+      { provide: APP_GUARD, useClass: AuthenticatedRateLimitGuard },
     ],
   })
   class AppModule {}
diff --git a/apps/api/src/auth.ts b/apps/api/src/auth.ts
index 48ecfd5..62a980b 100644
--- a/apps/api/src/auth.ts
+++ b/apps/api/src/auth.ts
@@ -16,6 +16,7 @@ import {
 
 import { verifyAttempt, verifyPinAttempt } from "./security";
 import { isDifferentPassword, strongPasswordSchema } from "./password-policy";
+import { REQUEST_RATE_LIMITS, RequestRateLimitService } from "./rate-limit";
 
 export function normalizeUsername(value: string) {
   return value
@@ -31,6 +32,8 @@ export class AuthController {
   constructor(
     @Inject(Database) private db: Database,
     @Inject(JwtService) private jwt: JwtService,
+    @Inject(RequestRateLimitService)
+    private requestLimits: RequestRateLimitService,
   ) {}
   private actor(user: any): Actor {
     return {
@@ -137,6 +140,11 @@ export class AuthController {
       include: { role: true },
     });
     if (!user) bad("Usuario o contraseña incorrectos.");
+    this.requestLimits.assert(
+      "auth-account",
+      [req.ip ?? "", user.id],
+      REQUEST_RATE_LIMITS.authAccount,
+    );
     const matches =
       user.active && (await compare(data.password, user.passwordHash));
     // Los fallos se cuentan por cuenta y dirección IP, como los PIN por
@@ -201,6 +209,11 @@ export class AuthController {
     });
     if (!user?.active || !user.mustChangePassword)
       bad("No hay un cambio de contraseña pendiente para esta cuenta.");
+    this.requestLimits.assert(
+      "auth-account",
+      [req.ip ?? "", user.id],
+      REQUEST_RATE_LIMITS.authAccount,
+    );
     await verifyAttempt(
       this.db,
       `login:${user.id}:${user.authVersion}:${req.ip ?? ""}`,
@@ -273,6 +286,11 @@ export class AuthController {
       where: { hash: tokenHash },
     });
     if (!saved || saved.expiresAt < new Date()) bad("La sesión ha expirado.");
+    this.requestLimits.assert(
+      "auth-refresh-session",
+      [req.ip ?? "", saved.sessionId ?? saved.id],
+      REQUEST_RATE_LIMITS.refreshSession,
+    );
     // deleteMany hace la rotación de uso único incluso con peticiones concurrentes.
     const consumed = await this.db.refreshToken.deleteMany({
       where: { id: saved.id },
diff --git a/apps/api/src/cash.ts b/apps/api/src/cash.ts
index 65bf2c8..c002370 100644
--- a/apps/api/src/cash.ts
+++ b/apps/api/src/cash.ts
@@ -35,6 +35,7 @@ import {
   bad,
   conflict,
   denied,
+  canViewCashExpected,
 } from "./common";
 import { cashLock, terminalName } from "./sales";
 import { STORE_REPORTS, storeReport, sendStoreReport } from "./reports";
@@ -93,6 +94,25 @@ function closeDifferences(session: any, expected: any) {
     transfer: money(d(session.countedTransfer ?? 0).minus(expected.transfer)),
   };
 }
+export { canViewCashExpected } from "./common";
+
+// El cierre de una cajera es realmente ciego: cualquier diferencia exige una
+// explicación, sin comunicar si está cerca o lejos del monto esperado. Quien
+// gestiona ventas conserva el umbral configurable para cierres supervisados.
+export function cashCloseRequiresNote(
+  actor: Actor,
+  differences: { cash: unknown; card: unknown; transfer: unknown },
+  differenceLimit: number,
+) {
+  const values = [
+    Math.abs(Number(differences.cash)),
+    Math.abs(Number(differences.card)),
+    Math.abs(Number(differences.transfer)),
+  ];
+  return canViewCashExpected(actor)
+    ? Math.max(...values) > differenceLimit
+    : values.some((value) => value > 0);
+}
 // Recalcula lo esperado de una caja ya cerrada (venta offline sincronizada o
 // transferencia verificada después del cierre) y guarda las diferencias.
 export async function refreshClosedCash(tx: any, session: any) {
@@ -412,9 +432,7 @@ export class CashController {
   @Get()
   @Permit("cash:write")
   async sessions(@CurrentUser() actor: Actor) {
-    const showExpected =
-      can(actor.permissions, "profit:read") ||
-      can(actor.permissions, "sale:manage");
+    const showExpected = canViewCashExpected(actor);
     const sessions = await this.db.cashSession.findMany({
       where: {
         branchId: actor.branchId,
@@ -546,10 +564,11 @@ export class CashController {
       body,
     );
     return this.db.$transaction(async (tx) => {
-      const session = await cashLock(tx, actor, parse(uuid, id));
-      const expected = await cashExpected(tx, session);
-      if (data.type === "out" && data.amount > expected.cash)
-        bad("No hay suficiente efectivo en caja.");
+      const _session = await cashLock(tx, actor, parse(uuid, id));
+      // No comparar el retiro con el esperado: aceptar/rechazar importes
+      // convierte esta ruta en un oráculo que permite calcular el arqueo por
+      // búsqueda. El movimiento registra lo que físicamente entró o salió; la
+      // diferencia se determina una sola vez durante el cierre ciego.
       const row = await tx.cashMovement.create({
         data: { ...data, sessionId: id, userId: actor.id },
       });
@@ -693,11 +712,7 @@ export class CashController {
       const differences = closeDifferences(data, expected);
       const differenceLimit = Number(settings?.cashDifferenceLimit ?? 100);
       if (
-        Math.max(
-          Math.abs(Number(differences.cash)),
-          Math.abs(Number(differences.card)),
-          Math.abs(Number(differences.transfer)),
-        ) > differenceLimit &&
+        cashCloseRequiresNote(actor, differences, differenceLimit) &&
         !input.notes.trim()
       )
         bad(
@@ -746,9 +761,7 @@ export class CashController {
             message: `Diferencias de caja: efectivo RD$ ${row.differenceCash}, tarjeta RD$ ${row.differenceCard}, transferencia RD$ ${row.differenceTransfer}`,
           },
         });
-      const showExpected =
-        can(actor.permissions, "profit:read") ||
-        can(actor.permissions, "sale:manage");
+      const showExpected = canViewCashExpected(actor);
       return showExpected
         ? { ...row, differences }
         : { id: row.id, closedAt: row.closedAt };
@@ -786,14 +799,11 @@ export class CashController {
   @Get(":id/cuadre")
   @Permit("cash:write")
   async cuadre(@Param("id") id: string, @CurrentUser() actor: Actor) {
-    const report = await buildCuadre(
-      this.db,
-      actor,
-      await this.ownSession(actor, id),
-    );
-    const showExpected =
-      can(actor.permissions, "profit:read") ||
-      can(actor.permissions, "sale:manage");
+    const session = await this.ownSession(actor, id);
+    if (!session.closedAt && !canViewCashExpected(actor))
+      bad("Cierra la caja para consultar el cuadre.");
+    const report = await buildCuadre(this.db, actor, session);
+    const showExpected = canViewCashExpected(actor);
     if (showExpected) return report;
     const publicForeign = (currency: any) => {
       const { expected, difference, ...visible } = currency;
@@ -825,6 +835,8 @@ export class CashController {
   ) {
     if (!STORE_REPORTS.includes(name)) bad("Reporte no disponible.");
     const session = await this.ownSession(actor, id);
+    if (!session.closedAt && !canViewCashExpected(actor))
+      bad("Cierra la caja para consultar sus reportes.");
     const report = await storeReport(this.db, actor, name, {
       cashSessionId: session.id,
     });
diff --git a/apps/api/src/common.ts b/apps/api/src/common.ts
index 56a085c..cd60d34 100644
--- a/apps/api/src/common.ts
+++ b/apps/api/src/common.ts
@@ -39,6 +39,12 @@ export type Actor = {
   branchId: string;
 };
 export type ActorRequest = Request & { actor: Actor };
+// Una misma política protege todos los caminos que pueden revelar el arqueo:
+// caja, reportes genéricos y alertas. `reports:read`/`alerts:write` por sí solos
+// no autorizan a conocer los importes esperados ni sus diferencias.
+export const canViewCashExpected = (actor: Actor) =>
+  can(actor.permissions, "profit:read") ||
+  can(actor.permissions, "sale:manage");
 export const CurrentUser = createParamDecorator(
   (_data: unknown, ctx: ExecutionContext) =>
     ctx.switchToHttp().getRequest<ActorRequest>().actor,
@@ -237,6 +243,8 @@ export function safe<T>(value: T, actor: Actor): T {
     "unitCost",
     "landedCost",
     "costTotal",
+    "wasteCost",
+    "wasteCostTotal",
     "wholesalePrice",
     "grossProfit",
     "netProfit",
diff --git a/apps/api/src/inventory-resilience.ts b/apps/api/src/inventory-resilience.ts
new file mode 100644
index 0000000..9ac65b4
--- /dev/null
+++ b/apps/api/src/inventory-resilience.ts
@@ -0,0 +1,73 @@
+import { businessDate } from "@fitstore/shared";
+
+/** Código canónico para identificar un lote sin depender de mayúsculas o espacios. */
+export function normalizeLotNumber(value: string) {
+  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toUpperCase();
+}
+
+/**
+ * La identidad física del lote es su código dentro de una variante. El
+ * vencimiento se valida aparte: puede completar un dato antes ausente, pero no
+ * crear otro lote con el mismo código.
+ */
+export function lotIdentity(
+  lotNumber: string,
+  expiryDate?: string | Date | null,
+) {
+  const normalized = normalizeLotNumber(lotNumber);
+  const expiry = expiryDate ? new Date(expiryDate) : null;
+  return {
+    lotNumber: normalized,
+    lotNumberNormalized: normalized,
+    expiryDate: expiry,
+  };
+}
+
+/** Une el vencimiento recibido con el guardado y detecta códigos ambiguos. */
+export function reconcileLotExpiry(
+  current: Date | string | null | undefined,
+  incoming: Date | string | null | undefined,
+) {
+  const existing = current ? new Date(current) : null;
+  const received = incoming ? new Date(incoming) : null;
+  return {
+    conflict:
+      !!existing &&
+      !!received &&
+      businessDate(existing) !== businessDate(received),
+    expiryDate: existing ?? received,
+  };
+}
+
+/** Prisma puede envolver SQLSTATE 40001 como P2010 o traducirlo a P2034. */
+export function isSerializationConflict(error: any) {
+  const detail = String(
+    error?.meta?.code ?? error?.meta?.message ?? error?.message ?? "",
+  );
+  return (
+    error?.code === "40001" ||
+    error?.code === "P2034" ||
+    (error?.code === "P2010" && detail.includes("40001"))
+  );
+}
+
+/** Cinco intentos como máximo; otros errores nunca se ocultan ni se reintentan. */
+export async function retrySerializable<T>(
+  operation: () => Promise<T>,
+  maxAttempts = 5,
+): Promise<T> {
+  for (let attempt = 1; ; attempt++) {
+    try {
+      return await operation();
+    } catch (error) {
+      if (!isSerializationConflict(error) || attempt >= maxAttempts)
+        throw error;
+      // Cede el turno y evita que dos solicitudes vuelvan a chocar en el mismo
+      // instante. El jitter evita que una ráfaga completa se resincronice; aun
+      // así el plazo total de espera sigue acotado a menos de 150 ms.
+      await new Promise((resolve) =>
+        setTimeout(resolve, attempt * 10 + Math.floor(Math.random() * 10)),
+      );
+    }
+  }
+}
diff --git a/apps/api/src/inventory.ts b/apps/api/src/inventory.ts
index a6fb847..e735a34 100644
--- a/apps/api/src/inventory.ts
+++ b/apps/api/src/inventory.ts
@@ -43,6 +43,12 @@ import {
   json,
   qty,
 } from "./common";
+import {
+  isSerializationConflict,
+  lotIdentity,
+  reconcileLotExpiry,
+  retrySerializable,
+} from "./inventory-resilience";
 
 // Unidades que la venta no toma (paso 04): lotes vencidos según la fecha de
 // Santo Domingo, o sin vencimiento cuando la categoría lo exige.
@@ -504,13 +510,13 @@ export class InventoryController {
   @RequireTerminal()
   @Permit("inventory:write")
   async adjustment(@Body() body: unknown, @CurrentUser() actor: Actor) {
-    const data = parse(
+    const parsed = parse(
       z.object({
         variantId: uuid,
         qty: signedStockQty(),
         reason,
         lotId: uuid.optional(),
-        lotNumber: z.string().optional(),
+        lotNumber: z.string().trim().min(1).max(120).optional(),
         expiryDate: z.string().datetime().optional(),
         type: z
           .enum(["adjustment", "waste", "supplier_return"])
@@ -518,101 +524,115 @@ export class InventoryController {
       }),
       body,
     );
-    return this.db.$transaction(
-      async (tx) => {
-        const variant = await lockVariant(tx, data.variantId, actor);
-        let lotId = data.lotId;
-        if (
-          data.qty < 0 &&
-          !data.lotId &&
-          !variant.product.category.requiresLot &&
-          !variant.allowNegativeStock
-        ) {
-          const untracked =
-            Number(variant.stock) -
-            variant.lots.reduce(
-              (sum: number, l: any) => sum + Number(l.qty),
-              0,
-            );
-          if (untracked + data.qty < 0)
-            bad("Stock insuficiente sin lote. Selecciona el lote de salida.");
-        }
-        if (data.expiryDate && expired(data.expiryDate))
-          bad("No puedes ajustar un lote vencido.");
-        if (
-          variant.product.category.requiresLot ||
-          data.lotId ||
-          data.lotNumber
-        ) {
-          if (data.qty < 0) {
-            if (!lotId) bad("Selecciona el lote de salida.");
-            const lot = await tx.lot.findFirstOrThrow({
-              where: { id: lotId, variantId: variant.id },
-            });
-            if (Number(lot.qty) + data.qty < 0)
-              bad("Stock insuficiente en el lote.");
-            await tx.lot.update({
-              where: { id: lot.id },
-              data: { qty: { increment: data.qty } },
-            });
-          } else {
-            if (
-              !data.lotNumber ||
-              (variant.product.category.requiresExpiry && !data.expiryDate)
-            )
-              bad("Indica lote y vencimiento.");
-            const existingLot = await tx.lot.findUnique({
-              where: {
-                variantId_lotNumber: {
-                  variantId: variant.id,
-                  lotNumber: data.lotNumber,
+    const data = parsed.lotNumber
+      ? { ...parsed, ...lotIdentity(parsed.lotNumber, parsed.expiryDate) }
+      : parsed;
+    return retrySerializable(() =>
+      this.db.$transaction(
+        async (tx) => {
+          const variant = await lockVariant(tx, data.variantId, actor);
+          let lotId = data.lotId;
+          if (
+            data.qty < 0 &&
+            !data.lotId &&
+            !variant.product.category.requiresLot &&
+            !variant.allowNegativeStock
+          ) {
+            const untracked =
+              Number(variant.stock) -
+              variant.lots.reduce(
+                (sum: number, l: any) => sum + Number(l.qty),
+                0,
+              );
+            if (untracked + data.qty < 0)
+              bad("Stock insuficiente sin lote. Selecciona el lote de salida.");
+          }
+          if (data.expiryDate && expired(data.expiryDate))
+            bad("No puedes ajustar un lote vencido.");
+          if (
+            variant.product.category.requiresLot ||
+            data.lotId ||
+            data.lotNumber
+          ) {
+            if (data.qty < 0) {
+              if (!lotId) bad("Selecciona el lote de salida.");
+              const lot = await tx.lot.findFirstOrThrow({
+                where: { id: lotId, variantId: variant.id },
+              });
+              if (Number(lot.qty) + data.qty < 0)
+                bad("Stock insuficiente en el lote.");
+              await tx.lot.update({
+                where: { id: lot.id },
+                data: { qty: { increment: data.qty } },
+              });
+            } else {
+              if (
+                !data.lotNumber ||
+                (variant.product.category.requiresExpiry && !data.expiryDate)
+              )
+                bad("Indica lote y vencimiento.");
+              const identity = lotIdentity(data.lotNumber, data.expiryDate);
+              const existingLot = await tx.lot.findUnique({
+                where: {
+                  variantId_lotNumberNormalized: {
+                    variantId: variant.id,
+                    lotNumberNormalized: identity.lotNumberNormalized,
+                  },
                 },
-              },
-            });
-            if (existingLot && expired(existingLot.expiryDate))
-              bad("No puedes aumentar un lote vencido.");
-            const lot = await tx.lot.upsert({
-              where: {
-                variantId_lotNumber: {
+              });
+              const reconciled = reconcileLotExpiry(
+                existingLot?.expiryDate,
+                identity.expiryDate,
+              );
+              if (reconciled.conflict)
+                bad("Ese lote ya tiene un vencimiento diferente.");
+              if (existingLot && expired(reconciled.expiryDate))
+                bad("No puedes aumentar un lote vencido.");
+              const lot = await tx.lot.upsert({
+                where: {
+                  variantId_lotNumberNormalized: {
+                    variantId: variant.id,
+                    lotNumberNormalized: identity.lotNumberNormalized,
+                  },
+                },
+                create: {
                   variantId: variant.id,
-                  lotNumber: data.lotNumber,
+                  ...identity,
+                  qty: data.qty,
+                  cost: variant.costAvg,
+                  branchId: actor.branchId,
                 },
-              },
-              create: {
-                variantId: variant.id,
-                lotNumber: data.lotNumber,
-                expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
-                qty: data.qty,
-                cost: variant.costAvg,
-                branchId: actor.branchId,
-              },
-              update: { qty: { increment: data.qty } },
-            });
-            lotId = lot.id;
+                update: {
+                  qty: { increment: data.qty },
+                  expiryDate: reconciled.expiryDate,
+                },
+              });
+              lotId = lot.id;
+            }
           }
-        }
-        await stockChange(
-          tx,
-          actor,
-          variant,
-          data.qty,
-          data.type,
-          data.reason,
-          undefined,
-          lotId,
-        );
-        await audit(
-          tx,
-          actor,
-          data.type,
-          "variant",
-          variant.id,
-          undefined,
-          data,
-        );
-        return safe(variant, actor);
-      },
-      { isolationLevel: "Serializable" },
+          await stockChange(
+            tx,
+            actor,
+            variant,
+            data.qty,
+            data.type,
+            data.reason,
+            undefined,
+            lotId,
+          );
+          await audit(
+            tx,
+            actor,
+            data.type,
+            "variant",
+            variant.id,
+            undefined,
+            data,
+          );
+          return safe(variant, actor);
+        },
+        { isolationLevel: "Serializable" },
+      ),
     );
   }
   @Get("purchase-orders")
@@ -724,7 +744,7 @@ export class InventoryController {
                 // Unidades buenas: 0 si toda la línea llegó dañada.
                 qty: countedQty(),
                 ...damageFields,
-                lotNumber: z.string().min(1).optional(),
+                lotNumber: z.string().trim().min(1).max(120).optional(),
                 expiryDate: z.string().datetime().optional(),
               }),
             )
@@ -732,7 +752,26 @@ export class InventoryController {
         }),
         body,
       );
-    const data = { operationId, freight, otherCosts, allocation, items };
+    const data = {
+      operationId,
+      freight,
+      otherCosts,
+      allocation,
+      items: items.map((item) =>
+        item.lotNumber
+          ? {
+              ...item,
+              ...lotIdentity(item.lotNumber, item.expiryDate),
+              expiryDate: lotIdentity(
+                item.lotNumber,
+                item.expiryDate,
+              ).expiryDate?.toISOString(),
+            }
+          : item.expiryDate
+            ? { ...item, expiryDate: new Date(item.expiryDate).toISOString() }
+            : item,
+      ),
+    };
     if (new Set(data.items.map((i) => i.itemId)).size !== data.items.length)
       bad("No repitas líneas de recepción.");
     data.items.forEach(checkDamage);
@@ -881,34 +920,41 @@ export class InventoryController {
               data: { costAvg: newCost },
             });
             if (line.lotNumber) {
+              const identity = lotIdentity(line.lotNumber, line.expiryDate);
               const existingLot = await tx.lot.findUnique({
                 where: {
-                  variantId_lotNumber: {
+                  variantId_lotNumberNormalized: {
                     variantId: variant.id,
-                    lotNumber: line.lotNumber,
+                    lotNumberNormalized: identity.lotNumberNormalized,
                   },
                 },
               });
-              if (existingLot && expired(existingLot.expiryDate))
+              const reconciled = reconcileLotExpiry(
+                existingLot?.expiryDate,
+                identity.expiryDate,
+              );
+              if (reconciled.conflict)
+                bad("Ese lote ya tiene un vencimiento diferente.");
+              if (existingLot && expired(reconciled.expiryDate))
                 bad("No puedes recibir existencias en un lote vencido.");
               const lot = await tx.lot.upsert({
                 where: {
-                  variantId_lotNumber: {
+                  variantId_lotNumberNormalized: {
                     variantId: variant.id,
-                    lotNumber: line.lotNumber,
+                    lotNumberNormalized: identity.lotNumberNormalized,
                   },
                 },
                 create: {
                   variantId: variant.id,
-                  lotNumber: line.lotNumber,
-                  expiryDate: line.expiryDate
-                    ? new Date(line.expiryDate)
-                    : null,
+                  ...identity,
                   qty: line.qty,
                   cost: costs[index],
                   branchId: actor.branchId,
                 },
-                update: { qty: { increment: line.qty } },
+                update: {
+                  qty: { increment: line.qty },
+                  expiryDate: reconciled.expiryDate,
+                },
               });
               lotId = lot.id;
             }
@@ -952,17 +998,11 @@ export class InventoryController {
     // PostgreSQL puede abortar una de dos transacciones serializables aunque
     // ambas representen exactamente la misma recepción. La segunda petición
     // debe recuperar el resultado confirmado, no exponer P2010/40001 como 500.
-    for (let attempt = 0; ; attempt++) {
+    return retrySerializable(async () => {
       try {
         return await execute();
-      } catch (error: any) {
-        const serialization =
-          error?.code === "P2034" ||
-          (error?.code === "P2010" &&
-            String(error?.meta?.code ?? error?.meta?.message ?? "").includes(
-              "40001",
-            ));
-        if (!serialization) throw error;
+      } catch (error) {
+        if (!isSerializationConflict(error)) throw error;
         const prior = await this.db.goodsReceipt.findUnique({
           where: { operationId: data.operationId },
         });
@@ -971,9 +1011,9 @@ export class InventoryController {
             bad("UUID usado con datos distintos.");
           return safe(prior, actor);
         }
-        if (attempt >= 2) throw error;
+        throw error;
       }
-    }
+    });
   }
   // Historial de recepciones (paso 37): las últimas 50 o las de un período.
   @Get("goods-receipts")
@@ -1161,49 +1201,51 @@ export class InventoryController {
   @RequireTerminal()
   @Permit("sale:manage")
   async applyCount(@Param("id") id: string, @CurrentUser() actor: Actor) {
-    return this.db.$transaction(
-      async (tx) => {
-        await tx.$queryRaw`SELECT id FROM "InventoryCount" WHERE id=${parse(uuid, id)}::uuid FOR UPDATE`;
-        const count = await tx.inventoryCount.findFirstOrThrow({
-          where: { id: parse(uuid, id), branchId: actor.branchId },
-        });
-        if (count.status !== "pending") bad("El conteo ya fue aplicado.");
-        for (const item of (count.items as any[]).sort((a, b) =>
-          a.variantId.localeCompare(b.variantId),
-        )) {
-          const variant = await lockVariant(tx, item.variantId, actor);
-          if (Number(variant.stock) !== item.expected)
-            bad("El stock cambió. Repite el conteo.");
-          if (variant.product.category.requiresLot)
-            bad("Ajusta productos con lote desde su lote específico.");
-          const lotStock = variant.lots.reduce(
-            (sum: number, l: any) => sum + Number(l.qty),
-            0,
-          );
-          if (item.counted < lotStock)
-            bad(
-              "El conteo no puede quedar por debajo del stock con lote. Ajusta el lote específico.",
-            );
-          const delta = quantity(d(item.counted).minus(variant.stock));
-          if (delta)
-            await stockChange(
-              tx,
-              actor,
-              variant,
-              delta,
-              "count",
-              "Conteo físico aprobado",
-              id,
+    return retrySerializable(() =>
+      this.db.$transaction(
+        async (tx) => {
+          await tx.$queryRaw`SELECT id FROM "InventoryCount" WHERE id=${parse(uuid, id)}::uuid FOR UPDATE`;
+          const count = await tx.inventoryCount.findFirstOrThrow({
+            where: { id: parse(uuid, id), branchId: actor.branchId },
+          });
+          if (count.status !== "pending") bad("El conteo ya fue aplicado.");
+          for (const item of (count.items as any[]).sort((a, b) =>
+            a.variantId.localeCompare(b.variantId),
+          )) {
+            const variant = await lockVariant(tx, item.variantId, actor);
+            if (Number(variant.stock) !== item.expected)
+              bad("El stock cambió. Repite el conteo.");
+            if (variant.product.category.requiresLot)
+              bad("Ajusta productos con lote desde su lote específico.");
+            const lotStock = variant.lots.reduce(
+              (sum: number, l: any) => sum + Number(l.qty),
+              0,
             );
-        }
-        await tx.inventoryCount.update({
-          where: { id },
-          data: { status: "applied", appliedBy: actor.id },
-        });
-        await audit(tx, actor, "count_apply", "count", id);
-        return { ok: true };
-      },
-      { isolationLevel: "Serializable" },
+            if (item.counted < lotStock)
+              bad(
+                "El conteo no puede quedar por debajo del stock con lote. Ajusta el lote específico.",
+              );
+            const delta = quantity(d(item.counted).minus(variant.stock));
+            if (delta)
+              await stockChange(
+                tx,
+                actor,
+                variant,
+                delta,
+                "count",
+                "Conteo físico aprobado",
+                id,
+              );
+          }
+          await tx.inventoryCount.update({
+            where: { id },
+            data: { status: "applied", appliedBy: actor.id },
+          });
+          await audit(tx, actor, "count_apply", "count", id);
+          return { ok: true };
+        },
+        { isolationLevel: "Serializable" },
+      ),
     );
   }
 }
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index 2922345..6abd477 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -5,11 +5,11 @@ import { NestFactory } from "@nestjs/core";
 import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
 import helmet from "helmet";
 import cookieParser from "cookie-parser";
+import { json as jsonBodyParser } from "express";
 import { createAppModule } from "./app";
 import { validateSecret } from "./security";
 import { ApiExceptionFilter } from "./common";
 import { captureApiException, initializeApiMonitoring } from "./monitoring";
-import { createRequestRateLimiter } from "./rate-limit";
 
 config({ path: resolve(process.cwd(), "../../.env") });
 config();
@@ -20,17 +20,21 @@ async function bootstrap() {
   if (production && !webOrigin)
     throw new Error("WEB_ORIGIN es obligatorio en producción.");
   const secret = validateSecret(process.env.JWT_SECRET, production);
-  const app = await NestFactory.create(createAppModule(secret));
+  // Nest no registra su parser interno: instalamos exactamente uno. Los
+  // limitadores públicos se aplican después de resolver una cuenta real.
+  const app = await NestFactory.create(createAppModule(secret), {
+    bodyParser: false,
+  });
   app.getHttpAdapter().getInstance().set("trust proxy", 1);
   app.setGlobalPrefix("api");
   app.use(helmet());
+  app.use(jsonBodyParser({ limit: "100kb" }));
   app.use(cookieParser());
   app.enableCors({
     origin: webOrigin || "http://localhost:5173",
     credentials: true,
   });
   app.useGlobalFilters(new ApiExceptionFilter());
-  app.use(createRequestRateLimiter());
   if (!production || process.env.ENABLE_SWAGGER === "true") {
     const document = SwaggerModule.createDocument(
       app,
diff --git a/apps/api/src/merchandise.ts b/apps/api/src/merchandise.ts
index ae2e90c..d6d7096 100644
--- a/apps/api/src/merchandise.ts
+++ b/apps/api/src/merchandise.ts
@@ -13,7 +13,6 @@ import { FileInterceptor } from "@nestjs/platform-express";
 import type { Response } from "express";
 import { createHash } from "node:crypto";
 import {
-  businessDate,
   can,
   countedQty,
   d,
@@ -48,6 +47,11 @@ import {
   receiptCosts,
   stockChange,
 } from "./inventory";
+import {
+  lotIdentity,
+  reconcileLotExpiry,
+  retrySerializable,
+} from "./inventory-resilience";
 import {
   DEFAULT_INVOICE_MODEL,
   extractAnthropic,
@@ -324,7 +328,19 @@ export class MerchandiseController {
   @Permit("inventory:write")
   async operation(@Body() body: unknown, @CurrentUser() actor: Actor) {
     merchandiseAccess(actor);
-    const data = parse(operationSchema, body);
+    const parsed = parse(operationSchema, body);
+    const data = {
+      ...parsed,
+      items: parsed.items.map((item) => {
+        if (!item.lotNumber) return item;
+        const identity = lotIdentity(item.lotNumber, item.expiryDate);
+        return {
+          ...item,
+          lotNumber: identity.lotNumber,
+          expiryDate: identity.expiryDate?.toISOString(),
+        };
+      }),
+    };
     if (!actor.terminalId)
       bad("Registra este equipo antes de mover mercancía.");
     if (data.direction === "exit" && !data.reason)
@@ -348,393 +364,407 @@ export class MerchandiseController {
     const requestHash = createHash("sha256")
       .update(JSON.stringify(data))
       .digest("hex");
-    return this.db.$transaction(
-      async (tx) => {
-        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.id}))::text`;
-        const prior = await tx.merchandiseOperation.findUnique({
-          where: { id: data.id },
-        });
-        if (prior) {
-          if (prior.userId !== actor.id || prior.branchId !== actor.branchId)
-            denied();
-          if (prior.requestHash !== requestHash)
-            bad("UUID usado con datos distintos.");
-          return prior.result;
-        }
-        // El código del producto rápido no puede ser ya de otro producto con
-        // otras mayúsculas o en el SKU: la mercancía entraría a un duplicado y
-        // la caja dejaría de agregar los dos por código (R9-codigos-3).
-        await assertCodesFree(
-          tx,
-          actor.branchId,
-          data.items.flatMap((l) =>
-            l.quick ? [{ codes: [l.quick.barcode] }] : [],
-          ),
-        );
-        const terminal = await tx.terminal.findFirstOrThrow({
-          where: {
-            id: actor.terminalId,
-            branchId: actor.branchId,
-            revokedAt: null,
-          },
-        });
-        const supplier = data.supplierId
-          ? await tx.supplier.findFirstOrThrow({
-              where: {
-                id: data.supplierId,
-                branchId: actor.branchId,
-                active: true,
-              },
-            })
-          : null;
-        let draft: any;
-        if (data.draftId) {
-          if (data.direction !== "entry")
-            bad("Una factura sólo permite entradas.");
-          await tx.$queryRaw`SELECT id FROM "InvoiceDraft" WHERE id=${data.draftId}::uuid FOR UPDATE`;
-          draft = await tx.invoiceDraft.findFirstOrThrow({
+    return retrySerializable(() =>
+      this.db.$transaction(
+        async (tx) => {
+          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${data.id}))::text`;
+          const prior = await tx.merchandiseOperation.findUnique({
+            where: { id: data.id },
+          });
+          if (prior) {
+            if (prior.userId !== actor.id || prior.branchId !== actor.branchId)
+              denied();
+            if (prior.requestHash !== requestHash)
+              bad("UUID usado con datos distintos.");
+            return prior.result;
+          }
+          // El código del producto rápido no puede ser ya de otro producto con
+          // otras mayúsculas o en el SKU: la mercancía entraría a un duplicado y
+          // la caja dejaría de agregar los dos por código (R9-codigos-3).
+          await assertCodesFree(
+            tx,
+            actor.branchId,
+            data.items.flatMap((l) =>
+              l.quick ? [{ codes: [l.quick.barcode] }] : [],
+            ),
+          );
+          const terminal = await tx.terminal.findFirstOrThrow({
             where: {
-              id: data.draftId,
+              id: actor.terminalId,
               branchId: actor.branchId,
-              userId: actor.id,
+              revokedAt: null,
             },
           });
-          if (draft.confirmedOperationId) bad("La factura ya fue confirmada.");
-          if (draft.supplierId !== (data.supplierId ?? null))
-            bad("El proveedor debe coincidir con el de la revisión.");
-        }
-        const total = money(
-          data.items.reduce((s, l) => s + l.qty * l.unitCost, 0) +
-            data.freight +
-            data.taxes,
-        );
-        const damagedCost = money(
-          data.items.reduce(
-            (s, l) => s.plus(damagedCostOf({ ...l, cost: l.unitCost })),
-            d(0),
-          ),
-        );
-        const invoiceTotal =
-          data.invoiceTotal ??
-          (draft?.total != null ? Number(draft.total) : undefined);
-        // La factura puede cobrar también lo dañado: coincide con o sin ello.
-        if (
-          invoiceTotal !== undefined &&
-          Math.abs(invoiceTotal - total) > 0.01 &&
-          Math.abs(invoiceTotal - (total + damagedCost)) > 0.01 &&
-          !data.acknowledgeMismatch
-        )
-          bad(
-            "El total de las líneas, flete e impuestos no coincide con la factura. Revisa o confirma la diferencia.",
-          );
-        let order: any;
-        if (data.orderId) {
-          if (data.direction !== "entry") bad("La orden sólo permite entrada.");
-          await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${data.orderId}::uuid FOR UPDATE`;
-          order = await tx.purchaseOrder.findFirstOrThrow({
-            where: { id: data.orderId, branchId: actor.branchId },
-            include: { items: true },
-          });
-          if (order.status === "received") bad("Orden ya recibida.");
-          if (order.supplierId !== data.supplierId)
-            bad("Proveedor distinto al de la orden.");
-        }
-        const lines: any[] = [];
-        for (const line of data.items) {
-          let variantId = line.variantId;
-          if (line.quick) {
-            const q = line.quick;
-            const cat = await tx.category.findFirstOrThrow({
-              where: { id: q.categoryId, branchId: actor.branchId },
-            });
-            // Quien no puede editar el catálogo (almacén) crea el producto
-            // inactivo: no se vende hasta que un gerente revise su precio.
-            const canPrice = can(actor.permissions, "catalog:write");
-            const p = await tx.product.create({
-              data: {
-                name: q.name,
-                sku: "Q-" + data.id + "-" + lines.length,
-                categoryId: cat.id,
-                branchId: actor.branchId,
-                createdBy: actor.id,
-                supplierId: data.supplierId,
-                ...(canPrice ? {} : { active: false }),
-                variants: {
-                  create: {
-                    sku: "QV-" + data.id + "-" + lines.length,
-                    barcode: q.barcode,
-                    price: q.price,
-                    costAvg: q.cost,
-                    attributes: { variante: q.variant },
-                    branchId: actor.branchId,
-                    createdBy: actor.id,
-                  },
+          const supplier = data.supplierId
+            ? await tx.supplier.findFirstOrThrow({
+                where: {
+                  id: data.supplierId,
+                  branchId: actor.branchId,
+                  active: true,
                 },
+              })
+            : null;
+          let draft: any;
+          if (data.draftId) {
+            if (data.direction !== "entry")
+              bad("Una factura sólo permite entradas.");
+            await tx.$queryRaw`SELECT id FROM "InvoiceDraft" WHERE id=${data.draftId}::uuid FOR UPDATE`;
+            draft = await tx.invoiceDraft.findFirstOrThrow({
+              where: {
+                id: data.draftId,
+                branchId: actor.branchId,
+                userId: actor.id,
               },
-              include: { variants: true },
             });
-            variantId = p.variants[0].id;
-            if (!canPrice)
-              await tx.alert.upsert({
-                where: { key: "new-product:" + p.id },
-                create: {
-                  key: "new-product:" + p.id,
-                  type: "product_review",
-                  severity: "medium",
-                  entityId: p.id,
-                  branchId: actor.branchId,
-                  message:
-                    p.name +
-                    ": producto creado al recibir mercancía. Revisa el precio y actívalo para venderlo.",
-                },
-                update: {},
-              });
+            if (draft.confirmedOperationId)
+              bad("La factura ya fue confirmada.");
+            if (draft.supplierId !== (data.supplierId ?? null))
+              bad("El proveedor debe coincidir con el de la revisión.");
           }
-          if (order) {
-            const item = order.items.find(
-              (i: any) => i.id === line.itemId && i.variantId === variantId,
+          const total = money(
+            data.items.reduce((s, l) => s + l.qty * l.unitCost, 0) +
+              data.freight +
+              data.taxes,
+          );
+          const damagedCost = money(
+            data.items.reduce(
+              (s, l) => s.plus(damagedCostOf({ ...l, cost: l.unitCost })),
+              d(0),
+            ),
+          );
+          const invoiceTotal =
+            data.invoiceTotal ??
+            (draft?.total != null ? Number(draft.total) : undefined);
+          // La factura puede cobrar también lo dañado: coincide con o sin ello.
+          if (
+            invoiceTotal !== undefined &&
+            Math.abs(invoiceTotal - total) > 0.01 &&
+            Math.abs(invoiceTotal - (total + damagedCost)) > 0.01 &&
+            !data.acknowledgeMismatch
+          )
+            bad(
+              "El total de las líneas, flete e impuestos no coincide con la factura. Revisa o confirma la diferencia.",
             );
-            if (!item) bad("Línea ajena a la orden.");
-            // Pedido = recibido bueno + dañado/rechazado + pendiente.
-            item.receivedQty = Number(item.receivedQty) + line.qty;
-            item.damagedQty = Number(item.damagedQty) + line.damagedQty;
-            if (d(item.receivedQty).plus(item.damagedQty).gt(Number(item.qty)))
-              bad("Cantidad superior a lo pendiente.");
+          let order: any;
+          if (data.orderId) {
+            if (data.direction !== "entry")
+              bad("La orden sólo permite entrada.");
+            await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${data.orderId}::uuid FOR UPDATE`;
+            order = await tx.purchaseOrder.findFirstOrThrow({
+              where: { id: data.orderId, branchId: actor.branchId },
+              include: { items: true },
+            });
+            if (order.status === "received") bad("Orden ya recibida.");
+            if (order.supplierId !== data.supplierId)
+              bad("Proveedor distinto al de la orden.");
           }
-          lines.push({ ...line, variantId });
-        }
-        const costs =
-          data.direction === "entry"
-            ? receiptCosts(
-                lines.map((l) => ({ qty: l.qty, cost: l.unitCost })),
-                money(d(data.freight).plus(data.taxes)),
-                data.allocation,
-              )
-            : [];
-        const receipt =
-          data.direction === "entry"
-            ? await tx.goodsReceipt.create({
+          const lines: any[] = [];
+          for (const line of data.items) {
+            let variantId = line.variantId;
+            if (line.quick) {
+              const q = line.quick;
+              const cat = await tx.category.findFirstOrThrow({
+                where: { id: q.categoryId, branchId: actor.branchId },
+              });
+              // Quien no puede editar el catálogo (almacén) crea el producto
+              // inactivo: no se vende hasta que un gerente revise su precio.
+              const canPrice = can(actor.permissions, "catalog:write");
+              const p = await tx.product.create({
                 data: {
-                  orderId: data.orderId,
-                  supplierId: data.supplierId,
-                  total,
-                  attachmentId: draft?.attachmentId,
-                  operationId: data.id,
-                  freight: data.freight,
-                  otherCosts: data.taxes,
-                  damagedCost,
-                  // El total del documento se conserva aparte de lo aceptado y
-                  // lo dañado; la diferencia reconocida es lo que no explica
-                  // ninguno de los dos (R9-A03).
-                  invoiceTotal: invoiceTotal ?? null,
-                  invoiceDifference:
-                    invoiceTotal === undefined
-                      ? 0
-                      : money(d(invoiceTotal).minus(total).minus(damagedCost)),
-                  // Sin condición propia, la de la orden o el plazo del proveedor.
-                  ...documentData(
-                    data,
-                    order
-                      ? {
-                          paymentType: order.paymentType,
-                          creditDays: order.creditDays,
-                        }
-                      : {},
-                    supplier?.paymentTermsDays,
-                  ),
-                  items: json(
-                    lines.map((l, i) => ({
-                      ...l,
-                      landedCost: costs[i],
-                      damagedCost: damagedCostOf({ ...l, cost: l.unitCost }),
-                      attachmentId: draft?.attachmentId,
-                    })),
-                  ),
-                  userId: actor.id,
+                  name: q.name,
+                  sku: "Q-" + data.id + "-" + lines.length,
+                  categoryId: cat.id,
                   branchId: actor.branchId,
+                  createdBy: actor.id,
+                  supplierId: data.supplierId,
+                  ...(canPrice ? {} : { active: false }),
+                  variants: {
+                    create: {
+                      sku: "QV-" + data.id + "-" + lines.length,
+                      barcode: q.barcode,
+                      price: q.price,
+                      costAvg: q.cost,
+                      attributes: { variante: q.variant },
+                      branchId: actor.branchId,
+                      createdBy: actor.id,
+                    },
+                  },
                 },
-              })
-            : null;
-        for (const [index, line] of lines
-          .map((l, i) => [i, l] as const)
-          .sort((a, b) => a[1].variantId.localeCompare(b[1].variantId))) {
-          // Una línea sólo con dañados no entra al stock: cierra lo pendiente.
-          if (data.direction === "entry" && !(line.qty > 0)) {
-            if (order)
-              await tx.purchaseItem.update({
-                where: { id: line.itemId },
-                data: { damagedQty: { increment: line.damagedQty } },
+                include: { variants: true },
               });
-            continue;
+              variantId = p.variants[0].id;
+              if (!canPrice)
+                await tx.alert.upsert({
+                  where: { key: "new-product:" + p.id },
+                  create: {
+                    key: "new-product:" + p.id,
+                    type: "product_review",
+                    severity: "medium",
+                    entityId: p.id,
+                    branchId: actor.branchId,
+                    message:
+                      p.name +
+                      ": producto creado al recibir mercancía. Revisa el precio y actívalo para venderlo.",
+                  },
+                  update: {},
+                });
+            }
+            if (order) {
+              const item = order.items.find(
+                (i: any) => i.id === line.itemId && i.variantId === variantId,
+              );
+              if (!item) bad("Línea ajena a la orden.");
+              // Pedido = recibido bueno + dañado/rechazado + pendiente.
+              item.receivedQty = Number(item.receivedQty) + line.qty;
+              item.damagedQty = Number(item.damagedQty) + line.damagedQty;
+              if (
+                d(item.receivedQty).plus(item.damagedQty).gt(Number(item.qty))
+              )
+                bad("Cantidad superior a lo pendiente.");
+            }
+            lines.push({ ...line, variantId });
           }
-          const v = await lockVariant(tx, line.variantId, actor);
-          let lotId = line.lotId;
-          if (data.direction === "entry") {
-            if (
-              (v.product.category.requiresLot ||
-                v.product.category.requiresExpiry) &&
-              !line.lotNumber
-            )
-              bad("Indica el lote.");
-            if (v.product.category.requiresExpiry && !line.expiryDate)
-              bad("Indica vencimiento.");
-            if (expired(line.expiryDate))
-              bad("No se recibe mercancía vencida.");
-            v.costAvg = weightedCost(
-              Math.max(0, Number(v.stock)),
-              Number(v.costAvg),
-              line.qty,
-              costs[index],
-            );
-            await tx.variant.update({
-              where: { id: v.id },
-              data: { costAvg: v.costAvg },
-            });
-            if (line.lotNumber) {
-              const existing = await tx.lot.findUnique({
-                where: {
-                  variantId_lotNumber: {
+          const costs =
+            data.direction === "entry"
+              ? receiptCosts(
+                  lines.map((l) => ({ qty: l.qty, cost: l.unitCost })),
+                  money(d(data.freight).plus(data.taxes)),
+                  data.allocation,
+                )
+              : [];
+          const receipt =
+            data.direction === "entry"
+              ? await tx.goodsReceipt.create({
+                  data: {
+                    orderId: data.orderId,
+                    supplierId: data.supplierId,
+                    total,
+                    attachmentId: draft?.attachmentId,
+                    operationId: data.id,
+                    freight: data.freight,
+                    otherCosts: data.taxes,
+                    damagedCost,
+                    // El total del documento se conserva aparte de lo aceptado y
+                    // lo dañado; la diferencia reconocida es lo que no explica
+                    // ninguno de los dos (R9-A03).
+                    invoiceTotal: invoiceTotal ?? null,
+                    invoiceDifference:
+                      invoiceTotal === undefined
+                        ? 0
+                        : money(
+                            d(invoiceTotal).minus(total).minus(damagedCost),
+                          ),
+                    // Sin condición propia, la de la orden o el plazo del proveedor.
+                    ...documentData(
+                      data,
+                      order
+                        ? {
+                            paymentType: order.paymentType,
+                            creditDays: order.creditDays,
+                          }
+                        : {},
+                      supplier?.paymentTermsDays,
+                    ),
+                    items: json(
+                      lines.map((l, i) => ({
+                        ...l,
+                        landedCost: costs[i],
+                        damagedCost: damagedCostOf({ ...l, cost: l.unitCost }),
+                        attachmentId: draft?.attachmentId,
+                      })),
+                    ),
+                    userId: actor.id,
+                    branchId: actor.branchId,
+                  },
+                })
+              : null;
+          for (const [index, line] of lines
+            .map((l, i) => [i, l] as const)
+            .sort((a, b) => a[1].variantId.localeCompare(b[1].variantId))) {
+            // Una línea sólo con dañados no entra al stock: cierra lo pendiente.
+            if (data.direction === "entry" && !(line.qty > 0)) {
+              if (order)
+                await tx.purchaseItem.update({
+                  where: { id: line.itemId },
+                  data: { damagedQty: { increment: line.damagedQty } },
+                });
+              continue;
+            }
+            const v = await lockVariant(tx, line.variantId, actor);
+            let lotId = line.lotId;
+            if (data.direction === "entry") {
+              if (
+                (v.product.category.requiresLot ||
+                  v.product.category.requiresExpiry) &&
+                !line.lotNumber
+              )
+                bad("Indica el lote.");
+              if (v.product.category.requiresExpiry && !line.expiryDate)
+                bad("Indica vencimiento.");
+              if (expired(line.expiryDate))
+                bad("No se recibe mercancía vencida.");
+              v.costAvg = weightedCost(
+                Math.max(0, Number(v.stock)),
+                Number(v.costAvg),
+                line.qty,
+                costs[index],
+              );
+              await tx.variant.update({
+                where: { id: v.id },
+                data: { costAvg: v.costAvg },
+              });
+              if (line.lotNumber) {
+                const identity = lotIdentity(line.lotNumber, line.expiryDate);
+                const existing = await tx.lot.findUnique({
+                  where: {
+                    variantId_lotNumberNormalized: {
+                      variantId: v.id,
+                      lotNumberNormalized: identity.lotNumberNormalized,
+                    },
+                  },
+                });
+                const reconciled = reconcileLotExpiry(
+                  existing?.expiryDate,
+                  identity.expiryDate,
+                );
+                if (reconciled.conflict)
+                  bad("Ese lote ya tiene un vencimiento diferente.");
+                if (existing && expired(reconciled.expiryDate))
+                  bad("No puedes recibir existencias en un lote vencido.");
+                const lot = await tx.lot.upsert({
+                  where: {
+                    variantId_lotNumberNormalized: {
+                      variantId: v.id,
+                      lotNumberNormalized: identity.lotNumberNormalized,
+                    },
+                  },
+                  create: {
                     variantId: v.id,
-                    lotNumber: line.lotNumber,
+                    ...identity,
+                    qty: line.qty,
+                    cost: costs[index],
+                    branchId: actor.branchId,
+                  },
+                  update: {
+                    qty: { increment: line.qty },
+                    expiryDate: reconciled.expiryDate,
+                  },
+                });
+                lotId = lot.id;
+              }
+            } else {
+              if (v.product.category.requiresLot && !lotId)
+                bad("Selecciona el lote de salida.");
+              if (lotId) {
+                const lot = await tx.lot.findFirstOrThrow({
+                  where: {
+                    id: lotId,
+                    variantId: v.id,
+                    branchId: actor.branchId,
                   },
+                });
+                if (Number(lot.qty) < line.qty) bad("Lote insuficiente.");
+                await tx.lot.update({
+                  where: { id: lot.id },
+                  data: { qty: { decrement: line.qty } },
+                });
+              } else {
+                const untracked =
+                  Number(v.stock) -
+                  v.lots.reduce((s: number, l: any) => s + Number(l.qty), 0);
+                if (untracked < line.qty)
+                  bad("Selecciona un lote con existencias.");
+              }
+              if (Number(v.stock) < line.qty) bad("Stock insuficiente.");
+            }
+            await stockChange(
+              tx,
+              actor,
+              v,
+              data.direction === "entry" ? line.qty : -line.qty,
+              data.direction === "entry" ? "purchase" : "merchandise_exit",
+              data.direction === "entry"
+                ? "Entrada de mercancía"
+                : data.reason!,
+              receipt?.id ?? data.id,
+              lotId,
+              data.direction === "entry" ? costs[index] : undefined,
+            );
+            if (order)
+              await tx.purchaseItem.update({
+                where: { id: line.itemId },
+                data: {
+                  receivedQty: { increment: line.qty },
+                  damagedQty: { increment: line.damagedQty },
                 },
               });
-              if (
-                existing &&
-                (expired(existing.expiryDate) ||
-                  (line.expiryDate &&
-                    (!existing.expiryDate ||
-                      businessDate(existing.expiryDate) !==
-                        businessDate(line.expiryDate))))
-              )
-                bad("Lote vencido o con vencimiento distinto.");
-              const lot = await tx.lot.upsert({
+            if (data.supplierId && line.supplierCode)
+              await tx.supplierCode.upsert({
                 where: {
-                  variantId_lotNumber: {
-                    variantId: v.id,
-                    lotNumber: line.lotNumber,
+                  supplierId_branchId_code: {
+                    supplierId: data.supplierId,
+                    branchId: actor.branchId,
+                    code: line.supplierCode,
                   },
                 },
                 create: {
-                  variantId: v.id,
-                  lotNumber: line.lotNumber,
-                  expiryDate: line.expiryDate
-                    ? new Date(line.expiryDate)
-                    : null,
-                  qty: line.qty,
-                  cost: costs[index],
+                  supplierId: data.supplierId,
                   branchId: actor.branchId,
+                  code: line.supplierCode,
+                  variantId: v.id,
                 },
-                update: { qty: { increment: line.qty } },
+                update: { variantId: v.id },
               });
-              lotId = lot.id;
-            }
-          } else {
-            if (v.product.category.requiresLot && !lotId)
-              bad("Selecciona el lote de salida.");
-            if (lotId) {
-              const lot = await tx.lot.findFirstOrThrow({
-                where: { id: lotId, variantId: v.id, branchId: actor.branchId },
-              });
-              if (Number(lot.qty) < line.qty) bad("Lote insuficiente.");
-              await tx.lot.update({
-                where: { id: lot.id },
-                data: { qty: { decrement: line.qty } },
-              });
-            } else {
-              const untracked =
-                Number(v.stock) -
-                v.lots.reduce((s: number, l: any) => s + Number(l.qty), 0);
-              if (untracked < line.qty)
-                bad("Selecciona un lote con existencias.");
-            }
-            if (Number(v.stock) < line.qty) bad("Stock insuficiente.");
           }
-          await stockChange(
-            tx,
-            actor,
-            v,
-            data.direction === "entry" ? line.qty : -line.qty,
-            data.direction === "entry" ? "purchase" : "merchandise_exit",
-            data.direction === "entry" ? "Entrada de mercancía" : data.reason!,
-            receipt?.id ?? data.id,
-            lotId,
-            data.direction === "entry" ? costs[index] : undefined,
-          );
           if (order)
-            await tx.purchaseItem.update({
-              where: { id: line.itemId },
+            await tx.purchaseOrder.update({
+              where: { id: order.id },
               data: {
-                receivedQty: { increment: line.qty },
-                damagedQty: { increment: line.damagedQty },
+                status: order.items.every((i: any) =>
+                  d(i.receivedQty).plus(i.damagedQty).gte(Number(i.qty)),
+                )
+                  ? "received"
+                  : "partial",
               },
             });
-          if (data.supplierId && line.supplierCode)
-            await tx.supplierCode.upsert({
-              where: {
-                supplierId_branchId_code: {
-                  supplierId: data.supplierId,
-                  branchId: actor.branchId,
-                  code: line.supplierCode,
-                },
-              },
-              create: {
-                supplierId: data.supplierId,
-                branchId: actor.branchId,
-                code: line.supplierCode,
-                variantId: v.id,
-              },
-              update: { variantId: v.id },
+          if (draft)
+            await tx.invoiceDraft.update({
+              where: { id: draft.id },
+              data: { confirmedOperationId: data.id },
             });
-        }
-        if (order)
-          await tx.purchaseOrder.update({
-            where: { id: order.id },
+          const result = {
+            id: data.id,
+            receiptId: receipt?.id,
+            variantIds: lines.map((l) => l.variantId),
+            total,
+            // Total del documento y diferencia reconocida (R9-A03).
+            invoiceTotal: receipt ? (invoiceTotal ?? null) : null,
+            invoiceDifference: receipt ? Number(receipt.invoiceDifference) : 0,
+            attachmentId: draft?.attachmentId,
+          };
+          await audit(
+            tx,
+            { ...actor, terminalId: terminal.id },
+            "merchandise_" + data.direction,
+            "merchandise",
+            data.id,
+            undefined,
+            { ...data, result },
+          );
+          await tx.merchandiseOperation.create({
             data: {
-              status: order.items.every((i: any) =>
-                d(i.receivedQty).plus(i.damagedQty).gte(Number(i.qty)),
-              )
-                ? "received"
-                : "partial",
+              id: data.id,
+              branchId: actor.branchId,
+              userId: actor.id,
+              terminalId: terminal.id,
+              requestHash,
+              result: json(result),
             },
           });
-        if (draft)
-          await tx.invoiceDraft.update({
-            where: { id: draft.id },
-            data: { confirmedOperationId: data.id },
-          });
-        const result = {
-          id: data.id,
-          receiptId: receipt?.id,
-          variantIds: lines.map((l) => l.variantId),
-          total,
-          // Total del documento y diferencia reconocida (R9-A03).
-          invoiceTotal: receipt ? (invoiceTotal ?? null) : null,
-          invoiceDifference: receipt ? Number(receipt.invoiceDifference) : 0,
-          attachmentId: draft?.attachmentId,
-        };
-        await audit(
-          tx,
-          { ...actor, terminalId: terminal.id },
-          "merchandise_" + data.direction,
-          "merchandise",
-          data.id,
-          undefined,
-          { ...data, result },
-        );
-        await tx.merchandiseOperation.create({
-          data: {
-            id: data.id,
-            branchId: actor.branchId,
-            userId: actor.id,
-            terminalId: terminal.id,
-            requestHash,
-            result: json(result),
-          },
-        });
-        return result;
-      },
-      { timeout: 30000 },
+          return result;
+        },
+        { isolationLevel: "Serializable", timeout: 30000 },
+      ),
     );
   }
 }
diff --git a/apps/api/src/offline-sales.ts b/apps/api/src/offline-sales.ts
new file mode 100644
index 0000000..ed57519
--- /dev/null
+++ b/apps/api/src/offline-sales.ts
@@ -0,0 +1,48 @@
+import { Body, Controller, Inject, Post } from "@nestjs/common";
+import { z } from "@fitstore/shared";
+import {
+  Actor,
+  CurrentUser,
+  Database,
+  Permit,
+  RequireTerminal,
+  audit,
+  parse,
+} from "./common";
+
+const resolution = z.object({
+  offlineUuid: z.string().uuid(),
+  action: z.enum(["reprice", "discard"]),
+  previousTotal: z.number().nonnegative().max(100000000),
+  currentTotal: z.number().nonnegative().max(100000000).optional(),
+  reason: z.string().trim().min(3).max(300),
+});
+
+@Controller()
+export class OfflineSalesController {
+  constructor(@Inject(Database) private readonly db: Database) {}
+
+  @Post("sales/offline-resolution")
+  @Permit("sale:write")
+  @RequireTerminal()
+  async record(@Body() body: unknown, @CurrentUser() actor: Actor) {
+    const data = parse(resolution, body);
+    await audit(
+      this.db,
+      actor,
+      data.action === "discard"
+        ? "offline_sale_discarded"
+        : "offline_sale_repriced",
+      "offline_sale",
+      data.offlineUuid,
+      { total: data.previousTotal },
+      {
+        ...(data.currentTotal === undefined
+          ? {}
+          : { total: data.currentTotal }),
+        reason: data.reason,
+      },
+    );
+    return { ok: true };
+  }
+}
diff --git a/apps/api/src/rate-limit.ts b/apps/api/src/rate-limit.ts
index a4d85dc..312a66d 100644
--- a/apps/api/src/rate-limit.ts
+++ b/apps/api/src/rate-limit.ts
@@ -1,92 +1,110 @@
 import { createHash } from "node:crypto";
+import {
+  CanActivate,
+  ExecutionContext,
+  HttpException,
+  HttpStatus,
+  Inject,
+  Injectable,
+} from "@nestjs/common";
 
 type Bucket = { count: number; until: number };
-
-export type RequestRateLimitOptions = {
-  windowMs?: number;
-  authAccountLimit?: number;
-  salesSessionLimit?: number;
-  now?: () => number;
+export type RequestRateLimitOptions = { windowMs?: number; now?: () => number };
+const digest = (...parts: string[]) =>
+  createHash("sha256").update(parts.join("\u0000")).digest("hex");
+const positiveLimit = (value: string | undefined, fallback: number) => {
+  const parsed = Number(value);
+  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
 };
 
-const loginIdentifier = (req: any) =>
-  String(req.body?.login ?? req.body?.email ?? "")
-    .trim()
-    .normalize("NFKC")
-    .toLocaleLowerCase("es");
-
-const sessionIdentifier = (req: any) => {
-  const authorization = String(req.headers?.authorization ?? "");
-  return authorization
-    ? createHash("sha256").update(authorization).digest("hex")
-    : "anonymous";
+export const REQUEST_RATE_LIMITS = {
+  authAccount: positiveLimit(process.env.AUTH_ACCOUNT_RATE_LIMIT, 60),
+  pinSession: positiveLimit(process.env.PIN_SESSION_RATE_LIMIT, 60),
+  refreshSession: positiveLimit(process.env.REFRESH_SESSION_RATE_LIMIT, 60),
+  salesSession: positiveLimit(process.env.SALES_SESSION_RATE_LIMIT, 120),
 };
 
-/**
- * Render puede presentar varias cajas bajo la dirección del proxy. Por eso no
- * existe un contador compartido por IP: login se limita por cuenta+IP y ventas
- * por sesión+IP. Tráfico anónimo o con tokens falsos sólo agota su propia clave.
- * La protección persistente de cinco claves erróneas sigue en AuthAttempt.
- */
-export function createRequestRateLimiter(
-  options: RequestRateLimitOptions = {},
-) {
-  const windowMs = options.windowMs ?? 60_000;
-  const authAccountLimit = options.authAccountLimit ?? 60;
-  const salesSessionLimit = options.salesSessionLimit ?? 120;
-  const now = options.now ?? Date.now;
-  const attempts = new Map<string, Bucket>();
-
-  const exceeds = (key: string, limit: number, at: number) => {
-    const item = attempts.get(key);
-    const current = item && item.until > at ? item : null;
-    if (current && current.count >= limit) return true;
-    attempts.set(key, {
-      count: (current?.count ?? 0) + 1,
-      until: current?.until ?? at + windowMs,
-    });
+/** Sólo recibe identidades ya verificadas contra la base de datos. */
+export class ValidatedRateLimitStore {
+  private readonly windowMs: number;
+  private readonly now: () => number;
+  private readonly buckets = new Map<string, Bucket>();
+  private nextPurgeAt = 0;
+  constructor(options: RequestRateLimitOptions = {}) {
+    this.windowMs = options.windowMs ?? 60_000;
+    this.now = options.now ?? Date.now;
+  }
+  exceeds(scope: string, identity: string[], limit: number) {
+    const at = this.now();
+    if (at >= this.nextPurgeAt) {
+      for (const [key, value] of this.buckets)
+        if (value.until <= at) this.buckets.delete(key);
+      this.nextPurgeAt = at + Math.max(1_000, Math.min(this.windowMs, 60_000));
+    }
+    const key = digest(scope, ...identity);
+    const item = this.buckets.get(key);
+    if (item?.until && item.until > at) {
+      if (item.count >= limit) return true;
+      item.count += 1;
+      return false;
+    }
+    this.buckets.set(key, { count: 1, until: at + this.windowMs });
     return false;
-  };
-
-  return (req: any, res: any, next: () => void) => {
-    const path = String(req.path ?? req.url?.split("?")[0] ?? "").toLowerCase();
-    const ip = String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
-    const at = now();
-    const auth = path.startsWith("/api/auth/");
-    const sale = req.method === "POST" && path.startsWith("/api/sales");
-    let blocked = false;
+  }
+  size() {
+    return this.buckets.size;
+  }
+}
 
-    if (auth) {
-      const identifier = loginIdentifier(req);
-      if (identifier)
-        blocked = exceeds(
-          `auth-account:${ip}:${identifier}`,
-          authAccountLimit,
-          at,
-        );
-    } else if (sale) {
-      blocked = exceeds(
-        `sales-session:${ip}:${sessionIdentifier(req)}`,
-        salesSessionLimit,
-        at,
+@Injectable()
+export class RequestRateLimitService {
+  private readonly store = new ValidatedRateLimitStore();
+  assert(scope: string, identity: string[], limit: number) {
+    if (this.store.exceeds(scope, identity, limit))
+      throw new HttpException(
+        "Demasiados intentos. Espera un minuto.",
+        HttpStatus.TOO_MANY_REQUESTS,
       );
-    }
+  }
+}
 
-    if (blocked) {
-      res
-        .status(429)
-        .json({ message: "Demasiados intentos. Espera un minuto." });
-      return;
-    }
-    if (attempts.size > 10_000) {
-      for (const [key, value] of attempts)
-        if (value.until < at) attempts.delete(key);
-      while (attempts.size > 10_000) {
-        const oldest = attempts.keys().next().value;
-        if (!oldest) break;
-        attempts.delete(oldest);
-      }
-    }
-    next();
-  };
+const requestPath = (req: any) =>
+  String(req.path ?? req.url?.split("?")[0] ?? "").toLowerCase();
+/** Se ejecuta después de AuthGuard; los Bearer falsos nunca crean un cubo. */
+@Injectable()
+export class AuthenticatedRateLimitGuard implements CanActivate {
+  constructor(
+    @Inject(RequestRateLimitService)
+    private readonly limits: RequestRateLimitService,
+  ) {}
+  canActivate(context: ExecutionContext) {
+    const req = context.switchToHttp().getRequest<any>();
+    const actor = req.actor;
+    if (!actor?.sessionId) return true;
+    const method = String(req.method ?? "GET").toUpperCase();
+    const path = requestPath(req);
+    // La sesión ya está firmada y validada por AuthGuard. No añadir la IP:
+    // además de cambiar legítimamente en celulares, una cabecera reenviada
+    // manipulable permitiría reiniciar el contador de la misma sesión.
+    const identity = [String(actor.sessionId)];
+    if (method === "POST" && (path === "/api/auth/pin" || path === "/auth/pin"))
+      this.limits.assert(
+        "auth-pin-session",
+        identity,
+        REQUEST_RATE_LIMITS.pinSession,
+      );
+    else if (
+      method === "POST" &&
+      (path === "/api/sales" ||
+        path.startsWith("/api/sales/") ||
+        path === "/sales" ||
+        path.startsWith("/sales/"))
+    )
+      this.limits.assert(
+        "sales-session",
+        identity,
+        REQUEST_RATE_LIMITS.salesSession,
+      );
+    return true;
+  }
 }
diff --git a/apps/api/src/reports.ts b/apps/api/src/reports.ts
index 3f19f26..0a80b83 100644
--- a/apps/api/src/reports.ts
+++ b/apps/api/src/reports.ts
@@ -29,6 +29,7 @@ import {
   uuid,
   safe,
   denied,
+  canViewCashExpected,
 } from "./common";
 
 export function dateRange(query: Record<string, string>) {
@@ -285,6 +286,7 @@ export class ReportsController {
       (actor.role === "seller" || !can(actor.permissions, "profit:read"))
     )
       denied();
+    if (name === "cash" && !canViewCashExpected(actor)) denied();
     if (STORE_REPORTS.includes(name))
       return sendStoreReport(
         res,
@@ -809,6 +811,14 @@ export async function storeReport(
         },
       })
     : null;
+  if (!canViewCashExpected(actor)) {
+    // Un reporte por fecha o por otra caja permite reconstruir el arqueo de
+    // una jornada abierta. Sin privilegio financiero sólo se admite la caja
+    // propia y después de cerrarla.
+    if (!session || session.userId !== actor.id) denied();
+    if (!session.closedAt)
+      bad("Cierra la caja para consultar sus reportes.");
+  }
   const range =
     session && !query.from && !query.to
       ? null
diff --git a/apps/api/src/sales.ts b/apps/api/src/sales.ts
index abbb063..1425a21 100644
--- a/apps/api/src/sales.ts
+++ b/apps/api/src/sales.ts
@@ -70,9 +70,134 @@ const paymentSummary = (payment: any) => {
       : 0,
   };
 };
+
+// `/sales` alimenta el historial operativo, no es una representación directa
+// de Prisma. Mantener una lista blanca evita que una columna nueva de costos o
+// un objeto JSON sensible aparezca automáticamente en la respuesta.
+export function saleHistoryDto(sale: any, actor: Actor) {
+  const showProfit = can(actor.permissions, "profit:read");
+  const item = (row: any) => ({
+    id: row.id,
+    variantId: row.variantId,
+    lotId: row.lotId,
+    qty: row.qty,
+    returnedQty: row.returnedQty,
+    unitPrice: row.unitPrice,
+    discount: row.discount,
+    tax: row.tax,
+    lineTotal: row.lineTotal,
+    ...(showProfit ? { unitCost: row.unitCost } : {}),
+    variant: row.variant
+      ? {
+          id: row.variant.id,
+          productId: row.variant.productId,
+          sku: row.variant.sku,
+          barcode: row.variant.barcode,
+          attributes: row.variant.attributes,
+          product: row.variant.product
+            ? { id: row.variant.product.id, name: row.variant.product.name }
+            : null,
+        }
+      : null,
+  });
+  const payment = (row: any) => {
+    const summary = paymentSummary(row);
+    return {
+      id: summary.id,
+      createdAt: summary.createdAt,
+      method: summary.method,
+      amount: summary.amount,
+      tendered: summary.tendered,
+      change: summary.change,
+      bank: summary.bank,
+      reference: summary.reference,
+      cardBrand: summary.cardBrand,
+      cardLast4: summary.cardLast4,
+      approvalCode: summary.approvalCode,
+      cardType: summary.cardType,
+      status: summary.status,
+      entryType: summary.entryType,
+      hasProof: summary.hasProof,
+      proofContentType: summary.proofContentType,
+      proofBytes: summary.proofBytes,
+      ...(showProfit ? { feeAmount: summary.feeAmount } : {}),
+    };
+  };
+  const returned = (row: any) => ({
+    id: row.id,
+    number: row.number,
+    reason: row.reason,
+    total: row.total,
+    taxTotal: row.taxTotal,
+    refundAmount: row.refundAmount,
+    refundMethod: row.refundMethod,
+    createdAt: row.createdAt,
+    ...(showProfit
+      ? {
+          costTotal: row.costTotal,
+          wasteQty: row.wasteQty,
+          wasteCostTotal: row.wasteCostTotal,
+          items: row.items,
+        }
+      : {}),
+  });
+  return {
+    id: sale.id,
+    number: sale.number,
+    status: sale.status,
+    customerId: sale.customerId,
+    sellerId: sale.sellerId,
+    cashSessionId: sale.cashSessionId,
+    subtotal: sale.subtotal,
+    discountTotal: sale.discountTotal,
+    discountReason: sale.discountReason,
+    discountRule: sale.discountRule,
+    discountApprovedBy: sale.discountApprovedBy,
+    discountApprovedName: sale.discountApprovedName,
+    discountApprovedRole: sale.discountApprovedRole,
+    taxTotal: sale.taxTotal,
+    total: sale.total,
+    creditBalance: sale.creditBalance,
+    creditDueDate: sale.creditDueDate,
+    ncf: sale.ncf,
+    ncfType: sale.ncfType,
+    recipientLegalId: sale.recipientLegalId,
+    fiscalStatus: sale.fiscalStatus,
+    notes: sale.notes,
+    voidedReason: sale.voidedReason,
+    voidedBy: sale.voidedBy,
+    createdAt: sale.createdAt,
+    updatedAt: sale.updatedAt,
+    items: (sale.items ?? []).map(item),
+    payments: (sale.payments ?? []).map(payment),
+    returns: (sale.returns ?? []).map(returned),
+    ...(showProfit ? { costTotal: sale.costTotal } : {}),
+  };
+}
 import PDFDocument from "pdfkit";
 import type { Response } from "express";
 
+export function normalizeLegacyOfflineDiscount(
+  input: SaleInput,
+  offline: boolean,
+  requestsDiscount: boolean,
+  cutoff = Date.parse("2026-10-09T04:00:00.000Z"),
+) {
+  const capturedAt = input.capturedAt ? Date.parse(input.capturedAt) : NaN;
+  if (
+    !requestsDiscount ||
+    input.discountReason ||
+    !offline ||
+    !Number.isFinite(capturedAt) ||
+    capturedAt > cutoff
+  )
+    return input;
+  return {
+    ...input,
+    discountReason: "Venta offline heredada (sin motivo registrado)",
+  };
+}
+
 // Una venta pendiente se mantiene como una sola cuenta por cobrar hasta que
 // un administrador confirma todos sus abonos.
 async function refreshReceivableAlert(
@@ -271,13 +396,22 @@ export class SalesController {
       input.items.some(
         (item) => item.discountPercent > 0 || (item.discountAmount ?? 0) > 0,
       );
-    if (requestsDiscount && !input.discountReason)
-      bad("Indica el motivo del descuento.");
     const { managerPin: ignored, ...fingerprint } = input;
     void ignored;
-    const requestHash = createHash("sha256")
+    const originalRequestHash = createHash("sha256")
       .update(JSON.stringify(fingerprint))
       .digest("hex");
+    const normalizedInput = normalizeLegacyOfflineDiscount(
+      input,
+      offline,
+      requestsDiscount,
+    );
+    const { managerPin: normalizedPin, ...normalizedFingerprint } =
+      normalizedInput;
+    void normalizedPin;
+    const requestHash = createHash("sha256")
+      .update(JSON.stringify(normalizedFingerprint))
+      .digest("hex");
     const completed = await this.db.sale.findUnique({
       where: { offlineUuid: input.offlineUuid },
       include: { items: true, payments: true },
@@ -288,10 +422,19 @@ export class SalesController {
         completed.branchId !== actor.branchId
       )
         denied();
-      if (completed.requestHash && completed.requestHash !== requestHash)
+      // Una venta heredada pudo quedar en IndexedDB antes de que el motivo
+      // fuese obligatorio. Su UUID sigue siendo la autoridad idempotente.
+      if (
+        completed.requestHash &&
+        completed.requestHash !== originalRequestHash &&
+        completed.requestHash !== requestHash
+      )
         bad("El UUID ya corresponde a otra venta.");
       return safe(completed, actor);
     }
+    if (requestsDiscount && !normalizedInput.discountReason)
+      bad("Indica el motivo del descuento.");
+    input = normalizedInput;
     if (offline) {
       const settings = await this.db.settings.findUnique({
         where: { id: actor.branchId },
@@ -953,13 +1096,7 @@ export class SalesController {
       // cada artículo de todas las ventas en una sola respuesta.
       take: filters.q || filters.date ? 500 : 100,
     });
-    return safe(
-      rows.map((sale) => ({
-        ...sale,
-        payments: sale.payments.map(paymentSummary),
-      })),
-      actor,
-    );
+    return rows.map((sale) => saleHistoryDto(sale, actor));
   }
   @Post("sales/:id/void")
   @Permit("*")
@@ -1534,25 +1671,54 @@ export class SalesController {
     const returned = await this.db.saleReturn.findFirstOrThrow({
       where: { id: parse(uuid, id), branchId: actor.branchId },
     });
-    const note = await this.db.creditNote.findUniqueOrThrow({
-      where: { returnId: returned.id },
-    });
+    const [note, settings] = await Promise.all([
+      this.db.creditNote.findUniqueOrThrow({
+        where: { returnId: returned.id },
+      }),
+      this.db.settings.findUnique({ where: { id: actor.branchId } }),
+    ]);
+    const business = (settings?.data as any) ?? {};
     res.setHeader("Content-Type", "application/pdf");
     const doc = new PDFDocument({ size: "A4", margin: 48 });
     doc.pipe(res);
     doc
       .fontSize(22)
-      .text("Nexora POS · " + returned.number)
+      .text(business.name || "Nexora POS", { align: "center" });
+    if (business.branchName)
+      doc.fontSize(11).text(business.branchName, { align: "center" });
+    if (business.address)
+      doc.fontSize(10).text(business.address, { align: "center" });
+    if (business.phone)
+      doc.fontSize(10).text("Tel.: " + business.phone, { align: "center" });
+    if (business.legalId)
+      doc.fontSize(10).text("RNC: " + business.legalId, { align: "center" });
+    doc
+      .moveDown()
+      .fontSize(16)
+      .text("Nota de crédito · " + returned.number)
       .fontSize(12)
       .text("Nota interna de crédito · no fiscal")
+      .text(
+        "Fecha: " +
+          note.createdAt.toLocaleString("es-DO", {
+            timeZone: BUSINESS_TIME_ZONE,
+            dateStyle: "short",
+            timeStyle: "short",
+          }),
+      )
       .text("Importe: RD$ " + note.amount)
       .text("Saldo: RD$ " + note.balance)
+      .text("Motivo de la devolución: " + returned.reason)
       .moveDown()
       .text("Código para presentar en caja:")
       .fontSize(14)
       .text(note.redemptionCode)
       .fontSize(10)
-      .text("Conserva este código. Permite usar el saldo de la nota.");
+      .moveDown()
+      .text("Condiciones de uso:")
+      .text(
+        "Presenta este código en caja. El saldo se aplica a compras en esta sucursal, se descuenta una sola vez por operación y está sujeto a verificación. No es efectivo ni comprobante fiscal.",
+      );
     doc.end();
   }
   @Post("sales/:id/installments")
@@ -1585,7 +1751,6 @@ export class SalesController {
   // URL en el pago, igual que el logo. La sube quien registró el cobro en su
   // caja o quien gestiona ventas; se puede reemplazar.
   @Post("payments/:id/proof")
-  @Permit("*")
   @UseInterceptors(
     FileInterceptor("file", {
       limits: { fileSize: PROOF_MAX_BYTES + 1, files: 1 },
@@ -1625,7 +1790,6 @@ export class SalesController {
     });
   }
   @Get("payments/:id/proof")
-  @Permit("*")
   async getPaymentProof(
     @Param("id") id: string,
     @CurrentUser() actor: Actor,
@@ -1891,16 +2055,20 @@ export class SalesController {
       doc.fontSize(10).text(business.branchName, { align: "center" });
     if (business.address)
       doc.fontSize(9).text(business.address, { align: "center" });
+    if (business.phone)
+      doc.fontSize(9).text("Tel.: " + business.phone, { align: "center" });
     if (business.legalId)
       doc.fontSize(9).text("RNC: " + business.legalId, { align: "center" });
     doc
       .fontSize(10)
       .text("Documento interno — no fiscal")
+      .text(sale.number)
       .text(
-        sale.number +
-          " · " +
-          sale.createdAt.toLocaleDateString("es-DO", {
+        "Fecha y hora: " +
+          sale.createdAt.toLocaleString("es-DO", {
             timeZone: BUSINESS_TIME_ZONE,
+            dateStyle: "short",
+            timeStyle: "short",
           }),
       )
       .moveDown();
@@ -1919,7 +2087,11 @@ export class SalesController {
       );
     doc
       .moveDown()
-      .text("ITBIS incluido: RD$ " + sale.taxTotal)
+      .text(
+        (business.taxIncluded === false
+          ? "ITBIS adicional: RD$ "
+          : "ITBIS incluido: RD$ ") + sale.taxTotal,
+      )
       .fontSize(18)
       .text("Total: RD$ " + sale.total);
     doc.fontSize(10);
diff --git a/apps/web/src/Management.tsx b/apps/web/src/Management.tsx
index fd2de31..c15324b 100644
--- a/apps/web/src/Management.tsx
+++ b/apps/web/src/Management.tsx
@@ -61,6 +61,11 @@ import {
   type Printing,
 } from "./Tienda";
 import { METHOD_LABEL, printSoon } from "./Prints";
+import {
+  applyPendingSaleReprice,
+  discardPendingSale,
+  isPendingPriceConflict,
+} from "./pendingSales";
 
 type Column = {
   label: string;
@@ -1369,6 +1374,7 @@ export function Cash() {
   const [open, setOpen] = useState(false),
     [movement, setMovement] = useState(false),
     [closing, setClosing] = useState<any>(null),
+    [discarding, setDiscarding] = useState<any>(null),
     [printing, setPrinting] = useState<Printing>(null);
   // Fondo sugerido: lo dejado en el último cierre de esta caja.
   const suggestion = useQuery({
@@ -1383,6 +1389,31 @@ export function Cash() {
     can(user.permissions, "profit:read") ||
     can(user.permissions, "sale:manage");
   const elsewhere = cashOnOtherDevice(active);
+  const repricePending = async (sale: any) => {
+    const [products, promotions, settings] = await Promise.all([
+      loadCatalog(),
+      api<any[]>("/promotions"),
+      api<any>("/settings"),
+    ]);
+    await applyPendingSaleReprice(
+      sale,
+      products,
+      promotions,
+      settings.taxIncluded !== false,
+      {
+        recordResolution: (body) => post("/sales/offline-resolution", body),
+        updateLocal: (id, changes) => localDB.sales.update(id, changes),
+      },
+    );
+    const result = await syncSales();
+    await client.invalidateQueries({ queryKey: ["pending-sales"] });
+    toast(
+      result.synced
+        ? "Precios actualizados y venta sincronizada."
+        : "Precios actualizados. La venta sigue pendiente de revisión.",
+      !result.synced,
+    );
+  };
   return (
     <>
       <Heading
@@ -1514,8 +1545,10 @@ export function Cash() {
               },
               {
                 label: "Acción",
-                render: (s) =>
-                  s.status === "conflict" && (
+                render: (s) => {
+                  if (s.status !== "conflict") return null;
+                  const priceConflict = isPendingPriceConflict(s.message);
+                  return (
                     <div className="pending-sale-actions">
                       {!s.input.customerId && (
                         <select
@@ -1546,7 +1579,19 @@ export function Cash() {
                           ))}
                         </select>
                       )}
-                      {s.input.customerId && (
+                      {priceConflict && (
+                        <Button
+                          variant="secondary"
+                          onClick={() =>
+                            repricePending(s).catch((error: any) =>
+                              toast(error.message, true),
+                            )
+                          }
+                        >
+                          Actualizar precios y reintentar
+                        </Button>
+                      )}
+                      {s.input.customerId && !priceConflict && (
                         <Button
                           variant="secondary"
                           onClick={async () => {
@@ -1563,8 +1608,12 @@ export function Cash() {
                           Reintentar
                         </Button>
                       )}
+                      <Button variant="danger" onClick={() => setDiscarding(s)}>
+                        Descartar
+                      </Button>
                     </div>
-                  ),
+                  );
+                },
               },
             ]}
           />
@@ -1725,19 +1774,39 @@ export function Cash() {
           }}
         />
       )}
+      {discarding && (
+        <ConfirmModal
+          title="Descartar venta pendiente"
+          description={`Se eliminará ${discarding.receipt?.number ?? "esta venta"} de este dispositivo. La decisión y el motivo quedarán en la bitácora.`}
+          confirmLabel="Descartar"
+          onClose={() => setDiscarding(null)}
+          onConfirm={async (reason) => {
+            await discardPendingSale(discarding, reason, {
+              recordResolution: (body) =>
+                post("/sales/offline-resolution", body),
+              deleteLocal: (id) => localDB.sales.delete(id),
+            });
+            await client.invalidateQueries({ queryKey: ["pending-sales"] });
+            toast("Venta pendiente descartada.");
+          }}
+        />
+      )}
       <PrintModal printing={printing} onClose={() => setPrinting(null)} />
     </>
   );
 }
 
 export function Customers() {
+  const user = useStore((state) => state.user)!;
+  const client = useQueryClient();
   const query = useQuery({
     queryKey: ["customers"],
     queryFn: () => api("/customers"),
   });
   const [create, setCreate] = useState(false),
     [search, setSearch] = useState(""),
-    [editing, setEditing] = useState<any>(null);
+    [editing, setEditing] = useState<any>(null),
+    [anonymizing, setAnonymizing] = useState<any>(null);
   const fields: Field[] = [
     { key: "name", label: "Nombre", required: true },
     { key: "phone", label: "Teléfono" },
@@ -1801,9 +1870,22 @@ export function Customers() {
               {
                 label: "Acción",
                 render: (c) => (
-                  <button className="text-link" onClick={() => setEditing(c)}>
-                    Editar
-                  </button>
+                  <div className="table-actions">
+                    <button
+                      className="text-link"
+                      onClick={() => setEditing(c)}
+                    >
+                      Editar
+                    </button>
+                    {can(user.permissions, "customers:erase") && (
+                      <button
+                        className="text-link danger-text"
+                        onClick={() => setAnonymizing(c)}
+                      >
+                        Anonimizar
+                      </button>
+                    )}
+                  </div>
                 ),
               },
             ]}
@@ -1827,6 +1909,22 @@ export function Customers() {
           onSubmit={(data) => mutate("/customers/" + editing.id, data, "PATCH")}
         />
       )}
+      {anonymizing && (
+        <ConfirmModal
+          title="Anonimizar cliente"
+          description={`Se eliminarán los datos personales de ${anonymizing.name}. Las ventas y sus montos se conservarán. Esta acción no se puede deshacer.`}
+          confirmLabel="Anonimizar"
+          onClose={() => setAnonymizing(null)}
+          onConfirm={async (reason) => {
+            await post(`/customers/${anonymizing.id}/anonymize`, {
+              reason,
+              requestRef: `APP-${new Date().toISOString()}`,
+            });
+            await client.invalidateQueries({ queryKey: ["customers"] });
+            toast("Cliente anonimizado.");
+          }}
+        />
+      )}
     </>
   );
 }
diff --git a/apps/web/src/POS.tsx b/apps/web/src/POS.tsx
index 110ffe0..600ef65 100644
--- a/apps/web/src/POS.tsx
+++ b/apps/web/src/POS.tsx
@@ -404,6 +404,12 @@ export function POS({ go }: { go: (page: string) => void }) {
   // [cart, session, online], F8 guardaba el cliente anterior (R9-caja-7).
   const onKey = useRef<(e: KeyboardEvent) => void>(() => {});
   onKey.current = (e) => {
+    const modalOpen = document.querySelector('[role="dialog"]');
+    const blockedByModal = ["F4", "F8", "F12"].includes(e.key);
+    if (modalOpen && blockedByModal) {
+      e.preventDefault();
+      return;
+    }
     if (e.key === "F2") {
       e.preventDefault();
       search.current?.focus();
diff --git a/apps/web/src/Prints.tsx b/apps/web/src/Prints.tsx
index 53a1f6b..8b4a49d 100644
--- a/apps/web/src/Prints.tsx
+++ b/apps/web/src/Prints.tsx
@@ -73,11 +73,12 @@ export function BusinessHeader({
 }) {
   const b = business ?? {};
   const phones = [b.phone, b.phone2].filter(Boolean);
+  const logo = b.logo || "/logo-grupo-macgen.png";
   return (
     <header className="tp-header">
-      {b.logo && <img className="tp-logo" src={b.logo} alt="" />}
-      <h2>Grupo Macgen</h2>
-      <p className="tp-branch">Plaza Lope de Vega</p>
+      <img className="tp-logo" src={logo} alt="" />
+      <h2>{b.name || "Nexora POS"}</h2>
+      {b.branchName && <p className="tp-branch">{b.branchName}</p>}
       {b.address && <p>{b.address}</p>}
       {b.legalId && <p>RNC: {b.legalId}</p>}
       {!!phones.length && <p>Tel.: {phones.join(" · WhatsApp: ")}</p>}
@@ -305,8 +306,16 @@ export function InvoicePrint({
   return (
     <>
       <BusinessHeader business={config} />
-      <Row label="NCF:" value={sale.ncf ?? ""} />
-      <h3 className="tp-center">FACTURA</h3>
+      {sale.ncf ? (
+        <>
+          <Row label="NCF:" value={sale.ncf} />
+          <h3 className="tp-center">COMPROBANTE FISCAL</h3>
+        </>
+      ) : (
+        <h3 className="tp-center">
+          DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL
+        </h3>
+      )}
       <Row label="Secuencia No." value={sale.number} />
       <Row label="Fecha" value={when(sale.createdAt ?? new Date())} />
       <Row label="Cajero" value={sale.cashierName ?? ""} />
diff --git a/apps/web/src/pendingSales.ts b/apps/web/src/pendingSales.ts
new file mode 100644
index 0000000..3585fa0
--- /dev/null
+++ b/apps/web/src/pendingSales.ts
@@ -0,0 +1,223 @@
+import {
+  d,
+  lineTotals,
+  money,
+  paymentTotals,
+  type SaleInput,
+} from "@fitstore/shared";
+import type { PendingSale, Product } from "./api";
+
+export const isPendingPriceConflict = (message?: string) =>
+  /precios o promociones cambiaron/i.test(message ?? "");
+
+function promotionDiscount(
+  promo: any,
+  variant: any,
+  product: Product,
+  qty: number,
+) {
+  const scope = promo.scope ?? {};
+  // La API sólo puede aplicar una promoción de lote después de asignar FEFO;
+  // la cola todavía no conoce ese lote. No anticiparla evita un total distinto.
+  if (scope.lotId) return 0;
+  if (
+    (scope.variantId && scope.variantId !== variant.id) ||
+    (scope.productId && scope.productId !== product.id) ||
+    (scope.categoryId && scope.categoryId !== product.categoryId) ||
+    (scope.brand && scope.brand !== product.brand)
+  )
+    return 0;
+  if (promo.type === "percent") return Number(promo.value);
+  if (promo.type === "amount")
+    return Math.min(100, (Number(promo.value) / Number(variant.price)) * 100);
+  if (promo.type === "special_price")
+    return Math.max(0, (1 - Number(promo.value) / Number(variant.price)) * 100);
+  if (promo.type === "nxm")
+    return (
+      ((Math.floor(qty / (scope.buy || 2)) *
+        ((scope.buy || 2) - (scope.pay || 1))) /
+        qty) *
+      100
+    );
+  if (promo.type === "second_half")
+    return ((Math.floor(qty / 2) * 0.5) / qty) * 100;
+  return 0;
+}
+
+/** Recalcula una venta pendiente sin alterar su UUID idempotente. */
+export function repricePendingSale(
+  input: SaleInput,
+  products: Product[],
+  promotions: any[],
+  taxIncluded = true,
+) {
+  const variants = new Map<string, { variant: any; product: Product }>();
+  for (const product of products)
+    for (const variant of product.variants)
+      variants.set(variant.id, { variant, product });
+  const active = promotions.filter(
+    (p) =>
+      p.active &&
+      new Date(p.startsAt) <= new Date() &&
+      new Date(p.endsAt) >= new Date(),
+  );
+  const lines = input.items.map((item) => {
+    const current = variants.get(item.variantId);
+    if (!current)
+      throw new Error("Un producto de la venta ya no está disponible.");
+    const { variant, product } = current;
+    const gross = Number(variant.price) * item.qty;
+    const lineDiscount = Math.max(
+      item.discountPercent,
+      gross ? ((item.discountAmount ?? 0) / gross) * 100 : 0,
+    );
+    const manual =
+      100 - ((100 - lineDiscount) * (100 - input.globalDiscount)) / 100;
+    const promo = Math.max(
+      0,
+      ...active.map((p) => promotionDiscount(p, variant, product, item.qty)),
+    );
+    const totals = lineTotals(
+      item.qty,
+      Number(variant.price),
+      Math.max(manual, promo),
+      Number(product.taxRate),
+      taxIncluded,
+    );
+    return { item, variant, product, totals };
+  });
+  const total = money(
+    lines.reduce((sum, line) => sum.plus(line.totals.total), d(0)),
+  );
+  const taxTotal = money(
+    lines.reduce((sum, line) => sum.plus(line.totals.tax), d(0)),
+  );
+  // Las primeras colas offline no guardaban expectedTotal. En ese caso el
+  // total aplicado de los pagos es una base segura y evita duplicar el monto
+  // al ajustar la diferencia.
+  const payments = input.payments.map((payment) => ({ ...payment }));
+  const receivables = [...payments]
+    .reverse()
+    .filter((payment) => ["credit", "cod"].includes(payment.method));
+  // El efectivo ya entregado no se inventa ni se borra: si ahora sobra, la API
+  // lo registra como cambio. Sólo una cuenta por cobrar puede crecer para
+  // cubrir un aumento; tarjeta/transferencia ya autorizadas no se alteran.
+  const nonCash = payments
+    .filter((payment) => payment.method !== "cash")
+    .reduce((sum, payment) => sum + Number(payment.amount), 0);
+  let nonCashExcess = money(Math.max(0, nonCash - total));
+  for (const payment of receivables) {
+    const applied = Math.min(Number(payment.amount), nonCashExcess);
+    payment.amount = money(Number(payment.amount) - applied);
+    nonCashExcess = money(nonCashExcess - applied);
+    if (nonCashExcess <= 0) break;
+  }
+  if (nonCashExcess > 0.01)
+    throw new Error(
+      "Esta venta usa pagos ya autorizados. Un administrador debe descartarla y cobrarla nuevamente.",
+    );
+  let paymentState = paymentTotals(total, payments);
+  if (paymentState.pending > 0) {
+    if (!receivables.length)
+      throw new Error(
+        "El precio aumentó y falta cobrar la diferencia. Descarta esta venta y cóbrala nuevamente.",
+      );
+    receivables[0].amount = money(
+      Number(receivables[0].amount) + paymentState.pending,
+    );
+    paymentState = paymentTotals(total, payments);
+  }
+  if (paymentState.pending > 0.01)
+    throw new Error(
+      "Esta venta no tiene pagos suficientes. Descártala y cóbrala nuevamente.",
+    );
+  return {
+    total,
+    taxTotal,
+    input: { ...input, expectedTotal: total, payments },
+    prices: lines.map(({ item, variant, product, totals }) => ({
+      variantId: item.variantId,
+      name: product.name,
+      sku: variant.sku,
+      qty: item.qty,
+      unitPrice: Number(variant.price),
+      discount: totals.discount,
+      lineTotal: totals.total,
+    })),
+  };
+}
+
+type RecordResolution = (body: {
+  offlineUuid: string;
+  action: "reprice" | "discard";
+  previousTotal: number;
+  currentTotal?: number;
+  reason: string;
+}) => Promise<unknown>;
+
+/**
+ * Audita y luego actualiza una venta en conflicto. El orden importa: si el
+ * servidor no confirma la auditoría, la copia local permanece intacta.
+ */
+export async function applyPendingSaleReprice(
+  sale: PendingSale,
+  products: Product[],
+  promotions: any[],
+  taxIncluded: boolean,
+  dependencies: {
+    recordResolution: RecordResolution;
+    updateLocal: (
+      id: string,
+      changes: Partial<PendingSale>,
+    ) => Promise<unknown>;
+  },
+) {
+  const result = repricePendingSale(
+    sale.input,
+    products,
+    promotions,
+    taxIncluded,
+  );
+  const previousTotal = Number(
+    sale.input.expectedTotal ?? sale.receipt?.total ?? 0,
+  );
+  await dependencies.recordResolution({
+    offlineUuid: sale.input.offlineUuid,
+    action: "reprice",
+    previousTotal,
+    currentTotal: result.total,
+    reason: "Catálogo, promociones y ajustes actualizados antes del reintento.",
+  });
+  const changes: Partial<PendingSale> = {
+    input: result.input,
+    receipt: {
+      ...sale.receipt,
+      total: result.total,
+      taxTotal: result.taxTotal,
+      payments: result.input.payments,
+      snapshot: result.prices,
+    },
+    status: "pending",
+    message: undefined,
+  };
+  await dependencies.updateLocal(sale.id, changes);
+  return { ...result, changes };
+}
+
+/** Registra el motivo en el servidor antes de borrar la única copia local. */
+export async function discardPendingSale(
+  sale: PendingSale,
+  reason: string,
+  dependencies: {
+    recordResolution: RecordResolution;
+    deleteLocal: (id: string) => Promise<unknown>;
+  },
+) {
+  await dependencies.recordResolution({
+    offlineUuid: sale.input.offlineUuid,
+    action: "discard",
+    previousTotal: Number(sale.input.expectedTotal ?? sale.receipt?.total ?? 0),
+    reason,
+  });
+  await dependencies.deleteLocal(sale.id);
+}
diff --git a/apps/web/src/styles.css b/apps/web/src/styles.css
index 3310d86..4f9951e 100644
--- a/apps/web/src/styles.css
+++ b/apps/web/src/styles.css
@@ -67,6 +67,11 @@
   --primary-soft: #f2ecfe;
   --pink: #ec4899;
   --green: #059669;
+  --focus: #6d28d9;
+  --input-border: #7b8498;
+  --success-strong: #047857;
+  --danger-text: #c92e43;
+  --warning-text: #92400e;
   --shadow: 0 4px 22px #29315b04;
   color-scheme: light;
   font-family: "Inter", sans-serif;
@@ -86,6 +91,11 @@
   --primary: #a78bfa;
   --primary-soft: #2c2246;
   --green: #34d399;
+  --focus: #a78bfa;
+  --input-border: #6b7894;
+  --success-strong: #047857;
+  --danger-text: #f87171;
+  --warning-text: #fbbf24;
   --shadow: none;
   color-scheme: dark;
 }
@@ -173,7 +183,7 @@ textarea {
   font: inherit;
   color: var(--text);
   background: var(--surface);
-  border: 1px solid var(--border);
+  border: 1px solid var(--input-border);
   border-radius: 9px;
   min-height: 44px;
   padding: 11px 13px;
@@ -199,6 +209,11 @@ input[type="checkbox"] {
   min-height: 20px;
   accent-color: var(--primary);
 }
+input[type="checkbox"]:focus-visible,
+input[type="radio"]:focus-visible {
+  outline: 3px solid var(--focus);
+  outline-offset: 2px;
+}
 input[type="number"] {
   font-variant-numeric: tabular-nums;
 }
@@ -207,7 +222,7 @@ input[type="number"]::-webkit-inner-spin-button {
 }
 button:focus-visible,
 a:focus-visible {
-  outline: 3px solid #a78bfa;
+  outline: 3px solid var(--focus);
   outline-offset: 3px;
 }
 kbd {
@@ -247,7 +262,7 @@ kbd {
   color: var(--muted);
 }
 .button.success {
-  background: #059669;
+  background: var(--success-strong);
   color: #fff;
 }
 .button.danger {
@@ -301,7 +316,7 @@ kbd {
 .metric-icon.orange,
 .alert-symbol.orange {
   background: #fff5e6;
-  color: #b96c0b;
+  color: var(--warning-text);
 }
 .badge.danger {
   background: #fff0f0;
@@ -327,6 +342,10 @@ kbd {
   background: #422230;
   color: #fda4af;
 }
+[data-theme="dark"] .green-text,
+[data-theme="dark"] .trend.positive {
+  color: var(--green) !important;
+}
 .eyebrow {
   font-size: 9px;
   font-weight: 750;
@@ -335,19 +354,19 @@ kbd {
   margin-bottom: 8px;
 }
 .eyebrow.light {
-  color: #dacbff;
+  color: #ffffff;
 }
 .full-width {
   width: 100%;
 }
 .green-text {
-  color: var(--green) !important;
+  color: var(--success-strong) !important;
 }
 .violet-text {
   color: var(--primary) !important;
 }
 .danger-text {
-  color: #e04556 !important;
+  color: var(--danger-text) !important;
 }
 .right {
   text-align: right;
@@ -475,7 +494,7 @@ kbd {
 }
 .nav-caption {
   font-size: 8px;
-  color: #a6aab8;
+  color: var(--muted);
   font-weight: 700;
   letter-spacing: 1.5px;
   padding: 0 12px;
@@ -592,7 +611,7 @@ kbd {
 }
 .breadcrumb span {
   margin: 0 10px;
-  color: #cbd0df;
+  color: #8a93a6;
 }
 .breadcrumb strong {
   color: var(--text);
@@ -626,7 +645,7 @@ kbd {
   white-space: nowrap;
 }
 .connection.offline {
-  color: #b96c0b;
+  color: var(--warning-text);
 }
 .notification-bell {
   position: relative;
@@ -751,7 +770,7 @@ kbd {
   gap: 15px;
   padding: 14px 32px 20px;
   font-size: 9px;
-  color: #a6aab8;
+  color: var(--muted);
 }
 .panel {
   background: var(--surface);
@@ -815,7 +834,7 @@ kbd {
 }
 .welcome-banner p {
   font-size: 10px;
-  color: #90809f;
+  color: #6b5b7d;
   margin: 7px 0 10px;
 }
 .welcome-banner button {
@@ -1037,10 +1056,10 @@ kbd {
   gap: 1px;
 }
 .trend.positive {
-  color: #059669;
+  color: var(--success-strong);
 }
 .trend.negative {
-  color: #dc4f60;
+  color: var(--danger-text);
 }
 .dashboard-main-grid {
   display: grid;
@@ -1083,7 +1102,7 @@ kbd {
   font-size: 10px;
   font-weight: 650;
   background: #fff5e6;
-  color: #b96c0b;
+  color: var(--warning-text);
   border: 1px solid #ffebcc;
   height: 23px;
   min-width: 23px;
@@ -1131,7 +1150,7 @@ kbd {
 .dashboard-alert > svg {
   margin-left: auto;
   margin-top: 7px;
-  color: #bcc0ce;
+  color: #8a93a6;
 }
 .empty-small {
   padding: 30px 0;
@@ -1287,7 +1306,7 @@ td strong {
   width: 27px;
   border-radius: 7px;
   font-size: 9px;
-  color: #a6aab8;
+  color: var(--muted);
   background: var(--surface-soft);
 }
 .rank.first {
@@ -1545,7 +1564,7 @@ td strong {
   flex-wrap: wrap;
 }
 .error-panel > svg {
-  color: #dc4f60;
+  color: var(--danger-text);
 }
 .error-panel p {
   font-size: 12px;
@@ -1952,7 +1971,7 @@ td strong {
   align-items: flex-end;
 }
 .cart-line-total button {
-  color: #c1c4d1;
+  color: #8a93a6;
   padding: 0;
 }
 .cart-line-total strong {
@@ -2020,7 +2039,7 @@ td strong {
   height: 49px;
   width: 100%;
   font-size: 13px;
-  background: #059669;
+  background: var(--success-strong);
 }
 .charge-button span {
   flex: 1;
@@ -2329,7 +2348,7 @@ td strong {
   margin-top: 16px;
 }
 .cash-main p {
-  color: #dac4fb;
+  color: #ffffff;
   font-size: 11px;
 }
 .cash-main > strong {
@@ -2341,7 +2360,7 @@ td strong {
 }
 .cash-main > span:last-child {
   font-size: 11px;
-  color: #dac4fb;
+  color: #ffffff;
 }
 .cash-methods {
   padding: 25px;
@@ -2629,7 +2648,7 @@ td strong {
   margin: 20px 0;
 }
 .login-art p {
-  color: #dac4fb;
+  color: #ffffff;
   font-size: 14px;
   max-width: 320px;
   line-height: 1.8;
@@ -2648,7 +2667,7 @@ td strong {
   align-items: center;
   gap: 14px;
   font-size: 12px;
-  color: #e5d6fc;
+  color: #ffffff;
 }
 .login-stats svg {
   width: 17px;
@@ -3792,9 +3811,15 @@ td strong {
   box-shadow: 0 3px 8px #7c3aed22;
 }
 .goods-mode button.active.exit {
-  background: #db2777;
+  background: #be185d;
   box-shadow: 0 3px 8px #db277722;
 }
+:root[data-theme="dark"] .goods-mode button.active {
+  color: #0b0f19;
+}
+:root[data-theme="dark"] .goods-mode button.active.exit {
+  color: #ffffff;
+}
 .goods-card {
   padding: 18px;
   margin-bottom: 16px;
@@ -3975,7 +4000,7 @@ td strong {
   margin: 0 0 10px;
 }
 .goods-line.unmatched .goods-match {
-  color: #92400e;
+  color: var(--warning-text);
   font-weight: 550;
 }
 .goods-fields {
@@ -4019,7 +4044,7 @@ td strong {
   margin: -4px 0 10px;
 }
 .goods-warning {
-  color: #b45309;
+  color: var(--warning-text);
   font-weight: 600;
 }
 .goods-sum {
@@ -4438,7 +4463,7 @@ td strong {
 }
 
 .equipment-legacy {
-  color: #b45309 !important;
+  color: var(--warning-text) !important;
 }
 :root[data-theme="dark"] .equipment-legacy {
   color: #fbbf24 !important;
diff --git a/package.json b/package.json
index bac4a12..4eab5fc 100644
--- a/package.json
+++ b/package.json
@@ -34,6 +34,7 @@
     "concurrently": "^9.2.0",
     "embedded-postgres": "18.4.0-beta.17",
     "eslint": "^9.39.0",
+    "express": "^5.2.1",
     "prettier": "^3.6.0",
     "supertest": "^7.1.0",
     "typescript": "~5.9.3",
diff --git a/packages/shared/src/index.ts b/packages/shared/src/index.ts
index a87198c..60baa65 100644
--- a/packages/shared/src/index.ts
+++ b/packages/shared/src/index.ts
@@ -613,6 +613,7 @@ export const permissions: Record<string, string[]> = {
     "reports:read",
     "profit:read",
     "customers:write",
+    "customers:erase",
     "promotions:write",
     "alerts:write",
   ],
diff --git a/tests/api.test.ts b/tests/api.test.ts
index de7dfc8..7e8b0c4 100644
--- a/tests/api.test.ts
+++ b/tests/api.test.ts
@@ -12,6 +12,7 @@ requireApi("dotenv").config({
   path: fileURLToPath(new URL("../.env", import.meta.url)),
   quiet: true,
 });
+
 const apiDir = fileURLToPath(new URL("../apps/api", import.meta.url));
 // Ejecuta node en apps/api sin bloquear este proceso. Con spawnSync el bucle
 // de eventos se detiene: si pasan más de 5 s, la API cierra las conexiones
@@ -218,9 +219,11 @@ afterAll(async () => {
         await ok(
           "/cash-sessions/" + s.id + "/close",
           {
-            countedCash: Math.max(0, current.expected.cash),
-            countedCard: Math.max(0, current.expected.card),
-            countedTransfer: Math.max(0, current.expected.transfer),
+            // El arqueo es ciego para la cajera; la limpieza tampoco debe
+            // depender de importes que la API oculta correctamente.
+            countedCash: Math.max(0, current.expected?.cash ?? 0),
+            countedCard: Math.max(0, current.expected?.card ?? 0),
+            countedTransfer: Math.max(0, current.expected?.transfer ?? 0),
             notes: "Cierre de pruebas",
           },
           t,
@@ -1046,13 +1049,26 @@ describe("Seguridad, offline y funciones completadas", () => {
       200,
     );
   });
-  it("1: limita ventas detrás del proxy y separa direcciones IP", async () => {
-    const send = (ip: string) =>
+  it("1: limita ventas por sesión aunque cambie la IP y no bloquea otra sesión", async () => {
+    const login = async () => {
+      const response = await fetch(base + "/auth/login", {
+        method: "POST",
+        headers: { "Content-Type": "application/json" },
+        body: JSON.stringify({
+          email: "admin@fitstore.demo",
+          password: process.env.SEED_DEMO_PASSWORD || "FitStore-Demo-2026!",
+        }),
+      });
+      return (await response.json()).accessToken as string;
+    };
+    const limitedToken = await login();
+    await enroll(limitedToken, "QA límite sesión A");
+    const send = (ip: string, as = limitedToken) =>
       fetch(base + "/sales", {
         method: "POST",
         headers: {
           "Content-Type": "application/json",
-          Authorization: "Bearer " + token,
+          Authorization: "Bearer " + as,
           "X-Forwarded-For": ip,
         },
         body: "{}",
@@ -1061,7 +1077,10 @@ describe("Seguridad, offline y funciones completadas", () => {
     for (let n = 0; n < 121; n++) results.push((await send(rateIp)).status);
     expect(results.slice(0, 120).every((n) => n === 400)).toBe(true);
     expect(results[120]).toBe(429);
-    expect((await send("198.18.0.10")).status).toBe(400);
+    expect((await send("198.18.0.10")).status).toBe(429);
+    const otherToken = await login();
+    await enroll(otherToken, "QA límite sesión B");
+    expect((await send("198.18.0.10", otherToken)).status).toBe(400);
   });
   it("3 y 9: lote vencido según Santo Domingo no se vende ni se recibe", async () => {
     const p = await ok("/products", {
@@ -3119,7 +3138,10 @@ describe("Ronda 4 · auditoría de ChatGPT y propia", () => {
     });
     const lot = await fixtureDb.lot.findUnique({
       where: {
-        variantId_lotNumber: { variantId: supplementVariant.id, lotNumber },
+        variantId_lotNumberNormalized: {
+          variantId: supplementVariant.id,
+          lotNumberNormalized: lotNumber.toUpperCase(),
+        },
       },
     });
     expect(Number(lot.qty)).toBe(3);
@@ -5990,10 +6012,25 @@ describe("Ronda 9 · revisión · seguridad", () => {
       pin: "246813",
       roleId: roles.find((r: any) => r.name === role).id,
     });
+    const activePassword = "FitStore-R9-Activa-2026!";
+    const changed = await call("/auth/change-password", randomIp(), {
+      login: user.email,
+      currentPassword: password,
+      newPassword: activePassword,
+      confirmPassword: activePassword,
+    });
+    if (changed.status !== 201)
+      throw new Error(
+        "/auth/change-password: " +
+          changed.status +
+          " " +
+          JSON.stringify(changed.body),
+      );
+    user.testPassword = activePassword;
     actors.push(user);
     return user;
   }
-  const login = (user: any, ip: string, pass = password) =>
+  const login = (user: any, ip: string, pass = user.testPassword ?? password) =>
     call("/auth/login", ip, { email: user.email, password: pass });
 
   it("R9-seguridad-1: cinco contraseñas erróneas de un tercero no cierran la sesión de la vendedora ni le impiden entrar desde su equipo", async () => {
@@ -6086,21 +6123,35 @@ describe("Ronda 9 · revisión · seguridad", () => {
     expect((await login(seller, ip, "FitStore-R9-Nueva!")).status).toBe(201);
   });
 
-  it("R9-seguridad-2: el límite por IP de /auth y /sales no se evita cambiando mayúsculas en la ruta", async () => {
+  it("R9-seguridad-2: los límites por cuenta y sesión no se evitan cambiando mayúsculas o IP", async () => {
     const authIp = randomIp();
+    const limitedUser = await newUser("seller");
     const auth: number[] = [];
     for (let n = 0; n < 60; n++)
-      auth.push((await call("/Auth/login", authIp, {})).status);
+      auth.push(
+        (
+          await call("/Auth/login", authIp, {
+            email: limitedUser.email,
+            password: "contraseña-incorrecta",
+          })
+        ).status,
+      );
     expect(auth.every((s) => s === 400)).toBe(true);
-    expect((await call("/auth/login", authIp, {})).status).toBe(429);
-    expect((await call("/AUTH/login", authIp, {})).status).toBe(429);
+    const invalidLogin = { email: limitedUser.email, password: "incorrecta" };
+    expect((await call("/auth/login", authIp, invalidLogin)).status).toBe(429);
+    expect((await call("/AUTH/login", randomIp(), invalidLogin)).status).toBe(
+      400,
+    );
+    const salesUser = await newUser("admin");
+    const salesToken = (await login(salesUser, randomIp())).body.accessToken;
+    await enroll(salesToken, "QA límite R9");
     const salesIp = randomIp();
     const sales: number[] = [];
     for (let n = 0; n < 120; n++)
-      sales.push((await call("/Sales", salesIp, {}, token)).status);
+      sales.push((await call("/Sales", salesIp, {}, salesToken)).status);
     expect(sales.every((s) => s === 400)).toBe(true);
-    expect((await call("/sales", salesIp, {}, token)).status).toBe(429);
-    expect((await call("/SALES", salesIp, {}, token)).status).toBe(429);
+    expect((await call("/sales", randomIp(), {}, salesToken)).status).toBe(429);
+    expect((await call("/SALES", salesIp, {}, salesToken)).status).toBe(429);
   });
 });
 
@@ -9516,3 +9567,270 @@ describe("Ronda 9 · auditoría de ChatGPT · R9-A03 total de la factura conserv
     expect(Number(receipt.invoiceDifference)).toBe(50);
   });
 });
+
+describe("I1 + K1 · lotes y concurrencia de inventario", () => {
+  let variant: any;
+
+  beforeAll(async () => {
+    const category = (await ok("/categories")).find(
+      (row: any) => !row.requiresLot && !row.requiresExpiry,
+    );
+    const product = await ok("/products", {
+      name: "QA identidad lote " + suffix,
+      sku: "QA-I1-" + suffix,
+      categoryId: category.id,
+      variants: [
+        {
+          sku: "QA-I1V-" + suffix,
+          barcode: "QA-I1B-" + suffix,
+          costAvg: 10,
+          price: 20,
+        },
+      ],
+    });
+    products.push(product);
+    variant = product.variants[0];
+  });
+
+  it("I1: código sin distinguir caso converge, NULL recibe fecha y otro vencimiento se rechaza", async () => {
+    const codes = [" lote   i1 ", "LOTE I1", "Lote I1", "lote i1"];
+    const responses = await Promise.all(
+      codes.map((lotNumber) =>
+        request("/inventory/adjustments", {
+          variantId: variant.id,
+          qty: 1,
+          reason: "QA identidad concurrente",
+          lotNumber,
+        }),
+      ),
+    );
+    expect(responses.map((response) => response.status)).toEqual([
+      201, 201, 201, 201,
+    ]);
+    let lots = await fixtureDb.lot.findMany({
+      where: { variantId: variant.id },
+    });
+    expect(lots).toHaveLength(1);
+    expect(lots[0]).toMatchObject({
+      lotNumber: "LOTE I1",
+      lotNumberNormalized: "LOTE I1",
+      expiryDate: null,
+    });
+    expect(Number(lots[0].qty)).toBe(4);
+
+    await ok("/inventory/adjustments", {
+      variantId: variant.id,
+      qty: 1,
+      reason: "QA completa vencimiento",
+      lotNumber: "lote i1",
+      expiryDate: "2030-01-01T04:00:00.000Z",
+    });
+    await ok("/inventory/adjustments", {
+      variantId: variant.id,
+      qty: 1,
+      reason: "QA mismo día dominicano",
+      lotNumber: "LOTE   I1",
+      expiryDate: "2030-01-01T12:00:00.000Z",
+    });
+    const rejected = await request("/inventory/adjustments", {
+      variantId: variant.id,
+      qty: 1,
+      reason: "QA vencimiento contradictorio",
+      lotNumber: "Lote I1",
+      expiryDate: "2030-01-02T04:00:00.000Z",
+    });
+    expect(rejected.status).toBe(400);
+    expect(rejected.body.message).toMatch(/vencimiento diferente/i);
+    lots = await fixtureDb.lot.findMany({ where: { variantId: variant.id } });
+    expect(lots).toHaveLength(1);
+    expect(lots[0].expiryDate?.toISOString()).toBe("2030-01-01T04:00:00.000Z");
+    expect(Number(lots[0].qty)).toBe(6);
+  });
+
+  it("K1: aplicar el mismo conteo en paralelo no duplica el movimiento", async () => {
+    const product = await ok("/products", {
+      name: "QA conteo K1 " + suffix,
+      sku: "QA-K1-" + suffix,
+      categoryId: clothing.categoryId,
+      variants: [
+        {
+          sku: "QA-K1V-" + suffix,
+          barcode: "QA-K1B-" + suffix,
+          costAvg: 10,
+          price: 20,
+        },
+      ],
+    });
+    products.push(product);
+    const id = product.variants[0].id;
+    const count = await ok("/inventory/counts", {
+      items: [{ variantId: id, counted: 7 }],
+    });
+    const results = await Promise.all([
+      request("/inventory/counts/" + count.id + "/apply", {}),
+      request("/inventory/counts/" + count.id + "/apply", {}),
+    ]);
+    expect(results.map((result) => result.status).sort()).toEqual([201, 400]);
+    expect(
+      await fixtureDb.inventoryMovement.count({
+        where: { refId: count.id, type: "count" },
+      }),
+    ).toBe(1);
+    expect(
+      Number(
+        (await fixtureDb.variant.findUniqueOrThrow({ where: { id } })).stock,
+      ),
+    ).toBe(7);
+  });
+});
+
+describe("D1 + O1 · compatibilidad y resolución auditable offline", () => {
+  let variant: any;
+
+  beforeAll(async () => {
+    const category = await ok("/categories", {
+      name: "QA D1 sin promociones " + suffix,
+    });
+    const product = await ok("/products", {
+      name: "QA venta offline heredada " + suffix,
+      sku: "QA-D1-" + suffix,
+      categoryId: category.id,
+      taxRate: 0,
+      variants: [
+        {
+          sku: "QA-D1V-" + suffix,
+          barcode: "QA-D1B-" + suffix,
+          costAvg: 40,
+          price: 100,
+        },
+      ],
+    });
+    products.push(product);
+    variant = product.variants[0];
+    await ok("/inventory/adjustments", {
+      variantId: variant.id,
+      qty: 5,
+      reason: "QA stock para compatibilidad offline",
+    });
+  });
+
+  it("D1: sincroniza el descuento heredado, conserva idempotencia y exige motivo a una venta online nueva", async () => {
+    const settings = await ok("/settings");
+    const originalCash = await fixtureDb.cashSession.findUniqueOrThrow({
+      where: { id: session.id },
+      select: { openedAt: true },
+    });
+    const offlineUuid = randomUUID();
+    const legacyReason = "Venta offline heredada (sin motivo registrado)";
+    const legacy = {
+      offlineUuid,
+      capturedAt: "2026-10-08T12:00:00.000Z",
+      customerId: defaultCustomerId,
+      cashSessionId: session.id,
+      items: [{ variantId: variant.id, qty: 1, discountPercent: 10 }],
+      globalDiscount: 0,
+      payments: [{ method: "cash", amount: 90 }],
+      expectedTotal: 90,
+    };
+    try {
+      await fixtureDb.cashSession.update({
+        where: { id: session.id },
+        data: { openedAt: new Date("2026-10-08T11:00:00.000Z") },
+      });
+      await ok(
+        "/settings",
+        { ...settings, allowOfflineSales: true },
+        token,
+        "PUT",
+      );
+
+      const first = await ok("/sales/sync", { sales: [legacy] });
+      expect(first.results[0].status, JSON.stringify(first.results[0])).toBe(
+        "synced",
+      );
+      expect(first.results[0].sale.discountReason).toBe(legacyReason);
+      const saleId = first.results[0].sale.id;
+      const stored = await fixtureDb.sale.findUniqueOrThrow({
+        where: { offlineUuid },
+      });
+      expect(stored.id).toBe(saleId);
+      expect(stored.discountReason).toBe(legacyReason);
+
+      const discountAudit = await fixtureDb.auditLog.findFirstOrThrow({
+        where: {
+          action: "discount_approved",
+          entity: "sale",
+          entityId: saleId,
+        },
+        orderBy: { createdAt: "desc" },
+      });
+      expect((discountAudit.after as any)?.reason).toBe(legacyReason);
+
+      const second = await ok("/sales/sync", { sales: [legacy] });
+      expect(second.results[0]).toMatchObject({
+        status: "synced",
+        sale: { id: saleId, discountReason: legacyReason },
+      });
+      expect(await fixtureDb.sale.count({ where: { offlineUuid } })).toBe(1);
+      expect(
+        await fixtureDb.auditLog.count({
+          where: { action: "discount_approved", entityId: saleId },
+        }),
+      ).toBe(1);
+
+      const online = await request("/sales", {
+        ...legacy,
+        offlineUuid: randomUUID(),
+        capturedAt: undefined,
+      });
+      expect(online.status).toBe(400);
+      expect(online.body.message).toMatch(/motivo del descuento/i);
+    } finally {
+      await fixtureDb.cashSession.update({
+        where: { id: session.id },
+        data: { openedAt: originalCash.openedAt },
+      });
+      await ok("/settings", settings, token, "PUT");
+    }
+  });
+
+  it("O1: registra cada resolución autenticada en AuditLog", async () => {
+    for (const resolution of [
+      {
+        offlineUuid: randomUUID(),
+        action: "reprice",
+        previousTotal: 100,
+        currentTotal: 90,
+        reason: "Catálogo vigente confirmado por la cajera",
+      },
+      {
+        offlineUuid: randomUUID(),
+        action: "discard",
+        previousTotal: 125,
+        reason: "Cliente canceló la operación pendiente",
+      },
+    ]) {
+      expect(await ok("/sales/offline-resolution", resolution, token)).toEqual({
+        ok: true,
+      });
+      const logged = await fixtureDb.auditLog.findFirstOrThrow({
+        where: {
+          action:
+            resolution.action === "discard"
+              ? "offline_sale_discarded"
+              : "offline_sale_repriced",
+          entity: "offline_sale",
+          entityId: resolution.offlineUuid,
+        },
+        orderBy: { createdAt: "desc" },
+      });
+      expect(logged.userId).toBe(actors[0].id);
+      expect(logged.terminalId).toBe(tokenTerminal.get(token));
+      expect(logged.before).toEqual({ total: resolution.previousTotal });
+      expect(logged.after).toMatchObject({ reason: resolution.reason });
+      if (resolution.currentTotal !== undefined)
+        expect((logged.after as any).total).toBe(resolution.currentTotal);
+      else expect(logged.after).not.toHaveProperty("total");
+    }
+  });
+});
diff --git a/tests/cash-privacy.test.ts b/tests/cash-privacy.test.ts
new file mode 100644
index 0000000..a22af44
--- /dev/null
+++ b/tests/cash-privacy.test.ts
@@ -0,0 +1,98 @@
+import { describe, expect, it } from "vitest";
+import { AlertsController } from "../apps/api/src/alerts";
+import { ReportsController, storeReport } from "../apps/api/src/reports";
+
+const actor = (permissions: string[], id = "cashier-1") =>
+  ({
+    id,
+    name: "Caja",
+    email: "caja@example.test",
+    role: "custom",
+    permissions,
+    branchId: "main",
+  }) as any;
+
+describe("C2 · privacidad de arqueo por rutas indirectas", () => {
+  it("el reporte genérico de caja exige privilegio financiero", async () => {
+    const controller = new ReportsController({} as any);
+    await expect(
+      controller.report("cash", {}, actor(["reports:read"]), {} as any),
+    ).rejects.toMatchObject({ status: 403 });
+  });
+
+  it("sin privilegio sólo permite STORE_REPORTS de la caja propia cerrada", async () => {
+    const openOwn = {
+      id: "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
+      branchId: "main",
+      userId: "cashier-1",
+      openedAt: new Date(),
+      closedAt: null,
+    };
+    const db = {
+      cashSession: {
+        findFirstOrThrow: async ({ where }: any) =>
+          where.id === openOwn.id ? openOwn : { ...openOwn, userId: "other" },
+      },
+    };
+    await expect(
+      storeReport(db, actor(["reports:read"]), "venta-por-forma-pago", {
+        cashSessionId: openOwn.id,
+      }),
+    ).rejects.toMatchObject({ status: 400 });
+    await expect(
+      storeReport(db, actor(["reports:read"]), "venta-por-forma-pago", {}),
+    ).rejects.toMatchObject({ status: 403 });
+    await expect(
+      storeReport(
+        db,
+        actor(["reports:read"], "other"),
+        "venta-diaria-usuario",
+        {
+          cashSessionId: openOwn.id,
+        },
+      ),
+    ).rejects.toMatchObject({ status: 403 });
+  });
+
+  it("GET y PATCH de alertas ocultan montos de cash_difference", async () => {
+    const exact = {
+      id: "8cb86d0b-638b-4fb2-8a8b-2e18af78d35f",
+      type: "cash_difference",
+      message:
+        "Diferencias de caja: efectivo RD$ 1,234.00, tarjeta RD$ 0, transferencia RD$ 0",
+      status: "new",
+    };
+    const db = {
+      alert: {
+        findMany: async () => [
+          exact,
+          { id: "alert-2", type: "stock", message: "Stock bajo" },
+        ],
+        findFirstOrThrow: async () => exact,
+        update: async () => ({ ...exact, status: "seen" }),
+      },
+      auditLog: { create: async () => ({}) },
+    };
+    const controller = new AlertsController(
+      db as any,
+      {
+        evaluate: async () => [],
+      } as any,
+    );
+    const limited = actor(["alerts:write"]);
+    const rows = await controller.alerts(limited, {});
+    expect(rows[0].message).not.toMatch(/1,234|RD\$/);
+    expect(rows[1].message).toBe("Stock bajo");
+    const updated = await controller.state(
+      exact.id,
+      { status: "seen" },
+      limited,
+    );
+    expect(updated.message).not.toMatch(/1,234|RD\$/);
+
+    const privileged = actor(["alerts:write", "profit:read"]);
+    expect((await controller.alerts(privileged, {}))[0].message).toBe(
+      exact.message,
+    );
+  });
+});
diff --git a/tests/claude-round2.test.ts b/tests/claude-round2.test.ts
index 31e6052..2af7826 100644
--- a/tests/claude-round2.test.ts
+++ b/tests/claude-round2.test.ts
@@ -1,6 +1,12 @@
 import { readFileSync } from "node:fs";
 import { describe, expect, it } from "vitest";
-import { createRequestRateLimiter } from "../apps/api/src/rate-limit";
+import { ValidatedRateLimitStore } from "../apps/api/src/rate-limit";
+import {
+  CashController,
+  canViewCashExpected,
+  cashCloseRequiresNote,
+} from "../apps/api/src/cash";
+import { SalesController, saleHistoryDto } from "../apps/api/src/sales";
 import { paymentReceiptLine } from "../packages/shared/src";
 
 const source = (path: string) => readFileSync(path, "utf8");
@@ -9,59 +15,22 @@ describe("Auditoría Claude 2 · regresiones focales", () => {
   it("N1: separa el límite compartido del límite por cuenta e IP", () => {
     const main = source("apps/api/src/main.ts");
     const limiter = source("apps/api/src/rate-limit.ts");
-    expect(main).toContain("createRequestRateLimiter");
+    expect(main).not.toContain("createRequestRateLimiter");
     expect(limiter).not.toContain("auth-shared:");
     expect(limiter).not.toContain("sales-shared:");
-    expect(limiter).toContain("loginIdentifier");
+    expect(limiter).toContain("actor?.sessionId");
 
-    const middleware = createRequestRateLimiter();
-    const call = ({
-      path = "/api/auth/login",
-      login,
-      authorization,
-    }: {
-      path?: string;
-      login?: string;
-      authorization?: string;
-    }) => {
-      let status = 200;
-      let continued = false;
-      middleware(
-        {
-          method: "POST",
-          path,
-          ip: "10.0.0.1",
-          body: login ? { login } : {},
-          headers: authorization ? { authorization } : {},
-        },
-        {
-          status(code: number) {
-            status = code;
-            return this;
-          },
-          json() {},
-        },
-        () => {
-          continued = true;
-        },
+    const store = new ValidatedRateLimitStore();
+    for (let attempt = 0; attempt < 60; attempt++)
+      expect(store.exceeds("auth-account", ["10.0.0.1", "cuenta-a"], 60)).toBe(
+        false,
       );
-      return { status, continued };
-    };
-    for (let attempt = 0; attempt < 601; attempt++)
-      call({ login: "nombre-aleatorio-" + attempt });
-    expect(call({ login: "cuenta-legitima" })).toEqual({
-      status: 200,
-      continued: true,
-    });
-
-    for (let attempt = 0; attempt < 601; attempt++)
-      call({ path: "/api/sales" });
-    expect(
-      call({
-        path: "/api/sales",
-        authorization: "Bearer sesion-valida-de-cajera",
-      }),
-    ).toEqual({ status: 200, continued: true });
+    expect(store.exceeds("auth-account", ["10.0.0.1", "cuenta-a"], 60)).toBe(
+      true,
+    );
+    expect(store.exceeds("auth-account", ["10.0.0.1", "cuenta-b"], 60)).toBe(
+      false,
+    );
   });
 
   it("A07: oculta esperado y diferencias, y exige confirmar el conteo ciego", () => {
@@ -120,4 +89,191 @@ describe("Auditoría Claude 2 · regresiones focales", () => {
     expect(management).toContain("Recibido:");
     expect(management).toContain("Cambio:");
   });
+
+  it("C2: la cajera no obtiene el arqueo abierto ni usa retiros o el umbral como oráculo", async () => {
+    const seller = {
+      role: "seller",
+      permissions: ["cash:write"],
+    } as any;
+    const manager = {
+      role: "manager",
+      permissions: ["cash:write", "sale:manage"],
+    } as any;
+    expect(canViewCashExpected(seller)).toBe(false);
+    expect(canViewCashExpected(manager)).toBe(true);
+    expect(
+      cashCloseRequiresNote(seller, { cash: 0.01, card: 0, transfer: 0 }, 100),
+    ).toBe(true);
+    expect(
+      cashCloseRequiresNote(manager, { cash: 0.01, card: 0, transfer: 0 }, 100),
+    ).toBe(false);
+
+    const cash = source("apps/api/src/cash.ts");
+    expect(cash).toContain("Cierra la caja para consultar el cuadre.");
+    expect(cash).toContain("Cierra la caja para consultar sus reportes.");
+    expect(cash).not.toContain("data.amount > expected.cash");
+    expect(cash).not.toContain('bad("No hay suficiente efectivo en caja.")');
+
+    const controller = new CashController({
+      cashSession: {
+        findFirstOrThrow: async () => ({
+          id: "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
+          branchId: "main",
+          userId: "seller-1",
+          closedAt: null,
+        }),
+      },
+    } as any);
+    const actor = {
+      id: "seller-1",
+      branchId: "main",
+      role: "seller",
+      permissions: ["cash:write"],
+    } as any;
+    await expect(
+      controller.cuadre("3e6b82b5-bb56-45ca-9f5a-d19f4955fc84", actor),
+    ).rejects.toMatchObject({ status: 400 });
+    await expect(
+      controller.sessionReport(
+        "3e6b82b5-bb56-45ca-9f5a-d19f4955fc84",
+        "venta-por-forma-pago",
+        {},
+        actor,
+        {} as any,
+      ),
+    ).rejects.toMatchObject({ status: 400 });
+  });
+
+  it("F1: POST y GET de evidencia comparten propietario de caja o sale:manage", async () => {
+    const payment = {
+      id: "b05b9bc2-7bd3-4c22-8c88-2e598bb42869",
+      saleId: "2d57851f-646e-40de-a571-ab4576651c6f",
+      cashSessionId: "owner-session",
+      entryType: "installment",
+      proofUrl: "data:image/png;base64,iVBORw0KGgo=",
+    };
+    const db = {
+      payment: { findFirstOrThrow: async () => payment },
+      cashSession: {
+        findFirst: async ({ where }: any) =>
+          where.userId === "owner" ? { id: payment.cashSessionId } : null,
+      },
+    };
+    const controller = new SalesController(db as any);
+    const authorize = (actor: any) =>
+      (controller as any).proofPayment(actor, payment.id);
+    await expect(
+      authorize({
+        id: "owner",
+        branchId: "main",
+        permissions: ["sale:write"],
+      }),
+    ).resolves.toBe(payment);
+    await expect(
+      authorize({
+        id: "manager",
+        branchId: "main",
+        permissions: ["sale:manage"],
+      }),
+    ).resolves.toBe(payment);
+    await expect(
+      authorize({
+        id: "other",
+        branchId: "main",
+        permissions: ["sale:write"],
+      }),
+    ).rejects.toMatchObject({ status: 403 });
+    expect(
+      Reflect.getMetadata("permission", SalesController.prototype.paymentProof),
+    ).toBeUndefined();
+    expect(
+      Reflect.getMetadata(
+        "permission",
+        SalesController.prototype.getPaymentProof,
+      ),
+    ).toBeUndefined();
+  });
+
+  it("F2: el historial usa lista blanca y no entrega costos de merma a la cajera", () => {
+    const sale = {
+      id: "sale-1",
+      number: "N-1",
+      status: "completed",
+      total: 100,
+      costTotal: 40,
+      requestHash: "no-debe-salir",
+      items: [
+        {
+          id: "item-1",
+          variantId: "variant-1",
+          qty: 1,
+          returnedQty: 1,
+          unitPrice: 100,
+          unitCost: 40,
+          discount: 0,
+          tax: 0,
+          lineTotal: 100,
+          stockAllocations: [{ cost: 40 }],
+          variant: {
+            id: "variant-1",
+            productId: "product-1",
+            sku: "SKU-1",
+            attributes: {},
+            costAvg: 40,
+            product: { id: "product-1", name: "Producto", secret: "x" },
+          },
+        },
+      ],
+      payments: [
+        {
+          id: "payment-1",
+          method: "cash",
+          amount: 100,
+          tendered: 100,
+          change: 0,
+          entryType: "sale",
+          status: "ok",
+          feeAmount: 9,
+          proofUrl: null,
+        },
+      ],
+      returns: [
+        {
+          id: "return-1",
+          number: "NC-1",
+          reason: "Dañado",
+          total: 100,
+          taxTotal: 0,
+          costTotal: 0,
+          wasteQty: 1,
+          wasteCostTotal: 40,
+          refundAmount: 100,
+          refundMethod: "cash",
+          items: [{ wasteCost: 40 }],
+        },
+      ],
+    };
+    const seller = saleHistoryDto(sale, {
+      role: "seller",
+      permissions: ["sale:write"],
+    } as any) as any;
+    expect(seller.number).toBe("N-1");
+    expect(seller.items[0].variant.product.name).toBe("Producto");
+    expect(seller).not.toHaveProperty("requestHash");
+    expect(seller).not.toHaveProperty("costTotal");
+    expect(seller.items[0]).not.toHaveProperty("unitCost");
+    expect(seller.items[0]).not.toHaveProperty("stockAllocations");
+    expect(seller.items[0].variant).not.toHaveProperty("costAvg");
+    expect(seller.payments[0]).not.toHaveProperty("feeAmount");
+    expect(seller.returns[0]).not.toHaveProperty("costTotal");
+    expect(seller.returns[0]).not.toHaveProperty("wasteCostTotal");
+    expect(seller.returns[0]).not.toHaveProperty("items");
+
+    const manager = saleHistoryDto(sale, {
+      role: "manager",
+      permissions: ["profit:read"],
+    } as any) as any;
+    expect(manager.costTotal).toBe(40);
+    expect(manager.returns[0].wasteCostTotal).toBe(40);
+  });
 });
diff --git a/tests/compliance.test.ts b/tests/compliance.test.ts
new file mode 100644
index 0000000..0f0291d
--- /dev/null
+++ b/tests/compliance.test.ts
@@ -0,0 +1,98 @@
+import { readFileSync } from "node:fs";
+import { describe, expect, it } from "vitest";
+
+const luminance = (hex: string) => {
+  const channels = hex
+    .slice(1)
+    .match(/.{2}/g)!
+    .map((part) => parseInt(part, 16) / 255)
+    .map((value) =>
+      value <= 0.04045
+        ? value / 12.92
+        : Math.pow((value + 0.055) / 1.055, 2.4),
+    );
+  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
+};
+const contrast = (a: string, b: string) => {
+  const [bright, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
+  return (bright + 0.05) / (dark + 0.05);
+};
+const cssVariable = (css: string, name: string) =>
+  new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1] ?? "";
+
+describe("Cumplimiento legal y accesibilidad", () => {
+  it("G1: el ticket sin NCF se identifica como no fiscal y no imprime una fila NCF vacía", () => {
+    const source = readFileSync("apps/web/src/Prints.tsx", "utf8");
+    expect(source).toContain(
+      "DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL",
+    );
+    expect(source).not.toContain('<h3 className="tp-center">FACTURA</h3>');
+    expect(source).not.toContain(
+      '<Row label="NCF:" value={sale.ncf ?? ""} />',
+    );
+  });
+
+  it("G2: el encabezado térmico usa los datos de Ajustes y un logo predeterminado", () => {
+    const source = readFileSync("apps/web/src/Prints.tsx", "utf8");
+    expect(source).not.toContain("<h2>Grupo Macgen</h2>");
+    expect(source).not.toContain(
+      '<p className="tp-branch">Plaza Lope de Vega</p>',
+    );
+    expect(source).toContain('{b.name || "Nexora POS"}');
+    expect(source).toContain("b.branchName");
+    expect(source).toContain("b.address");
+    expect(source).toContain("b.phone");
+    expect(source).toContain("b.legalId");
+    expect(source).toContain('b.logo || "/logo-grupo-macgen.png"');
+  });
+
+  it("G5: los PDF incluyen contacto, hora, tratamiento del ITBIS y condiciones de la nota", () => {
+    const source = readFileSync("apps/api/src/sales.ts", "utf8");
+    const salePdf = source.slice(source.indexOf('@Get("sales/:id/receipt.pdf")'));
+    const noteStart = source.indexOf('@Get("returns/:id/credit-note.pdf")');
+    const notePdf = source.slice(
+      noteStart,
+      source.indexOf('@Post("sales/:id/installments")', noteStart),
+    );
+    expect(salePdf).toContain("business.phone");
+    expect(salePdf).toContain("Fecha y hora:");
+    expect(salePdf).toContain("ITBIS adicional:");
+    expect(salePdf).toContain("business.taxIncluded");
+    expect(notePdf).toContain("this.db.settings.findUnique");
+    expect(notePdf).toContain("business.address");
+    expect(notePdf).toContain("Fecha:");
+    expect(notePdf).toContain("Condiciones de uso:");
+  });
+
+  it("G10: los colores funcionales alcanzan contraste AA y los controles conservan foco visible", () => {
+    const css = readFileSync("apps/web/src/styles.css", "utf8");
+    expect(contrast(cssVariable(css, "--success-strong"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
+    expect(contrast(cssVariable(css, "--warning-text"), "#fff5e6")).toBeGreaterThanOrEqual(4.5);
+    expect(contrast(cssVariable(css, "--danger-text"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
+    expect(contrast(cssVariable(css, "--focus"), "#ffffff")).toBeGreaterThanOrEqual(3);
+    expect(contrast(cssVariable(css, "--input-border"), "#ffffff")).toBeGreaterThanOrEqual(3);
+    expect(css).toContain('input[type="checkbox"]:focus-visible');
+    expect(css).toContain('input[type="radio"]:focus-visible');
+    expect(css).toContain("background: var(--success-strong)");
+    expect(css).toContain("outline: 3px solid var(--focus)");
+  });
+
+  it("G11: F4, F8 y F12 no ejecutan acciones detrás de un modal", () => {
+    const source = readFileSync("apps/web/src/POS.tsx", "utf8");
+    expect(source).toContain("const modalOpen = document.querySelector");
+    expect(source).toContain('["F4", "F8", "F12"].includes(e.key)');
+    expect(source).toContain("if (modalOpen && blockedByModal)");
+  });
+
+  it("G7: el sistema no solicita ni almacena la fecha de nacimiento", () => {
+    const schema = readFileSync("apps/api/prisma/schema.prisma", "utf8");
+    const admin = readFileSync("apps/api/src/admin.ts", "utf8");
+    const migration = readFileSync(
+      "apps/api/prisma/migrations/202610150002_remove_customer_birthday/migration.sql",
+      "utf8",
+    );
+    expect(schema).not.toMatch(/\bbirthday\b/);
+    expect(admin).not.toMatch(/\bbirthday\b/);
+    expect(migration).toContain('DROP COLUMN IF EXISTS "birthday"');
+  });
+});
diff --git a/tests/customer-privacy.test.ts b/tests/customer-privacy.test.ts
new file mode 100644
index 0000000..abafb8c
--- /dev/null
+++ b/tests/customer-privacy.test.ts
@@ -0,0 +1,101 @@
+import { describe, expect, it, vi } from "vitest";
+import { permissions } from "../packages/shared/src/index";
+import { AdminController } from "../apps/api/src/admin";
+
+const customerId = "11111111-1111-4111-8111-111111111111";
+const actor = {
+  id: "owner",
+  name: "Dueña",
+  email: "owner@example.test",
+  role: "manager",
+  permissions: permissions.manager,
+  branchId: "main",
+} as any;
+
+function fixture(debt = 0, creditNoteBalance = 0) {
+  const sale = { number: "NX-42", total: 875, ncf: "B0200000042" };
+  const tx = {
+    customer: {
+      findFirstOrThrow: vi.fn(async () => ({
+        id: customerId,
+        name: "Persona privada",
+        phone: "809-555-0101",
+        email: "private@example.test",
+        legalId: "00100000001",
+        notes: "Dato privado",
+      })),
+      update: vi.fn(async ({ data }: any) => ({ id: customerId, ...data })),
+    },
+    sale: {
+      aggregate: vi.fn(async () => ({ _sum: { creditBalance: debt } })),
+    },
+    creditNote: {
+      aggregate: vi.fn(async () => ({
+        _sum: { balance: creditNoteBalance },
+      })),
+    },
+    quote: { updateMany: vi.fn(async () => ({ count: 1 })) },
+    auditLog: {
+      updateMany: vi.fn(async () => ({ count: 2 })),
+      create: vi.fn(async ({ data }: any) => data),
+    },
+  };
+  const db = {
+    $transaction: vi.fn(async (operation: (client: typeof tx) => unknown) =>
+      operation(tx),
+    ),
+  };
+  return { api: new AdminController(db as any), tx, sale };
+}
+
+describe("G6: anonimización de clientes", () => {
+  it("reserva el endpoint a customers:erase y no lo concede a vendedores", () => {
+    const handler = (AdminController.prototype as any).anonymizeCustomer;
+    expect(Reflect.getMetadata("permission", handler)).toBe("customers:erase");
+    expect(permissions.manager).toContain("customers:erase");
+    expect(permissions.seller).not.toContain("customers:erase");
+  });
+
+  it("rechaza la anonimización cuando hay crédito o contraentrega pendiente", async () => {
+    const { api, tx } = fixture(25);
+    await expect(
+      (api as any).anonymizeCustomer(
+        customerId,
+        { reason: "Solicitud verificada", requestRef: "SOL-2026-001" },
+        actor,
+      ),
+    ).rejects.toMatchObject({ status: 409 });
+    expect(tx.customer.update).not.toHaveBeenCalled();
+  });
+
+  it("borra datos personales y auditoría sin alterar ventas ni montos", async () => {
+    const { api, tx, sale } = fixture();
+    const originalSale = structuredClone(sale);
+    const result = await (api as any).anonymizeCustomer(
+      customerId,
+      { reason: "Solicitud verificada", requestRef: "SOL-2026-002" },
+      actor,
+    );
+
+    expect(result).toMatchObject({ id: customerId, active: false });
+    expect(tx.customer.update).toHaveBeenCalledWith(
+      expect.objectContaining({
+        data: expect.objectContaining({
+          phone: null,
+          email: null,
+          legalId: null,
+          notes: "",
+          active: false,
+        }),
+      }),
+    );
+    expect(tx.auditLog.updateMany).toHaveBeenCalled();
+    expect(JSON.stringify(tx.auditLog.updateMany.mock.calls)).not.toContain(
+      "809-555-0101",
+    );
+    expect(JSON.stringify(tx.auditLog.create.mock.calls)).not.toContain(
+      "809-555-0101",
+    );
+    expect(sale).toEqual(originalSale);
+  });
+});
diff --git a/tests/inventory-resilience.test.ts b/tests/inventory-resilience.test.ts
new file mode 100644
index 0000000..27d3efc
--- /dev/null
+++ b/tests/inventory-resilience.test.ts
@@ -0,0 +1,101 @@
+import { describe, expect, it } from "vitest";
+import { readFileSync } from "node:fs";
+import { fileURLToPath } from "node:url";
+import {
+  isSerializationConflict,
+  lotIdentity,
+  reconcileLotExpiry,
+  retrySerializable,
+} from "../apps/api/src/inventory-resilience";
+
+describe("I1 · identidad canónica de lote", () => {
+  it("unifica el código sin distinguir mayúsculas, espacios ni vencimiento", () => {
+    expect(lotIdentity("  lote   abc  ", null)).toEqual(
+      lotIdentity("LOTE ABC", undefined),
+    );
+    expect(lotIdentity(" lote abc ", null).lotNumberNormalized).toBe(
+      "LOTE ABC",
+    );
+  });
+
+  it("completa un vencimiento nulo y rechaza otro día para el mismo código", () => {
+    const received = new Date("2030-01-01T04:00:00.000Z");
+    expect(reconcileLotExpiry(null, received)).toEqual({
+      conflict: false,
+      expiryDate: received,
+    });
+    expect(
+      reconcileLotExpiry(received, "2030-01-01T12:00:00.000Z").conflict,
+    ).toBe(false);
+    expect(
+      reconcileLotExpiry(received, "2030-01-02T04:00:00.000Z").conflict,
+    ).toBe(true);
+  });
+
+  it("trata como el mismo vencimiento las horas distintas del mismo día dominicano", () => {
+    expect(
+      reconcileLotExpiry("2030-01-01T12:00:00.000Z", "2030-01-02T03:59:59.000Z")
+        .conflict,
+    ).toBe(false);
+  });
+
+  it("la migración aborta fechas ambiguas y reescribe lotes usados por devoluciones", () => {
+    const sql = readFileSync(
+      fileURLToPath(
+        new URL(
+          "../apps/api/prisma/migrations/202610140001_lot_identity/migration.sql",
+          import.meta.url,
+        ),
+      ),
+      "utf8",
+    );
+    expect(sql).toContain("count(DISTINCT");
+    expect(sql).toContain("RAISE EXCEPTION");
+    expect(sql).toContain('normalize("lotNumber", NFKC)');
+    expect(sql).toContain('UPDATE "InventoryMovement"');
+    expect(sql).toContain('UPDATE "SaleItem"');
+    expect(sql).toContain("jsonb_set");
+    expect(sql.indexOf('UPDATE "SaleItem"')).toBeLessThan(
+      sql.indexOf('DELETE FROM "Lot"'),
+    );
+  });
+});
+
+describe("K1 · reintentos serializables acotados", () => {
+  it("dos solicitudes recuperan un 40001/P2010 transitorio sin duplicar", async () => {
+    let committed: { id: string } | undefined;
+    let conflicts = 0;
+    const request = async () =>
+      retrySerializable(async () => {
+        if (!committed) {
+          if (!conflicts++) throw { code: "P2010", meta: { code: "40001" } };
+          committed = { id: "recepcion-1" };
+        }
+        return committed;
+      });
+    const results = await Promise.all([request(), request()]);
+    expect(results).toEqual([{ id: "recepcion-1" }, { id: "recepcion-1" }]);
+    expect(new Set(results.map((row) => row.id)).size).toBe(1);
+  });
+
+  it("se detiene al quinto conflicto y no reintenta errores de negocio", async () => {
+    let attempts = 0;
+    await expect(
+      retrySerializable(async () => {
+        attempts++;
+        throw { code: "P2010", meta: { message: "SQLSTATE 40001" } };
+      }),
+    ).rejects.toMatchObject({ code: "P2010" });
+    expect(attempts).toBe(5);
+    expect(isSerializationConflict({ code: "P2034" })).toBe(true);
+
+    attempts = 0;
+    await expect(
+      retrySerializable(async () => {
+        attempts++;
+        throw new Error("stock insuficiente");
+      }),
+    ).rejects.toThrow("stock insuficiente");
+    expect(attempts).toBe(1);
+  });
+});
diff --git a/tests/offline-policy.test.ts b/tests/offline-policy.test.ts
index 40409a1..a75ca6e 100644
--- a/tests/offline-policy.test.ts
+++ b/tests/offline-policy.test.ts
@@ -1,6 +1,13 @@
 import { describe, expect, it } from "vitest";
 import { AdminController } from "../apps/api/src/admin";
 import { offlineSaleAction } from "../apps/web/src/offlinePolicy";
+import { normalizeLegacyOfflineDiscount } from "../apps/api/src/sales";
+import {
+  applyPendingSaleReprice,
+  discardPendingSale,
+  isPendingPriceConflict,
+  repricePendingSale,
+} from "../apps/web/src/pendingSales";
 
 describe("política de ventas offline", () => {
   it("bloquea por defecto una venta iniciada sin conexión", () => {
@@ -25,6 +32,260 @@ describe("política de ventas offline", () => {
   });
 });
 
+describe("compatibilidad de descuentos offline heredados", () => {
+  const input = {
+    offlineUuid: "11111111-1111-4111-8111-111111111111",
+    cashSessionId: "22222222-2222-4222-8222-222222222222",
+    capturedAt: "2026-10-08T12:00:00.000Z",
+    customerId: "33333333-3333-4333-8333-333333333333",
+    items: [
+      {
+        variantId: "44444444-4444-4444-8444-444444444444",
+        qty: 1,
+        discountPercent: 10,
+      },
+    ],
+    globalDiscount: 0,
+    payments: [{ method: "cash" as const, amount: 90 }],
+  };
+
+  it("añade un motivo auditable sólo a una venta offline heredada", () => {
+    const normalized = normalizeLegacyOfflineDiscount(input, true, true);
+    expect(normalized.discountReason).toMatch(/offline heredada/i);
+    expect(input).not.toHaveProperty("discountReason");
+  });
+
+  it("no relaja una venta nueva en línea", () => {
+    expect(normalizeLegacyOfflineDiscount(input, false, true)).toBe(input);
+  });
+
+  it("no inventa motivo para una venta offline posterior al corte legado", () => {
+    const current = { ...input, capturedAt: "2026-10-10T12:00:00.000Z" };
+    expect(normalizeLegacyOfflineDiscount(current, true, true)).toBe(current);
+  });
+});
+
+describe("resolución de precios viejos en la cola offline", () => {
+  const input: any = {
+    offlineUuid: "11111111-1111-4111-8111-111111111111",
+    cashSessionId: "22222222-2222-4222-8222-222222222222",
+    items: [
+      {
+        variantId: "44444444-4444-4444-8444-444444444444",
+        qty: 2,
+        discountPercent: 0,
+      },
+    ],
+    globalDiscount: 0,
+    expectedTotal: 200,
+    payments: [{ method: "cash", amount: 200 }],
+  };
+  const products: any[] = [
+    {
+      id: "p1",
+      name: "Producto actualizado",
+      categoryId: "c1",
+      brand: "Nexora",
+      taxRate: "0",
+      variants: [
+        {
+          id: input.items[0].variantId,
+          sku: "SKU-1",
+          price: "150",
+        },
+      ],
+    },
+  ];
+
+  it("no inventa efectivo cuando el precio sube después de entregar la venta", () => {
+    expect(() => repricePendingSale(input, products, [], true)).toThrow(
+      /falta cobrar la diferencia/i,
+    );
+  });
+
+  it("cubre un aumento sólo si ya existe una cuenta por cobrar", () => {
+    const result = repricePendingSale(
+      {
+        ...input,
+        payments: [{ method: "credit", amount: 200 }],
+      } as any,
+      products,
+      [],
+      true,
+    );
+    expect(result.input.offlineUuid).toBe(input.offlineUuid);
+    expect(result.total).toBe(300);
+    expect(result.input.payments[0].amount).toBe(300);
+    expect(result.prices[0].unitPrice).toBe(150);
+  });
+
+  it("no aplica promociones por lote antes de que la API asigne FEFO", () => {
+    const result = repricePendingSale(
+      { ...input, expectedTotal: 200 },
+      products.map((p) => ({
+        ...p,
+        variants: p.variants.map((v: any) => ({ ...v, price: "100" })),
+      })),
+      [
+        {
+          active: true,
+          startsAt: "2020-01-01T00:00:00.000Z",
+          endsAt: "2040-01-01T00:00:00.000Z",
+          type: "percent",
+          value: 50,
+          scope: { lotId: "55555555-5555-4555-8555-555555555555" },
+        },
+      ],
+      true,
+    );
+    expect(result.total).toBe(200);
+  });
+
+  it("reduce pagos editables sin producir importes negativos", () => {
+    const result = repricePendingSale(
+      {
+        ...input,
+        expectedTotal: 300,
+        payments: [
+          { method: "card", amount: 200, cardLast4: "1234", approvalCode: "A" },
+          { method: "cash", amount: 100 },
+        ],
+      } as any,
+      products.map((p) => ({
+        ...p,
+        variants: p.variants.map((v: any) => ({ ...v, price: "100" })),
+      })),
+      [],
+      true,
+    );
+    expect(result.total).toBe(200);
+    expect(result.input.payments[1].amount).toBe(100);
+    expect(result.input.payments.every((p) => p.amount >= 0)).toBe(true);
+  });
+
+  it("distribuye una rebaja entre varios pagos editables sin tocar la tarjeta", () => {
+    const result = repricePendingSale(
+      {
+        ...input,
+        expectedTotal: 300,
+        payments: [
+          { method: "card", amount: 200, cardLast4: "1234", approvalCode: "A" },
+          { method: "cash", amount: 50 },
+          { method: "credit", amount: 50 },
+        ],
+      } as any,
+      products.map((p) => ({
+        ...p,
+        variants: p.variants.map((v: any) => ({ ...v, price: "110" })),
+      })),
+      [],
+      true,
+    );
+    expect(result.total).toBe(220);
+    expect(result.input.payments).toEqual([
+      expect.objectContaining({ method: "card", amount: 200 }),
+      expect.objectContaining({ method: "cash", amount: 50 }),
+      expect.objectContaining({ method: "credit", amount: 20 }),
+    ]);
+  });
+
+  it("exige descartar o cobrar otra vez si los pagos editables no cubren la rebaja", () => {
+    expect(() =>
+      repricePendingSale(
+        {
+          ...input,
+          expectedTotal: 300,
+          payments: [
+            {
+              method: "card",
+              amount: 290,
+              cardLast4: "1234",
+              approvalCode: "A",
+            },
+            { method: "cash", amount: 10 },
+          ],
+        } as any,
+        products.map((p) => ({
+          ...p,
+          variants: p.variants.map((v: any) => ({ ...v, price: "100" })),
+        })),
+        [],
+        true,
+      ),
+    ).toThrow(/descartarla y cobrarla nuevamente/i);
+  });
+
+  it("detecta sólo el conflicto que admite reprecificación", () => {
+    expect(
+      isPendingPriceConflict(
+        "Los precios o promociones cambiaron. Revisa el total antes de cobrar.",
+      ),
+    ).toBe(true);
+    expect(isPendingPriceConflict("No hay suficiente stock.")).toBe(false);
+  });
+
+  it("audita antes de reemplazar input y recibo, conservando offlineUuid", async () => {
+    const order: string[] = [];
+    let audit: any;
+    let update: any;
+    const creditInput = {
+      ...input,
+      payments: [{ method: "credit", amount: 200 }],
+    } as any;
+    const sale: any = {
+      id: input.offlineUuid,
+      input: creditInput,
+      receipt: { number: "LOCAL-11111111", total: 200, snapshot: [] },
+      status: "conflict",
+      message: "Los precios o promociones cambiaron.",
+    };
+    await applyPendingSaleReprice(sale, products, [], true, {
+      recordResolution: async (body) => {
+        order.push("audit");
+        audit = body;
+      },
+      updateLocal: async (_id, changes) => {
+        order.push("update");
+        update = changes;
+      },
+    });
+    expect(order).toEqual(["audit", "update"]);
+    expect(audit).toMatchObject({
+      offlineUuid: input.offlineUuid,
+      action: "reprice",
+      previousTotal: 200,
+      currentTotal: 300,
+    });
+    expect(update.input.offlineUuid).toBe(input.offlineUuid);
+    expect(update.input.expectedTotal).toBe(300);
+    expect(update.receipt).toMatchObject({ total: 300, taxTotal: 0 });
+    expect(update.receipt.snapshot[0].unitPrice).toBe(150);
+    expect(update.status).toBe("pending");
+  });
+
+  it("al descartar registra motivo antes de borrar IndexedDB", async () => {
+    const order: string[] = [];
+    const sale: any = {
+      id: input.offlineUuid,
+      input,
+      receipt: { total: 200 },
+      status: "conflict",
+    };
+    await discardPendingSale(sale, "Cliente canceló la operación", {
+      recordResolution: async (body) => {
+        order.push("audit:" + body.action + ":" + body.reason);
+      },
+      deleteLocal: async () => {
+        order.push("delete");
+      },
+    });
+    expect(order).toEqual([
+      "audit:discard:Cliente canceló la operación",
+      "delete",
+    ]);
+  });
+});
+
 describe("compatibilidad de ajustes offline", () => {
   const base = {
     name: "Nexora POS",
diff --git a/tests/rate-limit-l1.test.ts b/tests/rate-limit-l1.test.ts
new file mode 100644
index 0000000..d0ee7da
--- /dev/null
+++ b/tests/rate-limit-l1.test.ts
@@ -0,0 +1,104 @@
+import { readFileSync } from "node:fs";
+import { describe, expect, it, vi } from "vitest";
+import {
+  AuthenticatedRateLimitGuard,
+  RequestRateLimitService,
+  ValidatedRateLimitStore,
+} from "../apps/api/src/rate-limit";
+import { AuthController } from "../apps/api/src/auth";
+
+const context = (request: any) =>
+  ({ switchToHttp: () => ({ getRequest: () => request }) }) as any;
+
+describe("L1 · rate limiting sólo con identidades validadas", () => {
+  it("el parser JSON queda instalado una sola vez", () => {
+    const main = readFileSync("apps/api/src/main.ts", "utf8");
+    expect(main).toContain("bodyParser: false");
+    expect(main.match(/app\.use\(jsonBodyParser/g)).toHaveLength(1);
+    expect(main).not.toContain("createRequestRateLimiter");
+  });
+  it("61 intentos de una cuenta no bloquean otra cuenta", () => {
+    const store = new ValidatedRateLimitStore();
+    for (let attempt = 1; attempt <= 60; attempt++)
+      expect(store.exceeds("auth-account", ["10.0.0.1", "user-a"], 60)).toBe(
+        false,
+      );
+    expect(store.exceeds("auth-account", ["10.0.0.1", "user-a"], 60)).toBe(
+      true,
+    );
+    expect(store.exceeds("auth-account", ["10.0.0.1", "user-b"], 60)).toBe(
+      false,
+    );
+  });
+  it("10,001 claves falsas no ocupan memoria ni abren el límite de sesiones válidas", () => {
+    const service = new RequestRateLimitService();
+    const guard = new AuthenticatedRateLimitGuard(service);
+    for (let i = 0; i < 10_001; i++)
+      expect(
+        guard.canActivate(
+          context({
+            method: "POST",
+            path: "/api/sales",
+            ip: "10.0.0.1",
+            headers: { authorization: `Bearer falsa-${i}` },
+          }),
+        ),
+      ).toBe(true);
+    const valid = {
+      method: "POST",
+      path: "/api/sales",
+      ip: "10.0.0.1",
+      actor: { sessionId: "session-valid-a" },
+    };
+    for (let attempt = 1; attempt <= 120; attempt++)
+      expect(guard.canActivate(context(valid))).toBe(true);
+    expect(() => guard.canActivate(context(valid))).toThrowError(
+      "Demasiados intentos",
+    );
+    expect(() =>
+      guard.canActivate(context({ ...valid, ip: "203.0.113.99" })),
+    ).toThrowError("Demasiados intentos");
+    expect(
+      guard.canActivate(
+        context({ ...valid, actor: { sessionId: "session-valid-b" } }),
+      ),
+    ).toBe(true);
+  });
+
+  it("10,001 nombres inexistentes no crean cubos de cuenta", async () => {
+    const db = { user: { findFirst: vi.fn(async () => null) } };
+    const limits = {
+      assert: vi.fn(() => {
+        throw new Error("cuenta-limitada");
+      }),
+    };
+    const controller = new AuthController(db as any, {} as any, limits as any);
+    for (let i = 0; i < 10_001; i++)
+      await expect(
+        controller.login(
+          { login: `inexistente-${i}`, password: "x" },
+          { ip: "10.0.0.1" } as any,
+          {} as any,
+        ),
+      ).rejects.toBeTruthy();
+    expect(limits.assert).not.toHaveBeenCalled();
+    db.user.findFirst.mockResolvedValueOnce({ id: "user-real" } as never);
+    await expect(
+      controller.login(
+        { login: "real", password: "x" },
+        { ip: "10.0.0.1" } as any,
+        {} as any,
+      ),
+    ).rejects.toThrow("cuenta-limitada");
+    expect(limits.assert).toHaveBeenCalledTimes(1);
+  });
+  it("cada sesión conserva su propio límite de PIN y ventas", () => {
+    const store = new ValidatedRateLimitStore();
+    expect(store.exceeds("sales-session", ["sale-a"], 1)).toBe(false);
+    expect(store.exceeds("sales-session", ["sale-a"], 1)).toBe(true);
+    expect(store.exceeds("sales-session", ["sale-b"], 1)).toBe(false);
+    expect(store.exceeds("auth-pin-session", ["pin-a"], 1)).toBe(false);
+    expect(store.exceeds("auth-pin-session", ["pin-a"], 1)).toBe(true);
+    expect(store.exceeds("auth-pin-session", ["pin-b"], 1)).toBe(false);
+  });
+});
diff --git a/vitest.config.ts b/vitest.config.ts
index eb8f871..6a827aa 100644
--- a/vitest.config.ts
+++ b/vitest.config.ts
@@ -6,6 +6,7 @@ export default defineConfig({
       "tests/invoice.test.ts",
       "tests/realtime.test.ts",
       "tests/inventario.test.ts",
+      "tests/inventory-resilience.test.ts",
       "tests/portabilidad.test.ts",
       "tests/e2e-higiene.test.ts",
       "tests/offline-policy.test.ts",
@@ -13,6 +14,10 @@ export default defineConfig({
       "tests/auth-username.test.ts",
       "tests/api-monitoring.test.ts",
       "tests/claude-round2.test.ts",
+      "tests/rate-limit-l1.test.ts",
+      "tests/cash-privacy.test.ts",
+      "tests/compliance.test.ts",
+      "tests/customer-privacy.test.ts",
     ],
   },
 });
```
