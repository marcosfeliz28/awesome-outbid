# Requisitos fiscales de FitStore POS — República Dominicana

**Fecha de corte: 6 de octubre de 2026.** Actividad considerada: tienda minorista de suplementos, maquillaje y fajas, operada por una persona física o una SRL. Moneda: pesos dominicanos (RD$). Se parte de la configuración propuesta de precios con ITBIS del 18 % incluido; esto no sustituye la clasificación tributaria de cada producto.

**Datos pendientes:** la dueña no tiene a mano la fecha de inscripción en el RNC ni el régimen tributario. Tampoco se conoce su clasificación oficial ante la DGII. Por eso este documento explica las condiciones aplicables, sin atribuirle a la tienda una fecha individual o un régimen que no se ha comprobado. Es un documento de requisitos: no certifica que FitStore ya los implemente.

## 1. Respuesta para la dueña: ¿debe emitir e-CF ahora?

**La tienda está comprendida, en principio, en la obligación de incorporarse a la facturación electrónica. Pero no puede afirmarse que una tienda pequeña ya esté fuera de plazo en octubre de 2026.** Si pertenece al grupo oficial de **Pequeños, Micro y no clasificados** cuyo plazo vencía el 15 de mayo de 2026, la DGII le concedió una prórroga automática de seis meses: **la fecha límite general pasa al 15 de noviembre de 2026**. No requiere solicitar esa prórroga. El aviso remite a las infracciones y sanciones de los artículos 26 y 27 de la Ley 32-23 para el incumplimiento después del plazo prorrogado. [S01], [S03]

La DGII volvió a identificar el **15 de noviembre de 2026** como fecha límite de ese grupo en su comunicación del 26 de agosto de 2026. En las fuentes consultadas al corte de este documento no se encontró una prórroga general posterior. Las páginas anteriores que todavía indiquen el 15 de mayo deben leerse junto con el Aviso 06-26. [S04]

Ser una SRL, persona física o negocio de poco tamaño no basta para fijar el plazo: hace falta la clasificación de la DGII. La inscripción reciente puede modificar la fecha individual. El régimen RST tampoco debe tratarse como una exención general de emitir comprobantes electrónicos. [S01], [S05], [S28]

### Fechas y condiciones que hay que distinguir

| Situación ante la DGII | Regla relevante al 6/10/2026 | Decisión para la tienda |
|---|---|---|
| Pequeño, Micro o no clasificado comprendido en el Aviso 06-26 | Plazo original: 15/5/2026. Prórroga automática hasta **15/11/2026**. | Completar autorización e implementación a más tardar en esa fecha, si este es su grupo. [S03], [S04] |
| Grande Local o Mediano | La DGII anunció emisión exclusivamente electrónica desde **1/11/2026**, con vigencia ordinaria de sus secuencias B hasta 31/10/2026. | No aplicar este corte a una tienda pequeña sin confirmar su clasificación. [S04] |
| Inscripción nueva o próxima al vencimiento del grupo | La DGII contempla **120 días desde la inscripción** para nuevos contribuyentes después del vencimiento; si se inscriben antes con tiempo insuficiente, debe extenderse el plazo para completar los 120 días. | Obtener fecha de inscripción y confirmación del plazo individual; no calcular una extensión sin esos datos. [S05], [S06] |
| Ya autorizada como emisora electrónica | Puede existir coexistencia B/E dentro del plazo permitido para su segmento, incluida la prórroga. Después corresponde emisión E y las excepciones de contingencia autorizada. | Revisar autorización, secuencias y política de contingencia con el contador/proveedor. [S40], [S19] |

El artículo 37 de la Ley 32-23 estableció la incorporación escalonada: 12 meses para Grandes Nacionales, 24 para Grandes Locales y Medianos, y 36 para Pequeños, Micro y no clasificados. La clasificación aplicable y cualquier comunicación individual de la DGII deben verificarse en la Oficina Virtual (OFV). [S01], [S05]

**Conclusión individual pendiente:** si la tienda es del grupo pequeño habitual, todavía tiene el plazo prorrogado en octubre. Si su clasificación, inscripción o autorización son distintas, la respuesta puede cambiar. El contador debe dejar por escrito el plazo de ese RNC antes de activar la emisión de producción.

## 2. Qué ocurre con B01, B02 y B04

Los NCF tradicionales de la serie B no desaparecieron de manera simultánea para todos los contribuyentes. Dentro del período en que su uso ordinario esté permitido, deben pertenecer a secuencias autorizadas y vigentes para el emisor. Un número interno de ticket no sustituye ese NCF. [S07]

La respuesta oficial CA4770 de la DGII permite coexistencia de B y E mientras el emisor esté dentro del plazo de su segmento, incluida la prórroga. Esto no permite emitir dos facturas por una misma operación ni prolongar el uso ordinario de B después del corte aplicable. [S40]

