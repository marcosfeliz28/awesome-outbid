Borrador generado por IA. Revisión por un abogado dominicano colegiado antes de firmar.

# Términos de uso de la IA de ventas de Norexos («Preguntar a Norexos»)

Estado: borrador del 31-oct-2026; corregido técnicamente el 7-nov-2026 para que coincida con el código desplegado. Anexo D del contrato de servicio SaaS Norexos. Redactado para proteger a la proveedora. Siglas: CC = Código Civil; CT = Código Tributario; L172 = Ley 172-13; L53 = Ley 53-07; L126 = Ley 126-02. «verificado» = artículo leído en la fuente de `FUENTES_LEGALES.md`.

## 0. Base técnica de las afirmaciones de este documento

Lo que este documento dice sobre el funcionamiento de la IA de ventas se tomó de `apps/api/src/assistant.ts`, `apps/api/src/ai-usage.ts` (tabla `AiUsage`) y `docs/sistema/IA_VENTAS.md`. La función ya está integrada y desplegada, pero **APAGADA** mientras no se configuren el proveedor y el plan. Para cada cliente solo se activa si su Hoja de contratación la incluye. Antes de firmar, la proveedora confirma que lo desplegado sigue coincidiendo con este documento; si no coincide, lo actualiza y no afirma lo que no se cumpla. [Fundamento: honestidad de la oferta, L358 art. 48, verificado: el proveedor responde por la veracidad de lo que publicita, por prudencia]

## 1. Qué es

1.1. La IA de ventas es una función **opcional**. Solo queda activa para el cliente cuando la Hoja de contratación la identifica como incluida y el Servicio tiene configurados el proveedor y el plan correspondiente. Los topes y precios aplicables son los de esa Hoja; mientras no se aprueben y firmen, siguen **PENDIENTES**. Permite escribir una pregunta en lenguaje natural sobre las ventas del negocio y recibir una respuesta corta.

1.2. Funciona con herramientas **de solo lectura** (resumen de ventas, productos más vendidos, cobros por método y banco, comparación de períodos y ventas propias de la cajera). No hay herramienta que escriba o cambie datos; si se le pide cambiar un precio, una existencia o una venta, responde que no puede.

1.3. Usa un modelo de inteligencia artificial de un tercero (Anthropic; modelo económico configurable). El proveedor es un subencargado (Anexo III de `03_ACUERDO_ENCARGADO_TRATAMIENTO.md`).

## 2. No guarda consultas

2.1. **Norexos no persiste el texto de las preguntas ni el de las respuestas en su base funcional.** Cada pregunta es independiente: no hay memoria ni historial entre preguntas (la pantalla no reenvía historial y la API solo acepta la pregunta). La retención en registros técnicos del alojamiento o del proveedor de IA es **NO CONFIRMADA**.

2.2. Lo único que se guarda es **una fila de uso por pregunta** (tabla `AiUsage`): usuario, sucursal, fecha y hora, modelo, tokens, costo estimado y si salió bien, sin texto. Sirve para aplicar el tope diario y medir costos. No se encontró en el código de la rama una escritura del texto de la pregunta o la respuesta en la base, en la bitácora ni en un registro de peticiones (prueba automática `tests/assistant-api.test.ts`).

2.3. **Lo que sí sucede fuera de Norexos:** para responder, la pregunta y las cifras que las herramientas devuelven en ese momento se envían al proveedor de IA. El sistema no detecta ni elimina automáticamente datos personales, contraseñas, números de tarjeta u otros secretos que el usuario escriba en la pregunta antes de transmitirla; el usuario no debe incluirlos. La proveedora no controla cuánto tiempo el proveedor los conserva ni si los usa para otros fines: **NO VERIFICADO**, depende de sus términos.

2.4. Los registros técnicos del alojamiento (por ejemplo, de Render) no se revisaron para esta afirmación: NO VERIFICADO.

[Fundamento: L172 art. 5 números 1, 5 y 8 (licitud, seguridad y finalidad), verificados; L172 art. 80, verificado, por la transferencia al proveedor en el extranjero]

## 3. Qué datos ve la IA

3.1. Solo **cifras agregadas** (totales, hasta diez productos, bancos o métodos de cobro), nunca filas de ventas, ni contraseñas, PIN, datos de tarjeta o tokens. Única excepción: a la cajera, «mis ventas» le puede devolver su **última venta propia** (número de factura, total y hora) y su producto más vendido del período. Los nombres de productos y bancos se envían recortados y marcados como datos.

3.2. Los permisos se aplican en el servidor **antes** de llamar a la IA: sin permiso de reportes y sin ser cajera, la función no responde. Costo, ganancia y margen solo se muestran a quien tenga el permiso `profit:read`. La cajera solo ve sus propias ventas, sin costos y sin totales de la tienda.

