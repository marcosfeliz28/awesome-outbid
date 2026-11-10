# Levantamiento de todo lo que pidió DeepSeek (orden directa de la dueña, 10-nov-2026)

Objetivo: darle a DeepSeek TODO lo que exige su encargo (`ENCARGO_DEEPSEEK.md`) para una
auditoría hacker profunda sobre una copia de prueba, con el máximo de privilegios, y luego
corregir todos los fallos. Este documento recorre cada requisito del Expediente, pone el
valor real (sacado del código) donde ya se sabe, y marca qué produce el generador de
fixtures y qué necesita la copia corriendo.

## Decisión de privilegios (orden de la dueña)
- DeepSeek recibe el **máximo**: el código fuente completo (caja blanca), los 3 documentos,
  el Expediente relleno y cuentas de **todos los roles, incluido `admin`**, en la copia.
- **Único límite (no es desobediencia, es lo que protege a personas y dinero reales):** todo
  contra la **copia de prueba**, nunca contra producción; datos y credenciales **inventados**,
  nunca clientes/PIN/claves reales; sin claves de Anthropic/Google/Render reales. La copia se
  destruye y las credenciales se rotan al terminar. El pentest no necesita nada real para ser
  profundo.

## Cómo corre la copia de prueba (verificado en el código)
La app arranca local sin servicios externos:
`pnpm db:local` (Postgres local, `scripts/local-db.mjs`) → `pnpm db:migrate` →
`pnpm db:seed` (semilla base) → **`node scripts/fixtures-deepseek.mjs`** (lo construye el
worker: dos sucursales, todos los roles y todos los fixtures con IDs fijos) → `pnpm dev`
(API 3001 + web). Para que DeepSeek (chat en línea) la alcance hay que **exponerla**: túnel
desde la laptop (p. ej. un servicio de túnel) o un servicio de prueba en Render. Esa
exposición es el único paso que depende de la dueña/laptop.

---

## 3.1 — Cuentas por rol — las produce el generador de fixtures
La semilla base (`seed.ts`) solo crea 4 usuarios en una sucursal. El generador los amplía a
los 9 que pide DeepSeek, en 2 sucursales, con IDs y PIN fijos (clave de prueba única,
rotada al terminar). Roles reales de fábrica (`packages/shared`): `admin *`, `manager`,
`seller`, `warehouse`, `gv`, `gerente_gv`. Política de clave: `seller` = 6 dígitos; el resto
= 12+ fuerte (`password-policy.ts`). Cada fila del 3.1 queda lista cuando corre el generador.

## 3.2 — PINs de aprobación — los produce el generador
Gerente A, Gerente B (persona distinta), Dueña (autoaprueba) y un PIN corto antiguo de 4
dígitos para probar el aviso de "cámbialo". PIN de 6 dígitos (`admin.ts:208`).

## 3.3 — Terminales — las produce el generador
Uno aprobado (`approvedAt` + `secretHash`), uno pendiente, uno revocado, los tres con su
`id`, `registerNumber`, `cashierNumber`. Registro/aprobación con PIN: `realtime.ts`.

## 3.4 — Sucursales + IDs concretos — los produce el generador
Dos sucursales (`branchId` A y B) con IDs fijos para TODOS los objetos (ventas, clientes con
PII y anonimizado, productos con/sin costo, pagos, créditos, void requests, GV, rol custom,
usuarios). Son la munición de las capas 3-6 (IDOR, dinero, inyección, archivos): sin ellos la
auditoría se queda en teoría.

## 3.5 — Sesiones — LISTO (valores reales del código)
| Item | Valor real |
|---|---|
| Login | `POST /api/auth/login` `{login, password}` → `accessToken` + cookie `refresh_token` |
| Access token TTL | **15 min** (`auth.ts:410`, `expiresIn: "15m"`) |
| Refresh cookie | `maxAge` **7 días** (`auth.ts:400`); `HttpOnly`, `Secure`, `SameSite` |
| Timeout de inactividad | **30 min** por defecto, configurable (`auth.ts:359`, `common.ts:674`) |
| Revocación | el `AuthGuard` compara `payload.version` con `user.authVersion` (`common.ts:667`): cambiar clave/expulsar sube la versión e invalida los access token |
| Refresh | `POST /api/auth/refresh` con la cookie |

## 4 — Fixtures que deben existir — los produce el generador
Los 19 objetos del Expediente (venta con transferencia pendiente, venta a crédito con abono,
venta en espera, offline en conflicto, anulación pendiente, caja con descuadre, producto
con/sin costo, cliente PII/anonimizado, GV completo, comprobante subido, Excel válido, alerta
+ regla, gasto + proveedor, promoción, nota de crédito, kardex, vale de caja), cada uno con el
ID de la tabla 3.4.

## 5 — Configuración — LISTO (valores reales)
| Item | Valor real |
|---|---|
| Subida de logo | 1 MB (`admin.ts:912`) |
| Subida de comprobante de venta / GV | 2 MB (`PROOF_MAX_BYTES`, `gv-money.ts:251`) |
| Importación de catálogo (Excel) | 5 MB (`inventory-import.ts:44`) |
| Respaldo Drive | tope `DRIVE_BACKUP_MAX_BYTES` 2 GB por defecto |
| Límite de login | 30 fallos/hora por cuenta, bloqueo 5 intentos/15 min (`security.ts:42-50`) |
| Límite de PIN | 10/hora por solicitante; 30/hora PIN corto (`security.ts:51-56`) |
| Timeout de sesión | 30 min (ver 3.5) |
| `WEB_ORIGIN` obligatorio en prod | `main.ts:23-24`; `JWT_SECRET` ≥ 32 (`security.ts:17`) |
| Drive / Telegram | desconectados en la copia — no tocar terceros |

## 6 — Infra / ops — depende de dónde corra la copia
Snapshot + restauración: `pnpm backup` (`scripts/backup.mjs`) para la copia local, o snapshot
de Render si se despliega. Reinicio: `pnpm dev`. Rotación de credenciales demo: al terminar,
reseed con clave nueva. La dueña/laptop elige: **(A) laptop con túnel** o **(B) servicio de
prueba en Render** (N1 lo puede montar si la dueña confirma el workspace y el costo).

## 7 — Guardia y palabra STOP
Guardia = la dueña (y N1 como coordinación). "STOP" en el chat de DeepSeek corta en ≤ 60 s.
Ventana: la que fije la dueña. Sin franjas de producción porque la copia está aislada.

---

## Estado y lo que falta (un solo paso externo)
- **Listo ya:** secciones 3.5 y 5 (valores reales), ENCARGO y plantilla, código completo para
  entregar, límite de privilegios definido.
- **Lo construye el worker (en marcha):** `scripts/fixtures-deepseek.mjs` (2 sucursales, 9
  roles, 19 fixtures con IDs fijos) + el Expediente relleno con esos IDs + el paquete máximo.
- **Único paso de la dueña/laptop:** decidir dónde corre la copia para que DeepSeek la alcance
  (laptop con túnel, o Render de prueba montado por N1). Sin eso, DeepSeek no tiene a qué
  conectarse, por más completo que esté el resto.
