# Seguridad en 20 puntos: auditoría de solo lectura

Fecha: 30-oct-2026. Base: `origin/nexora-cloud` (c9975b02). Rama de la auditoría: `claude/seguridad-20`. Skill: `.claude/skills/seguridad-20/SKILL.md`. Tarea T39 (orden de Norexos 1, prioridad alta).

Reglas de esta auditoría: no se cambió código; no se imprimió ningún valor secreto (solo archivo:línea y tipo de patrón); no se tocó producción (sin llamadas a la API ni a la base desplegadas). Cada fila dice qué se comprobó y con qué comando. Lo que no se pudo comprobar está escrito como **NO COMPROBADO**.

Gravedad: **alta** (detiene la mezcla), **media**, **baja**.

## Resumen

- **Hallazgo alto (1 grupo):** dependencias con denegación de servicio (punto 13). Avisado a Norexos 1 por mensaje el 30-oct con archivo:línea. Detiene la mezcla hasta corregirlo.
- **Hallazgo medio (1):** la extracción de fotos y PDF con la IA no tiene tope diario por usuario (punto 8).
- **Hallazgos bajos (2):** `$queryRawUnsafe` en cinco sitios (punto 16); el valor por defecto de CORS en entornos sin `NODE_ENV=production` es `localhost` (punto 10).
- **Sin hallazgo en código:** llaves en el código y en el historial (1, 18); XSS (7); rutas sin permiso (3); hashes (17).
- **NO COMPROBADO en vivo:** cabeceras de la tienda desplegada (11), `dist` del build (15), valores de Render. No se tocó producción.

## Tabla de 20 puntos