Al vencer el plazo obligatorio aplicable, no corresponde mantener la serie B como alternativa ordinaria por no haber terminado la integración: el reglamento contempla el vencimiento de estos comprobantes para quienes incumplen la implementación. El instructivo 606 de febrero de 2026 también advierte sobre facturas B de proveedores que debían emitir electrónicamente. La excepción relevante es la contingencia fiscal debidamente notificada y con secuencias autorizadas. [S02] (art. 55), [S31], [S19]

Para Grandes Locales y Medianos existe el corte explícito de 31/10/2026–1/11/2026. Para esta tienda falta confirmar su grupo y fecha individual: **no se debe trasladar automáticamente ese corte al grupo pequeño ni garantizar que sus B seguirán habilitados después de su vencimiento**. [S04]

Los B emitidos válidamente antes del cambio se conservan como documentos históricos. La migración no autoriza borrarlos, renumerarlos ni facturar nuevamente las mismas ventas. Para una devolución posterior de una venta antigua, el sistema debe conservar su B original y aplicar la referencia fiscal que corresponda al comprobante de ajuste. [S08], [S13]

## 3. Comprobantes que necesita la caja

| Operación | Tradicional, cuando proceda | Electrónico | Información y comportamiento necesarios |
|---|---|---|---|
| Venta al consumidor final | **B02 — Factura de consumo** | **E32 — Factura de consumo electrónica** | Productos, cantidades, precios, descuentos, impuesto y total; identificación del comprador cuando la norma/importe lo exija. |
| Venta que el cliente necesita sustentar fiscalmente | **B01 — Factura de crédito fiscal** | **E31 — Factura de crédito fiscal electrónica** | RNC del cliente, nombre/razón social y demás campos aplicables. Verificar identidad y condición del RNC; no aceptar números inventados. |
| Devolución, reducción o reversión de una venta ya facturada | **B04 — Nota de crédito** | **E34 — Nota de crédito electrónica** | Comprobante original, fecha, motivo, productos/cantidades e importes ajustados; distinguir devolución parcial y total. Mantener original y nota vinculados. |

Fuentes de tipos y referencias: [S07], [S13]. Estas son las tres necesidades básicas planteadas para la tienda. Una operación distinta —por ejemplo, aumentar después el valor de una factura— puede requerir otro tipo, como una nota de débito; no debe resolverse forzando uno de los tres anteriores.

**“Crédito fiscal” no significa vender fiado.** El tipo de comprobante responde al uso fiscal del cliente; el pago puede ser efectivo, tarjeta o crédito. Una venta a crédito se factura una vez y origina una cuenta por cobrar. El abono posterior liquida esa cuenta y genera su constancia de pago, sin repetir la venta ni su impuesto. Esta separación es un requisito contable del sistema.

### Anulaciones y devoluciones

- Cancelar un carrito antes de facturar no genera por sí solo una nota de crédito ni un comprobante anulado.
- Una venta facturada que se devuelve o revierte requiere el tratamiento de nota de crédito: conservar la factura, el ajuste y la autorización; no borrar la venta. [S36]
- Las secuencias electrónicas no utilizadas y los casos de anulación admitidos por la DGII tienen el flujo **ANECF**. No sustituye una E34 por una operación ya emitida que debe ajustarse. [S05]
- No descontar ITBIS automáticamente en cualquier devolución: la DGII distingue los ajustes dentro de **30 días desde el nacimiento de la obligación tributaria** de los posteriores. Su consulta del 3/5/2024 indica restitución sin ITBIS fuera de ese plazo. Guardar fechas y someter al contador el tratamiento de un caso tardío, separado de la política comercial de devolución. [S36]

## 4. Formas de emitir y presupuesto inicial

La Ley 32-23 contempla sistema propio, proveedor certificado y Facturador Gratuito de la DGII. La tienda requiere su autorización como emisora; contratar un proveedor autorizado no convierte automáticamente su RNC en emisor electrónico. [S01], [S09]

| Ruta | Qué se necesita | Costos comprobables y límites |
|---|---|---|
| **Sistema propio / integración propia de FitStore** | RNC activo, acceso OFV, autorización de NCF, certificado digital del firmante autorizado, implementación técnica y aprobación del proceso de certificación de emisor. | Solicitud de autorización DGII: **gratuita**. Desarrollo, integración, alojamiento, soporte y renovación: sin tarifa oficial fija; requieren presupuesto. No se encontró una cotización verificable para integrar específicamente FitStore. [S10], [S11] |
| **Proveedor de Servicios de Facturación Electrónica autorizado — PSFE** | Seleccionar una entidad del listado DGII, contratar el alcance de API/servicio y completar el proceso del RNC usando ese proveedor. | Depende de volumen, certificado, integración y servicios contratados. Hay tarifas públicas orientativas abajo; no constituyen cotización para FitStore. [S09], [S12], [S20] |
| **Facturador Gratuito DGII** | Cumplir sus condiciones, solicitar acceso por OFV y disponer de equipo/conectividad. Su admisión no es automática para todo negocio que ya usa otro sistema. | Software gratuito. Existe una facilidad de primer certificado gratuito de uso exclusivo en ese facturador; renovación a cargo del contribuyente. Confirmar disponibilidad vigente y admisión. No se comprobó una API pública para integrarlo directamente con FitStore ni emisión offline desde el POS. [S24], [S25] |

