# Especificación: pantalla mínima del operador de plataforma para invitar y gestionar pilotos

Rama leída: origin/producto-nexora. Todas las citas son `archivo:línea` de esa rama. Es una especificación, no hay código escrito.

## 1. Alcance mínimo

HACE:
- Lista de empresas (`GET /api/platform/tenants`, platform.ts:89-100) y tarjetas de resumen (`GET summary`, platform.ts:135-168: total, alDia, enPrueba, porVencer, atrasados, suspendidos).
- Invitar un piloto (`POST tenants`, platform.ts:102-132) y mostrar el enlace de invitación UNA sola vez.
- Ver detalle de una empresa (`GET tenants/:slug`, platform.ts:170-189), incluida la administradora y si su invitación está pendiente.
- Reinvitar (platform.ts:256-262), revocar invitación (platform.ts:265-270) y restablecer clave (platform.ts:194-221).

NO HACE (fuera de alcance):
- Cobros, pagos, anulaciones, paquetes de IA, sesiones de soporte. Existen rutas (`payments`, `ai-packs`, `ai-usage`, `support-session`, `support-grants`, app.ts:172), pero no son de esta pantalla.
- Aprobar transferencias: eso es el panel local y el CLI (COBRO_TRANSFERENCIA_OPERACION.md:14-18).
- Cambiar plan, fecha o estado de una empresa. No hay ruta de edición en platform.ts.
- Enviar el enlace por correo o WhatsApp: la API solo devuelve la URL (platform.ts:127); el operador la copia y la manda.
- Ver datos de negocio de las empresas (platform.ts:134 «Solo conteos y montos»).
- Mostrar o recordar el token de plataforma fuera de la memoria de la pestaña.

## 2. Cómo se autentica el operador hoy, y riesgo de exponer la pantalla

- Credencial: cabecera `Authorization: Platform <token de 64 a 512 caracteres sin espacios>` (platform.ts:61). El servidor compara SHA-256 del token contra `PLATFORM_ADMIN_TOKEN_SHA256` y, opcional, `PLATFORM_ADMIN_TOKEN_SHA256_NEXT` para rotar (platform.ts:55-58, 62-64; render.producto.yaml:62-63).
- Sin hash válido o sin `PRODUCT_TENANCY=required`, TODAS las rutas responden 404 «No disponible.» (platform.ts:56-57). La pantalla debe tratar 404 como «el operador de plataforma no está activado en este servidor».
- Fallos: 401 «No autorizado.» (platform.ts:67); 5 fallos por IP por minuto y luego 429 «Demasiados intentos. Espera un minuto.» (platform.ts:60, 66).
- La credencial es compartida: por eso cada acción lleva `operadora` (nombre de quien opera, platform.ts:15-17). Las rutas pasan por el middleware «sin empresa» sin sesión de tenant (app.ts:171-175).
- El cliente `api()` NO sirve: pone `Bearer` de la sesión de la tienda, manda `credentials: "include"` y ante 401 llama `refreshSession()` y reintenta (apps/web/src/api.ts:363-372). Hay que usar un `fetch` propio hacia `/api/platform/...` con `Authorization: Platform …`, sin credenciales de cookies, y sin reintento.
- CORS: la API acepta solo el origen `WEB_ORIGIN` con `credentials: true` (apps/api/src/main.ts:66-70). La pantalla servida desde el mismo origen de la web funciona; desde otro origen, no.
- Riesgos de exponerla en la web pública del producto:
  1. Un solo secreto compartido da poder de crear empresas y de restablecer la clave de cualquier administradora (platform.ts:194-221, equivale a tomar una cuenta). No hay 2FA ni SSO: COBRO_TRANSFERENCIA_OPERACION.md:22 lo marca como pendiente y dice que el panel de plataforma «no es remoto ni listo para exponer a Internet».
  2. Si el token se guarda en `localStorage`, cualquier XSS lo roba. Regla: solo memoria de la pestaña (estado de React), nunca `localStorage`, `sessionStorage`, URL ni consola.
  3. Los enlaces de invitación y de restablecimiento son credenciales de un solo uso (7 días y 24 h, platform.ts:113, 206); mostrarlos en pantalla y en capturas es riesgo. El token va en el fragmento `#token=` para no llegar a logs (platform.ts:71-77): la pantalla no debe cambiar eso ni imprimirlo en consola.
  4. Un solo error de ruta pública (`/operador` visible a todos) revela que existe la función. Si `PRODUCT_TENANCY_REQUIRED` es falso, no debe montarse.
