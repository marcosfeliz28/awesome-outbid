# Puntos para el abogado (preparación documental, NO es asesoría legal)

Fecha: 2026-11-16. Solo lectura. Archivos `[cloud]` = rama origin/nexora-cloud (líneas de esa rama). Cada fila = una línea o un bloque contiguo del archivo; una fila puede traer varias marcas. Tipo: **D** dato de la dueña, **A** revisión del abogado, **T** dato técnico que Claude puede llenar. Clase: **M** marca abierta, **Af** afirmación a confirmar.


## A. Términos de servicio del producto (docs/legal/producto)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 1 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:17` | Prueba gratis 14 días [DUEÑA: confirmar] | M | D | Dueña confirma días (la hoja de precios dice piloto de 60 días: elegir uno) | no (decisión comercial; ver conflicto 14 vs 60 días) |
| 2 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:18` | Precios en RD$ con ITBIS [DUEÑA: precios finales] | M | D | Dueña fija precios finales y moneda (hoja de precios está en US$ y no dice si incluye ITBIS) | no si el piloto es gratis |
| 3 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:20` | No borra datos por falta de pago durante [PLAZO] [ABOGADO/DUEÑA: plazo de conservación tras la baja] | M | A | Dueña propone plazo; abogado confirma mínimos legales de conservación | sí: el piloto termina con una baja |
| 4 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:33` | Datos a [PROVEEDOR DE IA]; «no entrena sus modelos» [ABOGADO: verificar contrato del proveedor y transferencia internacional] | M | A | Nombre del proveedor lo llena Claude (Anthropic según AVISO); abogado revisa contrato y transferencia | sí solo si la IA se activa en el piloto (hoy apagada) |
| 5 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:37` | Ayuda en [CANAL] en horario [HORARIO] [DUEÑA] | M | D | Dueña dice canal y horario | sí: el cliente debe saber cómo pedir ayuda |
| 6 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:43` | Negocio y contador responsables de DGII, e-CF; Nexora no emite comprobantes [ABOGADO: redactar según Ley 32-23 y estado de la e-CF] | M | A | Abogado redacta el deslinde fiscal | sí: el sistema no emite NCF/e-CF y la ley obliga e-CF |
| 7 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:48` | [ABOGADO/DUEÑA: compromiso de disponibilidad y compensación, si se ofrece] | M | A | Dueña decide si ofrece; abogado redacta o confirma que se omita | no (se puede no ofrecer) |
| 8 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:51` | [ABOGADO: límite de responsabilidad (ej. 12 meses) y exclusiones, Ley 358-05] | M | A | Abogado fija tope válido y exclusiones | sí: es la protección principal de la dueña |
| 9 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:55` | Tras la baja conserva datos [PLAZO] y luego borra [ABOGADO] | M | A | Plazo (dueña) y excepciones legales (abogado) | sí |
| 10 | `docs/legal/producto/TERMINOS_DE_SERVICIO.md:61` | Ley aplicable y tribunal: República Dominicana [ABOGADO] | M | A | Abogado confirma ley y jurisdicción | sí |

## B. Política de privacidad del producto (docs/legal/producto)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 11 | `docs/legal/producto/POLITICA_PRIVACIDAD.md:9` | Nexora trata datos por encargo del Negocio [ABOGADO: contrato de encargado del tratamiento] | M | A | Abogado confirma que el acuerdo 03 basta | sí: el cliente carga datos de sus clientes |
| 12 | `docs/legal/producto/POLITICA_PRIVACIDAD.md:22` | Proveedor IA no entrena [ABOGADO: confirmar retención y transferencia internacional] | M | A | Claude lee la política publicada del proveedor; abogado valida | sí solo si la IA está activa |
| 13 | `docs/legal/producto/POLITICA_PRIVACIDAD.md:34` | [ABOGADO: transferencias internacionales] | M | A | Abogado dice base y aviso necesarios (Render en EE. UU., Google, Telegram) | sí |
| 14 | `docs/legal/producto/POLITICA_PRIVACIDAD.md:37` | Conserva [PLAZO] tras la baja; respaldos por rotación [ABOGADO: plazos y conservación fiscal] | M | A | Dueña propone plazo; abogado/contador fijan mínimos | sí |
| 15 | `docs/legal/producto/POLITICA_PRIVACIDAD.md:43` | Derechos al Negocio; datos de cuenta a [CORREO] [ABOGADO: plazos y procedimiento Ley 172-13] | M | A | Dueña da el correo; abogado confirma plazos | sí |
| 16 | `docs/legal/producto/POLITICA_PRIVACIDAD.md:46` | Aviso de incidentes al Negocio [ABOGADO: plazos y obligación de avisar a la autoridad] | M | A | Abogado dice si hay obligación y plazo (la ley leída no la trae) | sí |

