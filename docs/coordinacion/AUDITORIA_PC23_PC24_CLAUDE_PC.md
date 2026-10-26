# Auditoría de PC-23 (cobro manual) y PC-24 (paquetes de IA) · Claude PC · 26-oct-2026 (solo lectura)

**Código auditado:** `origin/producto-nexora` en `8ae06d8d` (PC-23 `06847e33`, PC-24 `fd07ca16`, y `20f169eb`/`38ef3cf4` que usan su cuota). Lectura de código, migraciones y pruebas; **no se ejecutó nada**. No se tocó Render, ninguna base ni credenciales.

## Veredicto
| Punto | Veredicto |
|---|---|
| PC-24 · paquetes de IA y cuota mensual | **Aprobado**, con 4 observaciones menores |
| PC-23 · cobro manual del operador | **Corregir** (integridad de la anulación y pruebas que faltan; sin saltos de autorización ni datos de tarjeta) |

Lo que pidió Claude nube, directo: **nadie fuera de la dueña marca pagos: cumple. No queda ningún dato de tarjeta: cumple. Una empresa no usa la cuota de otra: cumple.**

## PC-23 · cobro manual (`platform-billing.ts`, `platform.ts`, migraciones de `PlatformPayment`)
**Quién puede marcar un pago: solo el operador de la plataforma ✔.**
- Las tres rutas (registrar, anular, consultar) son `@Public()` pero llaman a `authorizePlatform` (`platform.ts:54-69`, `platform-billing.ts:77,144,175`). Sin `PRODUCT_TENANCY=required` ni un hash válido responden 404.
- El token es `Platform` más 64 a 512 caracteres; se compara `sha256` contra los hashes guardados en el entorno con `timingSafeEqual` y recorre todos (rotación `_NEXT`). Límite de 5 fallos por IP.
- `Tenant` es de solo lectura para el rol de las empresas; solo el rol de facturación de la plataforma cambia plan o estado. Ninguna ruta de empresa cambia plan, estado ni vencimiento. `product-billing.ts` crea solicitudes con el monto fijado por el servidor y no activa nada; `activateTenant` no tiene llamadores. **Una empresa no puede marcar su factura pagada ni extender su prueba.**
- Prueba: 401 sin credencial y con el token de una empresa (`product-platform-billing-postgres.test.ts:114-118`).

**Sin datos de tarjeta ✔.** No hay columnas de tarjeta; la prueba escanea el esquema, el SQL y el código y fija la lista de columnas (`:253-270`). Los registros solo llevan el código de la empresa, los meses y la fecha. No hay subida de comprobante en PC-23: solo una referencia de texto libre (hasta 120 caracteres).

**Dinero.** Montos `numeric(12,2)` con `CHECK > 0`. El servidor exige monto = mensualidad × meses y el año vale 10 meses (`:37`, `:97`); **no hay pagos parciales, sobrepago ni prorrateo** (regla de negocio, hay que saberla). Idempotencia con `operationId` único y `FOR UPDATE` sobre la empresa; se rechaza una referencia vigente repetida. Sin fecha atrasada (el inicio sale del reloj del servidor). Un pago a una empresa suspendida la deja activa y extiende desde el máximo entre hoy y el vencimiento (no cobra los días vencidos). La anulación es una fila nueva con motivo, única por pago y con disparador de misma empresa: solo inserta.

**Aislamiento.** RLS con política de solo lectura; `REVOKE ALL` y `GRANT SELECT` solo al rol de las empresas; disparadores de inmutabilidad contra `UPDATE`, `DELETE` y `TRUNCATE`.

### Hallazgos (corregir)
- **A · media (confirmado leyendo):** al anular un pago, `void` (`platform-billing.ts:166`) recalcula `paidThroughAt` con `paidUntilFrom` (`:56`) usando **solo** las filas de `PlatformPayment`. Sobrescribe cualquier otro origen de esa fecha (ajuste manual, fecha previa, `activateTenant`); ordena por `createdAt`, así que con empates en el mismo milisegundo es no determinista; y si se anula un pago y no queda ninguno vigente, el estado sigue `active`. **Arreglo mínimo:** guardar la fecha previa (`prevPaidThrough`) en la fila del pago, o permitir anular solo el último pago vigente. **Prueba que falta:** anular el único pago, el del medio y uno ya vencido (el test actual no ejercita `void`).
- **B · baja (confirmado):** repetir un pago ya registrado (misma `operationId`) devuelve siempre `status: "active"` (`:93`), aunque se haya anulado después. Debería responder 409 o el estado real.
- **C · baja-media (plausible):** el índice único de la referencia solo existe en el código, no en la base; lo protege el bloqueo. **Arreglo:** índice único parcial en la base sobre (empresa, referencia normalizada) donde no sea una anulación.
- **D · baja (plausible, no leí la exportación):** la empresa lee sus propias filas, incluidos `operator`, `voidReason` y `operationId`; las notas internas del operador podrían salir en su exportación. Excluir `voidReason` de las columnas exportadas.
- **Referencia con aspecto de tarjeta:** no se rechaza un número largo pegado por error en `reference`. Rechazar 13 a 19 dígitos que pasen la regla de Luhn. Falta prueba.
- **Auditoría del operador:** el operador es un texto (`PLATFORM_OPERATOR_LABEL`) y hay un token único y estático, sin MFA; **no se escribe en `AuditLog`** (a diferencia de `platform_password_reset`). Quedan la fila del pago y un registro de consola. Conviene una fila de bitácora por pago o anulación.
- **Límite de intentos en memoria** (por instancia, se reinicia con el servidor); con un proxy mal configurado, 5 intentos desde la IP «desconocida» podrían bloquear al operador. Sin lista de IP permitidas.
- **Pruebas que faltan:** todo el flujo `void`, la repetición tras anular, el límite 429, la carrera de una misma referencia con dos `operationId`, la fuga de `voidReason` en la exportación y una referencia con aspecto de PAN.