La respuesta inicial de un trámite no equivale a haber terminado la certificación técnica. No se debe prometer la puesta en producción en un día por el tiempo indicado para responder una solicitud. [S10], [S11]

### Referencias comerciales de costo, separadas de las fuentes fiscales

| Referencia publicada | Importe | Qué hay que confirmar |
|---|---|---|
| **DIGI, Cámara de Comercio de Santo Domingo:** certificado de persona física para procedimientos tributarios | **US$29.95 por 1 año** o **US$45.00 por 2 años**. | Idoneidad para el representante/firmante, impuestos, requisitos, modalidad de custodia, entrega y tipo de cambio. No confundir con un certificado de sello de otro precio. [S22] |
| **Timbro / INDEXA SRL**, campaña de 2026 | Emisión estándar sin cuota ni cargo por emisión hasta **31/12/2026, 11:59 p. m., hora dominicana**. | Excluye certificado, terceros, trabajos a medida y compromisos Corporativo contratados. [S21] |
| **Timbro**, tarifas anunciadas desde **1/1/2027** | Inicio: **RD$0/mes**, 500 facturas incluidas, adicional **RD$0.75**. Negocio: **RD$1,790/mes**, 10,000 incluidas, adicional **RD$0.14**. Por RNC; los cargos llevan ITBIS. | Elegibilidad MIPYME/RST, reglas de cálculo por volumen, integración y adicionales. Son tarifas futuras publicadas, no una cuota de octubre de 2026. [S21] |
| **Alanube Soluciones SRL** | **Por cotizar:** no se encontró precio público verificable en la página consultada. | API, incorporación del RNC, soporte, firma, exportación, contingencia, volumen e impuestos. Figura en el listado autorizado de la DGII. [S20], [S23] |

INDEXA SRL también figura en el listado autorizado DGII. Verificar de nuevo entidad, RNC y tipos autorizados al contratar. Una campaña gratuita no hace gratuita la integración completa del POS. [S20]

Para un presupuesto comparable, solicitar por escrito: costo inicial de incorporación/integración, mensualidad, comprobantes incluidos —incluidas notas—, excedentes, certificado/renovación, soporte, conservación y descarga de XML, contingencia, instalación local si hace falta y costos de salida. **No hay evidencia suficiente para asignar hoy un costo total a FitStore.**

**Orientación práctica:** para una tienda pequeña, evaluar primero una API de un PSFE autorizado si se quiere facturar desde la misma caja. El sistema propio es viable si se dispone de capacidad para completar y mantener la certificación. El Facturador Gratuito puede ser alternativa de baja complejidad, pero debe revisarse cómo evitar doble digitación y duplicados con el POS. Esta es una recomendación operativa, no una obligación legal.

## 5. Requisitos técnicos del módulo fiscal

### XML y firma

La salida fiscal debe ajustarse a los **XML y XSD vigentes de la DGII**, con el tipo, e-NCF, emisor, comprador cuando corresponda, fechas, líneas, cantidades, precios/descuentos, impuestos y totales. Las notas deben identificar el documento modificado. Un JSON enviado a la API del proveedor puede ser su interfaz interna; no sustituye el XML fiscal firmado. Conservar la versión de esquema utilizada. [S13], [S37]

Usar certificado digital válido para procesos tributarios y firmante autorizado. La especificación de firma utiliza XMLDSig con RSA-SHA256 y resumen SHA256. Una firma dibujada o un QR no sustituye esta firma criptográfica. [S14]

Recomendaciones para FitStore: proteger clave privada y contraseña con acceso restringido, controlar vencimiento, registrar el firmante y no modificar el XML después de firmarlo. La cajera no debe necesitar manipular esas credenciales para vender.

### Envío, respuesta y estados

Integrar autenticación y servicios HTTPS conforme a la documentación DGII, separando pruebas/certificación y producción. Guardar XML enviado, respuesta, identificador de seguimiento cuando corresponda, estado, códigos/mensajes y fechas. **Recibir un TrackId no significa que la DGII haya aceptado la factura:** consultar y conservar el resultado. Diferenciar recepción, procesamiento, aceptación, aceptación condicional y rechazo. Los acuses y la aprobación comercial del receptor son procesos distintos de la respuesta DGII. [S15]

Para **E32 de monto menor a RD$250,000**, existe el flujo **RFCE — Resumen de Factura de Consumo Electrónica**. El sistema debe producir/conservar el documento firmado y remitir el resumen conforme a la especificación; no aplicar a todas las E32 el mismo flujo de envío que a E31. Para el umbral igual o superior, revisar el flujo completo correspondiente. [S16], [S17]

