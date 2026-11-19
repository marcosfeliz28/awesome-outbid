Borrador sin verificar, hecho por script (grep sobre origin/nexora-cloud, solo lectura). Generado: 2026-10-29.

# Permisos de la API (por @Permit)

ADVERTENCIA: lista de inventario, NO completa. No la uses para decisiones de seguridad hasta que alguien la compruebe contra todas las rutas.

| Permiso | Usos (archivo:línea) |
|---|---|
| `*` | 40: apps/api/src/admin.ts:840, apps/api/src/admin.ts:900, apps/api/src/admin.ts:936 … |
| `alerts:write` | 3: apps/api/src/alerts.ts:841, apps/api/src/alerts.ts:876, apps/api/src/alerts.ts:937 |
| `authenticated` | 10: apps/api/src/auth.ts:644, apps/api/src/auth.ts:791, apps/api/src/auth.ts:813 … |
| `cash:write` | 8: apps/api/src/cash.ts:760, apps/api/src/cash.ts:839, apps/api/src/cash.ts:951 … |
| `catalog:read` | 15: apps/api/src/admin.ts:821, apps/api/src/admin.ts:1332, apps/api/src/catalog.ts:232 … |
| `catalog:write` | 9: apps/api/src/catalog.ts:196, apps/api/src/catalog.ts:237, apps/api/src/catalog.ts:266 … |
| `customers:erase` | 1: apps/api/src/admin.ts:352 |
| `customers:write` | 3: apps/api/src/admin.ts:251, apps/api/src/admin.ts:277, apps/api/src/admin.ts:296 |
| `expense:write` | 6: apps/api/src/admin.ts:643, apps/api/src/admin.ts:646, apps/api/src/admin.ts:656 … |
| `gv:read` | 7: apps/api/src/gv-citas.ts:317, apps/api/src/gv-citas.ts:350, apps/api/src/gv-citas.ts:477 … |
| `gv:reports` | 1: apps/api/src/gv.ts:520 |
| `gv:verify` | 1: apps/api/src/gv.ts:448 |
| `gv:write` | 11: apps/api/src/gv-citas.ts:366, apps/api/src/gv-citas.ts:408, apps/api/src/gv-citas.ts:452 … |
| `inventory:write` | 9: apps/api/src/inventory.ts:639, apps/api/src/inventory.ts:1487, apps/api/src/inventory.ts:1496 … |
| `promotions:write` | 3: apps/api/src/admin.ts:1341, apps/api/src/admin.ts:1387, apps/api/src/alerts.ts:905 |
| `purchase:write` | 7: apps/api/src/admin.ts:568, apps/api/src/admin.ts:577, apps/api/src/admin.ts:588 … |
| `reports:read` | 9: apps/api/src/cashier-survey.ts:39, apps/api/src/formal-report.ts:43, apps/api/src/income-report.ts:293 … |
| `sale:manage` | 13: apps/api/src/courier.ts:120, apps/api/src/courier.ts:162, apps/api/src/incentives.ts:744 … |
| `sale:write` | 20: apps/api/src/admin.ts:739, apps/api/src/admin.ts:745, apps/api/src/admin.ts:803 … |

Rutas: NO ENCONTRADO por archivo (el prefijo de cada controlador se define fuera del decorador; ver tarea 16 de la cola).
