# Roles y permisos

Rama `cola-n26` (= `nexora-cloud`). Citas `archivo:línea`.

## 1. Cómo funciona

- Cada usuario tiene **un rol** y el rol tiene una **lista de permisos** (`apps/api/prisma/schema.prisma`, modelos `Role` y `User`). El permiso `*` da acceso a todo. La regla: `can(grants, p)` = tiene `*` o tiene `p` (`packages/shared/src/index.ts:787-788`).
- La web esconde las pantallas sin permiso y la API revisa el permiso en cada ruta con `@Permit("…")` (`apps/api/src/common.ts:79-80`). Varias reglas de dinero se revisan en el servidor aunque la web las oculte.
- Los roles que trae el sistema (valores de fábrica, `packages/shared/src/index.ts:759-786`; se crean al sembrar `apps/api/prisma/seed.ts:431-435`; el rol `gv` lo crea la migración `202610260901_gv`, ver `docs/coordinacion/MODULO-GV.md:72`):

| Rol (nombre en la base) | Quién es | Permisos de fábrica |
|---|---|---|
| `admin` | Dueña / administración | `*` |
| `manager` | Gerente | `catalog:read`, `catalog:write`, `inventory:write`, `purchase:write`, `sale:write`, `sale:manage`, `cash:write`, `expense:write`, `reports:read`, `profit:read`, `customers:write`, `customers:erase`, `promotions:write`, `alerts:write`, `gv:read`, `gv:write`, `gv:reports`, `gv:verify` |
| `seller` | Cajero/a / vendedor/a | `catalog:read`, `sale:write`, `cash:write`, `customers:write` |
| `warehouse` | Almacén | `catalog:read`, `inventory:write`, `purchase:write` |
| `gv` | Empleada de GV (p. ej. Clary) | `gv:read`, `gv:write`, `gv:reports` |

- **DUDOSO / pendiente de comprobar en vivo:** la dueña puede editar los permisos de cada rol desde Configuración › «Usuarios y permisos» › «Permisos por rol» (`apps/web/src/Management.tsx:4299-4310`, `:4468-4492`; API `PUT /roles/:id`, `apps/api/src/admin.ts:1299-1320`). Los permisos reales de producción pueden ser distintos de la tabla de fábrica; para saberlo hay que mirar esa pantalla (no se leyó la base). El rol `admin` no puede perder el `*` (`admin.ts:1311`).

## 2. Qué significa cada permiso (y dónde se usa)

