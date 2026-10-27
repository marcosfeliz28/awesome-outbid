# AT-06: credencial compartida de la operadora de la plataforma

Estado: diseño, sin código. Base: rama `claude-pc/cola2-26oct` (commit b0978950). Hallazgo medio de `docs/qa/AUDITORIA_TOTAL_27OCT.md` (rama `chatgpt-nube/auditoria-total-27oct`, commit 00e75d78; el archivo no está en esta base). Las líneas citadas son de esta base.

## 1. Problema

Toda la operación de la plataforma (alta de empresas, invitaciones, cobros, anulaciones, reenvío de claves y apertura de soporte) se autoriza con un único secreto compartido. Quien tenga el token actúa como cualquier operadora.

| Dónde | Qué pasa |
|---|---|
| `apps/api/src/platform.ts:55` | Un solo hash `PLATFORM_ADMIN_TOKEN_SHA256` del entorno decide el acceso. |
| `apps/api/src/platform.ts:58` | `PLATFORM_ADMIN_TOKEN_SHA256_NEXT` acepta un segundo token, pero sigue siendo global (rotación, no identidad). |
| `apps/api/src/platform.ts:54-69` | `authorizePlatform` solo compara el token (con `timingSafeEqual`, bien) y el límite es por IP (`:60`, `:66`). No hay identidad de persona en ningún punto. |
| `apps/api/src/platform.ts:17, 23, 32-33` | La «operadora» es un texto libre del cuerpo de la petición (`operadora`). Se valida en longitud, no en identidad. |
| `apps/api/src/platform.ts:37-40, 123-124, 250` | Las invitaciones guardan ese texto libre en la bitácora de la empresa (`AuditLog`, `userId: "platform"`). |
| `apps/api/src/platform.ts:207, 214-219` | Reenvío de clave: la atribución sale de la variable de entorno `PLATFORM_OPERATOR_LABEL` (una sola para todo el despliegue) y se escribe en `AuditLog` como `plataforma:<etiqueta>`. Además imprime en consola. |
| `apps/api/src/platform-billing.ts:81, 148` | Pagos y anulaciones: `operator` = `PLATFORM_OPERATOR_LABEL`, no quien opera. Se guarda en `PlatformPayment.operator` (`:121`, `:159`). |
| `apps/api/src/platform-billing.ts:169` | Consola: «pago anulado ... por ${operator}». |
| `apps/api/src/support-access.ts:126-128, 129, 137-139` | **El caso más grave.** `support-session` abre una sesión de lectura de 15 min dentro de una empresa con el token compartido. La «operadora» y el «motivo» son texto libre del cuerpo; el registro de la empresa a nombre de la cuenta `support`, no de la persona. |
| `apps/api/src/support-access.ts:109-111` | `support-grants` lista qué empresas tienen soporte abierto, con el mismo token. |
| `apps/api/src/app.ts:170` | Las rutas `/api/platform/...` se saltan el guard general (`@Public()`). La única barrera es `authorizePlatform`: cada ruta nueva debe llamarla o queda abierta. |
| `apps/web/src/PlatformPanel.tsx:11-22, 93-99` | El token vive en `sessionStorage` y viaja en `Authorization: Platform <token>`. Se abre `support-session` desde `:584-592` con el texto libre de operadora. |
| `render.producto.yaml:62-63` | El hash vive en Render (`sync: false`). Rotarlo corta a todas las personas que lo usen. |
| `scripts/plataforma-crear-empresa.mjs:33` | Script que usa el mismo token. |
| `apps/api/scripts/review-product-billing.ts:87`, `platform-billing-panel.ts:201` | Vía paralela: `PLATFORM_BILLING_DATABASE_URL`, un login de base de datos aparte (`docs/producto/COBRO_TRANSFERENCIA_OPERACION.md:16`). No pasa por el token, así que el diseño debe cubrirla también. |

Consecuencias concretas:
1. Dos personas con el mismo token no se distinguen. La bitácora dice lo que escriba cada una, no quién es.
2. Retirar acceso a una persona obliga a rotar el secreto de todas.
3. El token es estático y no caduca; no hay segundo factor.
4. Hoy hay una sola operadora (la dueña), así que el riesgo es latente. Debe resolverse **antes de dar acceso a una segunda persona**.

## 2. Diseño del arreglo

