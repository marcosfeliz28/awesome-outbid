# Auditoría de interfaz Nexora POS — 18-oct-2026

Alcance: lectura estática de POS, caja, conciliación de transferencias, gestión y dashboard. Sin cambios de código de aplicación, sin despliegue, Render, producción ni credenciales. No se usó una base de datos.

## Resultado

No confirmé un defecto funcional de interfaz que permita por sí mismo cobrar dos veces, alterar importes, perder una venta pendiente o ejecutar F4/F8/F12 detrás de un modal. Sí queda una brecha de cobertura E2E en la conciliación: el flujo probado a 320 px se detiene después de comprobar la diferencia, sin pulsar «Verificar seleccionadas» ni comprobar el resultado de la conciliación.

### UI-01 — cobertura incompleta del flujo de conciliación en móvil (baja; brecha de prueba, no defecto confirmado)

- Evidencia: `tests/e2e/envio-mensajero.spec.ts:134-148` navega a `transfer-reconciliation`, localiza la factura, marca su checkbox, introduce el total bancario y comprueba el texto de diferencia a 320 px. Luego sale a `courier-payouts`; no pulsa «Verificar seleccionadas» ni comprueba el resultado.
- Contexto: `apps/web/src/TransferReconciliation.tsx:77-104` implementa la verificación de filas seleccionadas y refleja resultados; `:419-424` expone el botón. Las pruebas unitarias en `tests/conciliar-transferencias.test.ts:181-192` cubren el helper serial `verifyOneByOne`, no la interacción/renderizado real de esa acción.
- Reproducción de la brecha: revisar el E2E indicado; el flujo termina sin enviar la verificación de la transferencia. No es una reproducción de fallo de producto.
- Parche propuesto: añadir un E2E de UI con fixture de pago pendiente que, a 320/390 px, verifique el pago seleccionado, compruebe el mensaje de éxito y la desaparición/actualización de la fila; añadir también un fallo de servidor que compruebe que el resultado de error queda visible y que las filas fallidas siguen seleccionadas.
- Estado: verificable por inspección de la prueba; no implica que la conciliación falle.

## Controles revisados sin hallazgo confirmado

- Atajos de caja: `apps/web/src/POS.tsx:551-569` llama al guard antes de despachar F4/F8/F12; `apps/web/src/posKeyboard.ts:1-20` bloquea esas tres teclas mientras exista `[role="dialog"]`. `tests/accessibility-contract.test.ts:441-465` cubre F4/F8/F12 con modal y que F2 siga disponible. El checkout además deshabilita botones durante `busy` (`POS.tsx:1970-1980`, botones en `:2393-2425` y `:2758-2767`).
- Ventas offline: `apps/web/src/POS.tsx:1712-1715, 1779-1800, 2022-2068, 2070-2135, 2136-2157` conserva el mismo UUID en reintentos ambiguos, elimina el PIN de gerente del registro local y no descuenta stock local si una petición online quedó sin respuesta. El servidor serializa la aceptación por UUID en `apps/api/src/sales.ts:677-714`; la sincronización conserva el UUID en `apps/web/src/api.ts:518-542`. `tests/offline-policy.test.ts` cubre política, conflictos y sincronización/idempotencia con pruebas unitarias.
- Caja y ventas pendientes: `apps/web/src/Management.tsx:1584-1593` filtra registros locales por sucursal para administración o por usuario para cajera; la descripción de ventas pendientes explica revisión y descarte (`:1732-1762`). Los conflictos no se eliminan automáticamente al reintentar: la ruta de sincronización devuelve resultados y actualiza/elimina según estado (`apps/web/src/pendingSales.ts:150-184`).
- Conciliación: `apps/web/src/TransferReconciliation.tsx:40-41,77-104,106-137,139-172` comparte un `busyRef` sincrónico entre verificar, rechazar y guardar envío; botones relevantes se deshabilitan durante operación (`:267-272,313-319,352-375,419-424`). La verificación de grupo es secuencial y conserva los resultados por fila (`tests/conciliar-transferencias.test.ts:181-192`). No encontré evidencia de carrera de doble clic que evada el bloqueo de UI.
- Adaptación/teclado: el CSS POS contiene breakpoints móviles y controles táctiles amplios (`apps/web/src/styles.css:5206-5295,5439-5487`); `tests/e2e/pos-pantalla.spec.ts:34-77` mide desbordamiento a resoluciones desktop y a la vez visibilidad de catálogo/cobro; `tests/e2e/envio-mensajero.spec.ts:143-148` mide overflow a 320 px en la ruta de conciliación. La prueba contractual de contraste/foco está en `tests/accessibility-contract.test.ts:355-439`.

## Verificación ejecutada y límites

- `pnpm install --frozen-lockfile`: correcto (925 paquetes, lockfile sin cambios).
- `pnpm db:generate`: correcto (Prisma Client 6.19.0 generado; sin conexión a base de datos).
- Primera ejecución, antes de generar el cliente: `pnpm exec vitest run tests/accessibility-contract.test.ts tests/offline-policy.test.ts` — 29 pruebas pasaron; la suite offline no pudo cargar por `Cannot find module '.prisma/client/default'`.
- Repetición tras `pnpm db:generate`: mismo comando — 2 archivos aprobados, 61 pruebas aprobadas (29 + 32), 0 fallidas.
- No se ejecutaron E2E, `pnpm check`, flujo manual del navegador ni escenarios táctiles reales: este encargo se limitó a revisión estática/pruebas unitarias seguras y no se aprovisionó PostgreSQL de pruebas. Por ello, el comportamiento visual real a 320/390 px, el tab/focus modal y las acciones de conciliación quedan sin verificar en navegador.

## Referencias de lectura

`apps/web/src/POS.tsx`, `Tienda.tsx`, `Management.tsx`, `Dashboard.tsx`, `TransferReconciliation.tsx`, `posKeyboard.ts`, `offlinePolicy.ts`, `pendingSales.ts`, `api.ts`, `styles.css`, `transferReconciliation.css`; pruebas `tests/accessibility-contract.test.ts`, `offline-policy.test.ts`, `conciliar-transferencias.test.ts` y E2E `tests/e2e/pos-pantalla.spec.ts`, `caja-web.spec.ts`, `store.spec.ts`, `envio-mensajero.spec.ts`, `caja-cierre-movil.spec.ts`.