Recomendaciones operativas: vincular un solo identificador de venta a su comprobante; reintentar envíos sin repetir cobro, inventario ni ingresos; mostrar pendientes y rechazos a la persona responsable; evitar reutilizar un e-NCF ya aceptado. La corrección de un rechazo debe seguir las reglas DGII, no una renumeración indiscriminada.

### Representación impresa y QR

La representación impresa debe mostrar los datos fiscales aplicables, desglose de ITBIS, total, e-NCF, fecha y datos de firma/seguridad exigidos. El QR dirige a la consulta de validez DGII con los parámetros requeridos; **no basta un enlace a la página principal o al ticket interno**. La variante E32 menor de RD$250,000 tiene parámetros de consulta específicos. [S17], [S18]

Probar en la impresora real que el QR conserva tamaño, margen y legibilidad conforme a la documentación. La reimpresión mantiene el mismo comprobante; no consume otra secuencia. El XML fiscal y los demás registros deben conservarse: una imagen o PDF del ticket no los reemplaza. [S08], [S17]

### Sin internet: tres escenarios distintos

| Escenario | Tratamiento fiscal | Control que debe tener FitStore |
|---|---|---|
| El emisor puede generar y firmar e-CF, pero no enviarlo por falta de conectividad | Declarar contingencia por el mecanismo DGII; generar e-CF offline y entregar representación con la leyenda oficial. Enviar al restablecer conexión, cumpliendo el plazo máximo de **72 horas** indicado por la DGII. [S19] | Conservar comprobante firmado, secuencia, venta y cola; registrar inicio/restablecimiento y alertar del vencimiento. No esperar voluntariamente 72 horas. |
| La falla técnica impide generar e-CF | Usar **secuencias B autorizadas**, con contingencia notificada. Esta modalidad no debe superar **15 días calendario**. Al finalizar, enviar a DGII los e-CF que referencian/reemplazan los B dentro de **30 días calendario**; no reenviarlos como una segunda factura al cliente. [S19] | Guardar B original, declaración y cierre de contingencia, referencia B→E y plazo de regularización. Registrar una sola venta. |
| La contingencia es de los servicios DGII | Conservar y enviar cuando se restablezca el servicio. Si supera **15 días hábiles**, la DGII habilita el procedimiento ordinario de reportes correspondiente. [S05] | Diferenciar caída DGII de caída del comercio y conservar evidencia. Seguir la comunicación oficial sobre restablecimiento y reportes. |

Guardar ventas localmente no demuestra por sí solo cumplimiento fiscal. Si el proveedor únicamente firma en la nube y no ofrece firma local, hay que acordar y probar una alternativa fiscal autorizada. “Sincronizada con el servidor del POS” y “aceptada por DGII” son estados diferentes. Estas distinciones deben verse en el panel de la dueña.

## 6. Reportes: qué se presenta y cuándo

### Matriz de obligaciones

| Reporte | Régimen ordinario, con comprobantes B cuando proceda | Emisor con facturación 100 % electrónica | RST aceptado |
|---|---|---|---|
| **606 — Compras de bienes y servicios** | En general, mensual, a más tardar el **15 del mes siguiente**. | Se mantiene; incluye comprobantes B y E de compras según las reglas aplicables. | La DGII contempla exclusión de envíos mensuales de compras/ventas; verificar modalidad y vigencia de aceptación. |
| **607 — Ventas de bienes y servicios** | En general, mensual, a más tardar el **15 del mes siguiente**. | Excluido cuando la facturación sea **100 % electrónica**. | Verificar obligaciones particulares; no asignarlo automáticamente por tratarse de una SRL. |
| **608 — Comprobantes anulados** | Cuando corresponda, con vencimiento general el **15 del mes siguiente**; revisar obligación de envío sin operaciones. | Excluido bajo la misma condición de facturación **100 % electrónica**. | Confirmar obligaciones en OFV y con el contador. |
| **IT-1 — Declaración del ITBIS** | Mensual; declaración y pago, en general, hasta el **20 del mes siguiente**. | Emitir e-CF no elimina el IT-1 ni el pago del impuesto. | Existen formularios simplificados y tratamiento por modalidad; no imponer el IT-1 ordinario sin comprobar la situación. |

Fuentes: formatos y plazos [S29], [S30]; exclusión 607/608 [S26], [S27]; RST [S28]; ITBIS [S35]. Verificar días no laborables y calendario tributario del período antes de fijar una fecha operativa. El informe diario de caja no sustituye estos envíos.

La respuesta oficial DGII sobre 607 explica que los B usados en contingencia no obligan por sí solos a duplicar reportes cuando se regularizan con sus e-CF y se conserva la condición de facturación electrónica. En meses de transición con ventas ordinarias B, el contador debe definir qué se remite y qué ya recibe la DGII, evitando duplicados. [S27]

