# Roles y permisos del producto (tarea 83)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`415f602a`), rama `claude-pc/cola-b13`. Definición única en `packages/shared/src/index.ts:839` (objeto `permissions`). Generado por script desde esas líneas; no se inventan roles.

| Rol | Permisos | Archivo:línea |
|---|---|---|
| admin | * | `packages/shared/src/index.ts:840` |
| manager | catalog:read, catalog:write, inventory:write, purchase:write, sale:write, sale:manage, cash:write, cash:drawer, expense:write, reports:read, profit:read, customers:write, customers:erase, promotions:write, alerts:write | `packages/shared/src/index.ts:841` |
| seller | catalog:read, sale:write, cash:write, customers:write | `packages/shared/src/index.ts:858` |
| warehouse | catalog:read, inventory:write, purchase:write | `packages/shared/src/index.ts:859` |
| support | catalog:read | `packages/shared/src/index.ts:861` |

## Nota

- Para el rol `support`, `apps/api/src/auth.ts:118` usa esta lista (`rolePermissions.support`); para los demás roles usa `user.role.permissions` de la base de datos.
- Los roles guardados en la base de datos no se ven en el código de esta lista: `NO ENCONTRADO` fuera de este objeto. Revisar seeds antes de dar la lista como completa.
