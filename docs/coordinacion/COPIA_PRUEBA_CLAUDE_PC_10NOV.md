# Copia de prueba de Nexora POS · informe de Claude PC (10-nov)

Base: `origin/nexora-cloud` @ `2ef2e364` (worktree aparte; el checkout de `claude-pc/fix-costo-permiso` no se tocó).

## Estado
- `pnpm install --frozen-lockfile`: OK (50,8 s).
- PostgreSQL local vacío en `127.0.0.1:5452` (`FITSTORE_DB_DIR=.local-db-prueba`, zona horaria UTC). No es producción.
- `pnpm db:generate`, `db:migrate` (todas aplicadas, incluida `202611090001_baja_cliente`), `db:seed`: OK. Semilla: 60 productos, 228 variantes, 4 usuarios demo, 3 proveedores, 850 ventas.
- API en `http://127.0.0.1:3001/api` (Nest). Web en `http://localhost:5173` (Vite).
- Login verificado para `cajera.test` y `gerente.sucursal-b` (token emitido).
- IA de ventas apagada: `GET /api/assistant/status` → `enabled:false`, falta la clave del proveedor. `ANTHROPIC_API_KEY` vacía.
- No se tocó Render ni la tienda en vivo. No se commitearon credenciales.

## Usuarios de prueba (claves inventadas, solo locales)
| usuario | rol | sucursal |
|---|---|---|
| cajera.test | seller | main |
| gerente.test | manager | main |
| admin.test | admin | main |
| duena.test | admin | main |
| gerente.sucursal-b | manager | sucursal-b |

Las claves y PIN se entregaron a Marcos en el chat; no están en este archivo.
Nota: en el código no existe rol "dueña"; `duena.test` usa el rol `admin`.

## Límites conocidos
- `apps/api/src/main.ts:79` y `apps/web/vite.config.ts` (y el script `dev` del web) escuchan en `0.0.0.0`. Para la web se forzó `127.0.0.1` por CLI; la API no tiene override y queda en `0.0.0.0:3001`. Se recomienda cambiar a `127.0.0.1` antes de compartir la copia.
- `sucursal-b` no tiene fila propia en la base (`branchId` es texto); el aislamiento se prueba con su usuario.

## Para la prueba de intrusión
- Solo localhost. Ningún servicio expuesto a internet.
- Las IA trabajan sobre capturas, rutas y respuestas copiadas a mano.