## PC-24 · paquetes de IA y cuota (`platform-ai-packs.ts`, `assistant.ts`, `assistant-usage.ts`, migración `202610280014_pc24_ai_pack_credit`)
**Quién puede acreditar: solo el operador ✔.** Las dos rutas (`platform-ai-packs.ts:143-180`) son `@Public()` y pasan por `authorizePlatform` (mismo token con `timingSafeEqual`, 5 fallos por IP). El rol de las empresas solo tiene `SELECT` sobre `AiPackCredit` (migración `:15-16`) y un disparador bloquea `UPDATE` y `DELETE` (`:17-27`). El asistente solo expone `usage` y `ask`, ambos `@Permit("authenticated")` (`assistant.ts:1475-1483`) y ninguno escribe paquetes. Prueba: 401 con el token de una empresa (`product-platform-ai-packs-postgres.test.ts:195-212`) y «permission denied» al insertar como empresa (`:270-295`).

**Una empresa no usa la cuota de otra ✔.** Política de RLS por `app.tenant_id`; todas las consultas de `aiUsage` filtran por `tenantId` (`:46-54`), así que `branchId='main'` repetido o un mismo id de usuario no importan. El bloqueo es `assistant:${tenantId}` (`:82`). Bloqueo, conteo e inserción van en una sola transacción: **sin doble gasto**. Prueba con PostgreSQL real: límite 200, 195 usadas, 10 peticiones simultáneas, pasan exactamente 5 (`:324-337`). Mes en la zona de la empresa, probado a las 23:59 y 00:30 de Santo Domingo (`:376-390`). El cambio de plan se lee en vivo.

**Sin datos sensibles ✔.** La bitácora guarda tokens, nombres de herramientas (máximo 10) y un estado; **nunca el texto de la pregunta** (`assistant-usage.ts:37-42`). No hay número de tarjeta, CVV ni PAN en el esquema, el código ni los scripts; `38ef3cf4` solo cambió `cvv` por `cv[cv]` en la lista de llaves sensibles (`assistant.ts:250-251`) y `card[_-]?(?:number|security)` sigue.

**Dinero ✔.** El tamaño es 100 o 300 (`:119`) con precio del mapa del servidor (`:23`); la base fuerza `questions IN (100,300)` y `priceDop > 0` (`numeric(12,2)`). Idempotencia: único por (empresa, referencia) más un índice global normalizado (`202610280025`); una variante de mayúsculas o espacios de otra empresa da 409 (`:246-252`). Un paquete vale solo el mes en que se acredita (uno comprado el día 30 rinde unos 2 días; **el operador debe saberlo**). La tabla es inmutable.

### Observaciones (todas bajas, no bloquean)
- **A:** `AiPackCredit` no guarda quién ni por qué lo acreditó (un solo token de plataforma). Añadir una nota o el operador.
- **B (baja-media):** cualquier usuario autenticado, **cajera incluida**, puede gastar toda la cuota de la empresa: `ask` es `@Permit("authenticated")` con 5 por minuto por usuario (`assistant.ts:1494`). Con el plan de 100 preguntas, una cajera las agota en unos 20 minutos y la dueña recibe el 429. **Arreglo:** un permiso `assistant:use` o un tope diario por usuario. Falta prueba.
- **C:** las respuestas fallidas o incompletas no se cuentan, pero el costo del proveedor ya se pagó (un caso de 6 rondas gasta tokens sin contarse); el límite por minuto lo acota. Contar las fallas o limitar las gratuitas por mes.
- **D:** el acreditado doble concurrente depende de `error.meta.code === "23505"` (`:166`) y la prueba es secuencial. Falta una prueba de dos peticiones simultáneas con la misma referencia.
- **No cubierto por pruebas:** dos empresas con el mismo usuario o sucursal `main` consumiendo a la vez, cambio de plan a mitad de mes y husos horarios distintos de Santo Domingo.

## Lo que no se verificó
La interfaz del panel del operador, las rutas MCP (solo se buscó con `grep` y no hay ruta de escritura), la exportación de datos de la empresa, la subida de comprobantes del flujo de las empresas (`product-billing.ts:88-123`) y `platform-token-rotation.test.ts`. Nada se ejecutó.