## C. Aviso de privacidad (docs/legal)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 17 | `docs/legal/AVISO_PRIVACIDAD.md:7` | Responsable legal [COMPLETAR], RNC [COMPLETAR], dirección y sucursal [COMPLETAR], contacto de privacidad [COMPLETAR] (4 marcas) | M | D | Dueña da razón social o nombre, RNC o cédula, dirección, cargo/correo/teléfono | sí: sin responsable identificado no se puede publicar el aviso |
| 18 | `docs/legal/AVISO_PRIVACIDAD.md:13` | Datos indispensables, opcionales y consecuencia de no darlos [COMPLETAR] | M | D | Dueña decide qué pide cada trámite (Claude propone con el esquema) | sí si se publica el aviso |
| 19 | `docs/legal/AVISO_PRIVACIDAD.md:15` | Base legal de cada finalidad, consentimiento, excepciones [ABOGADO] | M | A | Abogado confirma bases y cómo acreditar consentimiento | sí |
| 20 | `docs/legal/AVISO_PRIVACIDAD.md:19` | Render: región real y contrato [COMPLETAR: confirmar región real y contrato] | M | T | Claude verifica región en Render (hoy Virginia según render.yaml); contrato lo ve el abogado | sí para el piloto en nube; no para instalado |
| 21 | `docs/legal/AVISO_PRIVACIDAD.md:21` | Telegram: quién integra el grupo, accesos y conservación [COMPLETAR] | M | D | Dueña lista quién está en el grupo; Claude confirma si está activo | no si Telegram está apagado; sí si se usa |
| 22 | `docs/legal/AVISO_PRIVACIDAD.md:25` | Anthropic recibe imagen/PDF de facturas; «apagado en producción», no comprobado [COMPLETAR: contratos, ubicación, conservación y terceros realmente activos] | M | T | Claude comprueba qué está activo; contratos del proveedor los ve el abogado | no si está apagado |
| 23 | `docs/legal/AVISO_PRIVACIDAD.md:27` | Transferencia fuera de RD [ABOGADO: fundamento, requisitos, contratos, consentimiento] | M | A | Abogado confirma mecanismo (Ley 172-13 art. 80) | sí |
| 24 | `docs/legal/AVISO_PRIVACIDAD.md:31` | Plazos de conservación ventas, pagos, auditoría, expedientes [COMPLETAR con contador/abogado]; contactos y fotos [COMPLETAR: plazo y procedimiento] | M | A | Contador/abogado dan plazos fiscales y laborales; dueña define plazo operativo de contactos y fotos | sí |
| 25 | `docs/legal/AVISO_PRIVACIDAD.md:33` | Respaldo Drive: 365 días y 120 meses, ~10 años no garantizado [COMPLETAR: eliminación efectiva, papelera, descargas, retención de Google] | M | T | Claude documenta el comportamiento de Drive; abogado valida redacción | no (aviso informativo) |
| 26 | `docs/legal/AVISO_PRIVACIDAD.md:35` | Purga técnica; [COMPLETAR: plazos de Telegram, Sentry y Anthropic] | M | T | Claude lee políticas publicadas de cada proveedor | no |
| 27 | `docs/legal/AVISO_PRIVACIDAD.md:39` | Derechos [COMPLETAR: responsable, registro, canal] [ABOGADO: derechos, límites, plazos, reclamación Ley 172-13 arts. 7-15] | M | A | Dueña nombra responsable y canal; abogado confirma plazos | sí |
| 28 | `docs/legal/AVISO_PRIVACIDAD.md:45` | [COMPLETAR: aprobación y entrada en vigor] (completar identidad, bases, conservación, contratos antes de publicar) | M | D | Dueña aprueba y fecha, después del abogado | sí: nada se publica sin esto |

## D. Política de privacidad (docs/legal)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 29 | `docs/legal/POLITICA_PRIVACIDAD.md:7` | Responsable legal [COMPLETAR], RNC [COMPLETAR], dirección [COMPLETAR], correo/teléfono privacidad [COMPLETAR] (4 marcas) | M | D | Dueña da los mismos datos del aviso (una sola fuente) | sí |
| 30 | `docs/legal/POLITICA_PRIVACIDAD.md:9` | Campos obligatorios y alternativa por trámite [COMPLETAR] | M | D | Dueña decide qué es obligatorio en caja | no |
| 31 | `docs/legal/POLITICA_PRIVACIDAD.md:11` | Base jurídica por finalidad, consentimiento, obligaciones fiscales/laborales [ABOGADO] | M | A | Abogado confirma | sí |
| 32 | `docs/legal/POLITICA_PRIVACIDAD.md:15` | Render región efectiva y contrato [COMPLETAR] | M | T | Claude verifica región en Render; contrato: abogado | sí para nube |
| 33 | `docs/legal/POLITICA_PRIVACIDAD.md:23` | Transferencias internacionales [ABOGADO] y servicios activos, ubicación y retención por proveedor [COMPLETAR] | M | A | Abogado: mecanismo; Claude: lista de servicios activos | sí |
| 34 | `docs/legal/POLITICA_PRIVACIDAD.md:27` | Plazos para ventas, pagos, auditoría, clientes, empleados, fotos [COMPLETAR con contador/abogado] | M | A | Contador/abogado | sí |
| 35 | `docs/legal/POLITICA_PRIVACIDAD.md:29` | Drive: eliminación efectiva, papelera, reaplicar solicitudes tras restaurar [COMPLETAR] | M | T | Claude describe el proceso real de respaldo y restauración | no |
| 36 | `docs/legal/POLITICA_PRIVACIDAD.md:31` | Derechos, excepciones, plazos por solicitud, reclamación [ABOGADO Ley 172-13] | M | A | Abogado confirma (no fijar «10 días» sin su visto bueno) | sí |
| 37 | `docs/legal/POLITICA_PRIVACIDAD.md:37` | Procedimiento/responsable de incidentes, aprobación y entrada en vigor [COMPLETAR]; obligaciones [ABOGADO] | M | A | Dueña nombra responsable; abogado confirma obligaciones | sí |

