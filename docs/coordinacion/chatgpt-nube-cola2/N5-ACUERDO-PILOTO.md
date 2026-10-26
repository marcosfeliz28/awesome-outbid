# N5 · Revisión técnica del acuerdo y formulario del piloto

**Fecha de revisión:** 26 de octubre de 2026

**Alcance:** comparación documental y técnica; no se modificó el producto.

**Importante:** este informe no es asesoría legal. Sirve para que la dueña y su abogado identifiquen qué afirmaciones están respaldadas por el software y qué debe precisarse en el acuerdo.

## 1. Fuentes y límite de la revisión

Documentos revisados:

- `docs/piloto/ACUERDO_PILOTO.md`.
- `docs/piloto/FORMULARIO_OPINION_PILOTO.md`.

Código revisado:

- Rama de integración más reciente del producto: `origin/claude/producto-mezcla-4`, commit `1e7b1b2`.
- Rama de referencia de esta orden: `origin/nexora-cloud`, commit `a912333`.

Las funciones de invitación con consentimiento, paquetes de IA, cobro manual y soporte temporal de solo lectura están en `origin/claude/producto-mezcla-4`. **No están en el árbol de `origin/nexora-cloud` revisado.** Esta revisión demuestra lo que hace ese código, no que esté mezclado, desplegado o disponible para un piloto real. Antes de firmar o iniciar un piloto hay que confirmar por separado cuál commit está en el ambiente que usará el negocio.

No se revisó legislación ni se interpretó la validez de cláusulas. Tampoco se verificaron disponibilidad, copias de seguridad, entrega de datos, eliminación de empresas, WhatsApp, horarios de soporte ni operación en producción.

## 2. Resumen para la dueña

| Tema | Coincide con el código | Falta o no coincide | Riesgo práctico |
|---|---|---|---|
| Invitación y consentimiento | Sí: invitación de un uso, vencimiento, aceptación expresa, fecha, versión y bitácora | El acuerdo no explica el enlace de 7 días ni la doble evidencia: acuerdo en papel + aceptación al activar. El código no conserva una copia o huella del documento firmado | Medio |
| Piloto de 30 días | El panel propone 30 días y la API permite configurarlos | La API permite entre 1 y 365 días; 30 no es una regla fija | Medio |
| IA del plan | Sí: cuotas por plan y conteo mensual | El acuerdo no indica números, momento de reinicio, tratamiento de preguntas fallidas ni qué pasa al agotar la cuota | Medio |
| Paquetes extra de IA | Sí: 100 por RD$399 y 300 por RD$999, acreditados manualmente | No aparecen en el acuerdo; solo valen durante el mes de acreditación y no hay regla contractual sobre expiración o reembolso | Alto si se cobran durante el piloto |
| Cobro manual | Sí: transferencia, efectivo, tarjeta en el local y mensajero; activa o extiende el plan | El acuerdo omite mensajero, pago anual, comprobación de pago y anulación. El sistema solo registra un cobro hecho fuera de Nexora | Medio |
| Soporte de solo lectura | Sí: requiere permiso de la empresa, dura 24 h o 7 días, sesión de 15 min, alcance limitado y bitácora | El acuerdo solo dice “soporte por WhatsApp”; no informa el acceso técnico, qué datos ve, plazo, revocación ni registro | Alto de privacidad/transparencia |
| Copia y borrado de datos | La rama del producto incluye una exportación integral por empresa | No está demostrado el procedimiento operativo de entrega al terminar ni el borrado completo a los 30 días, incluidos respaldos y objetos | Alto |
| Formulario | Mide venta, configuración, caja, inventario, reportes, hardware, celular, precio y recomendación | No mide invitación/consentimiento, IA, cobro del plan ni soporte. La copia rápida tiene precios viejos | Medio |

## 3. Coincidencias verificadas

### 3.1 Invitación con consentimiento

El flujo técnico respalda una alta cerrada por invitación:

