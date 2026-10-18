# Área 4 — Datos, migraciones y respaldo

- **Base auditada:** `origin/nexora-cloud` en `cf6f7022ab9682db45327558e5dd18946a7b1473`.
- **Alcance:** `apps/api/prisma/schema.prisma`, migraciones, `apps/api/src/database-timezone.ts`, `scripts/backup.mjs`, `scripts/restore.mjs` y `apps/api/src/retention.ts`.
- **Comandos:** `git fetch origin`; `pnpm install --frozen-lockfile` (terminó correctamente, pnpm 11.19.0); `pnpm exec vitest run tests/db-zona-horaria.test.ts` (1 archivo, 4 pruebas aprobadas); búsquedas estáticas `rg` de SQL crudo, tipos de fechas, DDL destructivo y protecciones de migración.
- **Límite de ejecución:** no leí `.env`, no usé credenciales ni conecté a ninguna base. Por ello no ejecuté migraciones sobre PostgreSQL vacío/hostil ni `pg_restore` real. Esos resultados constan como no verificados.

## Hallazgos

| ID | Severidad | Evidencia | Qué pasa / reproducción mínima | Propuesta (no aplicada) | Prueba que debería fallar hoy |
|---|---|---|---|---|---|
| D-01 | MEDIO · **SIN REPRODUCIR** | `apps/api/prisma/migrations/202610210003_datos_privacidad/migration.sql:19-25`; `apps/api/src/retention.ts:148-163`; `apps/api/prisma/schema.prisma:811-821` | La migración captura cualquier error al agregar `AuthAttempt.updatedAt` y emite `NOTICE` sin abortar. La retención usa esa columna en la consulta de purga. Si el `ALTER TABLE` excede el `lock_timeout` o falla por otro motivo, la migración puede quedar registrada como aplicada sin la columna y la limpieza de intentos fallará en cada ejecución. **No reproducido en PostgreSQL** por la prohibición de usar credenciales/DB; es un riesgo derivado del flujo de errores del código, no un fallo confirmado. | Añadir una verificación pos-DDL que haga explícito el estado pendiente y un procedimiento automático/repetible que confirme columna y trigger; no silenciar una migración incompleta como exitosa sin dejar un estado observable/accionable. | En PostgreSQL descartable, mantener un lock que exceda 15 s sobre `AuthAttempt`, ejecutar la migración y comprobar el estado de `_prisma_migrations`, presencia de `updatedAt` y resultado de la purga. |
| D-02 | BAJO · **SIN REPRODUCIR** | `scripts/restore.mjs:5-8,20-26`; `scripts/backup.mjs:147-164` | El comando documenta que la URL debe ser una base nueva/vacía, pero acepta cualquier URL PostgreSQL y pasa su host/base directamente a `pg_restore`; tampoco comprueba que el destino esté vacío. Con el modo por defecto, una transacción única protege contra objetos parciales si el restore falla; `--jobs > 1` explícitamente pierde esa atomicidad. No se apuntó a ninguna base y no se comprobó el efecto real. | Antes de restaurar, validar que el destino está vacío (o exigir confirmación separada y explícita si se diseña restauración sobre una base existente); deshabilitar `--jobs > 1` salvo destinos descartables validados. | En una base PostgreSQL descartable con una tabla preexistente no conflictiva, invocar el script con dump válido y comprobar si modifica objetos/datos; repetir con `--jobs 2` e inyectar fallo para observar residuos. |

## Controles comprobados por lectura

- El `restoreDump` normal usa `--single-transaction` y `--exit-on-error`; el comentario documenta que `--jobs` no es atómico y debe usarse solo en una base descartable (`scripts/backup.mjs:142-164`).
- El respaldo comprueba manifiesto, tamaño y SHA-256 antes de restaurar; el código documenta las limitaciones del modo paralelo (`scripts/backup.mjs:63-109,142-164`).
- Las migraciones de restricciones e índices recientes usan nombres comprobados, `IF NOT EXISTS` o bloques de excepción, `lock_timeout` y `NOTICE`; ello reduce bloqueos de despliegue, aunque el estado posterior requiere verificación (`202610210001_datos_indices/migration.sql`, `202610210002_datos_restricciones/migration.sql`).
- El código de arranque comprueba la zona horaria de sesión y emite advertencia si no es UTC (`apps/api/src/database-timezone.ts:1-58`); las cuatro pruebas unitarias de zona horaria pasaron.
- Las expresiones `make_interval` que revisé reciben constantes enteras o `retryAfter` convertido a número; no encontré otro caso demostrado de incompatibilidad bigint/int como la clase mencionada en la orden.

## No verificado

- No se aplicaron las migraciones sobre base vacía ni con filas hostiles; no se verificó `schema.prisma` contra el resultado físico de todas las migraciones.
- No se comprobó PostgreSQL 17 contra el PostgreSQL 18 local. No ejecuté `pnpm db:migrate`, `prisma migrate diff`, respaldo ni restauración real.
- D-01 y D-02 requieren las reproducciones PostgreSQL descritas antes de tratarlos como confirmados.

