# Aviso de privacidad — Grupo Macgen

BORRADOR del 10 de octubre de 2026. No publicar hasta completar los datos y obtener revisión jurídica. Revisión asistida por IA, no auditoría independiente ni certificación de cumplimiento. Describe el código `496030f`; no verifica cuentas ni producción.

## Responsable y contacto

Nombre comercial: Grupo Macgen. Responsable legal: **[COMPLETAR: persona o razón social]**. RNC: **[COMPLETAR, si corresponde]**. Dirección y sucursal: **[COMPLETAR]**. Contacto para privacidad: **[COMPLETAR: cargo, correo, teléfono y atención presencial]**. No se han inventado datos empresariales.

## Datos y finalidad

Nexora registra clientes (nombre, cédula/RNC, teléfono, correo, notas), compras, devoluciones y cuentas pendientes; empleados (nombre, usuario, correo, rol y actividad); y fotos de comprobantes que se adjunten a pagos. Los verificadores de contraseña y PIN son hashes, no contraseñas guardadas para leerlas. Estos datos sirven para gestionar ventas, cobros, inventario, caja, acceso y trazabilidad. Una foto puede contener información bancaria visible: cubra lo innecesario antes de subirla. No agregue datos de salud ni información innecesaria a las notas. [S1–S3]

**[COMPLETAR: datos indispensables para cada trámite, datos opcionales y consecuencia de no aportarlos]**. La existencia de un campo no obliga a completarlo en todas las compras.

**[ABOGADO: confirmar la base legal de cada finalidad, cómo informar y acreditar consentimiento, obligaciones fiscales/laborales y excepciones aplicables]**. El artículo 5 de la Ley 172-13 contempla información y consentimiento. Este texto no acredita que una persona haya consentido. No se presume una excepción general por interés legítimo. [L1]

## Destinatarios y transferencias

El personal de la tienda accede según sus permisos. En la modalidad cloud, Render aloja datos y aplicación; el archivo de despliegue indica Virginia, Estados Unidos. **[COMPLETAR: confirmar región real y contrato]**. [S4]

Si se activan los avisos, Telegram recibe mensajes con nombres de cliente/cajero, artículos e importes. Sus miembros pueden leerlos. **[COMPLETAR: quién integra el grupo, accesos y conservación]**. Sentry está apagado por defecto; si se configura, recibe errores y datos técnicos, y la web puede enviar reproducción enmascarada de pantallas. Los filtros reducen exposición, sin garantizar ausencia total de datos personales. [S5–S6]

Google Drive puede recibir copias completas de PostgreSQL, cifradas antes de subirse con AES-256-GCM. Google recibe el archivo cifrado y metadatos; la frase de cifrado reside en la configuración del servidor y debe custodiarse también fuera de él. Tener código de respaldo no demuestra que la cuenta esté conectada ni que haya una copia reciente. [S7]

Anthropic recibe la imagen/PDF completo de una factura de proveedor si se configura la extracción y alguien la utiliza. Según la orden de coordinación, está apagado en producción; eso no fue comprobado en vivo. **[COMPLETAR: contratos, ubicación, conservación y terceros realmente activos]**. No se promete retención cero. Existe también una alternativa optativa de respaldo S3; confirmar si se usa. [S8–S9]

Estos servicios pueden tratar datos fuera de República Dominicana. **[ABOGADO: confirmar fundamento, requisitos de transferencia internacional, contratos e información/consentimiento aplicables]**. El cifrado no sustituye la revisión legal. [L1]

## Conservación y eliminación

Ventas, pagos, auditoría y expedientes laborales: **[COMPLETAR con contador/abogado: plazo por categoría y fundamento]**. No tienen una purga general en el código revisado. Contactos y fotos: **[COMPLETAR: plazo operativo y procedimiento]**. [S10]

