# Mensaje para ChatGPT NUBE y Gemini: levantamiento del cierre de caja

*(Pega este texto completo en cada uno. Es una propuesta por escrito: no se programa nada.)*

---

Eres asesor de un negocio real, Grupo Macgen, que usa un punto de venta propio llamado **Nexora POS**.

**Repositorio:** https://github.com/marcosfeliz28/awesome-outbid (rama `nexora-cloud`).
Lee primero `AGENTS.md` y `docs/coordinacion/ORDEN_LEVANTAMIENTO_CIERRE_CAJA.md`.

## Lo que quiero

Una **propuesta escrita, de máximo 2 páginas, en español sencillo**, para que el **cierre de caja** sea **más fácil, más práctico y con menos posibilidad de robo**. **No cambies código, ni la base de datos, ni nada del sistema.**

## Qué pasó (caso real del 17 de octubre)

Un cajero cerró su caja. El sistema esperaba **RD$ 9,900** en efectivo y él contó **RD$ 6,700**. Diferencia: **−3,200**.

| Concepto | RD$ |
|---|---|
| Venta en efectivo del día | 1,900 |
| Contraentregas cobradas en efectivo (de los días 15 y 16) | 4,700 |
| Una contraentrega vieja (11 de octubre) que el cajero cerró a las 17:09 | 3,300 |
| **Total que el sistema esperaba en la gaveta** | **9,900** |

La contraentrega de **3,300** ya la había recibido la dueña antes. El cajero la cerró en su caja sólo para quitar el saldo. El sistema pensó que ese dinero entró a su gaveta y la caja salió «faltando».

## Lo que ya existe hoy

- El sistema calcula el efectivo esperado como: ventas en efectivo del cajero + contraentregas o créditos que cobró en efectivo, más entradas, menos devoluciones y salidas.
- El cierre es **ciego**: la cajera no ve cuánto debería haber.
- Si la diferencia pasa de RD$ 100, el sistema crea una alerta alta dentro de la app. **No llega por correo ni al celular.**
- Acabamos de agregar: si el efectivo o la tarjeta no cuadran, la cajera **no cierra sin el PIN de un gerente**.
- Si el dueño cierra una transferencia de crédito, **no depende de ninguna caja**.
- El papel de cierre muestra «Total en venta efectivo», pero no dice «esto es lo que debes entregar» ni separa ventas del día de cobros de facturas viejas.

## Problemas que ya vemos

1. **Cerrar un cobro no obliga a decir dónde está el dinero.** Se puede cerrar una contraentrega «en efectivo» aunque el efectivo no esté en la gaveta (por ejemplo, ya lo recibió la dueña antes).
2. **No existe una forma para el efectivo recibido por la dueña antes.** Para transferencias sí existe; para efectivo, no.
3. **El papel del cierre es poco claro** para la dueña y para la cajera.
4. **La alerta es pasiva.** Sólo se ve si alguien abre el panel de Alertas.
5. **La tarjeta no se lee sola.** La cajera escribe el total del verifón. El 17 de octubre hubo un cobro de RD$ 2,500 en el verifón sin factura. Además, el lote del verifón del día 16 no se cerró, y por eso el cierre de tarjeta del día 17 salió con **+21,800** de diferencia.
6. **Todo es complejo.** A la dueña le cuesta saber quién cobró qué y si el dinero llegó.

## Lo que debe traer tu propuesta

1. **Cómo se debe cobrar y cerrar una contraentrega o un crédito** para que siempre se sepa dónde quedó el dinero. Incluye el caso «la dueña ya lo había recibido antes».
2. **Cómo debe verse el papel de cierre.** Describe las líneas. Debe decir claro: ventas del día, cobros de facturas viejas (con número de factura y cliente), efectivo que debe estar en la gaveta, lo contado, la diferencia y quién autorizó.
3. **Controles para evitar robo**, por ejemplo: doble conteo, entrega parcial a la dueña con firma, tope de efectivo en la gaveta, alertas al celular o correo, PIN de gerente.
4. **Tarjeta y verifón:** cómo cruzar el voucher con las ventas sin depender de que la cajera escriba bien un número, y cómo evitar que el lote quede abierto de un día para otro.
5. **Una tabla** con estas columnas: *problema · propuesta · esfuerzo (bajo, medio o alto) · cómo evita el robo*.
6. **Las 3 cosas que harías primero**, en orden.

## Reglas

- **Sólo propuestas.** No cambies código ni configuración.
- No pongas contraseñas, PIN ni datos de clientes en el documento.
- No cambies cómo se calculan los márgenes ni los precios.
- Piensa en una tienda real: cajeras con poco tiempo, internet que a veces se cae.
- Si algo no lo sabes, dilo y haz una pregunta; no inventes.

## Dónde entregar

- **ChatGPT NUBE:** rama `nexora-chatgpt-nube`, archivo `docs/PROPUESTA_CIERRE_CHATGPT.md`.
- **Gemini:** rama `nexora-gemini-auditoria`, archivo `docs/PROPUESTA_CIERRE_GEMINI.md`.
- Si no puedes subir archivos al repositorio, **responde con el texto completo** y la dueña se lo pasa a Claude.
