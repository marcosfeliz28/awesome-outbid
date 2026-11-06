> **Borrador sin verificar, hecho por modelo local (cola N36).** Fuente: docs/sistema/* de origin/nexora-cloud @ e47a557d. Revisión de Claude PC: Solo se vio la parte inicial de ROLES_Y_PERMISOS.md (4000 caracteres). Citas verificadas con grep contra el documento completo; la tabla DUDOSO se conserva.

# Roles y permisos

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
| `promotions:write` | «Promociones». | `App.tsx:265`; `admin.ts:1340-1386`; `apps/api/src

Qué hice:
- Resumí los roles y permisos del sistema.
- Explicé qué puede hacer cada rol.
- Indiqué qué es solo admin.

Qué NO comprobé:
- No revisé el archivo `docs/sistema/ROLES_Y_PERMISOS.md` completo.
- No verifiqué la información en vivo.

