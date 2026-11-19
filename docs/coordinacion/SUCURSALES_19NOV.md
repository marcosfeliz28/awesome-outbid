# Sucursales en el producto (orden de la dueña, 19-nov-2026)

Rama `claude/producto-sucursales-19nov` (desde `producto-nexora`). Sin despliegue.

## Cómo estaba modelado

- Casi todas las tablas tienen `branchId` (texto, por defecto `'main'`): catálogo, inventario,
  clientes, ventas, caja, gastos, bitácora… Cada consulta de la API filtra por
  `actor.branchId`, y `actor.branchId` sale **de `User.branchId` en cada petición** (AuthGuard).
- `Settings` es una fila por sucursal (`@@id([tenantId, id])`, `id = branchId`).
- `Warehouse` por sucursal (`@@unique([tenantId, branchId, kind])`): Tienda (`store`) y Casa (`home`).
- `Terminal.branchId`: un equipo pertenece a una sucursal; si no coincide con la del usuario,
  la sesión se cierra (AuthGuard) y el login no lo asocia.
- RLS por empresa (`tenant_isolation`, rol `nexora_tenant_runtime`). La sucursal **no** es una
  frontera de RLS: la separa la aplicación con `actor.branchId`.
- No existía tabla de sucursales: el límite del plan (`billing-plans.ts`) contaba los
  `branchId` distintos de usuarios y equipos.
- Numeración: contador `sale:<branchId>` / `return:<branchId>`, pero `Sale.number` y
  `SaleReturn.number` son únicos **por empresa** → una segunda sucursal habría chocado con
  `FS-0000001` de la principal.

## Diseño elegido (mínimo)

1. **Tabla `Branch`** (`202611190001_branches`): `(tenantId, id)` es la clave primaria, así
   `branchId` es único por empresa; `id` es el mismo texto que ya usan las columnas `branchId`
   (`main` = Principal). Columnas: `name`, `active`, fechas. RLS `tenant_isolation`, sin
   default de `tenantId` (falla cerrada), FK a `Tenant`.
   - Relleno idempotente: `main` para cada empresa + todo `branchId` ya usado en Settings,
     User, Terminal y Warehouse. No modifica ninguna fila existente.
   - Trigger `AFTER INSERT ON "Settings"` → registra la sucursal (así el alta de empresa
     crea su `main` sin tocar `registration.ts`).
   - Sin FK de `User.branchId` → `Branch` (muchas pruebas y semillas insertan usuarios
     directos); la API valida la sucursal al asignar.
2. **API** `apps/api/src/branches.ts` (sólo producto, permiso `*`, todo con bitácora):
   - `GET /api/branches` — sucursales, cuál es la actual y quién trabaja en cada una.
   - `POST /api/branches {name}` — código `s2`, `s3`… (primero libre). Límite del plan con el
     mismo candado que `enforcePlanQuota` (`plan:<tenant>`), contando sucursales **activas**;
     409 «El plan X permite N sucursales…». Crea su `Settings` copiando la principal salvo
     `onboarding` y `usdRateHeld` (nombre comercial, impuestos, moneda, reglas), su almacén
     «Tienda» (vendible). No copia inventario, clientes ni datos.
   - `PATCH /api/branches/:id {name?, active?}` — renombrar (nombre repetido = 409) y
     desactivar/activar. La principal no se desactiva; tampoco con personas activas, con
     caja abierta o si es la tuya. Reactivar respeta el límite del plan.
   - `POST /api/branches/:id/users {userId}` — asigna una persona. A otra persona se le sube
     `authVersion` (entra de nuevo, ya en su sucursal). No se mueve con caja abierta ni si su
     número de cajero ya está usado en la otra sucursal. **Selector**: con su propio id, la
     administradora se cambia de sucursal (desde un navegador sin equipo registrado; un equipo
     pertenece a su sucursal → 409 con explicación).
3. **Numeración propia**: `branchDocumentNumber()` — la principal sigue `FS-0000001` /
   `NC-000001`; las demás `FS-S2-0000001` / `NC-S2-000001`. Único cambio en `sales.ts`.
4. **Sesión**: no cambia; ya usa `User.branchId`. La cajera sólo opera su sucursal porque
   toda la API filtra por `actor.branchId` y el equipo debe ser de su sucursal.
5. **Web**: `apps/web/src/BranchSettings.tsx` (archivo nuevo, clases existentes, sin diseño
   propio) en Configuración del producto, visible sólo con `*`. Una línea en `Management.tsx`.

## Pruebas

- `tests/product-branches-postgres.test.ts` (API real + PostgreSQL): límite 409 (1 y 2),
  copia de ajustes, almacén, bitácora, renombrar, desactivar, asignar, caja abierta,
  cajera 403 en las 4 rutas, cajera de s2 no ve clientes de la principal, empresa B no ve ni
  toca nada de A (404), mismo código `s2` en dos empresas, selector.
- `tests/branches-migracion-postgres.test.ts`: migración sobre base con datos (2 empresas,
  sucursal heredada `norte`), `main` conservada, usuarios sin cambios, idempotente, RLS y trigger.
- `tests/branches-unit.test.ts`: numeración, códigos, contenido de la migración.
- `tests/branch-settings-web.test.ts`: presentación.
- Matriz de rutas (`product-route-matrix-postgres`): 4 rutas nuevas (210 → 214) y
  `GET /api/branches` en las lecturas aisladas. `product-tenants-postgres`: 69 tablas, `Branch`
  sin default de `tenantId`.

## Pendientes

- `enforcePlanQuota(…, "branches")` en `billing-plans.ts` sigue contando `branchId` de
  usuarios/equipos (no lo toqué: otro agente trabaja en facturación). Con `Branch` conviene
  contar `Branch` activas allí también.
- Bajar de plan con más sucursales activas que el nuevo límite: hoy no se fuerza nada.
- Selector sin cerrar sesión desde un equipo registrado (hoy 409): requeriría sucursal por
  sesión en vez de por usuario.
- Reportes consolidados de todas las sucursales (cada reporte filtra por la sucursal actual).
- Traspasos de inventario entre sucursales (hoy sólo entre almacenes de una sucursal).
- Diseño final de la pantalla: lo hace ChatGPT/Dot (regla 4 de CLAUDE.md).
- Tienda local (no producto): la tabla existe pero las rutas sólo se registran en producto.
