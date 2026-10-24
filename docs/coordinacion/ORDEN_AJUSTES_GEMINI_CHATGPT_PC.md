# Orden para ChatGPT PC — ajustes que salen de la propuesta de Gemini (Claude, arquitecto · 24-oct-2026)

Veredicto completo: `docs/coordinacion/VEREDICTO_GEMINI_24OCT.md`. Plan maestro: `PLAN-10-MEJORAS-PRODUCTO.md`.

**Orden de trabajo:** primero el bloque A (la tienda, corto). Luego sigue la fase 1 (`ORDEN_FASE1_CHATGPT_PC.md`) con los cambios del bloque B. La e-CF (mejora 1) se ordena aparte cuando el contador confirme el grupo DGII de la dueña.

## Bloque A — Cierre de caja de la tienda (rama `nexora-chatgpt-pc-cierre`, desde `origin/nexora-cloud`)

Es dinero de la tienda en producción: un commit por punto, prueba de integración PostgreSQL que falle antes y pase después, `pnpm check` y los 3 CI en verde. PR hacia `nexora-cloud`; Claude revisa y despliega con el OK de la dueña. No toques datos reales.

**A1. La cajera cobra «efectivo que ya tiene la dueña» con el PIN de gerente.**
- Hoy `ownerConfirmed` solo lo acepta un usuario con `*` (`apps/api/src/sales.ts:3637`, `:3956-3960`, `:4026`). Extiéndelo a quien **no** tiene `*` si envía `managerPin` válido. Usa el mismo verificador que el cierre (`managerPinApproval` / `verifyPinAttempt` de `apps/api/src/security.ts`, como en `cash.ts:772-811`, con su límite de intentos).
- Rutas: `sales/:id/credit-collections`, `sales/:id/cod-collections` y `credit-accounts/:id/collections`. Las tres pasan por la misma regla; no la copies tres veces.
- Efecto: el pago queda con `receivedById` del gerente que dio el PIN, **no** suma al efectivo esperado de ninguna gaveta, y queda en la bitácora con quién pidió y quién aprobó.
- Web: en el cobro de efectivo de contraentrega y crédito, opción «Este efectivo ya lo tiene la dueña» → pide el PIN de gerente. Por defecto sigue «Entra a mi gaveta».
- Pruebas: (1) cajera sin PIN → 400; (2) cajera con PIN válido → saldo saldado y esperado de su caja sin cambio; (3) PIN equivocado cuenta como intento fallido; (4) reenviar la misma operación no duplica.

**A2. Resumen del ticket de cuadre más claro** (`apps/web/src/Prints.tsx`, sección «Resumen»):
- Tres renglones explícitos: «Efectivo esperado en gaveta», «Efectivo contado» y «DIFERENCIA» con signo (sobrante + / faltante −). Toma los valores que ya calcula `buildCuadre` (`cash.ts`); no recalcules en la web.
- «Entregado» y «Dejado en caja» solo si se entregó algo (`delivered > 0`).
- Sección informativa «Recibido por la dueña (fuera de gaveta)» con factura, cliente y monto de los cobros del día marcados así en A1. Esos montos no suman al esperado.
- Sin cambios en el reporte diario de productos (ya se arregló el 17-oct; el nombre completo se queda, por orden de la dueña).
- Prueba: captura del ticket de 80 mm en `test-results/capturas/` con una caja que tenga los tres tipos de cobro.

**A3. Aviso cuando se usa el PIN de gerente.** Cada aprobación con PIN (cierre con diferencia, A1, movimientos de caja) genera un aviso por los canales que ya existen en `apps/api/src/notifications.ts` (correo/Telegram), con caja, monto y quién aprobó. Prueba con el proveedor falso de notificaciones.

## Bloque B — Cambios a la fase 1 (rama `producto-nexora`)

Todo lo de `ORDEN_FASE1_CHATGPT_PC.md` sigue igual, más:

1. **Primer cobro real = transferencia bancaria verificada.** El primer `BillingProvider` además del de prueba es «transferencia»: el cliente ve los datos de la cuenta de Nexora (configurables, nunca en el código), sube su comprobante, y la administración de Nexora verifica. Reusa la lógica y la pantalla de verificación de transferencias que ya existen; no la dupliques. Verificado → el plan pasa a `active` hasta la fecha pagada.
2. **Arranque guiado en menos de 30 minutos:** en el asistente de arranque, el paso «Productos» ofrece importar Excel (ya existe) y leer una factura de proveedor con IA (ya existe en Mercancía, limitado por plan). Prueba E2E cronometrada con 3 productos.
3. **Límite de equipos por plan:** el número de equipos aprobados (Configuración › Equipos) cuenta contra las cajas del plan. Aprobar uno de más → 409 con mensaje claro.
4. **Piloto:** la puerta de la fase 1 añade «3 negocios de prueba (datos ficticios) operan un día completo en la PWA sin ayuda». El instalador de Windows queda para después de la fase 2.

## No hacer

- No emitir NCF Serie B como camino para clientes nuevos (ver veredicto: e-CF obligatorio desde el 15-nov-2026).
- No desplegar ni tocar Render, la base de la tienda o sus datos.
- No cambiar el nombre completo del producto en el ticket.