| # | Punto | Resultado | Evidencia y gravedad |
|---|---|---|---|
| 1 | Esconder llaves de API | **OK** | `git grep` con patrones fuertes (`sk-ant-[A-Za-z0-9_-]{20,}`, `AKIA…`, `ghp_…`, `github_pat_…`, `xox[bp]-…`, bloques PEM) en las 315 ramas remotas: 0 aciertos. Patrón suelto de nombres de llave con valor de 16+ caracteres: aparece solo en `tests/` y `docs/validacion/` (fixtures), 0 en `apps/`, `packages/`, `deploy/`, `scripts/`, `render.yaml`, `.env.example`. Ver también punto 18. **NO COMPROBADO:** los valores reales de Render y de producción (no es accesible ni se debe imprimir). |
| 2 | Variables de entorno | **OK** | `.env.example` lista solo nombres. `validateSecret` exige `JWT_SECRET` de 32 o más caracteres (`apps/api/src/security.ts:17`). `WEB_ORIGIN` es obligatoria en producción (`apps/api/src/main.ts:23-24`). Ningún `VITE_*` secreto: solo `VITE_SHOW_DEMO_CREDENTIALS`, que no está en `render.yaml` y solo se activa con el texto `"true"` (`apps/web/src/App.tsx:95-96`). Baja: `.env.example` y `render.yaml` no se cruzaron variable por variable; **NO COMPROBADO** el conjunto completo de Render. |
| 3 | Rutas de administración | **OK** | `node scripts/rutas-permisos.mjs`: `rutas=187 sinPermiso=0`. Rutas públicas (`@Public`): `health/live`, `login`, `change-password`, `refresh`, `google/callback` (retorno de Drive). El informe regenerado está en `docs/auditoria/RUTAS_Y_PERMISOS.md`. |
| 4 | Autenticación | **OK (parcial)** | Contraseñas con `bcryptjs`; sesión de refresco en cookie `httpOnly`, `secure` y `sameSite: strict`, con caducidad de 7 días (`apps/api/src/auth.ts:396-400`). Bloqueo por intentos: `apps/api/src/auth.ts` y `tests/auth-lockout.test.ts`. Cambio de contraseña inicial forzado al arrancar (`safelyForcePasswordChangeAtStartup` en `main.ts`). **NO COMPROBADO:** la vida del token de acceso y el límite de intentos del PIN de gerente en cada ruta. |
| 5 | Acceso por usuario | **OK (parcial)** | `safe()` recorta costos y ganancia (`apps/api/src/common.ts:367`), usado 33 veces en la API. La vendedora nunca ve costos aunque tenga `profit:read` (`common.ts:368-370`). Pruebas: `tests/caja-ciega-margen-api.test.ts`, `tests/mis-ventas-preguntas-postgres.test.ts`, `tests/ventas-caja-ciega-postgres.test.ts`. Las de Postgres no corren en este contenedor (ver nota). **NO COMPROBADO:** cada endpoint con usuario sin permiso (no se recorrieron los 187). |
| 6 | Formularios | **OK (parcial)** | Entradas con `parse(schema, body)` (192 usos de `parse(` en la API) y límite de JSON de 100 kb (`main.ts:45`) y 4 MB solo para la importación de GV (`main.ts:44`). Archivos: `imageType` en `admin.ts`. **NO COMPROBADO:** cada una de las 88 rutas con `@Body()` (el conteo no prueba que cada una valide). |
| 7 | XSS | **OK** | `git grep` de `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval(`, `new Function(` en `apps/` y `packages/`: 0 aciertos. |
| 8 | Límite de tasa | **HALLAZGO media** (IA) / **OK** (login, PIN) | Login: `apps/api/src/auth.ts:66-75` y `rate-limit.ts` (`REQUEST_RATE_LIMITS`). PIN: `rate-limit.ts` (`pinSession`, `auth/pin`). Recuperación pública: **no existe**; el administrador restablece con `POST users/:id/reset-password` (`admin.ts:1228`, `@Permit("*")`), así que no aplica. **Hallazgo media:** la extracción de fotos y PDF llama a Anthropic (`apps/api/src/invoice.ts:369`, `:397`) y solo captura `RateLimitError` (`:423`); no hay tope diario por usuario. |
| 9 | Endpoints seguros | **OK (parcial)** | Toda ruta mutable tiene `@Permit` (punto 3). Operaciones de dinero con `operationId` idempotente: 32 usos en `sales.ts`, `cash.ts`, `warehouses.ts`, `merchandise.ts`. Pertenencia por sucursal en las consultas (`branchId`). **NO COMPROBADO:** la auditoría (`audit`) de cada operación. |
| 10 | CORS | **OK** con **baja** | Origen explícito, `credentials: true`, nunca `*` (`apps/api/src/main.ts:48-49`). **Baja:** si `WEB_ORIGIN` no se define fuera de producción, el origen por defecto es `http://localhost:5173` (`main.ts:48`); en Render sí es obligatoria. |
| 11 | Cabeceras | **OK en código; NO COMPROBADO en vivo** | API: `app.use(helmet())` (`main.ts:41`). Web: `deploy/render/security-headers.conf` define CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`), HSTS de un año, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`. Se incluye en el bloque del servidor (`deploy/render/nginx.conf.template:59`) y en las ubicaciones con caché propia. **NO COMPROBADO:** la respuesta real de la tienda y de la API desplegadas; las reglas de la sesión prohíben tocar producción. |
| 12 | Modo debug y errores | **OK (parcial)** | `NODE_ENV=production` en `render.yaml:52-53`. `ENABLE_SWAGGER` es `"false"` en Render (`render.yaml:56-57`). El filtro de errores responde un mensaje genérico en los errores 500 (`apps/api/src/common.ts:776-800`). **NO COMPROBADO:** qué se escribe en los registros (solo se leyó el filtro). |
| 13 | Dependencias | **HALLAZGO alto** | `pnpm audit --prod`: 3 altas y 1 moderada (ver tabla abajo). Avisado a Norexos 1 por mensaje. |
| 14 | Paquetes sin uso | **OK (parcial)** | `npx depcheck` sobre `apps/api`: sin hallazgos. **NO COMPROBADO:** `apps/web` y `packages/*`. |
| 15 | Archivos expuestos | **OK (parcial)** | `apps/web/public` tiene 10 archivos, ninguno `.env`, `.git`, respaldo, `.sql`, `.map` ni llave. **NO COMPROBADO:** `dist` (no está en git; no se construyó en esta tarea) y las rutas `/.env` y `/.git/config` en vivo. |
| 16 | Base de datos segura | **HALLAZGO baja** | 147 usos de `$queryRaw` con plantilla etiquetada (parametrizados). Cinco usos de `$queryRawUnsafe`, contrarios a la regla de `Prisma.sql`: `apps/api/src/database-timezone.ts:41`, `:45` (SQL constante); `apps/api/src/gv-money.ts:186` y `:354` (interpolan `OWNER[kind].table`, con `kind` de un tipo cerrado, sin texto de usuario); `apps/api/src/inventory.ts:420` (valores por parámetro `$1`, `$2`). No hay inyección posible con los datos actuales, pero conviene cambiarlos a `Prisma.sql`. **NO COMPROBADO:** respaldos cifrados y su restauración (ver `tests/` de restauración). |
| 17 | Hashes | **OK** | Contraseñas: `bcryptjs` (`apps/api/src/auth.ts:15`); campo `passwordHash` (`apps/api/prisma/schema.prisma`). PIN: `pinHash: await passwordHash(...)` (`apps/api/src/admin.ts:1091`); hash ficticio para tiempo constante (`auth.ts`). Las respuestas se pasan por `redact` (`admin.ts`). |
| 18 | Secretos en git | **OK** | Patrones fuertes en las 315 ramas remotas y en todo el historial (`git log --all -G`): 0 commits. Los únicos aciertos sueltos son de fixtures de prueba con hosts ficticios (`db.internal`, `internal-db`): `tests/cloud-deploy.test.ts:170,187,219,1222,1247`, `tests/portabilidad.test.ts:734`, `tests/drive-backup-core.test.ts:577`. No es producción. **NO COMPROBADO:** si esos valores de fixture coinciden con alguna credencial real (no se imprimen). |
| 19 | Auditoría completa | **OK** | Este informe, fechado. Los hallazgos entran a `docs/coordinacion/PENDIENTES_NOCHE_30OCT.md` por Norexos 1 (esta tarea es solo lectura y no lo modificó). |
| 20 | Sin errores | **OK** | Cada fila lleva comando o archivo:línea. Lo no comprobado está marcado. Ningún hallazgo se corrigió aquí, así que no hay prueba nueva que añadir. |