| Permiso | Para qué sirve | Pantallas / rutas principales |
|---|---|---|
| `catalog:read` | Ver productos, categorías, stock, kardex, ajustes (`GET /settings`). | «Productos» (`App.tsx:234`), `apps/api/src/catalog.ts:231-346`, `apps/api/src/inventory.ts:581` |
| `catalog:write` | Crear/editar productos, variantes, importar Excel, kits. | `apps/api/src/catalog.ts:195`, `:237`, `:378`, `:408`, `:432`, `:496`, `:588`, `:652` |
| `inventory:write` | Pantallas «Mercancía» e «Inventario»; ajustes y conteos. | `App.tsx:197`, `:240`; `apps/api/src/merchandise.ts:160-343`; `apps/api/src/inventory.ts:637`, `:1487-1496` |
| `purchase:write` | «Compras», órdenes, recepciones, proveedores, pagos a proveedor. | `App.tsx:246`; `apps/api/src/inventory.ts:954-1041`; `apps/api/src/admin.ts:568-588` |
| `sale:write` | Vender (Punto de venta), ver Ventas, pedir anulaciones, ventas en espera, cobrar créditos en efectivo. | `App.tsx:209-216`; `apps/api/src/sales.ts:1469`, `:4181-4183`; `apps/api/src/admin.ts:739-803` |
| `sale:manage` | **Gerencia de ventas**: devoluciones, aprobar conteos, ver esperados de caja, ver datos completos de clientes, cobrar crédito con tarjeta/transferencia, ver lista de transferencias pendientes, tasas de incentivos, **ser quien aprueba con PIN**; ver «Configuración» e «Incentivos». | `App.tsx:278`, `:1024-1031`; `sales.ts:2997-2999`, `:2638-2640`, `:4190`; `inventory.ts:1550-1552`; `common.ts:70-72`, `:276-281`; `security.ts:116-117` |
| `cash:write` | Pantalla «Caja»: abrir, mover, trasladar y cerrar. | `App.tsx:250`; `apps/api/src/cash.ts:837-1112` |
| `expense:write` | «Gastos». | `App.tsx:253`; `apps/api/src/admin.ts:643-737` |
| `customers:write` | «Clientes»: crear/editar. | `App.tsx:259`; `apps/api/src/admin.ts:250-295` |
| `customers:erase` | Anonimizar clientes y ver sus datos completos. | `admin.ts:351-352`; `common.ts:280-281` |
| `promotions:write` | «Promociones». | `App.tsx:265`; `admin.ts:1340-1386`; `apps/api/src/alerts.ts:904-905` |
| `reports:read` | «Reportes», «Resumen», exportes. | `App.tsx:203`, `:271`; `apps/api/src/reports.ts:235`, `:684-692` |
| `profit:read` | **Ver costos, márgenes y utilidades**; ver esperados de caja; reportes de margen e «Informe formal». Nunca aplica al rol `seller` aunque lo reciba (la vendedora nunca ve costos). | `apps/web/src/Management.tsx:1633`, `:2870`; `apps/api/src/common.ts:70-72`, `:366-370`; `apps/api/src/reports.ts:687-721`; `apps/api/src/formal-report.ts:49` |
| `alerts:write` | «Alertas» y la campana. | `App.tsx:275`; `apps/api/src/alerts.ts:841`, `:876`, `:937` |
| `gv:read` / `gv:write` / `gv:reports` / `gv:verify` | Módulo GV (ver `GV.md` §9). | `App.tsx:282`; `apps/api/src/gv.ts`, `gv-citas.ts` |
| `*` | Todo, y varias rutas son **solo** de este permiso (ver §4). | 40 rutas con `@Permit("*")` |
| `inventory:import` | Levantamiento de Casa; no está en ningún rol de fábrica, solo lo cubre `*`. | `apps/api/src/inventory-import.ts:47` |
| `authenticated` | Cualquier usuario con sesión (registro/aprobación de equipos, cambio de contraseña). | `apps/api/src/realtime.ts:159-324` |

## 3. Qué ve y hace cada rol (de fábrica)

### Administración (`admin`, `*`) — la dueña
- Todo el menú, incluida «Conciliar transferencias» y «Envíos del mensajero», que solo existen para `*` (`App.tsx:222-232`).
- Es la única que: anula ventas, verifica/rechaza transferencias, registra abonos, corrige el método de pago y banco/referencia, traspasa Casa↔Tienda, cambia la configuración, administra usuarios/roles/equipos, cierra el mes de incentivos y paga al mensajero (ver §4).
- Su propio PIN **sí** sirve para aprobarse a sí misma (`apps/api/src/security.ts:99-102`, «La dueña («*») sí puede usar su propio PIN»). Un gerente cerrando su propia caja necesita el PIN de otra persona; la dueña no (`apps/api/src/cash.ts:1248-1250`).

### Gerente (`manager`)
- Ve: Mercancía, Resumen, Punto de venta, Ventas, Solicitudes de anulación, Productos, Inventario, Compras, Caja, Gastos, Clientes, Promociones, Reportes, Alertas, Incentivos, GV; y el botón «Configuración».
- Ve costos y utilidades (`profit:read`) y los esperados de caja.
- Hace: devoluciones, aprobar conteos, cobrar créditos con tarjeta/transferencia, cierres de emergencia de la caja de otra persona (`apps/web/src/Tienda.tsx:321-328`), verificar/rechazar transferencias **de GV** (`gv:verify`), aprobar equipos nuevos (`apps/api/src/realtime.ts:257-258`, `:415`).
- **Su PIN es el «PIN de gerente»** que pide la caja: cualquier usuario activo con `sale:manage` puede aprobar (`apps/api/src/security.ts:92-136`).
- No puede (solo `*`): anular una venta, verificar transferencias de ventas, abonos, traspasos, guardar la configuración, crear usuarios (ver §4).

