# Área 5 — Notificaciones e integraciones

- **Base auditada:** `origin/nexora-cloud` en `cf6f7022ab9682db45327558e5dd18946a7b1473`.
- **Alcance:** `apps/api/src/notifications.ts`, `drive-backup.ts`, `drive-backup-core.ts`, `monitoring.ts` y enganches desde ventas/caja.
- **Comandos:** revisión de código y referencias; `pnpm exec vitest run tests/correo-avisos.test.ts tests/telegram-render.test.ts`.
- **Resultado de pruebas:** inicialmente Vitest no pudo cargar `@prisma/client` (`Cannot find module '.prisma/client/default'`). Después `pnpm db:generate` generó el cliente usando la configuración de Prisma sin cargar variables de entorno (`Prisma config detected, skipping environment variable loading`); no se conectó a base de datos. Repetición: `pnpm exec vitest run tests/correo-avisos.test.ts tests/telegram-render.test.ts` — **2 archivos y 20 pruebas pasan**. Salida: `Test Files 2 passed (2); Tests 20 passed (20)`.

## Hallazgos

| ID | Severidad | Evidencia | Qué pasa / reproducción mínima | Propuesta (no aplicada) | Prueba que debería fallar hoy |
|---|---|---|---|---|---|
| N-01 | MEDIO · **SIN REPRODUCIR** | `apps/api/src/notifications.ts:79-111,123-134,753-775` | Los correos de cierre de caja/solicitud de anulación se envían por POST directo a Resend y, ante cualquier error/timeout, se repiten hasta tres veces. La llamada no incluye clave idempotente ni usa la cola durable `NotificationOutbox` que sí existe para Telegram. Si Resend acepta el primer POST pero la respuesta se pierde/vence el timeout, los reintentos pueden generar correo duplicado. No se simuló un proveedor aceptando el mensaje y perdiendo la respuesta; por eso no está confirmado. | Persistir el envío de correo en una cola con identidad estable del evento y usar idempotencia del proveedor si está disponible; al menos cubrir el resultado ambiguo de timeout sin duplicar. | Mock de Resend: aceptar/registrar el primer POST pero cortar la respuesta; dejar que corra el reintento y afirmar que el evento produce un solo correo entregado. |
| N-02 | MEDIO · **SIN REPRODUCIR** | `apps/api/src/notifications.ts:916-944` | Para Telegram, la fila se reclama con arriendo; primero se envía el mensaje externo y después se marca `sent`. Si Telegram acepta el mensaje y el proceso cae o falla la escritura de `sentAt`, al vencer el arriendo la fila sigue `pending` y se vuelve a enviar. El flujo es de entrega al menos una vez; no hay idempotency key remota. No se provocó caída entre ambas operaciones ni se verificó respuesta real de Telegram. | Dejar documentada la semántica al menos-una-vez y reducir el intervalo de ambigüedad con identificador visible/deduplicación del lado consumidor si la plataforma lo permite; probar fallo justo después de aceptación externa. | Sustituir el transporte por un mock que acepte el primer envío y haga fallar el UPDATE de `sent`; tras vencer arriendo, comprobar duplicado y que la prueba propuesta detecta esa semántica. |

## Controles comprobados por lectura

- Las llamadas desde caja/ventas a `notify()` ocurren luego de guardar la operación; `notify` no espera al transporte externo, por lo que Telegram/Resend no bloquean la respuesta de venta (`notifications.ts:753-787`; enganches en `sales.ts` y `cash.ts`).
- Telegram guarda el mensaje en una outbox con `ON CONFLICT (eventType, refId) DO NOTHING`; el trabajador usa `FOR UPDATE SKIP LOCKED`, arriendo de 120 segundos, límite de intentos y respeto de 429 (`notifications.ts:732-750,916-981`).
- El token/chat de Telegram y la clave de Resend no se devuelven en las respuestas de `status`/`test`; los errores pasan por `sanitizeError`. Revisado por lectura, no probado con valores secretos (`notifications.ts:151-163,1000-1040`).
- Los campos variables de los mensajes de Telegram se escapan/limpian con `cleanText` y `escapeHtml` en los renderizadores inspeccionados.

## No verificado

- Reintentos/duplicados reales contra proveedores, `429`, caída entre el envío y el marcado `sent`, y outbox bajo concurrencia/API reiniciada.
- Envío real de correo/Telegram, control de logs con secretos sintéticos, integración OAuth/Drive y recepción de eventos Sentry.
- El comportamiento real de proveedores, reintentos, concurrencia/outbox y logs con secretos sintéticos sigue sin verificarse; las pruebas verdes ejercitan los tests disponibles, no una caída real de proveedor ni entrega externa.