### 2.1 Credencial por persona
- Nueva tabla de plataforma `PlatformOperator`: `id`, `name`, `email`, `role` (`owner` | `operator` | `billing_reviewer`, a decidir), `tokenHash` (SHA-256 de un token aleatorio de 32 bytes; nunca el token en claro), `tokenExpiresAt`, `lastUsedAt`, `active`, `createdAt`, `revokedAt`.
- Cada persona recibe su token una sola vez al crearla. El panel lo muestra y no lo vuelve a mostrar.
- La autorización busca el hash en la tabla, comprueba `active` y `tokenExpiresAt`, y devuelve el operador. Ese `id` reemplaza a todo texto libre.
- Alternativa de mayor garantía (ver decisión D1): login por persona con contraseña + TOTP y sesión corta (15 min) en el mismo esquema `Platform`.

### 2.2 Identidad en la bitácora (sustituye el texto libre)
- `operadora` deja de aceptarse en el cuerpo (`platform.ts:17, 23, 32-33`, `replaceInvitation`). Se toma del operador autenticado.
- `PLATFORM_OPERATOR_LABEL` se elimina del código (`platform.ts:207`, `platform-billing.ts:81, 148`). Cada escritura usa `operator.id` y `operator.name`.
- `PlatformPayment.operator` pasa a guardar el id del operador, con migración que conserva el valor antiguo en una columna aparte.

### 2.3 Bitácora de uso (nueva)
- Tabla `PlatformAccessLog`: `operatorId` (nulo si el token no coincide), `route`, `method`, `tenantSlug` (si aplica), `outcome` (`ok` | `denied` | `rate_limited`), `ip`, `userAgent`, `at`.
- Se escribe en `authorizePlatform` para cada intento, también los fallidos.
- Las acciones que ya tienen bitácora (pago, anulación, invitación, reenvío, soporte) añaden `operatorId` en su fila actual.
- Retención y acceso: decisión D5.

### 2.4 Rotación
- Token por persona con caducidad (propuesta: 90 días). Rotación por la propia persona desde el panel, o por la owner.
- El `PLATFORM_ADMIN_TOKEN_SHA256` global pasa a ser solo **de recuperación** (break-glass): fuera de uso diario, guardado con dos personas, con alerta cada vez que se use. Se mantiene `_NEXT` para su propia rotación.

### 2.5 Revocación
- `active=false` o `revokedAt` surte efecto en la siguiente petición (sin caché). Revocar a una persona no toca a las demás.
- Revocar también invalida cualquier sesión de soporte abierta por esa persona (la sesión de 15 min expira sola, pero se bloquean las nuevas).
- Notificación a la owner por `platform-notify.ts` al crear, revocar o rotar un operador, y ante ráfagas de `denied`.

### 2.6 Soporte
- `support-session` exige una referencia de ticket (no texto libre) y guarda `operatorId` en la bitácora de la empresa (`support-access.ts:137-139`).
- Decisión D6: si la empresa recibe aviso al abrirse soporte.

### 2.7 Cierre de la vía paralela
- `PLATFORM_BILLING_DATABASE_URL`: documentar quién custodia el login de base de datos y rotarlo al cambiar de persona.
- El revisor de los scripts de cobro sale de `NEXORA_BILLING_OPERATOR_ID` (`apps/api/scripts/review-product-billing.ts:86`, `platform-billing-panel.ts:202`), un texto de entorno sin verificar. Debe pasar a ser el id del operador autenticado (ver D7).

## 3. Riesgos

| Riesgo | Mitigación |
|---|---|
| Bloquear a la owner fuera del panel (token nuevo mal guardado). | Break-glass con dos personas; probar login antes de quitar el token global. |
| Olvidar una ruta `@Public()` sin `authorizePlatform` (`app.ts:170`). | Prueba automática: cada ruta de `/api/platform` responde 401 sin token válido. |
| Migración de pagos antiguos con `operator` en texto. | Columna nueva; el valor antiguo se conserva tal cual. |
| Rate limit por IP: un atacante detrás de un proxy comparte IP o la evade. | Revisar `clientIp` (`rate-limit.ts:153`) con el proxy de Render; límite también por identificador de token. |
| Token por persona guardado en `sessionStorage`: un XSS en el panel lo expone. | Mantener CSP; caducidad corta; valorar TOTP (D1). |
| Rompe pruebas y scripts existentes. | Actualizar `tests/platform-token-rotation.test.ts`, `tests/product-platform-*-postgres.test.ts`, `tests/e2e/plataforma-*.spec.ts`, `scripts/plataforma-crear-empresa.mjs`. |
| Mezclar cambios de identidad con la corrección de AT-01 (anulaciones). | Ramas separadas. |
| Operadora revocada conserva datos en su navegador. | `sessionStorage` se borra al cerrar pestaña; revocación en servidor es la barrera real. |