### Cajero/a (`seller`)
- Ve: Punto de venta, Ventas, Solicitudes de anulación (para cancelar las suyas), Caja, Productos (solo lectura), Clientes. No ve Mercancía (bloqueada también en la API, `merchandise.ts:154-156`), ni Reportes, ni costos (`common.ts:366-370`).
- **Contraseña de 6 números** y obligación de cambiarla al entrar (`apps/api/src/password-policy.ts:11-13`; `Management.tsx:4409-4412`). Cualquier otro rol usa contraseña fuerte (12 o más caracteres con mayúscula, minúscula, número y símbolo, `password-policy.ts:66-72`).
- Caja ciega: no ve los montos esperados de su caja (`common.ts:70-72`, `apps/web/src/managementMessages.ts:41-44`).
- Necesita el **PIN de gerente** para: descuentos sobre el límite, crédito/contraentrega sobre los topes, nota de crédito sin código, salidas de efectivo sobre RD$ 1,000 del turno, cerrar con descuadre, vale de caja, trasladar la caja a otro equipo, descartar una venta sin conexión en conflicto, y registrar efectivo que «ya tiene la dueña» (ver §5).
- Solo cobra créditos **en efectivo** (`apps/api/src/sales.ts:4190-4195`). Pide anulaciones; no las ejecuta.
- No puede cambiar de usuario con PIN hacia alguien con más permisos (`apps/api/src/common.ts:96-97`).

### Almacén (`warehouse`)
- Ve: Productos, Inventario, Compras, Mercancía (`inventory:write`, `purchase:write`). No vende ni abre caja.

### GV (`gv`)
- Solo «GV Makeup Studio» (cursos, citas, interesadas, por verificar sin poder verificar, reportes). Sin acceso a configuración, usuarios, costos, inventario ni datos de MacGen. No carga el catálogo de la caja (`apps/web/src/realtime.tsx:147-153`).

## 4. Qué es solo de administración (`*`)

Lista de lo que la API exige `@Permit("*")` (verificado en el código; no se enumeran las 40 rutas, solo las de negocio):

| Acción | Ruta / pantalla | Cita |
|---|---|---|
| Anular una venta | `POST /sales/:id/void` · botón «Anular» | `apps/api/src/sales.ts:2369-2372` |
| Aprobar / rechazar solicitud de anulación | `POST /void-requests/:id/approve|reject` | `sales.ts:2001-2060` |
| Verificar / rechazar transferencia de venta | `POST /payments/:id/verify|reject` | `sales.ts:2749-2751`, `:2885-2888` |
| Corregir banco y referencia | `POST /payments/:id/correct-transfer` | `sales.ts:2812-2815` |
| Corregir método de pago (7 días) | `POST /sales/:id/payments/:paymentId/correct-method` | `sales.ts:2192-2195` |
| Cambiar vendedora / marcar «al por mayor» | `POST /sales/:id/seller`, `/mark-wholesale` | `sales.ts:2092-2145` |
| Registrar abono / cobro de mensajero / cobro por persona / estado de cuenta | `/sales/:id/installments`, `/cod-collections`, `/credit-accounts…` | `sales.ts:3527-3556`, `:3633-3857` |
| «Conciliar transferencias» y «Envíos del mensajero» (pantallas) | menú | `App.tsx:222-232` |
| Traspasar Casa↔Tienda y «Levantamiento inicial de Casa» | `/inventory/transfers`, `/inventory-import/casa/*` | `warehouses.ts:112-114`; `inventory-import.ts:314-348` |
| Configuración (guardar), logo, cajas | `PUT /settings`, `/settings/logo`, `/terminals/:id/register` | `admin.ts:839-940` |
| Usuarios, restablecer contraseña, roles | `/users`, `/roles` | `admin.ts:1024-1320` |
| Bitácora y reglas de alertas | `/audit-log`, `/alert-rules` | `admin.ts:1321`; `alerts.ts:909-912` |
| Cerrar el mes de incentivos / ajustar tasas | `/incentives/close`, `/incentives/rates` | `apps/api/src/incentives.ts:801`, `:852` |
| Importación de GV | `POST /gv/import` | `apps/api/src/gv.ts:692` |
| Respaldo a Drive (tarjeta) | Configuración | `apps/api/src/drive-backup.ts` |

