# Órdenes para Claude PC (sesión local en la PC de la dueña) · 25-oct-2026

De parte de Claude nube (arquitecto). Desde la nube no puedo escribirte por el canal directo, por eso las órdenes van aquí. **Lee este archivo y `REVISION_NOCHE_CLAUDE.md` antes de cada tarea.**

Reglas:
- Trabaja en ramas `claude-pc/*` creadas desde `origin/nexora-cloud`.
- Un commit por punto, con una prueba que falle antes y pase después.
- `pnpm check` y los 3 CI en verde.
- Nunca Render, la base de datos de la tienda ni sus credenciales. No despliegues; eso lo hago yo.
- Al terminar cada punto, avísame por tu canal con el SHA.

## Ya resuelto por mí (no lo hagas)
- **Fallo 1 del cierre de caja** (la marca «Recibido por la dueña» se perdía cuando la cajera mandaba una referencia): corregido en `nexora-cloud` 17ce43c5, con su prueba.

## CPC-1 · `ownerReceived` por caja (fallo 2 del cierre)
- **Rama:** `claude-pc/owner-received-por-caja`.
- **Problema:** `apps/api/src/cash.ts` (`buildCuadre`, `ownerReceived`) lista los cobros «Recibido por la dueña» por sucursal y horario. Con dos cajas abiertas a la vez, el mismo cobro sale en los dos cuadres.
- **Arreglo:** atar cada cobro a la caja de la cajera que lo registró. La bitácora `credit_collection` trae el `userId` del actor y los `paymentId`; usa eso o guarda la caja de origen en un campo nuevo.
- **Prueba:** dos cajas abiertas, un cobro de la dueña desde la caja A: sale en el cuadre de A y no en el de B.

## CPC-2 · Lote del verifón al cerrar caja (C-03 del plan maestro)
- **Rama:** `claude-pc/lote-verifon`.
- **Qué:** al cerrar una caja que tuvo ventas con tarjeta, pedir el número de lote del verifón, más una foto opcional del voucher de cierre de lote (reusa la subida de evidencias). Se guarda en `closeDetails` y se imprime en el ticket de cuadre.
- **Pruebas:** sin ventas con tarjeta no se pide nada; con tarjeta y sin lote, el cierre responde 400 con un mensaje claro; el lote sale en el cuadre.

## CPC-3 · Seguir auditando (solo lectura)
- Lo que suban ChatGPT PC (`producto-nexora`) y ChatGPT nube (`nexora-chatgpt-nube-ia`): deja tus hallazgos arriba en `REVISION_NOCHE_CLAUDE.md`, como hiciste hoy.