- Recomendación (decisión de la dueña, ver 7): montar la ruta solo si `PRODUCT_TENANCY_REQUIRED` es verdadero (mismo patrón de App.tsx:1888-1896), sin enlace desde ningún menú, con `<meta name="robots" content="noindex">`, y entregarla solo con una de dos opciones: (a) servirla únicamente en la máquina del operador junto al panel local de facturación (scripts/platform-billing-panel.ts, escucha 127.0.0.1, línea 208), o (b) dejarla en la web pública con el token pegado cada vez. La opción (a) es la más segura y la que sigue lo ya decidido en COBRO_TRANSFERENCIA_OPERACION.md:18.

## 3. Pantallas y campos

Enrutado: igual que `AcceptInvitation`: en `App()` se compara `window.location.pathname` y se devuelve el componente antes de `<Shell />` (apps/web/src/App.tsx:1885-1897). Rutas nuevas sugeridas: `/operador` (todo en una pantalla con vistas internas, sin librería de rutas). Componente en archivo nuevo `apps/web/src/OperadorPlataforma.tsx`, exportado y usado en `App()` igual que `AcceptInvitation` (Registration.tsx:105).

Estilo: reutilizar la clase `product-registration` (styles.css:7143-7195) para el contenedor central y `field`. Componentes de `packages/ui/src/index.tsx`: `Button` (12), `Badge` (26), `Empty` (35), `Loading` (55), `Card` (65), `Field` con `label/hint/error` y `aria-describedby` ya resueltos (82-121), `TableFrame` (123, región con nombre y teclado), `Modal` (137, Radix Dialog con foco atrapado). Preferir `Field` sobre los `<label>` manuales de Registration.tsx:61-67.

### 3.1 Entrada (token)
- Campo `token` (contraseña, `autoComplete="off"`): 64 a 512 caracteres sin espacios (`/^Platform (\S{64,512})$/`, platform.ts:61). Validar en cliente `^\S{64,512}$`.
- Campo `operadora` (texto): `trim`, mínimo 2, máximo 80 (platform.ts:17). Se pide aquí una vez y se reutiliza en cada acción (queda en memoria, editable).
- Botón «Entrar»: llama `GET summary`. 200 = dentro. 401/404/429 = mensajes de la sección 4.

### 3.2 Panel: resumen y lista
- 6 tarjetas del resumen: Total, Al día, En prueba, Por vencer, Atrasados, Suspendidos. Ingresos del mes (`monthIncome`, `monthPayments`, `monthAiPacks`, `month`, platform.ts:164-167): mostrar solo `monthIncome` en RD$ como dato de lectura; no es necesario para invitar, se puede omitir en la primera versión.
- Tabla de empresas, columnas: nombre (`name`), código (`slug`), plan, estado (`status` efectivo), prueba termina (`trialEndsAt`), pagado hasta (`paidUntil`), creada (`createdAt`) (platform.ts:93, 97-99). Orden: la API entrega más nueva primero (platform.ts:94). Sin paginación en la API: la lista trae todas. Si hay más de unas 200, agregar filtro de texto en cliente por nombre o código.
- Botón principal «Invitar piloto» (acción principal, violeta).

### 3.3 Formulario «Invitar piloto» (modal o vista)
Cada campo copia el esquema `invitedTenant` (platform.ts:24-34, estricto: ningún campo extra, `.strict()`):

