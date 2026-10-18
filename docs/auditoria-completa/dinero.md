# Auditoría completa — Dinero y caja

Fecha: 2026-10-18
Base auditada: `origin/nexora-cloud` / `cf6f7022ab9682db45327558e5dd18946a7b1473`
Rama de trabajo: `codex/audit-money-20261018`
Alcance: `apps/api/src/{sales,cash,reports,incentives,courier}.ts`, esquema Prisma relacionado y pruebas puras de incentivos/privacidad/cuotas. Solo se editó este informe; no se modificó código de la aplicación.

## Resultado de ejecución

- `pnpm install --frozen-lockfile`: completó correctamente.
- `pnpm db:generate`: completó correctamente; generó Prisma Client sin leer valores de `.env` ni usar `DATABASE_URL`.
- `pnpm exec vitest run tests/incentives-calc.test.ts tests/credit-allocation.test.ts tests/cash-privacy.test.ts`: **3 archivos, 26 pruebas aprobadas**.
- Las pruebas de API/PostgreSQL y Playwright de dinero no se ejecutaron: no hay base de pruebas provisionada y no se leyó ni utilizó ninguna credencial. Los comportamientos que requieren una petición real y persistencia quedan marcados **SIN REPRODUCIR**.
- En el primer intento, antes de generar Prisma Client, Vitest falló en dos suites con `Cannot find module '.prisma/client/default'`; después de `pnpm db:generate`, las tres suites indicadas pasaron. No es un fallo de la aplicación.

## Hallazgos

| ID | Severidad | Estado | Archivo y línea |
|---|---|---|---|
| DIN-01 | Media | SIN REPRODUCIR en API/PostgreSQL | `apps/api/src/sales.ts:2575` |
| DIN-02 | Media | SIN REPRODUCIR en API/PostgreSQL | `apps/api/src/cash.ts:730` |

### DIN-01 — Una devolución parcial repetida sin `operationId` se acepta como una devolución nueva

**Evidencia:** el esquema acepta `operationId` opcional (`sales.ts:2571-2592`). El chequeo de repetición y el bloqueo idempotente solo se ejecutan cuando hay clave (`sales.ts:2596-2609`); al guardar, la clave ausente queda como `null` (`sales.ts:2909-2911`). Cada solicitud aceptada incrementa `returnedQty`, puede emitir nota de crédito y puede reponer el stock (`sales.ts:2751-2789`). La prueba existente confirma la compatibilidad deliberada actual: una devolución sin clave obtiene HTTP 201 (`tests/api.test.ts:9822-9824`).

**Reproducción mínima propuesta (no ejecutada):** con una venta completada de dos unidades a RD$100 cada una, enviar dos veces el mismo `POST /returns` sin `operationId`, para una unidad, `restock: true` y `refundMethod: "credit_note"`. Si se aceptan ambas, una sola devolución física termina generando dos notas/saldos de crédito y dos unidades repuestas. La segunda solicitud es indistinguible de una devolución intencional diferente porque no hay clave.

**Parche propuesto, no aplicado:** hacer `operationId` obligatorio en el endpoint; eliminar la excepción de compatibilidad que espera 201 sin clave y agregar regresión de doble envío idéntico sin clave, que debe rechazar el segundo y comprobar que solo existe una devolución/nota y que el stock subió una vez. Mantener la ruta actual de reintento con misma clave idempotente.

**Prueba que debe fallar hoy:** en la suite R9-A01, duplicar la misma devolución parcial omitendo `operationId` y esperar que el segundo envío no produzca escritura. Con el código actual ambos envíos siguen el camino de creación; la prueba no pudo ejecutarse sin API/DB.

### DIN-02 — Movimiento de caja sin `operationId` no es idempotente

**Evidencia:** el cuerpo permite omitir `operationId` (`cash.ts:727-741`). La búsqueda del movimiento ya existente solo corre si hay clave (`cash.ts:771-787`); si se omite, la ejecución alcanza `cashMovement.create` cada vez (`cash.ts:819-834`). Por tanto, dos reenvíos HTTP sin clave de una salida válida pueden registrar dos retiros y reducir dos veces el efectivo esperado. La interfaz actual envía una clave (`apps/web/src/Management.tsx:2073-2078`), pero la API no exige lo mismo a clientes antiguos o a llamadas directas.