RST exige aceptación formal y una fecha efectiva; no se presume por el tamaño del negocio. Mantener documentos aunque no se envíen los formatos mensuales. Las obligaciones anteriores a la entrada efectiva y otros deberes/retenciones aplicables deben verificarse. [S28]

### Datos que debe conservar el sistema

**606 — Por cada compra o gasto:** identificación y tipo de documento del proveedor; tipo de bienes/servicios comprados; NCF/e-NCF y comprobante modificado; fecha de factura y de pago; importes de bienes y servicios; ITBIS facturado, retenido, sujeto a proporcionalidad, llevado a costo/gasto o admitido como adelanto; retenciones/percepciones ISR e ITBIS cuando apliquen; ISC, otros impuestos y propina legal si corresponden; forma de pago. Encabezado: RNC del declarante, período y cantidad de registros. [S31]

**607 — Por cada documento de venta que deba reportarse:** identificación y tipo de documento del cliente; NCF y referencia modificada; tipo de ingreso; fecha de factura y fecha de retención aplicable; importe facturado sin ITBIS; ITBIS facturado/retenciones/percepciones y otros impuestos cuando correspondan; distribución del total por efectivo, cheque/transferencia/depósito, tarjeta, crédito y otras formas admitidas por el formato. Conservar también el encabezado mensual. Los montos por formas de pago deben conciliar con el total de la factura, no con el dinero entregado antes del cambio. [S32]

Las B02 **menores de RD$250,000** tienen tratamiento de resumen de consumo; las de **RD$250,000 o más** se detallan. Las notas que afectan B02 tienen tratamiento específico y no se omiten simplemente porque la factura original era pequeña. Esto es una regla de información tradicional; no debe confundirse con el flujo electrónico RFCE. [S34]

**608 — Por cada NCF anulable bajo el flujo aplicable:** NCF completo, fecha del comprobante y código de motivo; RNC, período y cantidad en el encabezado. Para trazabilidad, guardar además fecha/hora de anulación, usuario, autorización y motivo explicado. No generar filas por carritos descartados sin NCF. [S33]

**IT-1 y Anexo A — Base de preparación:** ventas por tratamiento/tasa, ITBIS generado, ajustes admitidos, compras/gastos con sus comprobantes e ITBIS deducible, importaciones con documentos aduaneros, retenciones sufridas y soportes. El impuesto requiere considerar créditos, pagos a cuenta y condiciones de deducción; no se calcula como el 18 % de lo recaudado en efectivo. [S35]

**Complemento contable recomendado:** saldos a favor y arrastres de períodos anteriores, proporcionalidad cuando corresponda, ajustes del contador y conciliación de percepciones/retenciones. No todo nace en la caja: alquileres, servicios, importaciones y liquidaciones del adquirente deben incorporarse al proceso contable. No basta exportar ventas para asegurar un IT-1 completo.

### Separaciones necesarias para que los reportes cuadren

- **Recepción física ≠ factura de compra:** recibir una entrega parcial modifica existencias por lo recibido; la compra fiscal y su pago se registran por sus documentos, sin replicar una factura por cada entrega.
- **Cobro ≠ venta nueva:** el abono de una cuenta por cobrar mueve dinero y saldo; no vuelve a producir ingreso/ITBIS de la venta original.
- **Tarjeta ≠ efectivo:** registrar importe aprobado, referencia y adquirente; separar comisión/retención bancaria de descuento al cliente. Conciliar contra liquidaciones, sin reducir indebidamente la venta bruta.
- **Devolución ≠ ingreso negativo sin documento:** vincular nota, productos, importe, impuestos y destino del producto —vendible o merma—. Un producto dañado no debe volver a existencias disponibles.
- **Exportación ≠ presentación:** conservar archivo enviado, validación, acuse de la DGII y correcciones; no marcar un formato “presentado” solo por descargarlo.

Estas son recomendaciones de diseño y conciliación. El mapeo final debe validarlo el contador con los instructivos vigentes.

## 7. Precios con ITBIS incluido

Para un producto efectivamente gravado al 18 %, después del descuento aplicable:

```text
Total final con ITBIS = cantidad × precio incluido − descuento autorizado
Base imponible = total final / 1.18
ITBIS = total final − base imponible
```

**Ejemplo puramente aritmético, no precio de la tienda:** RD$118.00 = base RD$100.00 + ITBIS RD$18.00. No sumar otro 18 % al precio que ya lo incluye. Usar decimales y el redondeo exigido por el formato fiscal; la factura, el cobro y el reporte deben conservar los mismos totales.

La tasa general es 18 %, pero existen bienes con otro tratamiento. No se ha establecido que cada suplemento, maquillaje o faja concreto de esta tienda tenga esa tasa: verificar el catálogo con el contador, según clasificación y régimen. Guardar tasa/tratamiento por producto y una copia histórica en cada venta; cambiar el catálogo mañana no debe alterar facturas anteriores. [S35]

## 8. Conservación, trazabilidad y respaldo