| Campo en pantalla | Clave JSON | Validación exacta (zod) |
|---|---|---|
| Nombre del negocio | `businessName` | trim, mín 2, máx 120 (platform.ts:25) |
| Código de empresa | `companyCode` | trim, a minúsculas, `/^[a-z0-9][a-z0-9-]{1,62}$/` (platform.ts:26); es el código con el que la empresa entra |
| Tipo de negocio | `businessType` | uno de `general`, `retail`, `beauty`, `fitness`, `services` (platform.ts:27). Etiquetas: General, Tienda, Belleza, Fitness, Servicios (Registration.tsx:66) |
| Plan | `plan` | uno de las claves de `BILLING_PLANS`: `autoservicio`, `basico`, `pro`, `premium` (billing-plans.ts:6-9; platform.ts:13, 28). Etiquetas con `label` y `monthlyDop` (Autoservicio RD$1,250, Básico 2,000, Pro 4,000, Premium 7,000 al mes; precios sujetos a aprobación de la dueña, COBRO_TRANSFERENCIA_OPERACION.md:3) |
| Días de prueba | `trialDays` | entero, mín 1, máx 365, por defecto 30 (platform.ts:29). Enviar número, no texto |
| Nombre de la administradora | `adminName` | trim, mín 2, máx 120 (platform.ts:30) |
| Correo de la administradora | `adminEmail` | trim, email válido, máx 254 (platform.ts:31); el servidor lo pasa a minúsculas (platform.ts:106) |
| Operadora | `operadora` | trim, mín 2, máx 80 (platform.ts:17, 32) |
| Acuerdo: versión | `acuerdo.version` | trim, `/^[A-Za-z0-9._-]{1,40}$/` (platform.ts:19) |
| Acuerdo: fecha | `acuerdo.fecha` | `/^\d{4}-\d{2}-\d{2}$/` (platform.ts:20); usar `<input type="date">`. El esquema NO valida que sea fecha real: validar también en cliente que exista (rechazar 2026-02-31) |
| Acuerdo: referencia | `acuerdo.referencia` | trim, mín 3, máx 120 (platform.ts:21) (ej.: número de contrato o de hoja firmada) |

El objeto `acuerdo` y la clave `operadora` son obligatorios al crear (platform.ts:32-33); solo son opcionales al reinvitar o revocar (platform.ts:23).
Respuesta 200: `{ id, slug, plan, status, trialEndsAt, invitationUrl }` (platform.ts:127).

### 3.4 Resultado de invitación (una sola vez)
- Muestra: empresa, código, plan, estado «Prueba», fecha de fin de prueba y `invitationUrl` en un campo de solo lectura con botón «Copiar enlace» (clipboard; si falla, seleccionar el texto).
- Aviso fijo: «Este enlace se muestra solo ahora y vence en 7 días (platform.ts:113). Si lo pierdes, usa Reenviar invitación.»
- No guardar la URL en el estado después de cerrar el diálogo; no ponerla en `console.*`. Al cerrar, borrar del estado.

### 3.5 Detalle de empresa
- `GET tenants/:slug` (platform.ts:170-189): `id, slug, name, plan, status, businessType, trialEndsAt, paidUntil, createdAt` y `admin { name, email, invitationPending, invitationExpiresAt }`. `admin` puede ser `null` o ausente.
- Acciones, según estado:
  - Si `admin.invitationPending` es verdadero: «Reenviar invitación» (`POST reinvite`) y «Revocar invitación» (`POST revoke-invitation`).
  - Si `invitationPending` es falso: «Restablecer clave de la administradora» (`POST password-reset`, sin cuerpo; platform.ts:194). Se registra con `PLATFORM_OPERATOR_LABEL` del servidor (platform.ts:207), no con el nombre de la operadora de la pantalla: esta ruta NO recibe `operadora`. Es una carencia a anotar (sección 7).
