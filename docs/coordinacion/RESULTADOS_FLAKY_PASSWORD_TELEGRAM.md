# Resultados · intermitentes de password-account y telegram (7-nov-2026)

Rama `claude-pc/flaky-password-telegram`. No se tocó dinero ni precios, no se mezcló a nexora-cloud ni se desplegó.

## 1. password-account · «dos cambios simultáneos de la propia contraseña»

**Síntoma en CI:** `expected [ 400, 401 ] to include 404` (job 128262422830, run 42326350204 intento 1; job 128359993464, run 42356747114 intento 2). Nota: en el run 42318323879 el registro que da GitHub muestra esta prueba en verde; ese run falló por `respaldo-drive` en e2e (otra rama).

**Causa raíz (defecto de producción, autenticación):** el cambio de contraseña que gana borra las filas `AuthAttempt` de la cuenta (`login:<id>:…`, `login-account:<id>:`) dentro de su transacción, sin el candado consultivo de `verifyAttempt`. Si ese borrado se confirma entre el `upsert` y el `update` del intento del perdedor, `tx.authAttempt.update` lanza P2025 y el filtro de errores responde 404 («El registro no existe.») en vez de 400. Traza local con un registro temporal: `security.ts:221`, `No record was found for an update`, modelo `AuthAttempt`.

**Arreglo (`apps/api/src/security.ts`):** los reinicios a cero usan `updateMany` (fila borrada = ya está en cero) y el cupo de la cuenta usa `upsert` (el fallo sigue contando aunque la fila haya desaparecido). Sin SQL nuevo ni cambio de mensajes.

**Regresión:** `tests/intentos-borrados.test.ts` (en `pnpm test`): `verify` borra las filas igual que el ganador. Antes: 2/2 fallan con P2025. Después: 2/2 pasan. Se añadió `updateMany` a los dobles de `auth-username` y `rate-limit-l1`.

## 2. telegram · «la purga borra los avisos enviados…»

**Síntoma en CI:** `Tiempo agotado esperando: aviso pendiente enviado` (job 128356379136, run 42356747114 intento 1). El Telegram falso no recibió nada después del cierre de caja.

**Causa raíz (prueba):** la prueba sembraba el aviso **pendiente** con `createdAt` de hace 40 días. La retención (`retention.ts`, V2-06) borra a propósito los pendientes de más de 30 días, y su primera vuelta corre **60 s después de arrancar cada API**. `withTg` arranca en el `beforeAll` y la purga es la última prueba del archivo: cuando el archivo pasa de ~60 s (CI lento: 92 s en el fallo, ~59 s cuando pasa), la retención de `withTg` borra el aviso antes de que salga. Volcado local en cada fallo: el aviso ya no existe (`[]`).

**Arreglo (`tests/telegram.test.ts`):** el pendiente se siembra con fecha de hoy y las APIs del archivo arrancan con `NEXORA_RETENTION=off`, así «borra el viejo» prueba la purga del trabajador y no la de retención. No se saltó ni se aflojó ninguna comprobación. El producto se comporta como está especificado.

## Corridas (local: PostgreSQL 16 del sistema, API dev en :3101, Node 24.22.2)

«Con carga» = 6 procesos al 100 % de CPU en 4 núcleos (simula el runner lento).

| Prueba                                            | Antes                         | Después   |
| ------------------------------------------------- | ----------------------------- | --------- |
| password «dos cambios», vitest ×30, sin carga     | 0/30                          | —         |
| password «dos cambios», vitest ×30, con carga     | **4/30** (404)                | **0/30**  |
| carrera aislada (guion, 2 sesiones a la vez) ×200 | **2/200** con 404             | **0/200** |
| telegram.test.ts completo ×30, con carga          | **20/30** (pendiente borrado) | **0/30**  |
| tests/intentos-borrados.test.ts                   | 2/2 fallan (P2025)            | 2/2 pasan |

Las suites `*-postgres` con Postgres embebido no corren en esta sandbox (`initdb` como root). `auth-lockout` (S-03) y `pin-otra-persona` agotan tiempo en esta sandbox **también con el `security.ts` original**: es del entorno local, no del cambio; CI las corre.

## Seguridad-20

1 y 18: sin llaves en el diff. 4: el bloqueo por intentos sigue contando (el cupo se recrea con `upsert`; un acierto sólo reinicia a cero). 16: sin SQL nuevo; las consultas siguen parametrizadas. 13 y 14: sin dependencias. 20: regresión que falla antes y pasa después. 2, 3, 5–12, 15, 17 y 19: no aplican (no cambian rutas, permisos, entradas, cabeceras ni variables de producción; `NEXORA_RETENTION` ya existía y sólo se usa en la prueba).