- En el flujo cerrado del piloto, la plataforma crea la empresa y exige nombre de operadora y referencia del acuerdo en papel (`apps/api/src/platform.ts:15-34`, `apps/api/src/platform.ts:102-127`). Existe además un registro público en `registration.ts:248-258`, pero permanece cerrado mientras `PRODUCT_PUBLIC_REGISTRATION` no se habilite explícitamente.
- El enlace vence a los 7 días, lleva el token en el fragmento de la URL y el servidor almacena su hash, no el token (`apps/api/src/platform.ts:71-77`, `apps/api/src/platform.ts:107-124`).
- La persona invitada no puede activar la cuenta sin marcar aceptación expresa (`apps/api/src/registration.ts:31-40`, `apps/web/src/Registration.tsx:105-139`).
- Al aceptar se guardan fecha, versiones del acuerdo y privacidad, método de consentimiento e IP en la bitácora (`apps/api/src/registration.ts:181-223`).
- La invitación es de un uso y puede revocarse o emitirse de nuevo con bitácora (`apps/api/src/platform.ts:223-269`).
- La prueba de PostgreSQL comprueba falta de aceptación, aceptación única, vencimiento, revocación, aislamiento entre empresas y trazabilidad (`tests/product-platform-invitation-postgres.test.ts:101-222`).

Esto coincide con la firma del acuerdo y con la obligación de usar credenciales propias. No obstante, el código registra metadatos del acuerdo (`versión`, `fecha`, `referencia`), no el contenido firmado ni una huella criptográfica del archivo.

### 3.2 Planes, cuota mensual y paquetes de IA

Los precios del acuerdo coinciden con la tabla técnica vigente:

- Autoservicio RD$1,250 y 100 preguntas.
- Básico RD$2,000 y 250 preguntas.
- Pro RD$4,000 y 600 preguntas.
- Premium RD$7,000 y 1,500 preguntas.

Fuente: `apps/api/src/billing-plans.ts:4-10`.

El consumo se cuenta por mes en la zona horaria de la empresa; la cuota del plan se suma a los paquetes acreditados y las preguntas simultáneas se serializan para no exceder el límite (`apps/api/src/platform-ai-packs.ts:35-113`). Al agotarse, la IA se bloquea con un mensaje específico, pero el resto del sistema sigue funcionando (`apps/api/src/platform-ai-packs.ts:22-26`, `apps/api/src/platform-ai-packs.ts:105-112`).

Los paquetes existentes son 100 preguntas por RD$399 y 300 por RD$999. Solo la operadora de plataforma puede acreditarlos y se exige una referencia (`apps/api/src/platform-ai-packs.ts:22-26`, `apps/api/src/platform-ai-packs.ts:116-180`). La migración intenta imponer unicidad sobre la referencia normalizada, pero omite el índice si encuentra duplicados anteriores (`apps/api/prisma/migrations/202610280025_ia08_ai_pack_reference/migration.sql:1-15`). Las pruebas confirman cuotas, precios, aislamiento, concurrencia y rechazo de referencias repetidas en una base limpia (`tests/product-platform-ai-packs-postgres.test.ts:159-267`, `tests/product-platform-ai-packs-postgres.test.ts:318-330`); antes de depender de esa garantía en una base existente hay que comprobar que el índice fue creado y que una violación de SQL crudo se traduce al 409 esperado.

### 3.3 Cobro manual del plan

El software no procesa dinero ni guarda tarjetas. La operadora anota un pago que ya recibió fuera del sistema (`apps/api/src/platform-billing.ts:11-23`). Admite:

- transferencia;
- efectivo;
- tarjeta cobrada en el local;
- mensajero.

El servidor deriva el importe del plan, acepta de 1 a 12 meses o un año equivalente a 10 mensualidades, evita dobles registros y extiende la vigencia del plan (`apps/api/src/platform-billing.ts:25-40`, `apps/api/src/platform-billing.ts:75-137`). La anulación exige motivo, agrega una fila inversa y recalcula `paidThroughAt` sin borrar el pago original (`apps/api/src/platform-billing.ts:140-170`); no recalcula en ese mismo punto todos los campos de estado, que también dependen de la consulta o del trabajador del ciclo de vida. Las pruebas cubren acceso exclusivo de plataforma, importes, métodos, reintentos, referencia duplicada, inmutabilidad, vigencia y estado de mora (`tests/product-platform-billing-postgres.test.ts:93-230`).

Esto respalda los tres medios mencionados en la cláusula 5, pero el acuerdo debe dejar claro que “pagado por tarjeta” significa cobro presencial fuera de Nexora, no una pasarela dentro del sistema.

