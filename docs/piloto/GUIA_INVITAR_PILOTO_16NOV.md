# Cómo invitar a un negocio piloto a Norexos (nube)

Guía para la dueña y su operador. Solo describe lo que el código y los documentos respaldan; lo demás dice «por verificar».
Citas: `PB:` = origin/producto-nexora; `NC:` = origin/nexora-cloud. Fecha de lectura: 16-nov-2026.
Abreviaturas de archivos (todos en `PB:apps/api/src/` salvo indicación): platform.ts = P, registration.ts = R, platform-billing.ts = B, tenant-lifecycle.ts = L, billing-plans.ts = BP.

## 1. Qué es un piloto

- Hoja de precios: **Piloto = 60 días sin costo**, para los primeros clientes, a cambio de comentarios y permiso para citarlos; después aplican los precios de introducción (`NC:docs/venta/HOJA_DE_PRECIOS.md:14`). El plan del piloto (visita, seguimiento día 3/14/45, cierre día 55) está en `NC:docs/venta/PILOTO_PRIMER_CLIENTE.md:3,10-17`.
- La invitación crea una empresa en estado `trial` con fin de prueba = hoy + `trialDays` (P:117).
- 🟡 **Por confirmar:** el código usa **30 días por defecto** (`trialDays` entre 1 y 365, default 30: P:29). Para cumplir los 60 días hay que enviar **`"trialDays": 60`** en cada invitación. Nada en el código lo fija en 60.
- Ojo, no confundir: el registro público (otra puerta) da 14 días (R:150), pero está cerrado salvo `PRODUCT_PUBLIC_REGISTRATION=enabled` (R:135). El piloto entra solo por invitación.

## 2. Requisitos antes de invitar

| # | Requisito | Estado según el código/documentos |
|---|-----------|-----------------------------------|
| 1 | Credencial de operador: la API de plataforma solo existe si el servidor tiene `PRODUCT_TENANCY=required` y `PLATFORM_ADMIN_TOKEN_SHA256` válido; si no, responde 404 (P:54-57). El cliente envía `Authorization: Platform <token de 64 a 512 caracteres>` (P:61); 5 fallos por minuto por IP bloquean (P:60). | Por verificar en Render (no se consultó): si la variable existe y quién guarda el token. Nunca copiar el token en chats ni documentos. |
| 2 | Correo de salida (`RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `APP_PUBLIC_URL`). **La invitación NO envía correo**: la API solo devuelve un enlace y el operador lo entrega a mano (P:127). El correo se usa para el registro público (R:62-71) y para avisos de vencimiento a la dueña (L:163-166, 197). | 🔴 Por verificar que estén configurados. Sin ellos la invitación igual funciona, pero no habrá avisos de vencimiento por correo; sí quedan avisos dentro del sistema (L:141-149). |
| 3 | `APP_PUBLIC_URL` (o `WEB_ORIGIN`) correcto: de ahí sale el dominio del enlace; si faltan, usa el host de la petición (P:73-74). | Por verificar el valor en producción. |
| 4 | **Acuerdo de servicio en papel**, firmado: la API **exige** versión, fecha (AAAA-MM-DD) y referencia verificable (P:18-22, 33). Sin él, la invitación no se crea. | 🔴 No hay evidencia de un acuerdo de piloto firmado. El contrato 2 se deriva «con revisión del abogado antes del primero» (`NC:PILOTO_PRIMER_CLIENTE.md:14,21`). |
| 5 | Términos revisados por abogado. Los 5 documentos de `NC:docs/venta/contrato/` dicen «Borrador generado por IA. Revisión por un abogado dominicano colegiado antes de firmar» (línea 1 de cada uno) y tienen plazos y precios **PENDIENTE** (p. ej. `05_CONDICIONES_DE_COBRO.md:5`). | 🔴 No revisados por abogado según los documentos. |
| 6 | Textos legales digitales (`PRODUCT_LEGAL_APPROVED=confirmed` + versiones): **no son necesarios** para un piloto en papel. Si no están aprobados, al aceptar se usa el acuerdo en papel registrado (R:199-200); si faltara, la aceptación falla (R:201). | Los borradores no son consentimiento publicable (R:51-53). |
| 7 | Operadora identificada: campo `operadora` (2-80 caracteres) para saber quién invitó, porque la credencial es compartida (P:15-17). Opcional: `PLATFORM_OPERATOR_LABEL` en el servidor (P:207; B:88). | Elegir un nombre por persona. |
| 8 | Precios en el sistema vs. hoja de precios: el código cobra con planes `autoservicio` RD$1,250, `basico` 2,000, `pro` 4,000, `premium` 7,000 al mes (BP:5-10), mientras la hoja aprobada el 7-nov habla de Nube Medio US$69 y Nube Completo US$119 (`NC:HOJA_DE_PRECIOS.md:11-12`). | 🔴 No coinciden. Hay que elegir un `plan` del código para el piloto y decidir el precio real antes de cobrar el mes 3. |

## 3. Pasos para crear la invitación hoy (llamando a la API)

Ruta: `POST /api/platform/tenants` (controlador `platform`: P:80,102; prefijo `api`: `PB:apps/api/src/main.ts:43`). El dominio base es el de la API en producción: por verificar.

Campos (todos obligatorios salvo `trialDays`; no se aceptan campos extra: `.strict()`, P:24-34):

| Campo | Regla |
|-------|-------|
| businessName | 2-120 caracteres |
| companyCode | minúsculas, números y guiones, 2-63 (P:26); es el código con que entrará; si ya existe responde 409 (P:129) |
| businessType | `general`, `retail`, `beauty`, `fitness` o `services` |
| plan | `autoservicio`, `basico`, `pro` o `premium` (BP:5-10) |
| trialDays | entero 1-365; **poner 60** |
| adminName / adminEmail | nombre y correo de la dueña del negocio piloto |
| operadora | quién de Norexos invita |
| acuerdo | `{ version, fecha, referencia }` del acuerdo en papel |

Ejemplo (datos ficticios; `TOKEN_DE_OPERADOR` es un marcador, nunca poner el real en este documento):

```bash
curl -sS -X POST "https://API-DE-NOREXOS.example/api/platform/tenants" \
  -H "Authorization: Platform $TOKEN_DE_OPERADOR" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Tienda Ejemplo SRL",
    "companyCode": "tienda-ejemplo",
    "businessType": "retail",
    "plan": "basico",
    "trialDays": 60,
    "adminName": "María Pérez",
    "adminEmail": "maria@ejemplo.test",
    "operadora": "Operador 1",
    "acuerdo": { "version": "piloto-1", "fecha": "2026-11-20", "referencia": "Acuerdo piloto firmado 20-nov, copia en carpeta Pilotos" }
  }'