La Norma 01-20 remite al deber de conservación del Código Tributario, cuyo artículo 50 contempla **diez años**. Conservar e-CF y sus soportes de forma consultable; la representación impresa no sustituye el documento electrónico. [S08]

Requisitos operativos recomendados:

- Guardar XML firmado, e-NCF, respuestas/estados DGII, representación, notas, referencias originales y contingencias.
- Conservar copia histórica de emisor/cliente, productos, tasas, precios, descuentos y distribución de pagos de cada documento.
- Mantener registros de quién creó, autorizó, cobró, devolvió o anuló; separar usuarios y permisos.
- Registrar movimientos de caja, cuentas por cobrar, recepción, costo histórico y destino de devoluciones; vincularlos a sus documentos.
- Hacer respaldos cifrados (recomendado: Nexora POS aún no cifra el volcado por su cuenta; sólo la copia a S3 usa el cifrado del bucket si se activa) y probar restauración/exportación. Si se usa PSFE, asegurar contractualmente acceso a XML y estados durante y después del contrato.
- Usar la fecha local de la tienda, **America/Santo_Domingo (UTC−4)**, para períodos y cierres; conservar hora técnica consistente para rastrear envíos.

## 9. Lo que falta confirmar antes de activar producción fiscal

| Dato o decisión pendiente | Quién lo confirma | Evidencia que debe quedar |
|---|---|---|
| Clasificación DGII y fecha de inscripción | Dueña/contador, en OFV o con DGII | Plazo individual aplicable al RNC; prórroga general/individual si corresponde. |
| Régimen ordinario o RST y fecha efectiva | Contador | Obligaciones habilitadas y modalidad, sin presumir exclusiones. |
| Tasa/tratamiento por producto | Contador | Catálogo tributario validado; especialmente suplementos. |
| Emisor, representante y autorización | Dueña/contador | RNC activo, acceso autorizado, certificado y resolución/estado de emisor. |
| Sistema propio, PSFE o Facturador Gratuito | Dueña con propuesta técnica | Alcance, costos, plazos, soporte y propiedad/exportación de datos. |
| Secuencias y contingencia | Contador/proveedor | Tipos autorizados, e-NCF disponibles, B de contingencia y procedimiento probado. |
| Reportes y transición B→E | Contador | Matriz de reportes por período, mapeo validado y responsable de presentación. |

**No está resuelto con las fuentes públicas:** el plazo exacto de esta tienda, su régimen, la tributación de cada SKU, su admisión al Facturador Gratuito y el costo de integrar FitStore. Tampoco se ha auditado en este documento la implementación de la ronda 9.

## 10. Fuentes y fechas

Todas las fuentes se consultaron el **6/10/2026**. Las fuentes fiscales son de DGII; la legislación está alojada en su portal oficial. Las referencias comerciales S21–S23 sirven únicamente para costos/capacidades publicados. **“s/f”** significa que no se encontró una fecha absoluta de publicación visible; no se inventa una. Una fecha de actualización del catálogo se identifica como tal, no como fecha de promulgación.

