# Verificación de las citas de la FAQ de caja y de los pasos sin cita del manual (T24)

Fuente: `origin/nexora-cloud` (SHA 9626b19f), archivo **`apps/web/src/POS.tsx`** (3,004 líneas).
Nota: la ruta `apps/web/src/pages/POS.tsx` que indicó la orden no existe en esa rama; se usó la ruta real.
Solo lectura. No se editó ningún borrador. Cada fila dice qué línea respalda la afirmación, o «SIN RESPALDO».

## FAQ de caja (12 citas)

| n | afirmación (borrador) | respaldo |
|---|---|---|
| 1 | Elegir cliente con F4 (cita 1048) | 1048: «Elegir cliente · F4»; atajo F4 en 567. **Respaldado** |
| 2 | Total a cobrar (cita 1215) | 1215: «Total a cobrar». **Respaldado** |
| 3 | Cobrar con el botón o F12 (1232, 1233) | 1232: «Cobrar»; 1233: «F12». **Respaldado** |
| 4 | Carrito vacío (1176) | 1176: «Carrito vacío». **Respaldado** |
| 5 | Solicitud de NCF (2583) | 2583: «Solicitud de NCF». **Respaldado** |
| 6 | Venta a crédito: «CRÉDITO · PENDIENTE DE PAGO» (2365) | 2365: la etiqueta exacta. **Respaldado** |
| 7 | Tipo de tarjeta: Crédito o Débito (2770, 2771) | 2770: «Crédito»; 2771: «Débito». **Respaldado** |
| 8 | Cuenta donde cayó el dinero (cita 2788) | La etiqueta está en **2779** («Cuenta donde cayó»); la línea 2788 es la opción «Elige la cuenta…». **Respaldado, cita corregida a 2779** |
| 9 | Monto del envío (2871) | 2871: «Monto del envío». **Respaldado** |
| 10 | Cambio (2853) | 2853: «Cambio». **Respaldado** |
| 11 | Centrar el código en la cámara (2999) | 2999: «Centra el código en la cámara.». **Respaldado** |
| 12 | Motivo del descuento (2910) | 2910: «Motivo del descuento». **Respaldado** |

Resultado: 11 de 12 respaldadas con la línea exacta. La 8 tiene la línea corregida (2779).

## Manual corto de caja: los 7 pasos sin cita y el paso 3

| n | afirmación (borrador) | respaldo |
|---|---|---|
| 1 | Abrir el POS | **SIN RESPALDO**: no hay texto de apertura del POS en el archivo. |
| 2 | Elegir cliente con F4; «Crear» no aparece | F4 **respaldado** (1048, 567). Pero «Crear no aparece» **contradice** la línea 2000: «elige o crea al cliente». Quitar la frase «Crear no aparece». |
| 4 | Agregar al carrito | **SIN RESPALDO** como acción: no hay botón «Agregar» para el carrito. Solo hay un comentario de que escanear agrega al carrito (546). Escribirlo como «escanea o busca» (1177). |
| 9 | Elegir método de pago | **Parcial**: hay una opción «Efectivo» (2537) y los tipos de cobro en 2770–2771. No hay texto que diga «Elegir método de pago». |
| 10 | Elegir banco | **Parcial**: la cuenta para transferencia es «Cuenta donde cayó» (2779). No dice «banco». Cambiar a «cuenta donde cayó». |
| 14 | Imprimir la nota de crédito | **SIN RESPALDO**: 2636 solo dice «Nota de crédito disponible». «Imprimir recibo» (2383) es del recibo de venta, no de la nota. |
| 15 | Finalizar venta y generar el comprobante | **Parcial**: «Venta registrada» (2360) e «Imprimir recibo» (2383). «Genera el comprobante» no está escrito. |

## Paso 3: «Utiliza el lector de código de barras o busca el artículo»
- **Respaldado.** «Escanea o busca un artículo» (1177); el lector escribe como teclado (639); el modal «Escanear código de barras» (2993) usa la cámara.
- Para no mezclar lector y cámara, el manual debe decir que se puede escanear con lector o con la cámara.

## Resumen
- FAQ de caja: 11 respaldadas, 1 con línea corregida (8).
- Manual: 2 SIN RESPALDO claros (1, 14), 1 contradicción (2), 2 parciales (9, 10), 1 parcial (15), 1 SIN RESPALDO como acción (4), y el paso 3 respaldado.
- Ninguna de las 8 citas ha sido verificada contra la versión que se publicaría; esta revisión es sobre `nexora-cloud` 9626b19f.