```

Respuesta: `id, slug, plan, status, trialEndsAt, invitationUrl` (P:127). Qué pasa por dentro: se crea la empresa con roles admin, manager, seller, warehouse, la dueña con clave y PIN inutilizables hasta que acepte, ajustes iniciales y el cliente «Consumidor final» (R:100-120; P:108-110). El enlace vence en **7 días** (P:113) y queda registro `invitation.created` con operadora y acuerdo, sin el token (P:123-124).

Entrega: copiar `invitationUrl` y enviarlo a la dueña por un canal privado (WhatsApp o correo propio). El token va después de `#`, para que no llegue a logs ni Referer (P:71). Es un secreto de un solo uso: no publicarlo en grupos.

## 4. Qué recibe y qué hace la persona invitada

1. Recibe el enlace `.../aceptar-invitacion#token=...` (P:75-76).
2. Abre la pantalla «Activa tu cuenta de Norexos» (`PB:apps/web/src/Registration.tsx:126`; ruta `PB:apps/web/src/App.tsx:1895-1897`).
3. Elige **contraseña** y **PIN de gerente de 6 números** (Registration.tsx:127-130; el PIN no puede ser una secuencia fácil: R:18) y marca la casilla de aceptación. Si no hay textos digitales, la casilla dice «Acepto usar Norexos bajo el acuerdo de servicio y privacidad que firmé con Norexos» (Registration.tsx:135).
4. El servidor valida el enlace (vigente, no usado), registra la aceptación con fecha y versión `papel:<version>` y avisa al operador (R:182-222). Límite: 10 intentos por IP (R:266).
5. Luego entra con **código de empresa, correo y contraseña** (R:223).
6. Si el enlace venció o ya se usó: «La invitación venció o ya se usó. Pide una nueva» (R:188). Se resuelve con reinvitar.

## 5. Ver estado, reinvitar y revocar

Todas llevan el mismo encabezado `Authorization: Platform ...` y las rutas cuelgan de `/api/platform`.