### 3.4 Soporte temporal de solo lectura

La administradora de cada empresa debe habilitar expresamente el acceso y puede elegir 24 horas o 7 días; puede retirarlo antes (`apps/api/src/support-access.ts:14-80`, `apps/web/src/SupportAccess.tsx:9-58`). La pantalla informa antes de consentir:

- qué puede revisar soporte: catálogo, precios, existencias, movimientos, compras, promociones y configuración;
- qué no puede revisar: clientes, ventas, caja, reportes, costos ni márgenes;
- duración y bitácora.

Fuente: `apps/web/src/SupportAccess.tsx:38-57`.

La operadora solo abre una sesión si la empresa ya concedió acceso; debe identificarse y escribir un motivo. El token dura 15 minutos (`apps/api/src/support-access.ts:83-146`). El rol queda fijado a `catalog:read`, independientemente de cambios en roles editables (`packages/shared/src/index.ts:837-860`, `apps/api/src/common.ts:793-805`). La API niega cualquier escritura, registra el intento, registra cada lectura y activa además transacciones `READ ONLY` (`apps/api/src/common.ts:814-889`). La prueba de integración verifica consentimiento, aislamiento, 403 a escritura, bitácora, `READ ONLY` de PostgreSQL y vencimiento (`tests/product-support-platform-postgres.test.ts:110-165`).

## 4. Faltantes y contradicciones

### A. Acuerdo del piloto

#### A1 · Disponibilidad no demostrada en la rama de operación — riesgo alto

Las cuatro funciones revisadas están en una rama de integración del producto, no en `nexora-cloud`. El acuerdo no debe presentarse como evidencia de que esas funciones ya están disponibles. Antes del primer piloto conviene anexar o registrar internamente la versión exacta desplegada y una prueba de aceptación.

#### A2 · Acceso de soporte no descrito — riesgo alto

La cláusula 1 promete soporte por WhatsApp y la cláusula 4 autoriza usar datos para soporte (`ACUERDO_PILOTO.md:9-12`), pero no explica que la empresa puede conceder acceso técnico temporal a parte de sus datos. Tampoco dice:

- que el acceso está apagado por defecto;
- quién puede habilitarlo;
- alcance exacto de los datos visibles;
- opciones de 24 horas o 7 días;
- sesión operativa de 15 minutos;
- revocación anticipada;
- identificación y motivo de la operadora;
- bitácora de la ruta, parámetros/filtros y cada intento de escritura. No queda demostrado que la bitácora enumere literalmente cada fila mostrada, aunque la interfaz use la frase «cada pantalla y registro consultado».

El abogado debe decidir si esto va en el acuerdo, en la política de privacidad, en un anexo de soporte o en los tres.

#### A3 · Entrega de la copia y borrado sin procedimiento demostrado — riesgo alto

Las cláusulas 4 y 5 prometen copia completa “en cualquier momento”, entrega al terminar y borrado a los 30 días (`ACUERDO_PILOTO.md:12-13`). La rama del producto sí contiene una exportación integral por empresa: descubre sus modelos, incluye tablas y objetos y expone `GET /tenant/export` para administración (`apps/api/src/tenant-export.ts:27-63,141-259,298-315` en `origin/claude/producto-mezcla-4`). Lo que no quedó demostrado es el procedimiento operativo para entregar esa exportación al terminar, verificar que abre correctamente y programar y acreditar el borrado completo a los 30 días. Tampoco está definido cómo se tratan respaldos, bitácoras, comprobantes, fotos u obligaciones de conservación.

No conviene prometer un procedimiento automático hasta definir responsable, formato, plazo de entrega, validación, excepciones de conservación y constancia final.

#### A4 · Duración contractual y duración técnica pueden separarse — riesgo medio

El acuerdo fija 30 días (`ACUERDO_PILOTO.md:7`); el panel inicia en 30, pero permite 1 a 365 días (`apps/web/src/PlatformPanel.tsx:1026-1038`, `apps/web/src/PlatformPanel.tsx:1150-1158`) y la API acepta ese rango (`apps/api/src/platform.ts:24-34`). Es flexibilidad administrativa, no un fallo, pero una captura equivocada puede dar acceso por un plazo distinto al firmado. Hace falta una verificación operativa o dejar en el acuerdo que prevalece la fecha escrita.

