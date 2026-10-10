# Cumplimiento: los 20 puntos aplicados a Nexora POS

Nexora es un sistema **interno** de caja de una tienda en República Dominicana. No tiene registro público, publicidad, reseñas ni correos masivos, así que varios puntos de la lista general no aplican. Estado según la revisión del commit c0b7105.

**Aviso:** todos los textos de esta carpeta son borradores técnicos. **Un abogado dominicano debe revisarlos** antes de usarlos (Ley 172-13 de datos personales, Ley 358-05 del consumidor y reglas de la DGII). Los campos entre [corchetes] los completa la dueña.

| # | Punto | Aplica | Estado | Acción | Borrador |
|---|---|---|---|---|---|
| 1 | Política de privacidad | Sí | Falta | Revisar con abogado, publicar en la app (enlace en login y pie) y en el negocio | POLITICA_PRIVACIDAD.md |
| 2 | Términos de uso | **No para clientes** | Opcional | La dueña acuerda las condiciones en persona con cada cliente. Sólo queda un borrador interno para empleados, opcional | TERMINOS_DE_USO.md |
| 3 | Política de reembolso | Sí | Falta en ticket | Texto en el pie del ticket y en Ajustes (días y condiciones) | POLITICA_DEVOLUCIONES.md, TEXTO_PIE_TICKET.md |
| 4 | Política de cookies | Mínima | Falta | Sólo hay una cookie de sesión; se declara en la política de privacidad | POLITICA_PRIVACIDAD.md |
| 5 | Banner de cookies | **No** | n/a | Sin analítica ni publicidad no hace falta banner | — |
| 6 | Consentimientos en formularios | Sí | Falta | Aviso breve donde se capturan datos del cliente (nombre, teléfono, RNC) | POLITICA_PRIVACIDAD.md |
| 7 | Sin datos innecesarios | Sí | Parcial | Quitar `birthday`; decidir `email`; `AuditLog.ip` se llena en cada acción y se borra a los 90 días (declarar la IP del empleado en los términos internos) | DATOS_PERSONALES_INVENTARIO.md |
| 8 | Auditar SDKs de terceros | Sí | Hecho (inventario) | Sentry web siempre activo: poner interruptor y declararlo; Anthropic y S3 sólo si se activan | REGISTRO_TERCEROS.md |
| 9 | Patrones engañosos | Sí | **Sin hallazgos** | Pago por defecto es efectivo; sin urgencia ni casillas premarcadas | — |
| 10 | Cargos ocultos | Sí | **Sin hallazgos** | La comisión de tarjeta es costo del negocio, no se suma al cliente. Mostrar qué promoción se aplicó | — |
| 11 | Quitar reseñas falsas | **No** | n/a | No existe módulo de reseñas ni testimonios | — |
| 12 | Afirmaciones sin sustento | Sí | Falta | Reescribir «Lo más seguro», «Anulación auditada», «Respaldos cifrados», «auditoría» (son revisiones con IA), «Facturación» en el manifest | LICENCIAS_Y_AFIRMACIONES.md |
| 13 | Texto alternativo | Sí | Casi | `alt` presentes; falta descripción útil en comprobantes y `aria-hidden` en adornos | ACCESIBILIDAD.md |
| 14 | Contraste de color | Sí | Falta | Botón Cobrar, foco, bordes de campos, avisos y rojo/verde como texto bajo AA | ACCESIBILIDAD.md |
| 15 | Navegación con teclado | Sí | Parcial | F4/F8/F12 se disparan con un modal abierto; subida de archivos sólo con mouse; foco en checkbox | ACCESIBILIDAD.md |
| 16 | Datos del negocio | Sí | **Falta (grave)** | El ticket dice «FACTURA» y tiene NCF vacío, sin leyenda «no fiscal»; nombre y dirección fijos en el código | NEGOCIO_DATOS_CHECKLIST.md |
| 17 | Consentimiento por edad | **No** | Sin uso | No se pide edad; `birthday` se elimina | — |
| 18 | Enlace de baja en correos | **No** | n/a | El sistema no envía correos, SMS ni WhatsApp; la cajera abre wa.me o mailto a mano | — |
| 19 | Licencias de fuentes e imágenes | Sí | Falta | Avisos OFL de Inter y Plus Jakarta Sans, ISC de lucide y demás; documentar origen del ícono y las ilustraciones | LICENCIAS_Y_AFIRMACIONES.md |
| 20 | Solicitud de eliminación de datos | Sí | **Falta** | Anonimizar cliente conservando montos y números de venta; rechazar si hay deuda pendiente | PROCEDIMIENTO_DERECHOS_DATOS.md |

## Cambios de código (pasan a la cola de ChatGPT)

Ver sección «Cumplimiento» de `docs/coordinacion/COLA_HALLAZGOS_NEXORA.md`.
