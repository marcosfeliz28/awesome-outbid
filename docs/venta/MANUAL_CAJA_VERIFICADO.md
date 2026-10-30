# Manual corto para la cajera (solo pasos respaldados)

Fuente: `apps/web/src/POS.tsx` de `origin/nexora-cloud` (SHA 9626b19f). Cada paso cita la línea que lo respalda.

1. **Elegir cliente:** presiona **F4** (POS.tsx:1048).
2. **Escanea o busca un artículo:** usa el lector de código de barras o búscalo; el modal «Escanear código de barras» usa la cámara (POS.tsx:1177, POS.tsx:2993).
3. **Ver subtotal:** revisa el **Subtotal** (POS.tsx:1183).
4. **Aplicar descuento global:** escribe el **Descuento global** si aplica (POS.tsx:1187).
5. **Ver total a cobrar:** revisa **Total a cobrar** (POS.tsx:1215).
6. **Cobrar:** pulsa **Cobrar** o **F12** (POS.tsx:1232, POS.tsx:1233).
7. **Confirmar la venta:** aparece **«Venta registrada»** (POS.tsx:2360).
8. **Solicitar NCF:** elige **«Solicitud de NCF»** (POS.tsx:2583).
9. **Elegir el tipo de NCF:** **B01 · Crédito fiscal** o **B02 · Consumidor final** (POS.tsx:2589 y POS.tsx:2590).

## Por confirmar con la dueña
Estos pasos no tienen respaldo en el código o están incompletos. No se publican hasta tener la respuesta.

- **Paso 1 (abrir el POS):** no hay texto de apertura en el archivo.
  - Pregunta: ¿Cómo abre la cajera el POS al empezar (qué pantalla o botón usa)?
- **Paso 4 (agregar al carrito):** no hay botón «Agregar»; solo escanear o buscar (POS.tsx:546 es un comentario).
  - Pregunta: ¿Cómo agrega la cajera un artículo al carrito: escaneando, buscando o con un botón? ¿Existe un botón «Agregar»?
- **Paso 9 (método de pago):** hay «Efectivo» (POS.tsx:2537) y los tipos de tarjeta (POS.tsx:2770–2771), pero no un texto «Elegir método de pago».
  - Pregunta: ¿Cuáles son los métodos de pago que elige la cajera y en qué pantalla aparecen?
- **Paso 10 (banco):** la cuenta aparece como «Cuenta donde cayó» (POS.tsx:2779), no como «banco».
  - Pregunta: ¿La cajera elige la cuenta donde cayó el dinero en transferencia o tarjeta? ¿Ese es el nombre que debe ver?
- **Paso 14 (imprimir la nota de crédito):** solo hay el aviso «Nota de crédito disponible» (POS.tsx:2636). «Imprimir recibo» (POS.tsx:2383) es del recibo de venta.
  - Pregunta: ¿La nota de crédito se imprime? ¿Cómo y dónde?
- **Paso 15 (finalizar y generar el comprobante):** hay «Venta registrada» (POS.tsx:2360) e «Imprimir recibo» (POS.tsx:2383); «genera el comprobante» no está escrito.
  - Pregunta: Al finalizar, ¿el sistema genera o imprime el comprobante solo? ¿Cuál es el paso exacto que hace la cajera?