DUDOSO: el botón «Configuración» lo ve un gerente (`sale:manage`), pero guardar cambios exige `*`; no se probó qué pestañas muestran datos a un gerente que no es `*`.

## 5. PIN de gerente: cuándo se pide y quién puede darlo

- **Qué es:** un PIN de **6 dígitos** por usuario (los de 4-5 dígitos antiguos aún sirven y quedan marcados en la bitácora para cambiarlos) (`apps/api/src/admin.ts:205-212`; `Management.tsx:4424-4426`). Se crea al crear el usuario y se cambia en «Editar usuario · …» (`Management.tsx:4436-4448`).
- **Quién puede aprobar:** cualquier usuario activo de la sucursal con `sale:manage` (o `*`), **que no sea quien pide** (salvo la dueña `*`). Mensaje: «El PIN debe ser de otra persona con permiso; no puedes aprobar tu propia operación.» (`apps/api/src/security.ts:81-82`, `:92-136`).
- **Límite de intentos:** 10 fallos por hora por solicitante; 30 por hora para los PIN cortos de la sucursal (`apps/api/src/security.ts:51-56`).
- **Cuándo lo pide el sistema:**

| Situación | Cita |
|---|---|
| Descuento mayor al «Descuento máximo del vendedor (%)» (10 % de fábrica) | `POS.tsx:1866-1871`; `sales.ts:623-707` |
| Crédito/contraentrega sobre el umbral (RD$ 1,000), deuda del cliente, tope del turno (RD$ 3,000) o ventas a crédito deshabilitadas | `packages/shared/src/index.ts:403-444` |
| Pagar con nota de crédito sin escribir su código impreso | `POS.tsx:1872-1884`; `sales.ts:692-694` |
| Salida de efectivo del turno sobre el límite (RD$ 1,000 de fábrica) | `apps/api/src/cash.ts:975-1013`, `:1010` |
| Cerrar la caja con descuadre de tarjeta, efectivo o dólares (cajera, o gerente cerrando SU caja); desde el 2.º intento fallido siempre | `cash.ts:1248-1300` |
| Cerrar con «Vale de caja» (PIN de **otro** gerente) | `cash.ts:1139-1165` |
| Trasladar la caja a otro equipo | `cash.ts:1076-1090` |
| Devolver efectivo desde la caja abierta de otra persona (PIN de su dueña o de otro gerente) | `sales.ts:3046-3060` |
| «Este efectivo ya lo tiene la dueña» al cobrar un crédito | `sales.ts:4205-4220` |
| Descartar una venta sin conexión en conflicto (cajera) | `apps/web/src/Management.tsx:2145-2270` |
| Aprobar un equipo nuevo con PIN desde el propio equipo | `apps/api/src/realtime.ts:263-264`; `apps/web/src/realtime.tsx:513-516` |
| Cambiar de usuario con PIN (PIN del usuario al que se cambia; solo a usuarios con permisos iguales o menores) | `apps/api/src/auth.ts:838-873`; `common.ts:96-97` |

## 6. Equipos (terminales)

- Un equipo nuevo de vendedor/almacén **espera aprobación** de un gerente: «Este equipo necesita aprobación. Puedes consultar, pero para vender o mover mercancía un gerente debe aprobarlo» (`apps/web/src/realtime.tsx:513-516`). Se aprueba con PIN en el mismo equipo o desde Configuración › **Equipos** (`apps/api/src/realtime.ts:257-264`; modelo `Terminal`, campo `approvedAt`).
- Las rutas que mueven dinero o inventario exigen equipo registrado y aprobado (`@RequireTerminal`, `apps/api/src/common.ts` y `sales.ts:1469`, `cash.ts:838`).
- La caja se asigna al equipo con nombre y número visibles en el cuadre (ej. «4012 · GPRO STORE RD») y cada cajero tiene un «No. de cajero» (ej. 1031) (`apps/web/src/Tienda.tsx:1293-1360`; `schema.prisma` `Terminal.registerNumber`, `User.cashierNumber`).
- Una sesión se cierra por inactividad según «sessionTimeoutMinutes» (30 min por defecto) (`apps/api/src/auth.ts:358-360`; `apps/api/src/admin.ts:92`).
