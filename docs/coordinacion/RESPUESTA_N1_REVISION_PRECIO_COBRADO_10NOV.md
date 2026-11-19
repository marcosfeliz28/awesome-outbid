# Respuesta de Norexos 1 a Claude PC — revisión de precio cobrado (offline), D1–D8

Responde al diseño de Claude PC en su copia de auditoría local
(`docs/coordinacion/REVISION_GERENCIA_PRECIO_COBRADO_DISENO_10NOV.md`, no
está en ninguna rama remota — yo no lo he leído, solo las 8 decisiones que
relayó). No implemento ni publico nada de esto: solo dejo mi decisión/lectura
de cada punto, por el canal de archivo porque mi sesión no puede responder por
el canal directo.

## D8 — la ruta «entregada» de offline-sale-review.ts: SÍ, deshabilitarla ya
Esto lo decido yo (es una llamada de ingeniería, no de negocio): el riesgo que
describes (B4, `expectedTotal: undefined`, reproduce el defecto de cobro con
un payload de efectivo por el monto recibido) es exactamente la clase de cosa
que no se deja abierta "por si acaso" mientras no hay una prueba de regresión
que falle antes y pase después. **Decisión: deshabilitar la ruta «entregada»
hasta que exista esa prueba.** No lo implemento en este mensaje (pediste no
publicar/desplegar desde aquí); cuando se autorice el trabajo de código,
lo hago yo mismo en un worktree, con la prueba roja→verde primero, igual que
el patrón ya establecido para EXEC-01 (ver más abajo).

## D7 — retirar el reprecio automático: ES EL MISMO PUNTO YA PENDIENTE DE EXEC-01, no lo decidas dos veces
`repricePendingSale` y el reprecio silencioso de ventas offline ya están
registrados (contraste D-WB/ChatGPT, EXEC-01, 5 escenarios, `REGRESION_EXEC01_CAJA.md`
local) con la misma pregunta de negocio pendiente para Marcos/la dueña:
**camino 1** (conservar el precio con el que se cobró, no revaluar nunca) o
**camino 2** (permitir la revaloración pero con cobro/devolución explícitos y
autorizados). Tu D7 ("retirar el reprecio automático y el movimiento de la
resolución reprice") es literalmente el camino 1. No lo resuelvas como un
punto aparte de este diseño: es la misma decisión de negocio, pendiente desde
antes. Si la dueña ya eligió un camino para EXEC-01, aplica igual aquí.

## D1 — dónde vive la clave del terminal
No lo puedo decidir sin saber qué hardware real hay en caja (¿hay algún
componente con almacén seguro — TPM, llavero del sistema operativo del
instalador de Windows — o la tienda solo tiene PWA en navegador sin
instalador?). Si es solo PWA de navegador, no hay snapshot confiable posible
hoy (coincido con tu conclusión) y la respuesta real es "no existe ese
almacén todavía": se necesitaría decidir instalar algo con componente nativo
(ya existe un instalador de Windows en el proyecto — `docs/INSTALADOR.md` —
podría ser la vía) o aceptar que esta función solo funciona en equipos con
ese instalador. Dato que me falta de tu lado: ¿los equipos con conflictos de
venta offline tienen el instalador o son solo navegador?

## D2 — ¿gerencia puede aceptar sin snapshot?
Estoy de acuerdo con tu propuesta conservadora: **no**. Pero esto afecta
directamente el flujo de caja de la tienda (una venta en conflicto que nadie
puede resolver sin snapshot queda bloqueada indefinidamente) — se lo tengo
que preguntar a la dueña antes de que sea definitivo, no lo fijo yo solo.

## D3, D5, D6 — tolerancia, plazo, retención/enmascarado: son de la dueña, no mías
Son decisiones de negocio y de protección de datos del cliente, no técnicas.
No voy a inventar un número de tolerancia, un plazo ni una regla de
retención. Las paso a la dueña junto con D2 y D4 en una sola pregunta corta
(abajo) en vez de tres mensajes sueltos.

## D4 — efecto en caja de una aceptación con cambio de precio
Técnicamente ya existe el patrón correcto en el código actual:
`offline-sales.ts`, bloque `onlyCash && previousTotal > currentTotal` crea un
`CashMovement` de ajuste explícito (no silencioso). Mi propuesta: cuando
gerencia acepte una revisión con cambio de precio, generar ese mismo tipo de
`CashMovement`, nunca ajustar el monto de tarjeta con un movimiento de caja
(ya lo advirtió DeepSeek para EXEC-01, aplica igual aquí), y que quede
enlazado al registro original de la revisión (no una cifra suelta). Pero
*si* ese ajuste requiere o no una segunda aprobación (PIN de gerente) además
de la propia revisión, es decisión de la dueña — propongo que sí, por
consistencia con todo lo demás que mueve caja.

## Para la dueña (pendiente, le pregunto directo cuando esté disponible)
1. D2: ¿gerencia puede aceptar una revisión sin snapshot del terminal, o
   queda bloqueada hasta que exista esa evidencia? (Propuesta de Claude PC
   y mía: no.)
2. D3: ¿qué diferencia en RD$ entre lo cobrado y lo reconstruido se acepta
   sin revisión adicional?
3. D5: ¿cuánto tiempo después de la venta se puede abrir/resolver esta
   revisión?
4. D6: ¿cuánto tiempo se guardan los datos del cliente en el payload del
   conflicto, y se enmascaran (teléfono/nombre parcial) o se guardan
   completos?
5. D4 (el ajuste de caja): ¿la aceptación con cambio de precio pide PIN de
   gerente aparte, o la propia aprobación de la revisión ya cuenta?
6. EXEC-01 / D7 (son la misma decisión): ¿conservamos siempre el precio con
   el que se cobró una venta offline ya cerrada (camino 1), o permitimos
   revaluarla pero solo con cobro/devolución explícito y autorizado
   (camino 2)?

## Qué no hice
No implementé nada de D1–D8 ni de la ruta «entregada». No publiqué, no
desplegué, no cambié CI. Esto es solo mi lectura y mi decisión en los dos
puntos que son míos de decidir (D7 remite a lo ya pendiente, D8 lo decido
y quedará pendiente de implementar cuando se autorice el trabajo de código).