| ID | Fuente enlazada | Fecha del documento o actualización verificable | Uso |
|---|---|---|---|
| S01 | [Ley 32-23][S01] | 16/5/2023 | Obligación, vías de emisión y calendario legal. |
| S02 | [Decreto 587-24][S02] | 10/10/2024 | Reglamento; contingencia y serie B. PDF oficial escaneado; las reglas operativas se contrastaron con las guías DGII. |
| S03 | [Aviso DGII 06-26][S03] | 6/5/2026 | Prórroga automática de seis meses para Pequeños, Micro y no clasificados. |
| S04 | [Comunicación DGII sobre emisión exclusiva y plazos][S04] | 26/8/2026 | Corte Grandes Locales/Medianos y reiteración del 15/11/2026 para pequeños. |
| S05 | [Preguntas frecuentes generales e-CF][S05] | Catálogo: 28/5/2026 | Inscripción nueva, ANECF, contingencia y clasificación. Fechas generales de calendario se actualizan con S03/S04. |
| S06 | [Respuesta oficial: facturación electrónica para nuevos contribuyentes][S06] | Consulta: 19/9/2026; respuesta sin fecha absoluta visible | Aplicación del plazo de inscripción frente al 15/11/2026. |
| S07 | [Guía DGII de comprobantes fiscales][S07] | s/f | B01/B02/B04 y equivalentes electrónicos. |
| S08 | [Norma General 01-20][S08] | 9/1/2020 | Modelo e-CF, documento electrónico y conservación; leer junto al reglamento posterior. |
| S09 | [Norma General 10-21][S09] | 8/11/2021 | PSFE, servicios y requisitos del cliente emisor. |
| S10 | [Ficha DGII: autorización de emisor electrónico][S10] | s/f | Requisitos y gratuidad del trámite. |
| S11 | [Proceso de certificación: emisor electrónico][S11] | Catálogo: 19/8/2025 | Certificación mediante sistema propio. |
| S12 | [Proceso de certificación con PSFE certificado][S12] | Catálogo: 29/5/2026 | Incorporación del RNC mediante proveedor. |
| S13 | [Formato XML e-CF V1.0][S13] | Catálogo: 30/10/2025 | Estructura, datos y referencias. Los XSD específicos pueden tener actualización posterior. |
| S14 | [Firmado de e-CF][S14] | Catálogo: 22/11/2023 | Firma XMLDSig y algoritmos. |
| S15 | [Descripción técnica de servicios DGII][S15] | Catálogo: 29/5/2026 | Autenticación, recepción y consulta de estados. |
| S16 | [Formato RFCE V1.0][S16] | Catálogo: 19/8/2020 | Resumen de consumo electrónico. |
| S17 | [Informe técnico e-CF V1.0][S17] | Catálogo: 6/4/2026 | Flujos, seguridad, QR y contingencia. |
| S18 | [Representación impresa: modelos ilustrativos][S18] | Catálogo: 22/4/2025 | Representación del comprobante. |
| S19 | [DGII CA4283: estado en contingencia][S19] | Publicación original: 23/1/2020; respuesta editada sin fecha absoluta visible | Respuesta oficial actual: 72 horas, B autorizado, 15/30 días; base legal actualizada al Decreto 587-24. |
| S20 | [Listado DGII de PSFE autorizados][S20] | Página dinámica, sin fecha única | INDEXA SRL y Alanube Soluciones SRL; comprobar nuevamente al contratar. |
| S21 | [Timbro: condiciones para comercios][S21] | Versión vigente desde 30/9/2026 | Campaña 2026 y tarifas anunciadas para 2027. **Fuente comercial.** |
| S22 | [DIGI: certificados de firma digital][S22] | s/f | Tarifas publicadas del certificado tributario. **Fuente comercial.** |
| S23 | [Alanube: servicio para República Dominicana][S23] | s/f | API y alcance publicado; precio no encontrado. **Fuente comercial.** |
| S24 | [DGII: Facturador Gratuito][S24] | Página sin fecha absoluta visible | Ruta gratuita y solicitud. |
| S25 | [Aviso DGII 19-25][S25] | 8/10/2025 | Extensión de facilidad de primer certificado gratuito y renovación. |
| S26 | [DGII: beneficios de la facturación electrónica][S26] | Julio de 2025 | Exclusión 607/608 cuando hay facturación 100 % electrónica. |
| S27 | [Respuesta oficial DGII: envío 607 con facturación electrónica][S27] | Consulta: 6/6/2025; respuesta sin fecha absoluta visible | 606, exclusión 607/608 y B en contingencia. |
| S28 | [Revista DGII: RST][S28] | s/f | Exclusiones mensuales, declaraciones simplificadas y aceptación efectiva. No se usan aquí sus cifras ilustrativas antiguas como topes actuales. |
| S29 | [DGII: formatos de envío de datos][S29] | s/f | Alcance general de 606/607/608. |
| S30 | [DGII: declaración y pago de impuestos][S30] | s/f | Vencimientos generales 15 y 20. |
| S31 | [Instructivo de llenado y envío 606][S31] | Febrero de 2026; catálogo: 12/2/2026 | Campos, compras B/E y advertencia sobre B de emisores obligados. |
| S32 | [Instructivo de llenado y envío 607][S32] | Catálogo: 18/12/2025 | Campos de ventas y formas de pago. |
| S33 | [Instructivo de llenado y envío 608][S33] | Catálogo: 15/6/2026 | NCF, fecha y motivo de anulación. |
| S34 | [Norma General 10-18][S34] | 5/7/2018 | Detalle/resumen de consumo y notas relacionadas. |
| S35 | [Guía DGII n.º 7: ITBIS][S35] | Julio de 2026; catálogo: 22/7/2026 | Tasas, IT-1, compras/importaciones, retenciones y plazos. |
| S36 | [Consulta técnica DGII: ITBIS en notas de crédito][S36] | 3/5/2024 | Límite de 30 días y tratamiento de ITBIS posterior. |
| S37 | [Catálogo DGII de documentación e-CF][S37] | Consulta: 6/10/2026; fechas por archivo | Vigencia y versiones de guías, XML y XSD. |
| S38 | [Catálogo DGII de formatos de envío][S38] | Consulta: 6/10/2026; fechas por archivo | Actualizaciones 606/607/608. |
| S39 | [Catálogo DGII de ITBIS][S39] | Consulta: 6/10/2026; fechas por archivo | Identificación de la guía ITBIS actualizada. |
| S40 | [DGII CA4770: coexistencia serie E y B][S40] | Publicación original: 18/3/2022; respuesta actualizada sin fecha absoluta visible | Coexistencia dentro del plazo permitido y uso posterior en contingencia. |

