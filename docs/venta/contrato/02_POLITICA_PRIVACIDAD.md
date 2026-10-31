Borrador generado por IA. Revisión por un abogado dominicano colegiado antes de firmar.

# Política de privacidad y tratamiento de datos de Norexos

Estado: borrador del 31-oct-2026. Forma parte del contrato de servicio SaaS (`01_CONTRATO_SERVICIO_SAAS.md`, cláusula 10). Redactada para proteger a la proveedora. Clave de siglas: CC = Código Civil; CT = Código Tributario; L172 = Ley 172-13; L53 = Ley 53-07; L126 = Ley 126-02. «verificado» = artículo leído en la fuente de `FUENTES_LEGALES.md`.

## 1. Quién es quién

1.1. **Proveedora** (Norexos): [NOMBRE LEGAL, RNC, DOMICILIO, CORREO DE PRIVACIDAD: COMPLETAR]. Presta el sistema de punto de venta e inventario.

1.2. **Cliente** (el negocio que contrata): es el **responsable del tratamiento** de los datos de sus propios clientes, empleados, proveedores y alumnas o clientas que registra en el sistema. La proveedora actúa como **encargada del tratamiento**: los trata por cuenta del cliente y solo para darle el servicio. [Fundamento: L172 art. 6 números 12 y 18, verificados]

1.3. La proveedora es **responsable directa** solo de los datos de la cuenta del cliente (nombre o razón social, RNC, contacto, usuarios administradores y datos de cobro del plan). [Fundamento: L172 art. 6 número 18, verificado]

## 2. Qué datos guarda el sistema

Según el esquema de la base de datos (`docs/sistema/DATOS_Y_MODELOS.md`; no se leyó ningún dato real):

| Grupo                | Datos                                                                                                                                                                             | Titulares               |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Usuarios y acceso    | usuario, correo, verificador de contraseña y de PIN (no la contraseña), rol, número de cajera, intentos fallidos, equipos aprobados, sesiones                                     | empleados del cliente   |
| Bitácora             | quién hizo qué, antes y después, equipo                                                                                                                                           | empleados del cliente   |
| Clientes             | nombre, teléfono, correo, cédula o RNC, límite de crédito; un cliente no se borra: se anonimiza                                                                                   | clientes del cliente    |
| Ventas y pagos       | ventas, renglones, pagos (método, banco, referencia, últimos 4 dígitos y marca de tarjeta, código de aprobación, foto de comprobante), devoluciones, notas de crédito, mensajeros | clientes del cliente    |
| Caja                 | aperturas, cierres, diferencias, movimientos de efectivo                                                                                                                          | cajeras                 |
| Inventario y compras | productos, variantes, lotes, kardex, proveedores (nombre, RNC, plazos), facturas de proveedor y sus imágenes o PDF                                                                | proveedores del cliente |
| Gastos e incentivos  | gastos, incentivos de cajeras, cierres                                                                                                                                            | empleados               |
| GV (módulo opcional) | cursos, inscripciones (nombre, teléfono, Instagram, pagos), citas de maquillaje (servicio, artistas, datos de boda), interesadas                                                  | alumnas y clientas      |
| Configuración        | nombre del negocio, tasa del dólar, cuentas de banco del negocio, reglas, ajustes                                                                                                 | el negocio              |
| IA de ventas         | solo un contador diario por usuario (cantidad de preguntas, tokens y costo estimado). **No el texto de las preguntas ni de las respuestas**                                       | usuarios                |

El sistema **no debe usarse** para guardar datos de salud, creencias, afiliación sindical ni vida sexual, números completos de tarjeta ni códigos de seguridad. Si el cliente los registra por su cuenta, él responde por ello. [Fundamento: L172 art. 76, verificado: esos datos solo se tratan con consentimiento expreso y por escrito]

Datos de menores: el cliente es responsable de su tratamiento, que se rige por las normas especiales de protección de niños, niñas y adolescentes. [Fundamento: L172 art. 79, verificado]

## 3. Para qué se usan

Para dar el servicio (ventas, caja, inventario, reportes), separar los datos de cada cliente, hacer respaldos, dar soporte cuando el cliente lo pide, cobrar el plan, cumplir la ley, prevenir fraude y proteger la seguridad. **No se venden los datos ni se usan para publicidad de terceros.** [Fundamento: L172 art. 5 números 1 y 8 (licitud y finalidad), verificados]

## 4. Base legal

4.1. Los datos que el cliente registra se tratan porque derivan de la relación comercial, laboral o contractual del cliente con sus titulares y son necesarios para cumplirla; en ese caso la ley no exige consentimiento. El cliente informa a sus titulares de la finalidad, los destinatarios y sus derechos. [Fundamento: L172 art. 27 número 4 y art. 5 número 3, verificados]