#### A5 · Evidencia del documento firmado incompleta — riesgo medio

El alta guarda versión, fecha y referencia del papel en la bitácora, y después fecha de aceptación. No guarda el archivo firmado ni su huella criptográfica (`apps/api/src/platform.ts:18-41`, `apps/api/src/platform.ts:111-125`; `apps/api/src/registration.ts:191-219`). Debe definirse dónde se conserva el original, quién tiene acceso, cuánto tiempo se retiene y cómo se vincula inequívocamente con la referencia registrada.

#### A6 · Cuotas y paquetes de IA poco definidos — riesgo medio/alto

La cláusula 1 solo dice “IA con su cuota mensual” (`ACUERDO_PILOTO.md:9`). No identifica la cuota de Básico o Pro, qué cuenta como pregunta, cuándo reinicia, si una pregunta que falla consume cuota, ni el tratamiento de indisponibilidad del proveedor.

Los paquetes extra tampoco aparecen en el acuerdo. En el código expiran al terminar el mes de la empresa, aunque se acrediten el último día (`apps/api/src/platform-ai-packs.ts:35-67`). Si se van a vender durante el piloto, el abogado debe revisar precio, vigencia, impuestos, reembolso y qué ocurre al terminar el piloto. Si el piloto es enteramente gratis, debe decirse expresamente que no se venderán paquetes durante ese período.

#### A7 · Cobro manual y métodos incompletos en el texto — riesgo medio

La cláusula 5 enumera transferencia, efectivo y tarjeta en el local (`ACUERDO_PILOTO.md:13`). El código agrega mensajero, permite anualidad por 10 mensualidades y anulación con motivo. El acuerdo no explica:

- cuándo se considera recibido un pago;
- qué comprobante entrega cada parte;
- si los importes incluyen impuestos;
- quién verifica la referencia;
- cómo se corrige o anula un registro;
- qué ocurre con la vigencia si el pago se devuelve;
- que Nexora no procesa ni guarda los datos de la tarjeta.

#### A8 · WhatsApp y horario laboral son promesas operativas sin definición — riesgo medio

“Soporte por WhatsApp en horario laboral” (`ACUERDO_PILOTO.md:9`) no define número, días, zona horaria, tiempo de respuesta, exclusiones ni canal alterno. El código revisado no garantiza una integración de WhatsApp ni un horario. La cláusula 9 permite terminar por WhatsApp (`ACUERDO_PILOTO.md:17`), pero no identifica qué número o qué evidencia confirma la recepción.

#### A9 · Cambios, prioridad y responsabilidad no tienen procedimiento — riesgo medio/alto

Las cláusulas 2 y 8 prometen aviso previo de cambios grandes y atención prioritaria a fallos de ventas o caja (`ACUERDO_PILOTO.md:10`, `ACUERDO_PILOTO.md:16`). No se define qué es un cambio grande, cómo se avisa, qué significa prioridad, qué tiempos aplican, ni cómo reportar una incidencia. La exclusión de pérdidas indirectas debe redactarla y validarla el abogado, tal como ya advierte el borrador.

#### A10 · Identidad contractual por completar — riesgo alto antes de firma

Faltan nombre de la persona representante, identificación del negocio, fecha y firmas (`ACUERDO_PILOTO.md:5-7`, `ACUERDO_PILOTO.md:19-21`). El abogado debe confirmar si “Grupo MacGen” es la persona o entidad que puede contratar y si “Nexora POS” se usa como nombre comercial.

#### A11 · Promesas jurídicas y operativas que el código no puede probar — riesgo alto

El acuerdo afirma que Nexora no vende ni comparte datos, que sólo los usa para prestar servicio y soporte y que pertenecen al negocio (`ACUERDO_PILOTO.md:12`). El aislamiento técnico ayuda, pero no demuestra prácticas de toda la organización ni determina propiedad jurídica. De igual forma, el código no puede demostrar por sí solo la práctica humana de «Nexora nunca pide la contraseña» (`ACUERDO_PILOTO.md:15`) ni que todas las funciones anunciadas estarán operativas durante cada día del piloto. Estas afirmaciones necesitan controles operativos, responsables y revisión jurídica, no sólo referencias al código.

