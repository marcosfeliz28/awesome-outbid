# Registro de terceros y flujo de datos — Nexora POS

BORRADOR del 10-oct-2026, base `496030f`. Revisión asistida por IA, no auditoría independiente ni certificación legal. Código disponible no equivale a servicio conectado; no se consultaron secretos ni datos/configuración de producción.

| Destino | Datos/mecanismo | Activación y evidencia |
|---|---|---|
| Render | Aplicación, tráfico y PostgreSQL con datos del negocio | Modalidad cloud. Blueprint Virginia, EE. UU.; región real/contrato pendientes (`render.yaml:15`, `:41`, `:77`) |
| Google Drive | Dump completo cifrado **antes** de subir, AES-256-GCM; nombre/fecha, tamaño y sumas. Cuenta y token OAuth cifrado en la base | Implementado; requiere tres variables y conexión OAuth `drive.file`, rutas administrador. Relevo declara **no conectado**, sin confirmación en vivo (`apps/api/src/drive-backup.ts:113`, `:627`, `:999`, `:1165`, `:1401`; `apps/api/src/drive-backup-core.ts:377`; `docs/coordinacion/RELEVO_CLAUDE_A_CHATGPT.md:22`) |
| Telegram | Nombres de cliente/cajero, artículos, importes y avisos de operación/respaldo; texto en NotificationOutbox | Bot y destino configurados; revisar miembros y no presumir grupo privado (`apps/api/src/notifications.ts:42`, `:191`, `:343`, `:678`) |
| Sentry web | Errores, trazas y replay enmascarado; riesgo por estructura/metadatos pese al saneamiento | Apagado por defecto sin `VITE_SENTRY_DSN`; estado real pendiente (`apps/web/src/monitoring.ts:9`, `:118`, `:128`) |
| Sentry API | Excepciones saneadas y metadatos técnicos | Apagado por defecto sin `SENTRY_DSN` (`apps/api/src/monitoring.ts:11`, `:46`) |
| Anthropic | Foto/PDF completo del proveedor, posibles datos personales, extracción en base64 | Clave y carga manual; orden declara apagado en producción, sin inspección en vivo. Retención contractual pendiente (`apps/api/src/merchandise.ts:254`, `:261`; `apps/api/src/invoice.ts:375`, `:397`; `docs/coordinacion/INSTRUCCIONES_ACTUALES.md:114`) |
| AWS S3 | Alternativa de dump completo, SHA y manifiesto; cifrado del proveedor en reposo, distinto de Drive | Ejemplo optativo; confirmar uso real (`deploy/render/backup/render-backup.mjs:108`, `:168`; `docs/RESPALDO_CLOUD_RENDER.md:22`) |
| WhatsApp / correo | Destinatario y texto del ticket vía enlaces | Acción manual, sin acreditar entrega/retención (`apps/web/src/POS.tsx:2159`, `:2171`) |
| GitHub público | Código, documentos internos e historial publicados accesibles a terceros | `gh repo view --json visibility`: `PUBLIC` el 10-oct-2026. No significa base pública; no se cambia visibilidad/depura historial |
| Descargas de dependencias | Peticiones de instalación/construcción y metadatos de transporte | No implica enviar ventas; destinos en `instalador/dependencias.lock.json:1` |

## Conservación y solicitudes

Drive programa desde las 03:30 Santo Domingo. Conserva una por cada uno de los 30 días más recientes **con copia** y una por cada uno de los 12 meses más recientes **con copia**. Tras verificar copia nueva manda sobrantes a papelera. No es límite estricto por edad: meses sin copia, desconexión y descargas pueden superar aproximadamente 13 meses. Confirmar vaciado efectivo de papelera/contrato, cuenta y copias descargadas (`apps/api/src/drive-backup-core.ts:546`, `:602`; `apps/api/src/drive-backup.ts:1062`, `:1287`).

Purga local tiene plazos técnicos/exclusiones; no gobierna proveedores (`apps/api/src/retention.ts:22`, `:26`, `:163`). Anonimización borra identificadores, fotos asociadas de pagos y ciertos textos/auditorías/avisos locales, rechaza saldos y conserva ventas/importes; no borra mensajes entregados ni copias externas (`apps/api/src/admin.ts:326`, `:356`, `:415`, `:491`, `:522`). Restaurar exige reaplicar solicitudes aprobadas.

## Pendientes de gerencia y abogado

Confirmar servicios activos sin mostrar secretos; contratos/regiones/retención y miembros Telegram; cuenta Drive y custodia de frase fuera de Render; restauración descartable. Revisar documentos/historial público con inventario reservado a Claude. No reproducir contenido personal aquí.

**[ABOGADO: confirmar bases, derechos, conservación y transferencias internacionales]**. [Ley 172-13, fuente oficial](https://sb.gob.do/media/4i1ploou/ley17213.pdf), consultada 10-oct-2026. Política/aviso existen como borradores; no afirman cumplimiento.