- Cuerpo de reinvite y revoke: `{ operadora, acuerdo? }`, estricto (platform.ts:23). Mandar `acuerdo` solo si la dueña dio una versión nueva; si se manda y la empresa aún no aceptó términos, reemplaza la versión de papel (platform.ts:246-249).
- Revocar y restablecer son destructivas: pedir confirmación en un `Modal` con el nombre de la empresa.
- Reinvite responde `{ slug, invitationUrl, expiresAt }` (platform.ts:261). Revoke responde `{ slug, revoked: true }` (platform.ts:269). Password-reset responde `{ slug, email, invitationUrl, expiresAt }` (platform.ts:220) y deja la clave anterior sin validez y cierra sus sesiones (platform.ts:191-193, 212-213). Mostrar los enlaces como en 3.4 (reinvite 7 días; restablecer 24 h, platform.ts:206).

## 4. Estados, errores y textos (español)

Estados de pantalla: sin entrar; entrando; cargando lista (`Loading`); lista vacía (`Empty`: «Aún no hay empresas piloto. Invita la primera.»); lista con datos; enviando formulario (botón desactivado, texto «Procesando…»); éxito; error.

Etiquetas de estado de empresa (valor `status` efectivo de `effectiveTenantStatus`; confirmar valores exactos en tenant-lifecycle.ts, que NO fue leído a fondo; el resumen usa `trial`, `active`, `past_due`, `suspended`, platform.ts:146-151): `trial` = «En prueba», `active` = «Al día», `past_due` = «Atrasada», `suspended` = «Suspendida». Badge con texto SIEMPRE además del color.

Mapa de errores (la API devuelve `message` en español; mostrar ese mensaje y, si falta, usar el de la tabla):

| Caso | Código | Texto |
|---|---|---|
| Función no activada | 404 «No disponible.» (platform.ts:57) | «El operador de plataforma no está activado en este servidor.» |
| Token incorrecto | 401 (platform.ts:67) | «Credencial no válida. Revisa el token.» |
| Demasiados intentos | 429 (platform.ts:60, 66) | «Demasiados intentos. Espera un minuto.» |
| Código ocupado | 409 (platform.ts:129) | «Este código de empresa ya está ocupado.» (marcar el campo código) |
| Empresa no encontrada | 404 (platform.ts:177, 199, 233) | «Empresa no encontrada.» |
| Invitación ya aceptada | 409 (platform.ts:234) | «La invitación ya se aceptó: la empresa entra con su propia clave.» (ofrecer Restablecer clave) |
| Sin administración activa | 409 (platform.ts:204) | «La empresa no tiene una cuenta de administración activa.» |
| Validación del cuerpo | `parse()` de common (no leído; ver pregunta abierta 7.7) | «Revisa los campos marcados.» Si el servidor no devuelve el campo, validar siempre en cliente para que esto casi no ocurra |
| Sin conexión | error de red | «No hay conexión. No se envió nada; vuelve a intentar.» |

Regla ante 401 de plataforma: NO borrar la sesión de la tienda ni llamar `refreshSession`; solo volver a pedir el token.
Evitar doble envío (POST de crear no es idempotente: un segundo clic con otro código crea otra empresa): desactivar el botón mientras `busy`, igual que Registration.tsx:36, 46.

## 5. Accesibilidad y modo claro/oscuro

