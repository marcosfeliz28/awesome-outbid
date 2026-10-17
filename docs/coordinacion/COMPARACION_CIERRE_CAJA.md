# Comparación de las dos propuestas de cierre de caja (orden 3ah)

17-oct-2026 · Claude (arquitecto). Fuentes: `docs/PROPUESTA_CIERRE_CHATGPT.md` (PR #4) y `docs/PROPUESTA_CIERRE_GEMINI.md` (pegada por la dueña). Ninguna de las dos se programa hasta que la dueña apruebe este plan.

## 1. En qué coinciden (se adopta)

1. Al cobrar una factura vieja (contraentrega o crédito) hay que decir **dónde quedó el dinero**: en mi gaveta / banco o verifón / ya lo recibió la dueña.
2. «**Ya lo recibió la dueña**» salda la factura **sin sumar a ninguna gaveta**.
3. **Dos papeles**: la cajera no ve lo esperado ni la diferencia (cierre ciego); la dueña ve el detalle **por factura y cliente**, el efectivo esperado, lo contado, la diferencia y quién autorizó.
4. **Entregas parciales** (sangría) cuando la gaveta pase de un tope, con doble firma.
5. **Avisos al correo o celular**, no solo en el panel de Alertas.
6. **Verifón**: lote cerrado cada día y grapado al cierre; cada voucher con su factura.

## 2. En qué difieren y qué se decide

| Tema | ChatGPT | Gemini | Decisión de Claude |
|---|---|---|---|
| Quién confirma «ya lo recibió la dueña» | Solo la dueña, desde su propia cuenta | PIN de gerente en la caja o cuenta de la dueña | **ChatGPT.** Un PIN tecleado en la pantalla de la cajera se puede ver o prestar; desde el celular de la dueña queda su identidad. Es lo mismo que ya hace con las transferencias. |
| Mientras no exista el botón | No simular una entrada y una salida que nunca pasaron | Opción C: cobro + «Salida» por el mismo monto, firmada por la dueña en el acto | **Gemini como regla de hoy, solo con la dueña presente.** El cuadre queda honesto y el papel firmado lo documenta. Se retira cuando exista el botón. |
| Verifón | Cruzar voucher por voucher con el reporte del adquirente (esfuerzo alto) | Reglas físicas: # de factura en cada voucher, cierre de lote grapado, subtotal en 0 por la mañana (esfuerzo bajo) | **Gemini primero** (desde mañana). ChatGPT después, solo si Cardnet exporta el reporte. |
| Sobrante de 100 de Edgar | Investigar; no dar la caja por cuadrada | No lo menciona | **ChatGPT.** Son los 100 «suyos» que dijo haber puesto; se registra como sobrante, no como cuadre. |
| Papel de cierre | Modelo corto | Acta línea por línea con 6 bloques | **Gemini** para el papel de la dueña. El de la cajera queda como hoy. |

## 3. Reglas desde mañana (sin programar nada)

1. Ninguna cajera cierra en su caja un cobro cuyo dinero **no entró a su gaveta**. Si ya lo tiene la dueña, lo cierra la dueña, o se hace cobro + «Salida» firmada por ella en el mismo minuto.
2. Cada voucher del verifón lleva escrito el número de factura. Cada tarde se cierra el lote y se grapa al cierre. Cada mañana el subtotal del verifón debe estar en 0.
3. Cuando un gerente pone su PIN, la nota explica por qué (el sistema ya la exige a la cajera).

## 4. Lo que Claude programa, en este orden

1. **Botón «Ya lo recibió la dueña» para efectivo**, solo para la dueña, sin caja, con la fecha en que lo recibió. Es el mismo mecanismo que ya existe para transferencias (cambio pequeño).
2. **Papel de la dueña** con el acta de Gemini: ventas del día, cobros de facturas viejas por factura y cliente, movimientos, efectivo esperado, contado, diferencia, quién autorizó. El de la cajera no cambia.
3. **Al cerrar**: número de lote del verifón y foto del cierre de lote; **aviso por correo** a la dueña cuando hay diferencia o se usó un PIN.
4. **Tope de efectivo en gaveta** con entrega parcial registrada y aviso.
5. Después, si Cardnet exporta el reporte: cruce voucher por voucher.

Ya hecho aparte (commit `140e7c1a`, pendiente de CI y despliegue): con efectivo o tarjeta descuadrados, la cajera no cierra sin el PIN de un gerente.

## 5. Decisiones que faltan de la dueña

1. ¿Un solo verifón (Cardnet)? ¿Exporta reporte o solo imprime?
2. ¿Cuánto fondo se queda en caja al cerrar?
3. ¿Desde qué monto en gaveta se hace entrega parcial?
4. ¿Alguien más (Genesis) puede confirmar «ya lo recibió la dueña»?
5. ¿Un cierre al día o cambio de turno?
6. ¿El mensajero entrega el efectivo a la cajera o a la dueña?