3.3. El cliente es responsable de asignar bien los permisos por rol. La proveedora no responde por información que el cliente haya autorizado a ver a un usuario. [Fundamento: CC art. 1382 y 1384, verificados; L53 art. 6, verificado, para el acceso no autorizado]

## 4. Límites

4.1. **Tope diario:** según el plan (10 o 30) y nunca más de 30 preguntas por día por usuario (día de negocio en `America/Santo_Domingo`). Al llegar al tope la función avisa y no llama a la IA.

4.2. Máximo de 600 tokens por respuesta, tiempo máximo de 20 segundos, hasta 4 llamadas al modelo y 3 rondas de herramientas por pregunta, hasta 4 consultas por ronda, rangos de fechas de hasta 366 días y hasta 6 preguntas por minuto por usuario.

4.3. La función está apagada si no hay llave del proveedor, si el plan no la incluye o por mantenimiento; en ese caso el menú se oculta y, si se intenta usar, el sistema dice por qué.

4.4. La proveedora puede cambiar el modelo, los topes y las herramientas sin previo aviso cuando sea por seguridad, costo del proveedor o calidad, y con aviso de [30] días si reduce el límite de un plan pagado (PENDIENTE). [Fundamento: CC art. 1134, verificado]

## 5. Lo que la IA no es

5.1. **La IA no sustituye al contador, al asesor fiscal ni al abogado.** No prepara ni presenta declaraciones, no calcula obligaciones tributarias definitivas, no emite comprobantes fiscales, no certifica cuadres de caja y no da asesoría financiera o legal. [Fundamento: CT art. 50 letra k y art. 254 párrafo I número 16, verificados; L32 arts. 2 y 4, verificados; el cliente es quien responde por sus obligaciones]

5.2. Puede equivocarse, malinterpretar la pregunta o usar un período distinto al que se quería. Cada respuesta indica el rango de fechas y las herramientas usadas; el usuario verifica contra los reportes del sistema antes de decidir. Las cifras están pensadas para coincidir con el desglose del sistema, pero no hay garantía de que coincidan en todos los casos.

5.3. No es un canal de soporte técnico ni de emergencias.

5.4. Las respuestas son información de apoyo para la gestión. El cliente decide y asume los resultados de sus decisiones.

[Fundamento: CC art. 1134 y 1147, verificados]

## 6. Usos prohibidos

El usuario no debe: intentar obtener datos que su rol no permite, saltarse los topes, automatizar preguntas en masa, intentar manipular el modelo («inyección de instrucciones») para ver datos ajenos o revelar las instrucciones internas, usar la función para fines ilícitos, ni compartir sus respuestas como si fueran certificaciones oficiales. Una pregunta manipuladora puede ser procesada por el proveedor de IA, pero no autoriza herramientas inventadas, operaciones de escritura ni acceso a otra empresa: el servidor vuelve a validar herramientas, parámetros, rol y empresa. Esos actos pueden causar suspensión inmediata y, si hay acceso ilícito o exceso de autorización, constituyen delito. [Fundamento: L53 arts. 6 y 10, verificados]

## 7. Responsabilidad

7.1. La función se ofrece «tal como está». La proveedora no garantiza exactitud, disponibilidad ni adecuación a un fin.

7.2. La responsabilidad por la IA de ventas se rige por la cláusula 17 del contrato principal (tope y exclusiones) y no se suma a ella. [Fundamento: CC art. 1149 a 1151, verificados; validez del tope: ABOGADO]

7.3. La proveedora no responde por decisiones comerciales, de compra, de precios o de personal basadas en respuestas de la IA, ni por fallas del proveedor de IA.

## 8. Costos y plan

El uso de la IA tiene un costo variable para la proveedora. El sistema guarda los tokens de cada pregunta y calcula el costo estimado con las tarifas documentadas en `apps/api/src/ai-prices.ts`; el importe real puede cambiar si el proveedor cambia sus tarifas o aplica condiciones regionales. Los topes y precios al cliente son los de la Hoja de contratación y siguen **PENDIENTES** mientras no se aprueben. La lectura de facturas con IA es otra función, cobrada o limitada aparte, que envía el documento completo al proveedor y conserva el borrador y el adjunto en el sistema; no se rige por la sección 2.

## 9. Cambios y terminación

La proveedora puede suspender la función por uso contrario a estos términos. Estos términos se modifican con el aviso de la cláusula 24 del contrato principal. Si la función deja de ofrecerse, el cliente puede cancelar solo ese servicio y recibe crédito proporcional si lo pagó por adelantado.

[Fundamento: CC art. 1134, verificado]