[S01]: https://dgii.gov.do/transparencia/baseLegal/Documents/Leyes/Ley%2032-23.pdf
[S02]: https://dgii.gov.do/legislacion/decretos/Documents/2024/Decreto587-24.pdf
[S03]: https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2026/06-26.pdf
[S04]: https://dgii.gov.do/noticias/Paginas/DGII-informa-emision-exclusiva-de-facturas-electronicas-para-Grandes-Locales-y-Medianos-contribuyentes-desde-noviembre.aspx
[S05]: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Preguntas%20frecuentes/Generales/Preguntas%20Frecuentes%20e-CF%20Generales.pdf
[S06]: https://ayuda.dgii.gov.do/conversations/discusiones/facturacin-electrnica-para-nuevos-contribuyentes/6aaebd9b402cf9d321471f7f
[S07]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/facturacion/Documents/Comprobantes%20Fiscales/1-Guia%205-Comprobantes%20Fiscales.pdf
[S08]: https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma01-20.pdf
[S09]: https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma10-21.pdf
[S10]: https://dgii.gov.do/servicios/Documents/Facturacion/TRA-Facturacion-Emisor-Electronico.pdf
[S11]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso%20de%20Certificacion%20para%20ser%20Emisor%20Electronico.pdf
[S12]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Documentaciones%20Proceso%20de%20Certificaci%C3%B3n%20FE/Proceso-Certificacion-EmisorElectronico-Proveedor-Servicios-FECertificado.pdf
[S13]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Comprobante%20Fiscal%20Electr%C3%B3nico%20(e-CF)%20V1.0.pdf
[S14]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Instructivos%20sobre%20Facturaci%C3%B3n%20Electr%C3%B3nica/Firmado%20de%20e-CF.pdf
[S15]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Descripcion%20Tecnica%20Servicios%20DGII.pdf
[S16]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Formatos%20XML/Formato%20Resumen%20Factura%20Consumo%20Electr%C3%B3nica%20v1.0.pdf
[S17]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Informe%20T%C3%A9cnico%20e-CF%20v1.0.pdf
[S18]: https://ws945695e.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Documentacin%20sobre%20eCF/Informe%20y%20Descripci%C3%B3n%20T%C3%A9cnica/Representaci%C3%B3n%20Impresa%20(Modelos%20ilustrativos).pdf
[S19]: https://ayuda.dgii.gov.do/conversations/facturacin-electrnica/ca4283-en-la-facturacin-electrnica-qu-significa-el-estado-en-contingencia/5f3c17ca8cd858ce87aad7ff
[S20]: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/Proveedores-servicios-FE-autorizados.aspx
[S21]: https://timbro.do/politicas/comercios/
[S22]: https://digi.camarasantodomingo.do/Certificados-de-Firma-Digital.html
[S23]: https://www.alanube.co/rd/
[S24]: https://www.dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/facturador-gratuito.aspx
[S25]: https://dgii.gov.do/publicacionesOficiales/avisosInformativos/Documents/2025/19-25.pdf
[S26]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/Infografias/Beneficios%20de%20la%20Facturacion%20Electronica.pdf
[S27]: https://ayuda.dgii.gov.do/conversations/discusiones/envo-607-con-facturacin-electrnica/68430e986b60527a3ecceb48
[S28]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/rst/Documents/Revista%20RST.pdf
[S29]: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscales/Paginas/formatos-envio-datos.aspx
[S30]: https://dgii.gov.do/cicloContribuyente/obligacionesTributarias/declaracionPagoImpuestos/Paginas/PagodeImpuesto.aspx
[S31]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/formatoEnvioDatos/Documents/4-LlenadoyEnvioFormato606.pdf
[S32]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/formatoEnvioDatos/Documents/5-InstructivoLlenadoyenvioFomato607.pdf
[S33]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/formatoEnvioDatos/Documents/3-Instructivo-de-llenado-y-env%C3%ADo-Formato-608.pdf
[S34]: https://dgii.gov.do/legislacion/normasGenerales/Documents/NG%20sobre%20Comprobantes%20Fiscales/Norma10-18.pdf
[S35]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/itbis/Documents/1-Guia%207%20-%20(ITBIS).pdf
[S36]: https://dgii.gov.do/legislacion/consultas/Consultas%20Tecnicas%202024/Mayo/Consulta%2018-ITBIS%20en%20notas%20de%20Cr%C3%A9dito.pdf
[S37]: https://dgii.gov.do/cicloContribuyente/facturacion/comprobantesFiscalesElectronicosE-CF/Paginas/documentacionSobreE-CF.aspx
[S38]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/formatoEnvioDatos/Paginas/default.aspx
[S39]: https://dgii.gov.do/publicacionesOficiales/bibliotecaVirtual/contribuyentes/itbis/Paginas/default.aspx
[S40]: https://ayuda.dgii.gov.do/conversations/facturacin-electrnica/ca4770-puede-un-contribuyente-emisor-electrnico-facturar-con-la-serie-e-y-b/6234a504a48a5020cd1a0100