## E. Procedimiento de derechos y registro de terceros

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 38 | `docs/legal/PROCEDIMIENTO_DERECHOS_DATOS.md:4` | Responsable [NOMBRE/CARGO], correo [CORREO DE CONTACTO], registro [UBICACIÓN] | M | D | Dueña pone nombre, correo y dónde se guarda el registro | sí si se atiende a clientes finales |
| 39 | `docs/legal/PROCEDIMIENTO_DERECHOS_DATOS.md:22` | Guardar solicitud y respuesta [N] años | M | A | Abogado/contador dan los años | no |
| 40 | `docs/legal/PROCEDIMIENTO_DERECHOS_DATOS.md:23` | Solicitudes de empleados las atiende [RR. HH./dueña] | M | D | Dueña dice quién | no |
| 41 | `docs/legal/PROCEDIMIENTO_DERECHOS_DATOS.md:35` | Si se expone un equipo o respaldo, avisar a [ABOGADO] para decidir si notificar | M | D | Dueña pone nombre y teléfono del abogado (y su aceptación) | sí: necesita abogado contratado |
| 42 | `docs/legal/PROCEDIMIENTO_DERECHOS_DATOS.md:12-31` | Plazos propuestos: acuse 2 días hábiles, verificación 3, respuesta 10 (prórroga única de 10) | Af | A | Abogado confirma contra Ley 172-13 art. 8 (PUNTOS_VERIFICADOS: 10 días hábiles para rectificar o suprimir) | no |
| 43 | `docs/legal/REGISTRO_TERCEROS.md:28` | [ABOGADO: confirmar bases, derechos, conservación y transferencias internacionales] | M | A | Abogado revisa registro de terceros | sí |

## F. Contrato 01 SaaS (nexora-cloud)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 44 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:1` | «Borrador generado por IA. Revisión por un abogado dominicano colegiado antes de firmar» | Af | A | Abogado revisa completo (los 6 contratos y los 3 anexos llevan este aviso) | sí: no se firma sin revisión |
| 45 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:13` | Proveedora: [NOMBRE LEGAL], RNC/cédula [COMPLETAR], domicilio [COMPLETAR], representante [NOMBRE Y CALIDAD], correo [COMPLETAR] (+ soporte@norexos.ai solo si dominio registrado) | M | D | Dueña: nombre legal o sociedad, RNC, domicilio, representante, correo real | sí |
| 46 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:15` | Cliente: razón social, RNC, domicilio, representante y poder, correo (4 [COMPLETAR]) | M | D | Se llena por cliente al firmar | sí (por cliente) |
| 47 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:35` | Ley 358-05 arts. 81-83 y su aplicación a clientes empresariales: ABOGADO | M | A | Abogado dice si el cliente cuenta como consumidor | sí |
| 48 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:37-46` | Precios de introducción; módulos extra 15 a 25 USD (PENDIENTE); pago anual 2 meses gratis (PENDIENTE); piloto gratis y descuento (PENDIENTE) | M | D | Dueña decide módulos, descuento anual y piloto | sí: piloto (condiciones) / no el resto |
| 49 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:56` | Precio en dólares y moneda de cobro PENDIENTES | M | D | Dueña decide USD o DOP | sí |
| 50 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:60-64` | Duración [mes/12 meses], aviso de no renovar [30] días, no renovación de la proveedora [60] días (PENDIENTE) | M | D | Dueña elige | no para el piloto; sí para el contrato pagado |
| 51 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:72` | Sin reembolso salvo falla grave de más de [72] horas seguidas (PENDIENTE) | M | D | Dueña decide el número; abogado revisa validez | no |
| 52 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:74` | Plan anual: sin devolución de meses no usados (PENDIENTE) | M | D | Dueña decide | no |
| 53 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:76` | Exportación de datos [30] días tras cancelar (PENDIENTE) | M | D | Dueña decide; abogado confirma contra conservación | sí |
| 54 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:78` | Limitación del remedio a un crédito: «su validez: ABOGADO» | Af | A | Abogado confirma | sí |
| 55 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:98, 110` | Protección del programa y propiedad intelectual, Ley 65-00: NO VERIFICADO | M | A | Abogado confirma | no |
| 56 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:126` | Horario de soporte [PENDIENTE: ej. 8:00 a 18:00] | M | D | Dueña dice horario | sí |
| 57 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:128` | Objetivo de disponibilidad [99] % mensual (PENDIENTE; «objetivo, no garantía») | Af | D | Dueña decide si lo publica; abogado confirma que no sea promesa | no (se puede omitir) |
| 58 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:134` | Obligación de medios y no de resultado: ABOGADO | Af | A | Abogado confirma | sí |
| 59 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:150` | Facturación electrónica: aviso DGII 14-25 verificado; art. 37 de la Ley 32-23 NO VERIFICADO | Af | A | Abogado lee el texto de la ley | sí |
| 60 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:154` | Cliente garantiza el ITBIS (taxRate); «tasa vigente: ABOGADO o contador» (sistema usa 18 %) | Af | A | Contador confirma tasa vigente | sí |
| 61 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:170` | Confidencialidad [5] años después (PENDIENTE) | M | D | Dueña decide años | no |
| 62 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:190` | Tope de responsabilidad: [3] meses pagados (PENDIENTE: 3 o 12 meses) | M | A | Dueña con abogado | sí |
| 63 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:198` | Validez del tope frente a dolo o falta grave: ABOGADO (sin artículo hallado) | Af | A | Abogado | sí |
| 64 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:210` | Suspensión con aviso de [5] días hábiles; ABOGADO (sin artículo leído) | M | A | Dueña da días; abogado valida suspensión sin juez | no para el piloto gratis |
| 65 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:214` | Resolución por incumplimiento, corrección en [10] días hábiles; eficacia de la resolución de pleno derecho: ABOGADO | M | A | Abogado (CC art. 1184) | no |
| 66 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:218` | Exportación [30] días y supresión máx. [60] días (PENDIENTE); «no existe purga automática por empresa» | M | D | Dueña decide plazos; abogado confirma | sí |
| 67 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:238` | Aceptación simple en pantalla/correo entre profesionales: ABOGADO (firma digital exige certificado INDOTEL) | Af | A | Abogado dice qué forma de firma usar | sí: hay que firmar el piloto |
| 68 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:254` | Tribunal competente [PENDIENTE: Distrito Nacional / domicilio de la proveedora] | M | D | Dueña propone; abogado decide | sí |
| 69 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:256` | Contrato mercantil y competencia territorial: ABOGADO | Af | A | Abogado | sí |
| 70 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:264-272` | Anexo A: plan, instalación, moneda, periodicidad, descuento o piloto (PENDIENTE) | M | D | Se llena por cliente al firmar | sí (por cliente) |
| 71 | `[cloud] docs/venta/contrato/01_CONTRATO_SERVICIO_SAAS.md:284` | Firma ante notario: procedimiento no verificado: ABOGADO | Af | A | Abogado dice si hace falta notario | no |

