# Política de privacidad — Grupo Macgen

BORRADOR del 10-oct-2026 sobre `496030f`. Revisión asistida por IA, no auditoría independiente ni certificación legal. Complete y lleve a abogado antes de publicar. No se inspeccionaron cuentas/configuración de producción.

## Responsable, datos y finalidad

Grupo Macgen es el nombre comercial. Responsable legal **[COMPLETAR]**, RNC **[COMPLETAR, si corresponde]**, dirección/sucursal **[COMPLETAR]**, correo/teléfono de privacidad **[COMPLETAR]**. Aplica a clientes, personal usuario del POS y personas que aparezcan en comprobantes/facturas. Leer junto con [el aviso](AVISO_PRIVACIDAD.md) y [el registro de terceros](REGISTRO_TERCEROS.md).

Se registran nombre, contacto, cédula/RNC y notas de clientes; ventas, pagos, devoluciones y saldos; datos de empleados, roles, verificadores de contraseña/PIN, equipos y actividad. Fotos de pagos pueden mostrar información bancaria. Finalidad: administrar operaciones, cobros, acceso, inventario y trazabilidad. No registrar tarjetas completas, códigos de seguridad ni datos de salud en notas/fotos. El esquema permite campos; no obliga a completarlos todos (**[COMPLETAR: obligatoriedad y alternativa por trámite]**) (`apps/api/prisma/schema.prisma:18`, `:216`, `:312`; `apps/api/src/sales.ts:2113`).

**[ABOGADO: confirmar base jurídica por finalidad, consentimiento/información previa y obligaciones fiscales/laborales]**. No presumir una excepción general por interés legítimo. Nexora imprime ticket no fiscal; no acredita emisión autorizada (`apps/web/src/Prints.tsx:290`). Esta política no registra consentimiento ni garantiza ausencia de datos de menores: gerencia debe revisar los casos y su base legal.

## Destinatarios y transferencias

Render aloja la modalidad cloud; Blueprint declara Virginia, Estados Unidos (**[COMPLETAR: región efectiva y contrato]**) (`render.yaml:15`, `:41`, `:77`). Telegram recibe, si se configura, mensajes con nombres, artículos e importes; no se comprobó grupo privado ni miembros (`apps/api/src/notifications.ts:42`, `:191`, `:678`).

Google Drive tiene implementación real: cifra el dump completo con AES-256-GCM antes de escribir/subir y verifica la copia. Requiere configuración y conexión OAuth; relevo declara no conectado, sin verificación en vivo. La frase existe en el servidor y debe guardarse también fuera de él; quien tenga copia y frase puede descifrarla (`apps/api/src/drive-backup.ts:113`, `:627`, `:999`; `apps/api/src/drive-backup-core.ts:148`; `docs/coordinacion/RELEVO_CLAUDE_A_CHATGPT.md:22`). S3 es una alternativa optativa distinta, sin ese cifrado previo (`deploy/render/backup/render-backup.mjs:168`).

Sentry está apagado por defecto sin DSN; al activarlo puede recibir errores, trazas y replay enmascarado de la web. Sus filtros no garantizan exposición cero (`apps/web/src/monitoring.ts:9`, `:118`, `:128`; `apps/api/src/monitoring.ts:11`). Anthropic requiere clave y carga manual: recibe foto/PDF completo del proveedor, no solo cifras. La orden declara apagado en producción, sin comprobación en vivo; conservación contractual pendiente (`apps/api/src/merchandise.ts:254`, `:261`; `apps/api/src/invoice.ts:375`; `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:114`).

El repositorio es **público** y contiene documentos internos e historial accesibles a terceros: `gh repo view --json visibility` devolvió `PUBLIC` el 10-oct-2026. Esto no significa que PostgreSQL sea público. No incluir expedientes ni secretos; esta entrega no cambia visibilidad ni depura historial.

**[ABOGADO: confirmar requisitos/fundamento de transferencias internacionales, contratos e información/consentimiento]**. **[COMPLETAR: servicios activos, ubicación y retención por proveedor]**. No prometer retención cero del proveedor.

## Conservación, derechos y eliminación

**[COMPLETAR con contador/abogado: plazos para ventas, pagos, auditoría, clientes, empleados y fotos]**. La purga técnica excluye ventas/pagos y auditoría. Borra eventos de más de 48 h, avisos enviados/fallidos antiguos de 30 días, ciertos intentos de autenticación de 48 h/30 días y tokens vencidos hace más de 24 h; puede desactivarse. No borra mensajes entregados a Telegram (`apps/api/src/retention.ts:22`, `:26`, `:163`).

Drive conserva una copia por cada uno de los 30 días más recientes **con respaldo** y una por cada uno de los 12 meses más recientes **con respaldo**; envía sobrantes a papelera después de verificar la nueva. Aproximadamente 13 meses con operación regular/papelera **no es máximo garantizado**: se cuentan días/meses con copia; interrupciones, desconexión y descargas pueden prolongar conservación. **[COMPLETAR: eliminación efectiva, papelera y reaplicación de solicitudes tras restaurar]** (`apps/api/src/drive-backup-core.ts:546`; `apps/api/src/drive-backup.ts:1062`, `:1287`).

Solicite acceso, rectificación y supresión/cancelación por el contacto indicado, con verificación proporcional de identidad, nunca contraseña/PIN. **[ABOGADO: confirmar derechos, excepciones, plazos por solicitud y reclamación según Ley 172-13]**. No fijar un plazo universal de diez días. La anonimización requiere `customers:erase`, rechaza saldos pendientes, limpia identificadores y fotos de pagos asociados, ciertos textos/auditorías/avisos locales y conserva importes. No elimina mensajes entregados, copias históricas ni empleados; su límite técnico no decide la validez jurídica de una solicitud (`apps/api/src/admin.ts:326`, `:356`, `:415`, `:491`, `:522`).

## Equipo, incidentes y revisión

Hay permisos por rol, verificadores de claves y revocación de sesiones; no certifican configuración real correcta (`packages/shared/src/index.ts:654`; `apps/api/src/admin.ts:1118`). El navegador mantiene consultas y operaciones pendientes; cerrar sesión borra caché recuperable y preserva ventas/mercancía offline. Revocar equipo bloquea servidor, no borra remotamente el dispositivo (`apps/web/src/api.ts:281`; `apps/api/src/realtime.ts:395`). Existe cookie técnica de renovación (`apps/api/src/auth.ts:303`). Si se activa Sentry, informar monitoreo y revisar consentimiento; no afirmar ausencia universal de analítica.

**[COMPLETAR: procedimiento/responsable de incidentes, comunicación, aprobación y entrada en vigor]**. **[ABOGADO: confirmar obligaciones]**. Fuente oficial consultada 10-oct-2026: [Ley 172-13, Superintendencia de Bancos](https://sb.gob.do/media/4i1ploou/ley17213.pdf).
