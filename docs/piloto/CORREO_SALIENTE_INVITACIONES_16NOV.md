# Correo saliente del producto (rama origin/producto-nexora) — inventario

Solo lectura. Sin valores de claves. Líneas = rama producto-nexora al hacer fetch.

## 1) Cómo funciona hoy
- Proveedor único: Resend, por HTTP POST `{RESEND_API_BASE|https://api.resend.com}/emails`, sin librería (no hay nodemailer ni SMTP).
- Variables (solo nombres): RESEND_API_KEY, NOTIFY_EMAIL_FROM, APP_PUBLIC_URL, RESEND_API_BASE (opcional), NOTIFY_EMAIL_TO (correos de caja/anulación de una tienda), PLATFORM_OWNER_EMAIL (avisos al operador), ANTHROPIC_API_KEY (solo resumen diario).
- Tres rutas de código separadas, cada una lee las variables a su manera:
  - registration.ts:62-71 `mailConfiguration()`: exige KEY + FROM + APP_PUBLIC_URL y https en producción; si falta algo lanza 503 «El registro por correo aún no está disponible» (falla cerrado). Se llama antes de guardar la cuenta (:140) y en reenvío (:228). Envío del correo de verificación: registration.ts:73-89 (timeout 8 s; token en el fragmento #token=).
  - notifications.ts:62-72 `emailSettings()`: sin KEY o sin TO queda apagado en silencio; FROM por defecto «Norexos <onboarding@resend.dev>» (remitente de pruebas de Resend, solo entrega a la cuenta dueña de Resend). Envío con idempotencia: notifications.ts:~95-128. Cierres de caja y solicitudes de anulación: notifications.ts:785-797.
  - tenant-lifecycle.ts:163-202: avisos de vencimiento de prueba/plan (7 y 3 días) al admin con correo verificado; si falta KEY o FROM, retorna sin hacer nada.
  - platform-notify.ts:87-100: avisos al operador (usa emailSettings con PLATFORM_OWNER_EMAIL).
  - daily-summary.ts:22: resumen diario, activo solo con RESEND_API_KEY y ANTHROPIC_API_KEY.
- Blueprint render.producto.yaml (raíz, no deploy/render/): declara RESEND_API_KEY (:78, sync:false), NOTIFY_EMAIL_FROM (:80), PLATFORM_OWNER_EMAIL (:76), PRODUCT_PUBLIC_REGISTRATION=disabled (:47-48). NO declara APP_PUBLIC_URL, NOTIFY_EMAIL_TO ni RESEND_API_BASE (por verificar si ya están puestas a mano en Render; no se puede comprobar desde aquí). .env.example:18 solo menciona RESEND_API_KEY para el resumen.
- Estado real de la clave en Render: por verificar. Docs (PENDIENTES-DUENA.md:85, LISTO_PARA_VENDER.md:120) dicen que la dueña aún no creó la cuenta de Resend / falta remitente propio.

## 2) Qué correos envía hoy
Sí (si hay configuración): verificación de correo del registro público (24 h) y su reenvío; avisos de vencimiento prueba/plan al admin; avisos al operador (alta, activación, vencimientos, pagos); cierre de caja y anulación (a NOTIFY_EMAIL_TO); resumen diario con IA (apagado por defecto).
No: invitación a negocio piloto (platform.ts:102-127 solo devuelve `invitationUrl`); restablecer clave por el operador (platform.ts:194-221 también solo devuelve enlace); reenvío de invitación (replaceInvitation, platform.ts:~227+).
Nota: el registro público está cerrado en piloto, así que hoy el correo de verificación tampoco se usa.

## 3) Qué falta para enviar la invitación (cambios mínimos, sin escribir código)
1. Extraer un envío común: reutilizar el fetch de registration.ts:79-88 (o `sendEmail` de notifications.ts) como función `sendInvitationEmail(to, url, negocio)`. Un solo archivo nuevo o función en registration.ts.
2. platform.ts:127: después de la transacción (:114-126) llamar al envío con `invitationLink(req, token)` (:72-78) y devolver además `emailSent: true|false` sin perder `invitationUrl` (el operador queda con respaldo manual). Error de envío NO debe romper la alta (la empresa ya está creada; igual que registration.ts:161-168).
3. Misma llamada en platform.ts:220 (restablecer clave) y en replaceInvitation (reenviar/renovar) para no dejar casos manuales.
4. Config: usar `mailConfiguration()` (registration.ts:62) o variante que no exija registro público; hoy exige APP_PUBLIC_URL (platform.ts:73 cae a WEB_ORIGIN si falta; el correo debe usar la misma base). Declarar APP_PUBLIC_URL y NOTIFY_EMAIL_FROM en render.producto.yaml.
5. Idempotencia: Idempotency-Key en el POST (como notifications.ts:95) con el hash de la invitación para evitar duplicados en reintentos.
6. Plantilla en español: nombre del negocio, quién invita, botón, aviso de vencimiento, contacto de soporte (SUPPORT_EMAIL ya existe en el blueprint:66-67).
7. Pruebas: simular fetch (patrón de tests existentes de registration) para: éxito, falla de Resend (no rompe alta), sin configuración (emailSent false).
8. Bitácora: añadir evento `invitation.emailed` en invitationEvent (platform.ts:37), sin el token.

## 4) Qué necesita la dueña (sin claves en chat)
- Cuenta en resend.com (plan gratis alcanza para piloto: límites exactos por verificar en su página).
- Dominio remitente propio (p. ej. nexorapos.net, ya en Cloudflare según LISTO_PARA_VENDER.md:148) verificado en Resend: agregar los registros DNS que Resend indique (SPF, DKIM; DMARC recomendado) en Cloudflare, sin proxy.
- Crear la API key en Resend y pegarla ella misma en Render como RESEND_API_KEY (nunca en el chat).
- Decidir remitente, p. ej. «Norexos <invitaciones@nexorapos.net>» (NOTIFY_EMAIL_FROM) y correo de respuesta/soporte.
- Terminar Custom Domain en Render y entonces ajustar WEB_ORIGIN y APP_PUBLIC_URL (el enlace debe salir con el dominio final, no con *.onrender.com).
- Sin dominio verificado, el remitente de pruebas de Resend solo entrega a su propio correo: no sirve para invitar a terceros.

## 5) Riesgos
- Spam: dominio nuevo sin reputación; mitigar con SPF+DKIM+DMARC, texto sencillo, remitente coherente, probar con Gmail/Outlook/Hotmail antes de invitar. Aun así, avisar al invitado que revise spam y mantener el enlace manual como respaldo.
- Token en el correo: el enlace es la credencial de alta (el token va en el fragmento #token=, no llega a logs HTTP ni Referer, platform.ts:71). En el correo queda guardado en la bandeja y en el proveedor (Resend retiene contenido; retención por verificar). Quien lea ese correo puede aceptar la invitación: usar solo el correo del dueño real, un solo uso, no reenviar en cadena, no registrar el enlace en logs.
- Vencimiento de 7 días (platform.ts:113): si no abre a tiempo, hace falta reenviar/renovar (replaceInvitation); dejarlo claro en el correo.
- Rebote o correo mal escrito: la empresa queda creada con invitación huérfana; mostrar `emailSent` al operador y conservar el enlace manual.
- Previsualizadores de enlaces (antivirus/correo) pueden abrir la URL; al estar el token en el fragmento no llega al servidor, pero confirmar que aceptar requiere una acción (formulario), por verificar en la página /aceptar-invitacion.
- Hoy tres rutas leen la configuración distinto (una falla cerrado, otras se apagan en silencio): puede dar la falsa impresión de que «el correo funciona» cuando solo falta una variable.

## 6) Estimado (solo estimado)
- Código + pruebas + plantilla: 4-6 h.
- Declarar variables en blueprint, documentación, CI en verde (3 CI), despliegue: 1-2 h.
- Prueba real de entrega en 3 buzones (Gmail, Outlook, correo de dominio) cuando exista el dominio verificado: 1-2 h (más espera de DNS, de minutos a horas, por verificar).
- Total Claude: ~6-10 h. La dueña: ~1 h (cuenta, DNS, pegar clave).