## G. Contrato 06 licencia instalada (nexora-cloud)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 72 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:1` | «Borrador generado por IA. Revisión por un abogado dominicano colegiado antes de firmar» | Af | A | Abogado revisa completo | sí |
| 73 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:13` | Proveedora: nombre legal, RNC/cédula, domicilio, representante, correo (5 [COMPLETAR/NOMBRE]) | M | D | Dueña (mismos datos que el 01) | sí |
| 74 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:15` | Cliente: razón social, RNC, domicilio, representante, correo | M | D | Por cliente al firmar | sí (por cliente) |
| 75 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:38` | Ley 358-05 arts. 81-83 y clientes empresariales: ABOGADO | Af | A | Abogado | sí |
| 76 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:42` | Límites de cajas y usuarios del Anexo A (PENDIENTE) | M | D | Dueña (propuesta: 3 cajas) | sí (por cliente) |
| 77 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:46` | Cambio de equipo [una vez al año sin costo; PENDIENTE] | M | D | Dueña | no |
| 78 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:54-56` | Precio US$149 único; instalación US$75; módulos extra y descuentos o piloto [PENDIENTE] | M | D | Dueña confirma (introducción aprobada 7-nov); módulos/piloto pendientes | sí (piloto), no el resto |
| 79 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:60` | Tasa del recargo por mora: ABOGADO | Af | A | Abogado | no para piloto gratis |
| 80 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:62` | Sin reembolso salvo falla de instalación en [10] días hábiles; devolución del pago único (PENDIENTE); validez: ABOGADO | M | D | Dueña decide; abogado valida | no para piloto gratis |
| 81 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:68` | Cuota cada [12] meses; primer año [PENDIENTE] | M | D | Dueña | no |
| 82 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:70` | Cuota de reactivación [PENDIENTE] | M | D | Dueña | no |
| 83 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:122` | Ley 65-00 (ingeniería inversa) y registro de la marca ante ONAPI: NO VERIFICADO | Af | A | Abogado: buscar marca «Norexos» en ONAPI | sí: no usar marca pública sin esto |
| 84 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:128` | 9.2 [PENDIENTE: ¿clave o activación técnica de licencia?] (hoy el instalador no la exige) | M | D | Dueña decide; Claude confirma estado técnico | no |
| 85 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:138` | Soporte a versiones antiguas: aviso [90] días y [PENDIENTE] | M | D | Dueña | no |
| 86 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:146` | Canales de soporte [correo soporte@norexos.ai solo cuando exista; WhatsApp: PENDIENTE] | M | D | Dueña dice canales; dominio debe estar registrado | sí |
| 87 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:148` | Horario [PENDIENTE] y tiempo de respuesta [PENDIENTE] | M | D | Dueña | sí |
| 88 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:156` | Soporte sin cuota: tarifa [PENDIENTE] | M | D | Dueña | no |
| 89 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:164` | Registro de accesos remotos: plazo de conservación [PENDIENTE: plazo] | M | D | Dueña propone; abogado confirma | no |
| 90 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:170` | [ABOGADO: ¿se firma el acuerdo 03 como anexo o basta esta cláusula?] | M | A | Abogado | sí si hay soporte remoto con datos |
| 91 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:174` | Aviso de brechas: sin obligación expresa hallada en la Ley 172-13: NO VERIFICADO | Af | A | Abogado dice si existe norma | sí |
| 92 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:182` | IA: el proveedor no se sabe cuánto conserva ni si entrena: NO VERIFICADO | Af | T | Claude lee política publicada; abogado valida | no si la IA está apagada |
| 93 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:188` | Transferencia internacional: quién informa al titular; «mecanismo: ABOGADO» | Af | A | Abogado | sí si se activa la IA |
| 94 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:198` | Facturación electrónica art. 37 Ley 32-23: NO VERIFICADO | Af | A | Abogado | sí |
| 95 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:200` | ITBIS tasa vigente: «ABOGADO o contador» | Af | A | Contador | sí |
| 96 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:208` | Garantía de funcionamiento [90] días (PENDIENTE) | Af | D | Dueña decide; abogado valida el remedio único | sí: es una promesa |
| 97 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:214` | Obligación de medios y exoneración mínima (Ley 358-05 art. 83): ABOGADO | Af | A | Abogado | sí |
| 98 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:218` | Confidencialidad [5] años (PENDIENTE) | M | D | Dueña | no |
| 99 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:224` | Resolución por incumplimiento [10] días; eficacia de pleno derecho: ABOGADO | M | A | Abogado | no |
| 100 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:226` | Terminación sin causa [60] días y devolución proporcional (PENDIENTE) | M | D | Dueña | no |
| 101 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:228` | Bloqueo técnico de licencia con [10] días de aviso [PENDIENTE: confirmar con la dueña] | M | D | Dueña | no |
| 102 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:238` | Tope de responsabilidad [12] meses (PENDIENTE: dueña con abogado) | M | A | Dueña con abogado | sí |
| 103 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:246` | Validez del tope frente a dolo o falta grave: ABOGADO | Af | A | Abogado | sí |
| 104 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:270` | Aceptación simple entre profesionales: ABOGADO | Af | A | Abogado | sí |
| 105 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:286` | 25.3 Jurisdicción: PENDIENTE (Distrito Nacional / domicilio proveedora / cliente); «no se completa hasta que lo defina un abogado» | M | A | Abogado | sí |
| 106 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:288` | Competencia territorial: ABOGADO (CPC no leído) | Af | A | Abogado | sí |
| 107 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:299` | Anexo A: SHA-256 del instalador [COMPLETAR] | M | T | Claude calcula el hash de cada instalador entregado | sí (se llena al entregar) |
| 108 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:300-302` | Anexo A: sucursal licenciada, equipo (marca, modelo, PC), cajas y usuarios [COMPLETAR] | M | D | Por cliente al firmar | sí (por cliente) |
| 109 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:303-307` | Anexo A: módulos, pago único, instalación, cuota anual, primer año (PENDIENTE) | M | D | Por cliente al firmar | sí (por cliente) |
| 110 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:309-310` | Anexo A: moneda y tipo de cambio, descuento o piloto (PENDIENTE) | M | D | Dueña | sí |
| 111 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:311, 317` | Anexo A: canales/horario de soporte [COMPLETAR]; jurisdicción [PENDIENTE] | M | D | Dueña (jurisdicción: abogado) | sí |
| 112 | `[cloud] docs/venta/contrato/06_CONTRATO_LICENCIA_INSTALADO.md:331` | Firma ante notario: ABOGADO | Af | A | Abogado | no |

## H. Contratos 02-05 de nexora-cloud (no estaban en el encargo; también tienen marcas)

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 113 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:9` | Proveedora [NOMBRE LEGAL, RNC, DOMICILIO, CORREO DE PRIVACIDAD: COMPLETAR] | M | D | Dueña | sí |
| 114 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:52-54, 61` | Retención y entrenamiento del proveedor de IA: NO VERIFICADO | Af | T | Claude lee la política publicada del proveedor | no si IA apagada |
| 115 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:60` | Render: región efectiva y contrato [COMPLETAR] | M | T | Claude verifica región | sí para nube |
| 116 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:62-64` | Drive «respaldos cifrados (AES-256-GCM antes de subirlos)», Telegram, Sentry: NO VERIFICADO | Af | T | Claude verifica en código si el cifrado AES-256-GCM existe (LICENCIAS_Y_AFIRMACIONES #21 dice que el volcado no se cifra por su cuenta) | sí si se promete cifrado |
| 117 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:65` | Correo y cobros: proveedor y país [COMPLETAR] | M | D | Dueña dice qué servicio de correo y cobro usa | no |
| 118 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:71` | Si el alojamiento en la nube exige consentimiento y qué mecanismo [ABOGADO] | M | A | Abogado | sí |
| 119 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:79` | Aviso de incidente en máximo [72] horas (PENDIENTE); sin norma hallada que obligue | M | A | Dueña acepta el compromiso; abogado dice si hay obligación | sí |
| 120 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:87` | Derechos: ayuda en 2 días hábiles (PENDIENTE); correo de privacidad [COMPLETAR] | M | D | Dueña | sí |
| 121 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:97` | Conservación: exportar [30] días y supresión [60] días (PENDIENTE) | M | D | Dueña | sí |
| 122 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:105` | Ley 53-07 art. 56 (conservar 90 días datos de tráfico): ¿aplica?: ABOGADO | Af | A | Abogado | no |
| 123 | `[cloud] docs/venta/contrato/02_POLITICA_PRIVACIDAD.md:113, 117` | Contacto de privacidad [CORREO: COMPLETAR]; ¿inscripción ante un órgano de control?: NO VERIFICADO | M | D | Dueña da correo; abogado responde lo de inscripción | sí |
| 124 | `[cloud] docs/venta/contrato/03_ACUERDO_ENCARGADO_TRATAMIENTO.md:49, 59, 103` | Obligación de medios, mecanismo de transferencia y tope ante la ley de datos: ABOGADO | Af | A | Abogado | sí |
| 125 | `[cloud] docs/venta/contrato/03_ACUERDO_ENCARGADO_TRATAMIENTO.md:73-75` | Aviso de incidente [72] horas (PENDIENTE); norma sobre brechas NO VERIFICADO | M | A | Dueña + abogado | sí |
| 126 | `[cloud] docs/venta/contrato/03_ACUERDO_ENCARGADO_TRATAMIENTO.md:89-91` | Exportar [30] días y supresión máx. [60] días (PENDIENTE); no hay purga automática | M | D | Dueña | sí |
| 127 | `[cloud] docs/venta/contrato/03_ACUERDO_ENCARGADO_TRATAMIENTO.md:137-140` | Tabla de subencargados (Anthropic, Google Drive, Telegram, Sentry): país y retención NO VERIFICADO | Af | T | Claude completa con configuración real y políticas publicadas | sí si se usan |
| 128 | `[cloud] docs/venta/contrato/03_ACUERDO_ENCARGADO_TRATAMIENTO.md:141` | [Correo y cobros: COMPLETAR] | M | D | Dueña | no |
| 129 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:7-9` | Precios (PENDIENTE): módulos 15 a 25, pago anual dos meses gratis; piloto 60 días | M | D | Dueña | no |
| 130 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:15-19` | Moneda [USD/DOP]; tasa [FUENTE Y FECHA: COMPLETAR; PENDIENTE]; ajuste si varía [5] %; regla de moneda extranjera NO VERIFICADO | M | A | Dueña elige moneda y fuente de tasa; abogado valida ajuste | sí si cobra en pesos |
| 131 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:27, 31` | Retenciones de ITBIS/ISR y Ley 32-23/Decreto 587-24: NO VERIFICADO | Af | A | Contador/abogado | no para piloto gratis |
| 132 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:33` | Costo administrativo por reemisión de factura [PENDIENTE] | M | D | Dueña | no |
| 133 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:37-43` | Factura [5] días antes; medios de pago [PENDIENTE]; instalación no reembolsable (PENDIENTE) | M | D | Dueña | no para piloto gratis |
| 134 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:51-59` | Mora automática (ABOGADO); recargo [1.5] % mensual (PENDIENTE); suspensión [5] días; datos [30] días; reactivación [PENDIENTE]; honorarios de abogado (ABOGADO) | M | A | Dueña con abogado | no para piloto gratis |
| 135 | `[cloud] docs/venta/contrato/05_CONDICIONES_DE_COBRO.md:69-73` | Reembolso por falla grave, plan anual, piloto gratis 60 días (PENDIENTE) | M | D | Dueña | sí (piloto) |
| 136 | `[cloud] docs/venta/contrato/04_TERMINOS_USO_IA_VENTAS.md:13, 47, 75` | IA de ventas: topes y precios PENDIENTES; aviso [30] días si reduce límite | M | D | Dueña | no (IA apagada) |
| 137 | `[cloud] docs/venta/contrato/04_TERMINOS_USO_IA_VENTAS.md:25, 27` | Retención y entrenamiento del proveedor de IA; alojamiento: NO VERIFICADO | Af | T | Claude lee política publicada | no (IA apagada) |
| 138 | `[cloud] docs/venta/contrato/04_TERMINOS_USO_IA_VENTAS.md:69` | Validez del tope de responsabilidad por la IA: ABOGADO | Af | A | Abogado | no (IA apagada) |

## I. Afirmaciones de producto: landing y hoja de precios

| n | archivo:línea | marca o afirmación textual | clase | tipo | qué se necesita para cerrarla | ¿bloquea el primer piloto? |
|---|---|---|---|---|---|---|
| 139 | `docs/venta/LANDING_TEXTOS.md:32-33` | «Comprobantes NCF. Emite comprobantes con las secuencias NCF que tú declaras» (verificar con contador) | Af | A | Abogado/contador: borrar o redactar; contradice «Norexos no emite NCF ni e-CF» de la hoja de precios y de la landing publicada | sí: promesa fiscal falsa si se publica |
| 140 | `docs/venta/LANDING_TEXTOS.md:42, 57-58` | Tabla comparativa «Comprobantes NCF: Sí» y FAQ «¿Emite comprobantes NCF? Sí» | Af | A | Igual: quitar hasta que exista emisión real y revisión | sí |
| 141 | `docs/venta/LANDING_TEXTOS.md:61-62` | «¿Mis datos están seguros? Acceso por rol y copias de respaldo» (verificar con abogado) | Af | A | Abogado: aceptar solo descripción factual; la nota 6 del propio archivo prohíbe prometer respaldo cifrado | sí |
| 142 | `docs/venta/LANDING_TEXTOS.md:66` | «Empezar prueba gratis (sin tarjeta)» frente a 14 días (TERMINOS) y piloto 60 días (hoja) | Af | D | Dueña unifica prueba/piloto | no |
| 143 | `docs/venta/LANDING_TEXTOS.md:6` | Nota: no usar el nombre «Nexora» hasta auditoría de marca; ONAPI sin verificar; landing usa nexorapos.net y norexos.net | Af | A | Abogado: búsqueda de marca en ONAPI | sí para publicar |
| 144 | `[cloud] docs/venta/LANDING_EN_PLANES.md:33, 42, 57, 60` | Landing EN: facturación NCF [RETIRADO: pendiente de revisión legal]; «Control de acceso por rol» | Af | A | Abogado confirma que se mantenga retirado | no |
| 145 | `docs/venta/HOJA_DE_PRECIOS.md:18` | «Norexos no emite NCF ni e-CF. Los recibos son documento no fiscal.» | Af | A | Abogado confirma que el deslinde basta dado que la Ley 32-23 obliga e-CF a los negocios (PUNTOS_PARA_ABOGADO #4) | sí |
| 146 | `docs/venta/HOJA_DE_PRECIOS.md:7-8` | «Sin mensualidad», «primer año de actualizaciones y soporte», renovación US$39 opcional | Af | A | Abogado: que coincida con 06 cláusulas 4 y 5 | no |
| 147 | `docs/venta/HOJA_DE_PRECIOS.md:9, 19` | IA de ventas: «Solo lee datos» y «Apagada hasta que la dueña ponga la clave» | Af | T | Claude verifica en código que es solo lectura y que está apagada | no |
| 148 | `docs/venta/HOJA_DE_PRECIOS.md:11-12` | Nube «Hosting dedicado» (Medio y Completo) | Af | T | Claude verifica qué es «dedicado» en Render antes de prometerlo | sí si el piloto es en nube |
| 149 | `docs/venta/HOJA_DE_PRECIOS.md:14` | «Piloto: 60 días sin costo… a cambio de comentarios y permiso para citarlos» | Af | A | Abogado redacta el permiso de uso del nombre del cliente | sí |
| 150 | `docs/venta/HOJA_DE_PRECIOS.md:20` | Instalado: «el respaldo en la misma laptop no te protege… la copia en USB es responsabilidad del cliente» | Af | A | Abogado confirma cláusula 7 y 18.2 del 06 | sí |
| 151 | `docs/venta/HOJA_DE_PRECIOS.md:23` | Soporte: WhatsApp [COMPLETAR]. Correo: [COMPLETAR] | M | D | Dueña | sí |
| 152 | `docs/venta/HOJA_DE_PRECIOS.md:3, 7` | Precios en US$ (~RD$60 por US$, «confirmar tasa»); no dice si incluyen ITBIS | Af | A | Contador: si el precio lleva ITBIS y cómo se factura | sí si cobra |

## 1. Conteo

Total de filas: **152** = D 62 + A 75 + T 15 (= 152).

Por clase: marcas abiertas (M) 105 + afirmaciones (Af) 47 = 152.

| Grupo | filas | D | A | T |
|---|---|---|---|---|
| A. Términos de servicio del producto (docs/legal/producto) | 10 | 3 | 7 | 0 |
| B. Política de privacidad del producto (docs/legal/producto) | 6 | 0 | 6 | 0 |
| C. Aviso de privacidad (docs/legal) | 12 | 4 | 4 | 4 |
| D. Política de privacidad (docs/legal) | 9 | 2 | 5 | 2 |
| E. Procedimiento de derechos y registro de terceros | 6 | 3 | 3 | 0 |
| F. Contrato 01 SaaS (nexora-cloud) | 28 | 14 | 14 | 0 |
| G. Contrato 06 licencia instalada (nexora-cloud) | 41 | 22 | 17 | 2 |
| H. Contratos 02-05 de nexora-cloud (no estaban en el encargo; también tienen marcas) | 26 | 12 | 9 | 5 |
| I. Afirmaciones de producto: landing y hoja de precios | 14 | 2 | 10 | 2 |
| **Suma** | **152** | 62 | 75 | 15 |

Bloquean el primer piloto (columna empieza con «sí»): **100**; no bloquean: **52**. Nota: «sí (por cliente)» se llena al firmar con cada cliente.

Marcas literales `[ABOGADO]/[DUEÑA]/[COMPLETAR]` en los 8 archivos del encargo (excluyendo PENDIENTE y fundamentos): se enumeran en los grupos A-G; el resto son marcas PENDIENTE, NO VERIFICADO y notas «ABOGADO» de fundamento, que también quedan abiertas.


## 2. Lo que la dueña puede llenar hoy sin abogado

Datos de identidad y contacto (una sola vez, se reutilizan en todos los archivos): nombre legal o sociedad, RNC o cédula, domicilio, representante y su calidad, correo de avisos y de privacidad (el correo `soporte@norexos.ai` solo vale con el dominio registrado), WhatsApp y teléfono, responsable de derechos de datos, nombre y teléfono del abogado, quién está en el grupo de Telegram.

Decisiones de negocio (el abogado solo las revisa después): días de prueba o piloto (14 vs 60), canal y horario de soporte, tiempo de respuesta, moneda USD o DOP, módulos, descuento anual, plazos de exportación (30 días) y supresión (60 días), duración y renovación, aviso de no renovación, reembolso por falla, objetivo de disponibilidad, años de confidencialidad, cuota de reactivación, garantía de 90 días, jurisdicción preferida, qué datos pide cada trámite en caja.

Filas de tipo D (por n): 1, 2, 5, 17, 18, 21, 28, 29, 30, 38, 40, 41, 45, 46, 48, 49, 50, 51, 52, 53, 56, 57, 61, 66, 68, 70, 73, 74, 76, 77, 78, 80, 81, 82, 84, 85, 86, 87, 88, 89, 96, 98, 100, 101, 108, 109, 110, 111, 113, 117, 120, 121, 123, 126, 128, 129, 132, 133, 135, 136, 142, 151.

Filas de tipo T (las llena Claude): 20, 22, 25, 26, 32, 35, 92, 107, 114, 115, 116, 127, 137, 147, 148.


## 3. Las 10 preguntas más importantes para el abogado

1. El sistema no emite NCF ni e-CF y la Ley 32-23 obliga la factura electrónica. ¿Basta la frase «Norexos no emite comprobantes; es responsabilidad del negocio» o hay riesgo para nosotros por vender un punto de venta que no factura? (filas de la hoja de precios, términos y contratos)
2. ¿Podemos limitar nuestra responsabilidad a lo pagado en 3 o 12 meses? ¿Vale si hay mala fe o falta grave? ¿Y si el cliente es una persona pequeña que cuenta como «consumidor» (Ley 358-05)?
3. ¿Quién firma primero: la dueña como persona física o una sociedad? ¿Qué papeles de la proveedora y del cliente hay que pedir (RNC, registro mercantil, poder)?
4. ¿Cómo se firma el piloto para que valga: aceptación en pantalla o por correo, firma digital con certificado o firma manuscrita ante notario?
5. Los datos de los clientes de nuestros clientes (nombres, cédula, teléfonos) viven en servidores de EE. UU. (Render) y, si se activan, Google, Telegram, Sentry y Anthropic. ¿Qué necesitamos hacer según la Ley 172-13: consentimiento, aviso, contrato con cada proveedor?
6. ¿Basta nuestro «acuerdo de encargado del tratamiento» (documento 03) para ser encargada, o hay un modelo oficial? ¿Hay obligación de avisar a la autoridad o a las personas si hay una filtración, y en cuántas horas?
7. ¿Por cuánto tiempo debemos guardar los datos (ventas, pagos, auditoría) y cuánto podemos o debemos conservar después de que el cliente se va? ¿Valen 30 días para exportar y 60 para borrar?
8. ¿Podemos suspender el servicio por falta de pago y dar por terminado el contrato sin ir a un tribunal? ¿Qué recargo mensual por mora es válido y exigible?
9. ¿Qué tribunal y qué ley deben aplicar? ¿Se trata el contrato como mercantil? ¿Conviene arbitraje o solo tribunales?
10. El nombre «Norexos»: ¿está registrado o libre en ONAPI? ¿Cómo protegemos el programa (derecho de autor) y qué podemos prohibir al cliente (copiar, ingeniería inversa, revender)? Y: ¿se puede citar al cliente piloto como referencia con su permiso por escrito?

## 4. Afirmaciones en landing u hoja de precios que parecen promesa legal o fiscal

Ver grupo I (filas 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152). Resumen:

- **NCF**: `LANDING_TEXTOS.md` (borrador) dice que Norexos «emite comprobantes NCF» (beneficio 5, tabla y FAQ). La hoja de precios y `apps/landing/precios.html` dicen lo contrario. Si se copia el borrador a la web es una promesa fiscal falsa. La landing EN ya lo marca [RETIRADO].
- **e-CF**: el borrador manda quitar toda mención a e-CF. La hoja de precios dice «no emite NCF ni e-CF»; el abogado debe confirmar que ese deslinde es suficiente frente a la obligación de e-CF de la Ley 32-23 (estado PARCIAL en `PUNTOS_VERIFICADOS.md`).
- **ITBIS**: términos dicen «precios en RD$ con ITBIS»; la hoja está en US$ y no dice si incluye ITBIS. Tasa 18 % solo verificada por resumen de ley. El contrato hace garantizar al cliente su ITBIS (cl. 13.4 / 14.3).
- **Protección de datos**: FAQ «¿Mis datos están seguros? Acceso por rol y copias de respaldo» y landing EN «Control de acceso por rol»; políticas citan «no entrena modelos» del proveedor de IA y «respaldos cifrados AES-256-GCM» (sin verificar; la lista de licencias dice que el volcado no se cifra por sí solo).
- **Respaldos**: hoja de precios: en la versión instalada el respaldo en la misma laptop no protege y la copia USB es del cliente; términos/políticas describen retención Drive de 365 días y 120 meses «aprox. 10 años no garantizado».
- **Disponibilidad y garantía**: objetivo 99 % mensual (01 cl. 11.2) y garantía de 90 días (06 cl. 15.2) son promesas si se publican.
- **Precio y piloto**: «sin mensualidad», «primer año de soporte incluido», «60 días sin costo», «sin tarjeta» (14 vs 60 días) y «permiso para citarlos».
- **IA**: «solo lee datos» y «apagada hasta que la dueña ponga la clave» son hechos técnicos que Claude debe verificar antes de publicarlos.
- **Marca y dominio**: «Norexos»/«Nexora» sin búsqueda en ONAPI; landing con nexorapos.net y contrato con soporte@norexos.ai (dominio sin registrar).

## Discrepancias detectadas entre documentos
- Prueba gratis: 14 días (términos) vs 60 días (piloto en hoja y contratos).
- Moneda: términos RD$ con ITBIS vs hoja y contratos US$.
- Los contratos 01 y 06 de la rama cloud también existen en el árbol local; la rama cloud es la fuente usada aquí. 02, 03, 04 y 05 (más FUENTES_LEGALES y PUNTOS_*) también llevan «Borrador generado por IA»: son 9 archivos, no 5.
- Las marcas de los 8 archivos del encargo y las de 02-05 se listan por separado (grupo H) para no mezclar el alcance.