## 4. Pasos de implementación (orden)

Ninguno se hace sin aprobación de la owner en las decisiones de la sección 5.

1. **Decisiones D1 a D6** (sección 5). Sin ellas no se escribe código.
2. **Migración de datos:** tablas `PlatformOperator` y `PlatformAccessLog`; columna `operatorId` en `PlatformPayment` y en las filas de `AuditLog` de plataforma. Solo aditiva. Archivos: `apps/api/prisma/schema.prisma` y carpeta de migraciones.
3. **Autorización por persona:** reescribir `authorizePlatform` (`platform.ts:54-69`) para buscar el operador por hash y registrar `PlatformAccessLog`. Mantener el token global como break-glass tras su propio flag. Devolver el operador en la petición.
4. **Quitar el texto libre:** `invitationAction`, `invitedTenant` y `replaceInvitation` (`platform.ts:17-33, 227-253`) toman el operador autenticado; eliminar `PLATFORM_OPERATOR_LABEL` en `platform.ts:207` y `platform-billing.ts:81, 148`.
5. **Soporte:** `openInput` (`support-access.ts:85`) exige ticket; `support-session` (`:126-143`) guarda `operatorId`.
6. **Gestión de operadores:** rutas `POST/GET /api/platform/operators`, rotación y revocación. Añadirlas a la lista de `app.ts:170` solo si necesitan ser públicas (no deberían).
7. **Panel web:** pantalla de operadoras (alta, rotar, revocar) y uso del nuevo token en `PlatformPanel.tsx`. Quitar el campo de operadora (`:565, 614-616`).
8. **Script y despliegue:** `scripts/plataforma-crear-empresa.mjs` con el token de la persona; `render.producto.yaml` sin `PLATFORM_OPERATOR_LABEL`; nota de rotación en la documentación operativa.
9. **Pruebas:** unitarias para `authorizePlatform` (token válido, revocado, caducado, `_NEXT`, `denied` registrado); integración con Postgres en las pruebas `product-platform-*`; prueba de que toda ruta `/api/platform` exige token; e2e del panel.
10. **Validación de producción:** fuera de este ciclo. Requiere despliegue y lo decide la owner.

## 5. Decisiones que requiere la dueña

- **D1. Mecanismo de identidad:** (a) token por persona con caducidad, más sencillo; (b) contraseña + TOTP por persona, más fuerte, recomendado si habrá más de una persona; (c) identidad externa (p. ej. acceso de Google o Cloudflare Access). Recomendación: (b).
- **D2. Personas y roles:** quiénes tendrán acceso, con qué nivel (solo lectura, cobros, administración de operadoras). Hace falta al menos la owner y, si aplica, la segunda persona.
- **D3. Caducidad y rotación:** 90 días propuestos; ¿quién recibe la alerta de rotación pendiente?
- **D4. Break-glass:** quién guarda el token global de recuperación, dónde (sobre sellado, dos personas) y cuándo se usa.
- **D5. Retención de `PlatformAccessLog`:** tiempo de conservación (propuesta: 12 meses) y quién puede consultarla. Sin datos personales de clientes en la bitácora.
- **D6. Aviso a la empresa:** ¿se avisa a la empresa cada vez que se abre soporte con la sesión de plataforma?
- **D7. Revisor de cobros:** `NEXORA_BILLING_OPERATOR_ID` y la vía `PLATFORM_BILLING_DATABASE_URL`: ¿se unifican con el nuevo operador o se mantienen separados?
- **D8. Calendario:** el arreglo debe quedar antes de dar acceso a una segunda persona. ¿Esa fecha es fija?

## 6. Alcance de esta entrega

Solo este documento. No se cambió código, no se desplegó nada, no se tocó Render ni producción, no se usaron credenciales.