- Colores: no crear tokens nuevos. Usar los de `:root` y `:root[data-theme="dark"]` (styles.css:71-123, 125-165): `--bg`, `--surface`, `--text`, `--muted`, `--border`, `--action` (#7c3aed), `--action-hover` (#6d28d9), `--on-action`, `--focus` (claro #6d28d9, oscuro #43e3b1), `--danger-text`, `--danger-soft`, `--positive-text`, `--warning-text`. Regla de diseño decidida: violeta = acción y lugar actual; esmeralda = estado y foco; no usar el color como decoración (docs/diseno/OBSIDIAN_LUMINA_PROGRESO.md:7-9).
- Acción principal («Invitar piloto», «Entrar», «Crear invitación») en violeta `--action` con texto `--on-action`. No hay una acción «Cobrar» en esta pantalla; si se agrega algún día, sigue la misma regla de acción principal violeta. Revocar y restablecer: `Button variant="danger"`.
- Estado de empresa en `Badge`: reutilizar las tonalidades existentes (`success`, `warning`, `danger`, `neutral`; styles.css:488-504 las adapta a oscuro). No inventar tonos nuevos.
- Modo oscuro: el tema se aplica con `data-theme="dark"` en la raíz; la pantalla hereda sin código propio. Verificar contraste en ambos temas.
- Nota de coherencia: `.product-registration button` usa `--primary` con texto `--surface` (styles.css:7191-7197). En oscuro `--primary` es #a78bfa, en claro #7c3aed; el texto sobre el botón cambia de blanco a casi negro. Para esta pantalla, preferir `Button` de `@nexora/ui`/clase `btn primary` con `--action`/`--on-action` y comprobar contraste ≥ 4.5:1 en ambos temas.
- Teclado y lector: un `<h1>` por vista; `Field` ya asocia `label`, pista y error con `aria-describedby` y `aria-invalid` (index.tsx:82-121); errores generales con `role="alert"`, éxitos con `role="status"` (Registration.tsx:72-73); `Modal` atrapa foco y devuelve al botón que lo abrió (Radix); tabla dentro de `TableFrame` (región con nombre y alcanzable con teclado, index.tsx:123); el enlace de invitación en `<input readOnly>` con `aria-label` «Enlace de invitación»; botón «Copiar» anuncia «Enlace copiado» con `role="status"`. Objetivos táctiles ≥ 44 px (como `min-height: 44px`, styles.css:7179-7181). Funcionar a 390 px de ancho sin desplazamiento horizontal de la página.
- Seguridad visual: la pantalla debe tener un encabezado fijo «Operador de plataforma» para no confundirse con la tienda.

## 6. Pruebas (fallan antes, pasan después)

Ya existe `tests/product-platform-invitation-postgres.test.ts` (API; no se toca) y `tests/platform-token-rotation.test.ts`. La pantalla no tiene pruebas. Revisar cómo se prueban pantallas hoy (hay `apps/web/src/*.test.*` para lógica y Playwright en las auditorías) y seguir ese patrón. Pruebas nuevas:

1. Unidad (puras, en un módulo `operador-validacion.ts` que replique el esquema): cada campo del apartado 3.3 con casos límite: 1 y 2 caracteres, 120 y 121, `companyCode` con mayúsculas, guion inicial, 64 caracteres; `trialDays` 0, 1, 365, 366, 1.5, texto; correo de 255 caracteres; `acuerdo.version` con espacio y con 41 caracteres; `fecha` «2026-02-31». Fallan antes porque el módulo no existe.
2. Paridad con el servidor: una prueba que importe el esquema real o un caso crear-con-datos-válidos contra la API de prueba y verifique que lo que acepta el cliente lo acepta el servidor y viceversa en los casos límite. (Si no se puede importar el esquema por no ser exportado, anotarlo; hoy `invitedTenant` no se exporta, platform.ts:24.)
3. Componente (jsdom o Playwright con la API simulada):
   - Sin token no hay llamadas; con token de 63 caracteres no se envía; con 64 se llama `GET summary` con cabecera exacta `Authorization: Platform <token>` y SIN `credentials: "include"`.
   - 401 no llama a `refreshSession` ni borra la sesión de la tienda; 404 muestra «no está activado»; 429 muestra «Espera un minuto».
   - Crear con datos válidos manda JSON con todas las claves de 3.3, `trialDays` numérico y sin claves extra (el servidor es `.strict()`), muestra el enlace y, al cerrar el diálogo, el enlace ya no está en el DOM.
   - 409 de código ocupado marca el campo y no limpia lo escrito.
   - Doble clic en «Crear» envía una sola petición.
   - El token y el enlace no aparecen en `localStorage`, `sessionStorage`, URL ni `console`.
4. Enrutado: `/operador` renderiza la pantalla solo con `PRODUCT_TENANCY_REQUIRED`; sin él cae en `<Shell />`; no hay enlace desde la navegación.
5. Auditoría de usuario (skill `auditoria-usuario`): capturas a 1366x768 y 390x844 en claro y oscuro, tabulación completa, sin desbordamiento. Solo lectura: nunca crear empresas reales; usar la API de prueba o un servidor local.
6. Seguridad (skill `seguridad-20`, lista de 20 puntos): revisar que no haya XSS al pintar `name` de empresas (React escapa; no usar `dangerouslySetInnerHTML`), que la ruta no se indexe, y que el token no salga a Sentry/monitoring: `traceBusinessOperation` envuelve `api()` (api.ts:385-388); el `fetch` propio no debe pasar por ahí con cabeceras.

## 7. Riesgos y preguntas abiertas para la dueña

Preguntas (decisión suya):
1. ¿Dónde vive la pantalla: solo en la computadora del operador (junto al panel local, más seguro) o en la web pública del producto con el token pegado? Sin 2FA ni SSO hoy (COBRO_TRANSFERENCIA_OPERACION.md:22), la opción pública es la de más riesgo.
2. ¿Quién es «la operadora»? Hay una credencial compartida; el campo `operadora` es texto libre y no se verifica. ¿Una sola persona o varias? ¿Qué nombre se escribe?
3. ¿Qué texto, versión y referencia tiene el acuerdo en papel que se firma con cada piloto (por ejemplo «v1», fecha, número de hoja)? Sin ellos el formulario no puede enviarse (campo obligatorio, platform.ts:33).
4. ¿Qué planes y cuántos días de prueba se ofrecen a los pilotos (por defecto 30, platform.ts:29; el registro público dice 14, Registration.tsx:59)? Los precios están sujetos a su aprobación (COBRO_TRANSFERENCIA_OPERACION.md:3).
5. ¿Cómo se entrega el enlace a la persona invitada (WhatsApp, correo a mano)? La API no envía nada (platform.ts:127). ¿Se quiere que la pantalla arme un mensaje listo para copiar y pegar?
6. ¿Se necesita editar plan, prórroga de prueba o suspender desde la pantalla? No hay ruta de servidor para eso; sería trabajo de API nuevo, fuera de esta especificación.

Riesgos técnicos:
7. `parse()` (apps/api/src/common, no leído) define el formato exacto del error de validación (400): el agente que programe debe leerlo y adaptar la sección 4; mientras tanto la validación del cliente debe ser completa.
8. `password-reset` no recibe `operadora` y deja constancia con una variable de entorno fija (platform.ts:207, 215-216): la bitácora no dice quién del equipo lo hizo. Mejora de API sugerida (otro cambio, no de esta pantalla).
9. `GET tenants` no pagina (platform.ts:90-95): con cientos de empresas la lista se vuelve pesada.
10. El código de empresa se puede ocupar con un nombre equivocado y no hay ruta para borrar o renombrar la empresa: un error de dedo al invitar se arregla solo revocando la invitación y creando otra con otro código. Mostrar un resumen de confirmación antes de enviar («Vas a crear la empresa X con código Y») reduce el riesgo.
11. Cada «Invitar» crea una empresa real en la base del producto (platform.ts:114-126): las pruebas manuales no deben hacerse contra producción.
12. `tenant-lifecycle.ts` y `registration.ts` (createTenantWithOwner) no se leyeron a fondo: los valores exactos de `status` deben confirmarse allí.

## 8. Estimado de horas (estimado, no compromiso)

| Tarea | Horas |
|---|---|
| Módulo de validación del cliente + pruebas de unidad | 2 a 3 |
| Entrada con token, `fetch` propio, manejo de 401/404/429 | 2 |
| Resumen + lista de empresas (con estados vacío y de carga) | 3 |
| Formulario de invitar + pantalla de enlace una sola vez | 4 |
| Detalle + reinvitar, revocar, restablecer con confirmación | 4 |
| Estilos claro/oscuro, accesibilidad, 390 px | 3 |
| Pruebas de componente y enrutado | 4 |
| Auditoría de usuario, seguridad-20, ajustes | 3 |
| Total | 25 a 26 h (aprox. 3 días de trabajo de una persona) |

Si solo se hace «Entrar + Invitar + enlace una vez» (lo mínimo para dejar de llamar la API a mano): 10 a 12 h.