**Reproducción mínima propuesta (no ejecutada):** abrir caja con RD$2,000 y enviar dos veces `POST /cash-sessions/:id/movements` sin `operationId`, con `type: "out"`, monto RD$400 y el mismo motivo. Ambas salidas quedan dentro del límite predeterminado de RD$1,000. Verificar si quedan dos movimientos y el esperado de caja baja RD$800 aunque el formulario se envió una sola vez y su respuesta se perdió.

**Parche propuesto, no aplicado:** exigir UUID `operationId` en el esquema y comprobar concurrencia de reintentos con idéntico cuerpo; misma clave devuelve la fila original y misma clave con otro cuerpo debe responder 400 sin escritura. No cambiar el tope de aprobación ni la comprobación de saldo.

**Prueba que debe fallar hoy:** prueba de API con dos envíos idénticos sin clave que espere rechazo del primer cuerpo inválido y cero movimientos, y prueba concurrente con la misma clave que espere exactamente un movimiento. No se ejecutó por falta de base de pruebas.

## Comprobaciones sin hallazgo demostrado

- **Permisos de caja y PIN:** el cierre usa la caja propia/`sale:manage`, suma transferencias desde el sistema y requiere aprobación de gerente para diferencias de efectivo o tarjeta de cajeras; el vale exige nota y PIN. Las salidas tienen límite agregado diario/turno y no pueden exceder el efectivo esperado (`cash.ts:912-1025`, `719-839`). Sin PostgreSQL no comprobé el flujo HTTP/PIN de extremo a extremo.
- **Cobro de crédito desde la ruta de cajera:** `POST /sales/:id/credit-collections` permite `sale:write`, pero rechaza para quien no tenga `sale:manage` toda línea que no sea efectivo; exige caja cuando una cajera recibe efectivo. La transacción bloquea la venta y verifica sucursal, estado completado, saldo e idempotencia (`sales.ts:3718-3785`, `3812-3871`).
- **Asignación de créditos/COD e incentivos:** las pruebas puras de asignación e incentivos pasaron. El código conserva el `sellerId` original y el factor mayorista al generar/recalcular incentivo; cobros, devoluciones y anulaciones recalculan por saldo efectivo y unidades restantes (`incentives.ts:264-348`, `461-545`). Casos con persistencia y concurrencia: **SIN REPRODUCIR**.
- **Devoluciones y anulaciones:** las devoluciones bloquean venta/caja/variantes, limitan cantidades al saldo no devuelto, consideran el efectivo realmente cobrado cuando la transferencia original sigue pendiente y controlan efectivo disponible (`sales.ts:2612-2653`, `2821-2885`). La anulación serializa por venta y exige caja propia para reembolsar efectivo de una caja cerrada (`sales.ts:1991-2067`). No se hizo prueba PostgreSQL concurrente.
- **Mensajero:** el pago de gastos de mensajería se limita a ventas completadas/no pagadas; el pago en lote verifica estado, duplicados y operación idempotente bajo bloqueos y registra venta/pago en una transacción (`courier.ts:63-110`, `190+`). No se hizo prueba PostgreSQL concurrente.
- **Cuadre y reportes:** el esperado de caja y la vista agregada usan el mismo tratamiento de pagos rechazados, abonos pendientes y devoluciones. El cuadre cuenta ventas completadas, separa anuladas y resta devoluciones asignadas a la caja que las hizo; reportes mapean transferencias rechazadas a crédito pendiente (`cash.ts:51-155`, `213-323`; `reports.ts:233-310`, `1752-1782`). Sin datos PostgreSQL no se reconciliaron totales de una jornada concreta.
- **Notificaciones:** la ruta de notificación de pago se invoca después de los cobros; no se revisó en esta subauditoría la entrega/reintento del proveedor de correo, ya que el foco es dinero y caja. No se usaron credenciales externas.

## No verificado / pendiente

- Pruebas de integración que requieren PostgreSQL y pruebas E2E; concurrencia real entre cajas, bloqueos, límites y valores monetarios en la base.
- Reproducción de DIN-01 y DIN-02 en entorno desechable.
- Reconciliación contable con datos de ejemplo: no se provisionó base aislada.
- Manejo de reintentos/duplicados en Resend y secretos de correo (fuera de la ejecución de esta subauditoría).
