# Prueba real de respaldo y restauración (9 de octubre de 2026)

Base de código: `origin/nexora-chatgpt` en `40f4cb0`. No se tocó producción ni Render, ni se modificó código del repositorio. Todo se ejecutó en un clúster PostgreSQL temporal propio (127.0.0.1:5733), con bases `nx_a` (origen), `nx_b` (restauración) y `nx_c_*` (prueba negativa), y sin cargar archivos `.env` de otros agentes.

Limitación: el servidor fue **PostgreSQL 16.14** del sistema (el embebido del repo es 18 y no corre como root; Render documenta 17). `pg_dump`/`pg_restore` 16.14 coinciden con el servidor. Falta repetir con PG 17 en un entorno cercano a Render.

## Resultados

| Paso | Resultado | Tiempo |
|---|---|---|
| Migrar A (`prisma migrate deploy`, 27 migraciones) | OK | 3,6 s |
| Sembrar A (`db:seed`: 846 ventas históricas) | OK | 5,7 s |
| Compilar API (`tsc`) y arrancar contra A | `/api/health` OK | 9,8 s compilar |
| Datos reales por HTTP (API compilada) | 12 ventas, 2 devoluciones (una con reingreso, una dañada), ajustes de inventario con lote, 1 caja abierta, cuadrada y cerrada (esperado = contado = 4 512,00) | ~2 s |
| `scripts/backup.mjs` | `.dump` custom 430 294 B, `pg_restore --list` OK, `.sha256` y `.json` creados; `sha256sum -c` OK | 0,34 s |
| Restaurar en B nueva (`pg_restore --no-owner --no-privileges --exit-on-error`) | exit 0 | 0,31 s |
| Comparar A vs B | 44 tablas con conteos idénticos; sumas idénticas; MD5 por contenido idéntico en 8 tablas | < 1 s |
| `prisma migrate status` contra B | "Database schema is up to date!" (27 migraciones) | 2,6 s |
| API compilada contra B (puerto 5745) | health OK, login admin OK, `GET /sales` y `/cash-sessions` devuelven los datos | arranque < 7 s |
| Negativa: dump truncado (50 %) en C | `pg_restore` exit 1: "could not read from input file: end of file" | 0,15 s |
| Negativa: dump con 4 KiB corruptos en C | exit 1: "could not uncompress data: invalid code lengths set" | 0,12 s |
| Negativa: dump de 200 bytes en C | exit 1, C queda sin tablas | 0,01 s |
| A y B tras las negativas | hash por contenido y conteos sin cambios | n/a |

Comparación A vs B (idéntica):

| Métrica | A | B |
|---|---|---|
| Sale (filas) / SUM(total) | 858 / 2 419 648,00 | 858 / 2 419 648,00 |
| SaleItem / Payment / SaleReturn | 1 704 / 858 / 2 | 1 704 / 858 / 2 |
| InventoryMovement (filas) / SUM(qty) | 1 936 / 4 253 | 1 936 / 4 253 |
| CashSession cerradas: esperado / contado / diferencia / apertura | 4 512 / 4 512 / 0 / 500 | 4 512 / 4 512 / 0 / 500 |
| Secuencia `RealtimeEvent_id_seq` | 245 | 245 |

Nota: tras arrancar la API contra B y hacer login, B tiene +1 en AuditLog, AuthSession y RefreshToken respecto a A. Es el login de la comprobación, no pérdida de datos; las tablas de negocio no cambiaron.

## Hallazgos (sin corregir, por indicación)