## Hallazgo alto: dependencias (punto 13). Estado tras `claude/deps-seguridad`

Se corrigieron body-parser, multer y qs con `pnpm.overrides` en `pnpm-workspace.yaml` (commit `27346886`, rama `claude/deps-seguridad`): body-parser 2.4.0, multer 2.5.0 y qs 6.17.1. `pnpm audit --prod` baja a **un solo aviso: zod 3.25.76** (GHSA-mrhx-c7xc-m3w5, parche en 4.6.6). Se deja como tarea aparte (abajo). El detalle original se conserva en la tabla siguiente.

### Tarea aparte: zod 4.x (no urgente)

- **Qué:** actualizar zod de 3.25.76 a 4.6.6 o más. Declarado en `apps/api/package.json:35` y `packages/shared/package.json:12`.
- **Por qué no ahora:** zod 4 cambia la API de esquemas; hay que revisar los `parse(...)` de la API y de `packages/shared`.
- **Mitigación mientras tanto:** el cuerpo JSON ya tiene tope de 100 kb (`apps/api/src/main.ts:45`) y 4 MB solo para la importación de GV (`main.ts:44`), que limitan el tamaño de cualquier colección que llegue a zod. Pendiente: añadir límite de longitud a los arrays de los esquemas expuestos a la red (los que aceptan listas en el cuerpo), para que una colección grande se rechace antes de validarse.
- **Quién decide el despliegue:** Norexos 1 (toca la API; no se despliega sin CI verde y lectura de cajas).

### Detalle original (30-oct, antes del parche)

`pnpm audit --prod` (JSON), base `c9975b02`:

| Gravedad | Paquete | Versión en el lock | Vulnerable | Parche | Aviso | Dónde llega |
|---|---|---|---|---|---|---|
| alta | body-parser | 2.3.0 (`pnpm-lock.yaml:2337`, `:6983`) | <2.4.0 | 2.4.0 | GHSA-27r3-jxmh-p828 (DoS: bytes sobrantes tras cuerpo comprimido) | `apps/api/src/main.ts:44-45` (`jsonBodyParser`) vía express |
| alta | multer | 2.4.0 (`pnpm-lock.yaml:3673`, `:8378`) | <2.5.0 | 2.5.0 | GHSA-q7qp-rjg7-q26m (DoS: `fileFilter` pendiente tras cancelar) | transitiva de `@nestjs/platform-express` |
| alta | zod | 3.25.76 (`pnpm-lock.yaml:4840`, `:9746`) | <4.6.6 | 4.6.6 | GHSA-mrhx-c7xc-m3w5 (DoS: colecciones grandes con restricciones) | `apps/api/package.json:35`, `packages/shared/package.json:12` |
| moderada | qs | 6.16.0 (`pnpm-lock.yaml:3945`, `:8654`) | ≤6.16.0 | 6.16.1 | GHSA-6pq8-jhm2-2vcw (TypeError sin capturar en `stringify` con `arrayFormat: comma`) | transitiva de express y body-parser |

Propuesta: subir body-parser a ≥2.4.0 y multer a ≥2.5.0 (por override de pnpm o al actualizar express y `@nestjs/platform-express`), y tratar zod 4.x como tarea aparte porque cambia los esquemas. Hasta corregirlo, no mezclar a `nexora-cloud`.

## Notas de comprobación

- **Pruebas de Postgres:** en este contenedor 14 archivos de pruebas con Postgres embebido fallan porque `initdb` no corre como root. Las pruebas de la fila 5 que dependen de Postgres no se pudieron ejecutar aquí; se citan solo como existentes.
- **Lo que no se hizo:** no se llamó a la API desplegada ni a la base de producción, no se construyó `dist`, no se probó cada endpoint con un usuario sin permiso, y no se revisaron los registros del servidor.