4.2. Para lo que no encaje en esa excepción (por ejemplo, promociones por mensaje), el cliente obtiene el consentimiento libre, expreso y consciente, por escrito o por medio equivalente. [Fundamento: L172 art. 5 número 4 y art. 71, verificados: la prospección comercial permite tratar datos facilitados por los titulares o con su consentimiento, y el titular puede pedir en cualquier momento el retiro de su nombre]

4.3. Para los datos de la cuenta del cliente, la base es el contrato. [Fundamento: L172 art. 27 número 4, verificado]

## 5. Inteligencia artificial

5.1. **IA de ventas («Preguntar a Norexos»).** Es de solo lectura y no tiene memoria entre preguntas. Cada pregunta viaja al proveedor de IA junto con las cifras agregadas que las herramientas de lectura devuelven en ese momento (totales, cobros por método y banco, hasta diez productos más vendidos); no se envían filas de ventas ni contraseñas, PIN, datos de tarjeta o tokens. **Norexos no guarda el texto de las preguntas ni de las respuestas**; guarda solo el contador diario del usuario. Fuente: diseño y código de la rama `claude/ia-ventas-linea` (commit `62720b17`, 30-oct-2026), notas `docs/coordinacion/ESTADO_T33.md` y `T33_DISENO.md`. Esa rama no estaba mezclada en `nexora-cloud` el 31-oct-2026; esta afirmación vale cuando lo desplegado coincida con ese código.

5.2. El proveedor de IA recibe el texto de la pregunta y las cifras para poder responder. **Cuánto tiempo los conserva y si los usa para entrenar es: NO VERIFICADO** (depende de los términos del proveedor, que no se leyeron); la proveedora no lo promete.

5.3. **Lectura de facturas con IA** (si está activada): se envía la imagen o PDF completo de la factura del proveedor; pueden aparecer datos personales. El sistema sí conserva el borrador y el adjunto. Retención en el proveedor de IA: NO VERIFICADO. [Fuente: `docs/legal/REGISTRO_TERCEROS.md`]

## 6. Con quién se comparten los datos (subencargados)

| Quién                       | Para qué                                           | Ubicación conocida                       | Estado                                        |
| --------------------------- | -------------------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| Render                      | servidores, API, web y base de datos               | Virginia, Estados Unidos (`render.yaml`) | región efectiva y contrato: COMPLETAR         |
| Proveedor de IA (Anthropic) | IA de ventas y lectura de facturas                 | país y retención: NO VERIFICADO          | solo si hay clave configurada                 |
| Google Drive                | respaldos cifrados (AES-256-GCM antes de subirlos) | NO VERIFICADO                            | solo si el cliente o la proveedora lo conecta |
| Telegram                    | avisos con nombres, artículos e importes           | NO VERIFICADO                            | solo si se configura                          |
| Sentry                      | errores y trazas técnicas                          | NO VERIFICADO                            | apagado por defecto sin DSN                   |
| Correo y cobros             | avisos del plan y pagos                            | COMPLETAR                                | COMPLETAR                                     |

Fuentes: `render.yaml`, `docs/legal/REGISTRO_TERCEROS.md`, `docs/legal/POLITICA_PRIVACIDAD.md`. La proveedora exige a cada subencargado medidas de seguridad y confidencialidad y responde ante el cliente conforme al acuerdo `03`. [Fundamento: L172 art. 5 número 5, art. 13 y art. 28, verificados]

## 7. Transferencias internacionales

Los servidores y varios subencargados están fuera de la República Dominicana. La transferencia se hace cuando el titular la autoriza o la ley la permite; el cliente, como responsable, incluye esa información y obtiene la autorización cuando corresponda. [Fundamento: L172 art. 80 números 1 y 4, y art. 6 número 20, verificados; si el simple alojamiento en la nube exige consentimiento y qué mecanismo usar: ABOGADO]

## 8. Seguridad

8.1. Medidas que existen en el sistema según su código y documentos: permisos por rol, bloqueo temporal tras intentos fallidos, aprobación de equipos, bitácora con antes y después, contraseñas y PIN guardados solo como verificadores, conexión cifrada, respaldos cifrados cuando se conecta el almacenamiento. Estas medidas **no garantizan** ausencia de incidentes. [Fuente: `docs/sistema/DATOS_Y_MODELOS.md` §1; `docs/legal/POLITICA_PRIVACIDAD.md`] [Fundamento: L172 art. 5 número 5 y art. 13 número 2, verificados]

8.2. Quien entre sin autorización o exceda su autorización a un sistema, o altere datos con fines fraudulentos, comete delito. [Fundamento: L53 arts. 6 y 10, verificados]

8.3. **Incidentes.** Si la proveedora detecta un incidente que afecte datos del cliente, le avisa sin demora indebida y en un máximo de [72] horas (PENDIENTE), con lo que sepa y lo que hizo. No se encontró en la L172 un artículo que obligue a notificar brechas a la autoridad o a los titulares; si existe una norma reglamentaria, es: NO VERIFICADO. [Fundamento: compromiso contractual, CC art. 1134, verificado]

