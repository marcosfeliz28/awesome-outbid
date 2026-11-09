# Propuesta de precios de Norexos (borrador de N1, 30-oct-2026)

Estado: PROPUESTA para la dueña. No hay estudio de mercado hecho todavía (lo investiga Claude PC, orden 95). Precios en USD; la dueña decide moneda de cobro y tipo de cambio.

## Costos conocidos

- IA de ventas (Haiku, 600 tokens por respuesta): ~US$0.005 por pregunta, ~US$1.5 por 300 preguntas. Peor caso con tope 30/día/usuario: 30 × 30 días × 0.005 = **US$4.5 por usuario al mes**. Uso real suele ser una fracción.
- Lectura de facturas con IA (Opus, cara): tope 30/día por usuario; cobrar aparte o limitar por plan.
- Hosting: Render (API + web + base) y copias; costo base por cliente depende de si se comparte la base (multiempresa). Falta medirlo.

## Opción A (recomendada): tres planes por tamaño

| Plan     | Precio/mes | Sucursales | Cajas | Usuarios | IA de ventas                 | Soporte                    |
| -------- | ---------- | ---------- | ----- | -------- | ---------------------------- | -------------------------- |
| Básico   | US$29      | 1          | 2     | 3        | no incluida                  | correo, 2 días hábiles     |
| Medio    | US$59      | 1          | 5     | 10       | 10 preguntas/día por usuario | correo + chat, 1 día hábil |
| Completo | US$119     | hasta 3    | 10    | 25       | 30 preguntas/día por usuario | prioritario, mismo día     |

- Instalación y carga de inventario (una vez): US$150 Básico, US$250 Medio, US$400 Completo (opcional si el cliente la hace solo).
- Pago anual: 2 meses gratis (≈ −16 %).
- Control de costo de IA: Medio a 10/día limita el peor caso a US$15 al mes por usuario; solo Completo permite 30/día.
- Módulos extra (GV/citas y cursos, incentivos): US$15–25 al mes cada uno.

## Opción B: un plan único (US$69/mes) con la IA aparte (US$9 por usuario que la use)

Más simple de explicar; menos ingreso en clientes grandes.

## Opción C: piloto gratis y luego plan

60 días sin costo para los 1–2 clientes del piloto (D6) a cambio de comentarios y permiso de usarlos como referencia; después pasan al plan que les corresponda con 20 % de descuento el primer año.

## Cuenta de margen (regla de la dueña: margen = (precio − costo)/precio, mínimo 15 %)

Con costo de IA hasta US$4.5 por usuario y hosting por definir, todos los planes superan el 15 % si el hosting compartido por cliente queda bajo ~US$8 (Básico), ~US$15 (Medio), ~US$30 (Completo). Hay que medir el costo real de hosting por cliente antes de fijar precios.

## Qué decide la dueña

Plan elegido (A/B/C), moneda, tipo de cambio, descuentos, si se cobra la instalación y los módulos extra.

Estudio de mercado y costo de hosting (orden 95 parte A, 31-oct-2026): ver docs/venta/ESTUDIO_PRECIOS_MERCADO.md.

## Propuesta de introducción 7-nov (pedida por la dueña: «los precios están muy caros» para República Dominicana)

Estado: APROBADA por la dueña el 7-nov-2026 («los precios que pusiste ahora son más reales; me gustan más»); sigue revisándose con el costo real que mida el medidor. Precios en US$; referencia aproximada RD$60 por US$ (confirmar tasa del día). Regla: margen = (precio − costo)/precio, mínimo 15 %, sin restar ITBIS.

Lo que cuesta de verdad (costos conocidos o medibles):

- **Instalado en la laptop del cliente: sin hosting.** El costo es tu tiempo de instalación y soporte (por medir) y nada de nube. Por eso es lo que se puede vender barato.
- **Nube dedicada: US$52–77 al mes por cliente** (Render: web 7 + API 25 + base 19 + disco 1.2, más el espacio Pro de 25 si aplica). Ningún plan de nube por debajo de ~US$62 cumple el 15 %. Para vender nube barata hay que compartir la pila entre clientes (multiempresa): **no verificado** que el producto lo soporte con seguridad.
- **IA de ventas (Haiku 5.5, US$0.10 entrada / US$0.50 salida por millón de tokens):** una pregunta cuesta del orden de US$0.001–0.003; con tope de 10/día por usuario el peor mes es ~US$1 por usuario. Dato estimado; el medidor (GET /ai/usage) dará el real.
- **Lectura de facturas con IA (Opus 5.5, US$4 / US$20 por millón):** ~US$0.10 por factura (estimado). Es la parte cara: con 30/día por usuario serían ~US$90 al mes. **No debe ir ilimitada.**

| Opción                                                  | Precio de introducción                                                | Precio de lista (después de los primeros clientes) | Qué incluye                                                                                                               |
| ------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Instalado** (1 sucursal, hasta 3 cajas, en su laptop) | **US$149 pago único** (~RD$9,000)                                     | US$249                                             | Instalador, primer año de actualizaciones y soporte por WhatsApp/correo. Renovación opcional: US$39 al año (lista US$59). |
| **IA de ventas** (opcional, por usuario)                | **US$7 al mes**                                                       | US$9                                               | 10 preguntas al día por usuario. Costo estimado ≤ US$1 → margen > 85 %.                                                   |
| **Lectura de facturas con IA** (opcional)               | 20 facturas al mes incluidas con la IA; extra **US$0.30** por factura | igual                                              | Costo estimado US$0.10 por factura → margen ~65 %.                                                                        |
| **Nube Medio** (1 sucursal, 5 cajas)                    | **US$69 al mes**                                                      | US$79                                              | Hosting dedicado; margen 24 % con US$52.                                                                                  |
| **Nube Completo** (3 sucursales, 10 cajas)              | **US$119 al mes**                                                     | US$139                                             | Margen 35–56 %.                                                                                                           |
| Nube Básico                                             | No se ofrece hasta tener hosting compartido verificado                | —                                                  | Pierde dinero.                                                                                                            |
| Instalación y carga de inventario (opcional)            | **US$75** (una laptop)                                                | US$150                                             | Una persona, medio día.                                                                                                   |

Piloto: 60 días gratis para 2–3 clientes a cambio de comentarios y permiso para citarlos; después pasan al precio de introducción.
Cuando el medidor tenga 30 días de uso real, se recalcula el precio de la IA con el costo medido (no el estimado) y se sube si hace falta.