### B. Formulario de opinión

#### B1 · Precios contradictorios dentro del mismo documento — riesgo alto de medición

La pregunta 9 usa los rangos y planes actuales de RD$1,250, RD$2,000, RD$4,000 y RD$7,000 (`FORMULARIO_OPINION_PILOTO.md:51-53`). La “Copia rápida” usa rangos viejos: menos de RD$500, RD$500–1,000, RD$1,000–2,000, RD$2,000–3,500 y más de RD$3,500 (`FORMULARIO_OPINION_PILOTO.md:105-106`). Las respuestas de ambas versiones no serían comparables. Debe existir una sola escala.

#### B2 · Dos momentos de envío, una introducción fija — riesgo bajo/medio

El acuerdo exige responder a las 2 y a las 4 semanas (`ACUERDO_PILOTO.md:14`), pero la introducción siempre dice “durante estas 2 semanas” (`FORMULARIO_OPINION_PILOTO.md:9`). La segunda medición debería decir cuatro semanas o usar un texto neutral. También conviene asignar una versión distinta a cada corte para comparar cambios.

#### B3 · No evalúa las cuatro capacidades contractuales — riesgo medio

Las diez preguntas no preguntan si:

- la invitación y aceptación fueron claras;
- la persona entendió qué aceptaba;
- la IA respondió bien y mostró correctamente su cuota;
- el límite o un paquete adicional fue comprensible;
- la información de facturación y pago fue clara;
- el acceso de soporte fue fácil de conceder, entender y retirar.

Por tanto, el formulario no permite validar la experiencia de las funciones objeto de este acuerdo.

#### B4 · “Anónimo” necesita precisión operativa — riesgo medio

El texto dice que el nombre no es obligatorio y que se puede responder anónimamente (`FORMULARIO_OPINION_PILOTO.md:11`, `FORMULARIO_OPINION_PILOTO.md:15-21`). El abogado debe precisar si el enlace, la cuenta de Google, WhatsApp, correo, dirección IP u otros metadatos podrían identificar al negocio. “Sin nombre” no siempre equivale a “anónimo”.

#### B5 · Falta información de tratamiento del formulario — riesgo medio

El formulario dice que las respuestas se usan para mejorar, pero no indica responsable, canal, conservación, acceso, eliminación ni si las respuestas pueden citarse de forma anónima. Tampoco existe una aceptación o aviso específico para ese tratamiento. Esto debe coordinarse con la política de privacidad.

#### B6 · Placeholders y destinatario sin cerrar — riesgo alto antes de enviar

Siguen pendientes versión, fecha, responsable y contacto de soporte (`FORMULARIO_OPINION_PILOTO.md:3`, `FORMULARIO_OPINION_PILOTO.md:62`). No debe enviarse con esos campos vacíos. El encabezado “Cómo leer los resultados (para el dueño)” también debe aclarar si se refiere a la dueña de Nexora o al negocio piloto.

## 5. Riesgos ordenados por prioridad

### Altos antes de firmar o iniciar

1. Confirmar que la versión que usará el piloto contiene realmente estas funciones; hoy la evidencia está en una rama de integración.
2. Revisar y describir jurídicamente el acceso de soporte y el tratamiento de datos durante ese acceso.
3. No prometer entrega y borrado a 30 días sin un procedimiento operativo verificable; la exportación integral existe, pero falta ensayar su entrega y la eliminación posterior.
4. Definir la entidad o persona contratante y completar todos los datos y firmas.
5. Unificar los precios de la pregunta 9 y su copia rápida.
6. Si se cobran paquetes de IA, incorporar condiciones de vigencia, expiración, impuestos y reembolso.

### Medios

1. Alinear los 30 días firmados con el plazo cargado en plataforma.
2. Definir cuotas de IA y qué se considera una pregunta consumida.
3. Explicar que el cobro es externo y Nexora solo lo registra manualmente.
4. Definir WhatsApp, horario, tiempo de respuesta y constancia de avisos.
5. Conservar y vincular el acuerdo firmado con la referencia técnica.
6. Adaptar el formulario para semana 2 y semana 4 e incluir IA, invitación, cobro y soporte.
7. Precisar si la encuesta es realmente anónima y cómo se tratan sus datos.