| Acción | Llamada | Qué hace |
|--------|---------|----------|
| Lista de empresas | `GET /tenants` | slug, nombre, plan, estado, fin de prueba, pagado hasta (P:89-100) |
| Resumen | `GET /summary` | conteos: total, al día, en prueba, por vencer (≤7 días), atrasados, suspendidos; ingresos del mes (P:135-168) |
| Detalle | `GET /tenants/:slug` | estado y datos de la dueña: nombre, correo, `invitationPending` y vencimiento de la invitación (P:170-188) |
| Reinvitar | `POST /tenants/:slug/reinvite` con `{ "operadora": "Operador 1" }` (puede añadir `acuerdo`) | enlace nuevo de 7 días; el anterior deja de servir; solo si no se ha aceptado (P:255-261, 234-239) |
| Revocar | `POST /tenants/:slug/revoke-invitation` con `{ "operadora": "..." }` | cancela el enlace pendiente; no borra la empresa; luego se puede reinvitar (P:264-269) |
| Dueña olvidó la clave | `POST /tenants/:slug/password-reset` | enlace de un solo uso de 24 h; cierra sus sesiones (P:191-221) |

Si la invitación ya se aceptó, reinvitar y revocar responden 409 «La empresa entra con su propia clave» (P:234). Para ver qué hizo cada quien: bitácora de la empresa con acciones `invitation.created/reissued/revoked/accepted` (P:123, 250; R:216-219).

## 6. Al terminar el periodo: estados y cobro

Estados (L:20-34, GRACE_DAYS = 7 en L:19), calculados con el reloj del servidor:

1. `trial`: hasta `trialEndsAt`. Avisos a 7 y 3 días: dentro del sistema a la administración, y por correo si hay correo configurado (L:127-149, 163-166).
2. `past_due` (mora): desde el vencimiento, **7 días de gracia**.
3. `suspended`: pasados los 7 días. Solo lectura y exportación; no se puede modificar ni vender (`PB:apps/api/src/common.ts:840-842`). El texto del aviso dice que nada se borra (L:149).
4. `active`: cuando se registra un pago; «pagado hasta» crece con cada pago (B:126-128).

Cómo se cobra hoy (manual, sin pasarela: B:11-13): el operador registra el pago ya recibido por fuera con `POST /api/platform/tenants/:slug/payments` (B:82).
- Campos: `operationId` (UUID, evita doble cobro), `amount`, `method` (`transfer`, `cash`, `card_in_store`, `courier`), `reference` y `months` (1-12) o `year: true` (B:28-37).
- El monto lo fija el servidor: mensualidad del plan en RD$ por meses; el año vale 10 meses (B:50-54, 105-108). Una referencia no se repite en la misma empresa (B:109-120).
- Si el piloto aún está en prueba, el pago se suma **después** del fin de prueba (B:122-125).
- Se puede anular solo el último pago: `POST .../payments/:id/void` con `{ "reason": "..." }` (B:160-183).
- Hay también un flujo de solicitud por la empresa y revisión de comprobante en un panel local del operador (`PB:docs/producto/COBRO_TRANSFERENCIA_OPERACION.md:7-18`); es local, no remoto, y precios, términos fiscales y cuentas siguen sin validar por la dueña (mismo archivo, línea 22).
- Precios en pesos vs. dólares de la hoja: ver requisito 8. Tasa por confirmar (`NC:HOJA_DE_PRECIOS.md:3`). Norexos no emite NCF ni e-CF (`NC:HOJA_DE_PRECIOS.md:18`).

## 7. Lo que falta para que esto sea fácil

1. 🔴 **Pantalla de operador:** no existe en la web; hoy todo es con `curl`/API (no hay ruta de operador en `PB:apps/web/src`; solo `/aceptar-invitacion` en App.tsx:1895; por verificar con una búsqueda completa antes de afirmarlo en público). El panel de cobro es local y por consola (COBRO...:18).
2. Que la invitación **envíe el correo** sola: hoy solo devuelve el enlace (P:127).
3. `trialDays` por defecto 60 (o un tipo «piloto»), para no depender de acordarse (P:29).
4. Acuerdo de piloto firmado y revisado por el abogado; carpeta con las copias; una referencia estándar (🔴).
5. Alinear planes del código (BP:5-10) con la hoja de precios (Nube Medio/Completo, US$) y fijar la tasa.
6. Guion de operador (plantilla de WhatsApp con el enlace) y guardar el enlace sin dejarlo en chats.
7. Quién guarda y rota el token de operador (rotación sin corte con `PLATFORM_ADMIN_TOKEN_SHA256_NEXT`: P:50-52); token por persona (hoy es compartido: P:15-16).
8. Bitácora del piloto `docs/venta/PILOTO_BITACORA.md` (citada en `NC:PILOTO_PRIMER_CLIENTE.md:16`); por verificar que exista.
9. Probar el flujo completo una vez en un entorno de prueba antes del primer cliente real (no se hizo ninguna llamada real para esta guía).
