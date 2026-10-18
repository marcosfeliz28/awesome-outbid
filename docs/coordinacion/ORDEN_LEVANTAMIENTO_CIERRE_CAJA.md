# Orden de levantamiento: cierre de caja más simple y más seguro

**Para:** ChatGPT NUBE y Gemini (cada uno por separado).
**De:** Claude (arquitecto), por orden de la dueña, 17-oct-2026.
**Qué se pide:** una **propuesta escrita**. **No se programa nada.**

## 1. Qué pasó (caso real del 17-oct)

Un cajero cerró su caja. El sistema esperaba **RD$ 9.900** en efectivo y él contó **RD$ 6.700**: diferencia de **−3.200**.

Los 9.900 eran:

| Concepto | RD$ |
|---|---|
| Venta en efectivo del día | 1.900 |
| Contraentregas cobradas en efectivo (3 de ayer y antes de ayer) | 4.700 |
| Una contraentrega vieja (11-oct) que el cajero «cerró» a las 17:09 | 3.300 |
| **Total** | **9.900** |

La contraentrega de 3.300 **la dueña ya había recibido ese dinero antes**. El cajero la cerró en su caja sólo para quitar el saldo. El sistema creyó que había entrado 3.300 en efectivo a su gaveta. Por eso la caja salió «faltando».

## 2. Los problemas que se ven

1. **Cerrar un cobro no obliga a decir dónde está el dinero.** Se puede cerrar una contraentrega o un crédito «en efectivo» sin que ese efectivo exista en la gaveta.
2. **El papel del cierre no es claro.** Muestra «Total en venta efectivo 9.900», pero no dice «esto es lo que debes entregar», ni qué parte son ventas del día y qué parte son cobros de facturas viejas. A la cajera no se le muestra la diferencia (cierre ciego).
3. **Las diferencias no frenaban el cierre.** Hasta hoy sólo pedían una nota. (Claude ya cambió esto: ahora piden el PIN de un gerente. Ver orden 3ag-bis.)
4. **La tarjeta no se lee sola.** La cajera escribe el total del verifón. El sistema no ve el voucher. El 17-oct hubo un cobro de RD$ 2.500 en el verifón sin factura.
5. **Es complejo para la dueña.** Cuesta saber, mirando el papel, quién cobró qué y si el dinero llegó.

## 3. Lo que queremos lograr

- Que sea **más fácil** para la cajera y para la dueña.
- Que **robar o «perder» dinero sea difícil** y se note el mismo día.
- Que **cada cobro de una factura vieja** quede ligado a dónde está el dinero: en la gaveta, en el banco, o ya recibido antes por la dueña.
- Sin quitar lo que ya existe: PIN de gerente, cierre ciego, alertas, auditoría.

## 4. Qué debe traer tu propuesta

Un archivo **corto (máximo 2 páginas)**, en español sencillo, con:

1. **Cómo debe cobrarse y cerrarse una contraentrega o un crédito** para que se sepa dónde quedó el dinero. Incluye el caso «la dueña ya lo había recibido antes».
2. **Cómo debe verse el papel de cierre.** Dibuja o describe las líneas. Debe decir claro: ventas del día, cobros de facturas viejas (con número de factura y cliente), efectivo que debe estar en la gaveta, lo contado, la diferencia y quién autorizó.
3. **Controles para evitar robo**, por ejemplo: doble conteo, entrega parcial a la dueña con firma, tope de efectivo en gaveta, alertas, PIN de gerente.
4. **Tarjeta y verifón:** cómo cruzar el voucher con las ventas sin que dependa de que la cajera escriba bien un número.
5. **Una tabla** con estas columnas: *problema · propuesta · esfuerzo (bajo, medio, alto) · cómo evita el robo*.
6. **Las 3 cosas que harías primero**, en orden.

## 5. Reglas

- **Sólo propuestas.** No cambies código, ni la base, ni los servicios.
- No pongas credenciales, PIN ni datos de clientes en el documento.
- No cambies cómo se calculan los márgenes ni los precios.
- Piensa en una tienda real: cajeras con poco tiempo, internet que a veces se cae.
- Si algo no lo sabes, dilo y haz una pregunta; no inventes.

## 6. Dónde entregar

- **ChatGPT NUBE:** rama `nexora-chatgpt-nube`, archivo `docs/PROPUESTA_CIERRE_CHATGPT.md`.
- **Gemini:** rama `nexora-gemini-auditoria`, archivo `docs/PROPUESTA_CIERRE_GEMINI.md`.

Claude compara las dos propuestas, elige lo mejor de cada una con la dueña, y recién entonces se programa.

Repositorio: https://github.com/marcosfeliz28/awesome-outbid · Lee primero `AGENTS.md` y `docs/coordinacion/INSTRUCCIONES_ACTUALES.md`.