## 6. Preguntas para llevar al abogado

1. ¿Quién debe figurar como proveedor: una persona física, una sociedad o “Grupo MacGen”, y cómo se presenta “Nexora POS” como nombre comercial?
2. ¿El acuerdo piloto y la política de privacidad deben aceptarse por separado, o basta una aceptación conjunta además de la firma en papel?
3. ¿Qué evidencia debe conservarse: original firmado, copia digital, versión, fecha, referencia, IP, huella del archivo y bitácora?
4. ¿La aceptación electrónica del enlace debe incluir el texto íntegro o enlaces a versiones inmutables?
5. ¿Cómo se describe el acceso temporal de soporte, sus categorías de datos, finalidad, duración, revocación y bitácora?
6. ¿La lectura de inventario, compras y configuración por soporte requiere una autorización específica adicional a la cláusula general de servicio?
7. ¿Qué plazo y formato pueden prometerse para entregar una copia completa de los datos?
8. ¿Qué datos pueden o deben conservarse después de terminar: facturación, seguridad, bitácoras, respaldos, comprobantes y obligaciones legales?
9. ¿Desde cuándo corren los 30 días para borrar y cómo se documenta la solicitud, la entrega y la eliminación?
10. ¿Cómo debe redactarse la limitación de responsabilidad y qué obligaciones mínimas de disponibilidad o recuperación no pueden excluirse?
11. ¿Qué significa “avisar antes de cualquier cambio grande” y qué canal constituye notificación válida?
12. ¿Qué horario, zona horaria y tiempo de respuesta se pueden prometer para WhatsApp? ¿Qué número será el canal autorizado para avisos y terminación?
13. ¿Los precios indicados incluyen impuestos? ¿Qué comprobante debe emitir Nexora por mensualidades y paquetes de IA?
14. ¿Cómo deben tratarse pago anual, pagos por mensajero, anulaciones, devoluciones y disputas de referencia?
15. ¿Los paquetes de IA pueden vencer al final del mes sin prorrateo o reembolso? ¿Cómo debe informarse antes de cobrarlos?
16. ¿Qué cuenta como “pregunta” de IA cuando hay error técnico, rechazo de seguridad, reintento o respuesta incompleta?
17. ¿Puede la encuesta llamarse “anónima” si se envía por un canal identificable? ¿Qué aviso de privacidad necesita?
18. ¿Se pueden usar comentarios o métricas del piloto en publicidad, incluso anonimizados, o se requiere autorización separada?
19. ¿La cláusula de NCF y responsabilidad ante la DGII necesita una advertencia más explícita o revisión contable independiente?
20. ¿La terminación por WhatsApp se entiende recibida al enviarse, al entregarse o al confirmarse?

## 7. Ajustes documentales recomendados para revisión jurídica

Sin modificar el producto, la siguiente versión del borrador debería:

1. identificar a las partes y al canal oficial;
2. anotar versión desplegada, fechas exactas y plan del piloto;
3. describir la invitación y la aceptación sin exponer detalles técnicos innecesarios;
4. incorporar un apartado claro de acceso temporal de soporte;
5. separar piloto gratuito de mensualidades y paquetes que solo aplicarían si continúa;
6. definir cuota de IA, reinicio y agotamiento, si la IA estará activa durante el piloto;
7. convertir la promesa de entrega/borrado en un procedimiento que use la exportación integral existente y que la operación pueda probar y acreditar;
8. unificar precios y versiones del formulario;
9. añadir al formulario preguntas sobre alta, IA, facturación y soporte;
10. mantener visible que el documento final debe aprobarlo el abogado antes de firma.

## 8. Conclusión técnica

El código de integración revisado sí contiene controles sustanciales para invitación consentida, cuotas y paquetes de IA, cobro manual, exportación integral y soporte limitado de solo lectura. La mayor brecha es que el acuerdo no describe varios controles, formula como absolutas algunas garantías condicionadas por configuración o migraciones y promete entrega y borrado a 30 días sin un procedimiento operativo demostrado. Además, la rama de operación indicada por la orden todavía no contiene estas funciones. El borrador debe volver al abogado junto con este informe y no usarse como confirmación de disponibilidad productiva.
