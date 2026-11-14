---
name: cuadres-cerrados
description: Para Norexos 2. Úsalo ANTES de listar pendientes de cuadre, transferencias, cobros o facturas a la dueña. Lo que ella ya resolvió o dio indicación no se vuelve a mencionar.
---
# Cuadres cerrados (orden de la dueña, 13-nov-2026)
«Ya no me menciones lo que te he dado solución.»

1. Antes de enviar cualquier lista de pendientes, lee `docs/operacion/cuadres-cerrados.md`.
2. Todo número de factura, depósito o caja que esté ahí **no se menciona**, ni como «excluido», ni como nota al pie.
3. Cuando la dueña resuelva algo o dé una indicación («déjalo así», «ya se cuadró», «yo le doy seguimiento», «Génesis la cuadró», constancias que ya mandó, pruebas anuladas), agrégalo a ese archivo en el mismo turno (fecha, factura, qué decidió) y haz commit + push a `claude/bitacora-n2`.
4. Solo se vuelve a mencionar si aparece un dato nuevo que contradiga lo cerrado (p. ej. dinero que no cuadra), y se dice en una línea.

## Regla de evidencia (orden de la dueña, 14-nov-2026)
- Si la dueña **justificó o dio por cerrada** una factura/transferencia/cobro, queda cerrada: **no se menciona más**, aunque el sistema la siga mostrando pendiente (se verifica en el sistema y se anota en `docs/operacion/cuadres-cerrados.md`).
- Si ella **no mostró evidencia** (comprobante, captura, extracto, o una indicación clara), la factura **se queda abierta** y sí se lista.
- La dueña es quien cierra. Claude no cierra por su cuenta lo que no tiene evidencia ni indicación.