## 9. Derechos de los titulares

9.1. Toda persona puede **acceder** a sus datos y saber el destino y uso que se hace de ellos, y pedir su **rectificación, actualización, cancelación (supresión) y oposición**; son derechos independientes entre sí. [Fundamento: L172 arts. 8, 9, 10 y 14, verificados]

9.2. **Plazos de la ley:** el responsable debe presentar la información de acceso en un máximo de **cinco (5) días hábiles** y rectificar, suprimir o actualizar en un máximo de **diez (10) días hábiles** desde el reclamo; si hubo cesión, avisa al cesionario dentro de cinco (5) días hábiles. La rectificación inexacta es gratuita. [Fundamento: L172 art. 8 y art. 12, verificados; el art. 12 está redactado para las sociedades de información crediticia y dice que igual disposición aplica a las demás entidades que manejan bancos de datos]

9.3. **Cómo ejercerlos:** quien sea cliente, empleado o proveedor de un negocio cliente de Norexos pide primero a ese negocio, que es el responsable. La proveedora le ayuda en un máximo de **dos (2) días hábiles** reenviando o ejecutando lo que el cliente indique (PENDIENTE). Los datos de la cuenta se piden a [CORREO DE PRIVACIDAD: COMPLETAR].

9.4. **Límites:** la supresión no procede si causa perjuicio a derechos o intereses legítimos de terceros o si hay obligación legal o contractual de conservar los datos (por ejemplo, el cliente debe conservar sus libros y comprobantes diez años). En el sistema, un cliente no se borra: se anonimiza, se rechaza si tiene saldo pendiente y se conservan los importes. [Fundamento: L172 arts. 8 y 15, verificados; CT art. 50 letra h, verificado; fuente técnica: `docs/sistema/DATOS_Y_MODELOS.md` §3 y `docs/legal/POLITICA_PRIVACIDAD.md`]

9.5. Si no se atiende el reclamo en plazo, el titular puede acudir a la acción de hábeas data ante el juez de su domicilio. El incumplimiento que cause daños da derecho a indemnización conforme al derecho común. [Fundamento: L172 arts. 8, 16, 17 y 20, verificados]

9.6. Se pide al titular acreditar su identidad de forma proporcionada; nunca contraseñas ni PIN.

## 10. Cuánto tiempo se conservan los datos

10.1. Mientras el contrato esté vigente, y hasta [30] días después de terminar para que el cliente exporte; luego se suprimen en un máximo de [60] días, salvo copias de respaldo que se eliminan por rotación (PENDIENTE: confirmar el calendario real de rotación) y datos que la ley obligue a guardar. Cancelado un dato, se bloquea y solo se conserva a disposición de las autoridades por el plazo de prescripción de las responsabilidades del tratamiento. [Fundamento: L172 art. 15, verificado]

10.2. Purgas técnicas automáticas que describe el repositorio: determinados registros de seguridad de más de 400 días, eventos de más de 48 horas, avisos de más de 30 días, intentos de autenticación antiguos y tokens vencidos; la IP del registro activo se borra a los 90 días; las copias de seguridad anteriores pueden conservarla hasta su eliminación. [Fuente: `docs/legal/POLITICA_PRIVACIDAD.md` citando `apps/api/src/retention.ts` y `security.ts`; vigencia en producción: no se inspeccionó]

10.3. Conservación fiscal. La obligación de conservar libros, registros y comprobantes diez años es del cliente, no de la proveedora. [Fundamento: CT art. 50 letra h, verificado]

10.4. Conservación de tráfico. Si la proveedora fuera «proveedor de servicios» en el sentido de la L53, debe conservar datos de tráfico, conexión y acceso un mínimo de 90 días. [Fundamento: L53 art. 56, verificado; su aplicación a un proveedor de software: ABOGADO]

## 11. Cookies y almacenamiento en el navegador

El sistema usa una cookie técnica de renovación de sesión y almacenamiento local para operar sin conexión (cola de ventas pendientes). No usa cookies publicitarias; si se activa analítica o Sentry se informará. [Fuente: `docs/legal/POLITICA_PRIVACIDAD.md`, citando `apps/api/src/auth.ts` y `apps/web/src/api.ts`; no se re-verificó en esta rama]

## 12. Cambios y contacto

La proveedora avisa los cambios con [30] días de antelación cuando afecten derechos del cliente. Contacto de privacidad: [CORREO: COMPLETAR].

## 13. Registro y políticas internas

Todo archivo o banco de datos, público o privado, debe contar con políticas de información que garanticen medidas de seguridad y control, y los responsables deben tener un manual interno de políticas y procedimientos para atender consultas y reclamos. La proveedora mantiene este documento y `docs/legal/PROCEDIMIENTO_DERECHOS_DATOS.md` como parte de ese manual. Si existe obligación de inscribirse ante algún órgano de control, es: NO VERIFICADO. [Fundamento: L172 art. 13 número 5 y art. 42, verificados]