El respaldo Drive conserva una copia por cada uno de los 30 días más recientes **con copia** y una por cada uno de los 12 meses más recientes **con copia**; tras verificar una copia nueva, las sobrantes van a la papelera. Con ejecución regular se habla de aproximadamente 13 meses incluyendo papelera, pero **no es un máximo garantizado**: interrupciones, meses sin copia, desconexión o copias descargadas pueden conservar datos más tiempo. **[COMPLETAR: eliminación efectiva, papelera, descargas y retención contractual de Google]**. [S7]

La purga técnica elimina ciertos registros antiguos de actividad, avisos y autenticación; no elimina mensajes ya entregados a Telegram ni copias externas. **[COMPLETAR: plazos de Telegram, Sentry y Anthropic]**. [S10]

## Sus derechos

Puede solicitar acceso, rectificación y supresión/cancelación cuando corresponda, usando el contacto indicado. Explique la solicitud y permita verificar su identidad de forma proporcionada; nunca envíe contraseña ni PIN. **[COMPLETAR: responsable, registro de recepción y canal de respuesta]**. **[ABOGADO: confirmar derechos, límites, plazos de respuesta y vía de reclamación según los artículos 7–15 de la Ley 172-13]**. [L1]

La herramienta de anonimización requiere autorización; rechaza deuda o nota de crédito pendiente, limpia identificadores, determinadas evidencias y textos asociados y conserva números e importes. Borra fotos asociadas de pagos en la base; no borra mensajes ya entregados, copias históricas ni datos de empleados. Ese límite del programa no resuelve jurídicamente una solicitud: gerencia debe revisarla. Si se restaura una copia, deben reaplicarse las solicitudes aprobadas. [S11]

## Evidencia interna y aprobación

Antes de publicar: completar identidad/contacto, bases, conservación, contratos y procedimiento de derechos; confirmar proveedores activos y revisión de abogado. **[COMPLETAR: aprobación y entrada en vigor]**. El repositorio es público y contiene documentos internos; no colocar expedientes ni secretos aquí (visibilidad consultada mediante `gh repo view --json visibility`, 10-oct-2026). Ello no significa que la base sea pública.

| Ref. | Código revisado en `496030f` |
|---|---|
| S1 | `apps/api/prisma/schema.prisma:18`, `:216`, `:312`: usuarios, clientes y pagos. |
| S2 | `packages/shared/src/index.ts:654`: permisos por rol. |
| S3 | `apps/api/src/sales.ts:2094`, `:2113`, `:2150`: imagen en base y acceso autorizado. |
| S4 | `render.yaml:15`, `:41`, `:77`: región declarada. |
| S5 | `apps/api/src/notifications.ts:42`, `:191`, `:343`, `:678`: configuración, nombres y envío. |
| S6 | `apps/web/src/monitoring.ts:9`, `:118`, `:128`; `apps/api/src/monitoring.ts:11`: activación y filtros. |
| S7 | `apps/api/src/drive-backup.ts:113`, `:627`, `:999`, `:1062`, `:1401`; `apps/api/src/drive-backup-core.ts:148`, `:546`, `:602`: cifrado, verificación, retención, calendario y acceso administrador. Guía: `docs/RESPALDO_DRIVE.md:219`. |
| S8 | `apps/api/src/merchandise.ts:254`, `:261`; `apps/api/src/invoice.ts:375`, `:397`: factura completa y proveedor. Estado declarado: `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:114`. |
| S9 | `deploy/render/backup/render-backup.mjs:108`, `:168`: alternativa S3, sin el cifrado previo de Drive. |
| S10 | `apps/api/src/retention.ts:22`, `:26`, `:163`: exclusiones, plazos técnicos y activación. |
| S11 | `apps/api/src/admin.ts:326`, `:356`, `:415`, `:491`, `:522`: anonimización y límites. |

L1: [Ley 172-13, publicación oficial de la Superintendencia de Bancos](https://sb.gob.do/media/4i1ploou/ley17213.pdf), consultada el 10-oct-2026. Se cita para revisión por abogado, sin certificar cumplimiento.