1. **`pg_restore --list` no detecta un dump truncado.** El dump a 50 % pasa `--list` con exit 0 porque el índice (TOC) está al inicio del archivo; la verificación de `scripts/backup.mjs:103` (y `deploy/render/backup/render-backup.mjs:107`) detecta corrupción del TOC, no de los datos. En esta prueba lo que rechaza el archivo malo es el SHA-256 (que no coincide) y, si se ignora, `pg_restore` falla al leer los datos. Conclusión: el SHA-256 del manifiesto debe comprobarse **antes** de restaurar; hoy ningún script del repo lo hace (hay que ejecutar `sha256sum -c` o equivalente a mano). Sugerencia: documentarlo en `docs/DEPLOY-RENDER.md` y/o añadir un script de restauración que lo verifique.
2. **La restauración fallida deja un esquema parcial.** Con `--exit-on-error` pero sin `--single-transaction`, el dump truncado/corrupto dejó 44 tablas vacías en C. No toca otras bases, pero la base destino no queda limpia. Con `--single-transaction` la misma restauración corrupta dejó 0 tablas (atómica). El comando de `docs/DEPLOY-RENDER.md:259` (formato directorio) no incluye esa opción; `--single-transaction` no es compatible con `--jobs`.
3. Menor: `scripts/backup.mjs:103` ejecuta `pg_restore --list` con `stdio: "inherit"`, por lo que vuelca el índice completo (~200 líneas) en la salida del respaldo.

## Comandos usados

```bash
# Preparación
git fetch origin
git worktree add -b claude/restore-evidence $S/wt-restore origin/nexora-chatgpt
cd $S/wt-restore && pnpm install --frozen-lockfile

# Clúster propio (como usuario postgres; no puede correr como root)
P=/usr/lib/postgresql/16/bin; D=/tmp/nx-restore-pg
runuser -u postgres -- $P/initdb -D $D/data -U nexora --auth=trust --encoding=UTF8
runuser -u postgres -- $P/pg_ctl -D $D/data -o "-p 5733 -c listen_addresses=127.0.0.1 -c unix_socket_directories=$D -c timezone=UTC" -l $D/pg.log -w start

# 1. Migrar y sembrar A
P=/usr/lib/postgresql/16/bin; $P/createdb -h 127.0.0.1 -p 5733 -U nexora nx_a
export DATABASE_URL='postgresql://nexora@127.0.0.1:5733/nx_a?options=-c%20TimeZone%3DUTC'
export SEED_DEMO_PASSWORD=<clave de prueba> JWT_SECRET=<aleatorio de 32+ caracteres> PORT=5744 WEB_ORIGIN=http://localhost:5173
pnpm db:generate && pnpm db:migrate && pnpm db:seed

# 2. API compilada y datos reales (script externo al repo con fetch; login, POST /terminals/register
#    y /approve, /products, /inventory/adjustments, /cash-sessions/open, /sales x12, /returns x2, /cash-sessions/:id/close)
pnpm --filter @fitstore/api build
(cd apps/api && node dist/main.js &)    # se guardó el PID para matarlo al final
node drive.mjs

# 3. Respaldo
NEXORA_BACKUP_DIR=$S/bk node scripts/backup.mjs
(cd $S/bk && sha256sum -c *.sha256 && pg_restore --list *.dump | grep -c "TABLE DATA")

# 4. Restaurar en B y comparar
$P/createdb -h 127.0.0.1 -p 5733 -U nexora nx_b
$P/pg_restore --no-owner --no-privileges --exit-on-error -h 127.0.0.1 -p 5733 -U nexora --dbname=nx_b $S/bk/nexora-nx_a-*.dump
# conteos por tabla, SUM(Sale.total), SUM(InventoryMovement.qty), cierres de caja y md5(string_agg(fila::text)) por tabla
# con psql sobre nx_a y nx_b, y diff de las salidas
DATABASE_URL=...nx_b... (cd apps/api && npx prisma migrate status)
DATABASE_URL=...nx_b... PORT=5745 node apps/api/dist/main.js    # health, login, GET /sales

# 5. Negativas
head -c $((N/2)) dump > trunc.dump; head -c 200 dump > head200.dump
# corrupt.dump: 4096 bytes invertidos (XOR 0xFF) a 1/3 del archivo
$P/createdb ... nx_c_trunc   # idem nx_c_corrupt, nx_c_head200, nx_c_single
$P/pg_restore --no-owner --no-privileges --exit-on-error --dbname=nx_c_<x> <x>.dump          # exit 1
$P/pg_restore --single-transaction ... --dbname=nx_c_single corrupt.dump                      # exit 1, 0 tablas
sha256sum <x>.dump   # no coincide con el .sha256 del respaldo
```

`$S` es el directorio temporal de la sesión; las contraseñas y secretos usados son de prueba y no se guardan en el repositorio.
