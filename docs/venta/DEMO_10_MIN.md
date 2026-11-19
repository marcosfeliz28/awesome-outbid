# Demo de 10 minutos

Para enseñarle Norexos a un dueño de tienda. Hablar simple, sin tecnicismos.

## Antes de ir

- **Datos demo:** el sistema solo crea datos de demostración fuera de producción (`apps/api/prisma/seed.ts`). Usa una instalación aparte, nunca la del cliente ni la de la dueña. Dónde está y quién la mantiene: **COMPLETAR**. Usuarios y contraseñas de la demo: se pasan por fuera, nunca en este documento.
- Entra a la demo con un usuario administrador, con una **caja ya abierta** y varias ventas hechas (efectivo, tarjeta y una transferencia) para que el cierre tenga qué mostrar. Prepara también una venta a medio hacer.
- Ten a mano la hoja de precios impresa (`hoja-de-precios.html`).
- Prueba todo la víspera, en la misma laptop. No muestres nada que no hayas probado.

## Guion

| Min  | Qué mostrar                                                                                                                                                             | Qué decir                                                                                         |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 0–1  | Pantalla de entrada: **Entrar a mi tienda**.                                                                                                                            | «Es tu tienda en una sola pantalla: caja, inventario y clientes.»                                 |
| 1–3  | **Punto de venta**: elegir cliente (F4), agregar 2 productos con un clic y con el lector, **Cobrar** (F12), pagar con efectivo, **Finalizar venta**, **Recibo PDF**.    | «Una venta en segundos. El recibo sale impreso, en PDF, por WhatsApp o correo.»                   |
| 3–4  | Pagar otra venta con **transferencia**: cuenta y referencia obligatorias. Mostrar que el descuento pide motivo.                                                         | «Todo queda anotado: quién, cuánto y por qué.»                                                    |
| 4–7  | **Caja › Cerrar y arquear**: contar monedas y billetes, tarjeta y lote. Cerrar. Mostrar el **Cuadre** impreso. Probar una caja que no cuadra: pide PIN y justificación. | «El sistema nunca te completa el monto. Cuentas a ciegas, y si hay diferencia queda justificada.» |
| 7–9  | **Reportes**: elegir uno (por ejemplo «Ventas por método de pago» o «Cierres y diferencias»), poner fechas y pulsar **PDF**. Mostrar también **Excel**.                 | «Sin hojas de cálculo: lo imprimes o se lo mandas a tu contador.»                                 |
| 9–10 | Hoja de precios y **piloto de 60 días**. Preguntar: «¿Cuántas cajas tienes?»                                                                                            | «Si te sirve, lo instalamos en tu laptop y lo pruebas 60 días.»                                   |

Los precios salen de `HOJA_DE_PRECIOS.md`; no los inventes de memoria.

## La IA de ventas («Preguntar a Norexos») — apagada

**No se muestra en la demo normal.** Está apagada hasta que la dueña ponga la clave del proveedor de IA. Mientras esté apagada, la opción ni aparece en el menú, y eso es lo correcto.

Solo si la dueña la enciende (clave puesta y plan con IA):

1. Confirma que en el menú lateral aparece **Preguntar a Norexos**. Si no aparece, no sigas: está apagada.
2. Haz una pregunta corta sobre ventas, por ejemplo «¿Cuánto vendimos esta semana?». Solo lee datos; no cambia nada.
3. Aclara los límites: **10 preguntas al día por usuario**, no recuerda preguntas anteriores, no guarda lo que escribes y no muestra costos ni ganancia a la cajera.
4. Si falla o se pasa del límite, no insistas: sigue con el guion.

No prometas respuestas exactas ni ahorros: la IA puede equivocarse, y las cifras oficiales están en los reportes.

## Qué NO decir

- Que Norexos emite factura fiscal (NCF o e-CF). **No la emite**; los recibos son documento no fiscal.
- Que la IA ya funciona, si no la viste encendida.
- Que hay nube barata: la nube es Medio o Completo; el plan básico en nube no se ofrece.
