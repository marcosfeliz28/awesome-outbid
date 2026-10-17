# Estado de seguridad · orden 3ag

Revisión asistida por IA del código de Nexora POS, base `4991b5136ad54b134ab7fafeee82bff73935c113`, 17 de octubre de 2026. No es una auditoría independiente ni una certificación. Rama local: `nexora-chatgpt-nube`, creada desde `nexora-cloud`.

Se revisaron los 21 controladores y sus 158 rutas. El inventario [de permisos](validacion/3ag-autorizacion-rutas.json) se contrasta con los controladores reales mediante una prueba. El inventario [de entradas](validacion/3ag-entradas-rutas.json) concilia los alias de salud y detalla las 112 rutas que consumen body/query/param.

| Control | Estado | Prueba |
|---|---|---|
| Permiso explícito y denegación cuando falta `@Permit` | corregido | `security-authorization.test.ts`: guardia y metadatos reales en todas las rutas privadas; rol sin permiso → 403, permiso suficiente → admisión. No equivale a ejecutar por HTTP cada operación de negocio. |
| Relaciones y listados limitados a la sucursal | corregido | `security-authorization-postgres.test.ts`: categorías, plantilla, proveedores de productos/importación, categorías de incentivos, compras y cotizaciones; usuario ajeno en encabezado de reporte. PostgreSQL real. |
| Propiedad de caja, ventas, solicitudes y evidencias | ya estaba | Lectura de controladores; integración existente `caja-por-usuario`, `credito-api`, `void-requests-api` y `calidad-seguridad-api`. |
| Campos extra rechazados, también en objetos anidados | corregido | `input-validation.test.ts` y `input-http.test.ts`: Zod estricto, valores repetidos/objetos en query y sync con rechazo individual de la venta inválida. |
| Presupuesto de entradas y paginación | corregido | Profundidad 20; 100.000 nodos; listas/campos 1.000; claves 200 caracteres; texto 300.000. Permanecen JSON HTTP 100 KB y límites específicos inferiores. El XLSX de inventario conserva 1.500 filas: no pasa por el límite JSON. |
| Consultas de los reportes diarios compatibles con la validación | corregido | `day-reports-contract.test.ts`: pulsa ambos botones del componente real, con todos los usuarios o uno elegido, y valida con `dateRange` real. La web envía el día seleccionado; la API conserva el día entero UTC−4 hasta el último milisegundo. |
| Matriz de variantes con presupuesto antes de materializar combinaciones | corregido | `security-matrix-3ag.test.ts`: rechazo antes de producir más de 500; instrumentación segura y control de 500 variantes válidas. |
| SQL con datos del usuario parametrizados | ya estaba | Revisión de llamadas tagged y `Prisma.sql`. `inventoryLossAlert` usa SQL constante y argumentos `$1/$2/$3`; la otra llamada `Unsafe` consulta literalmente la zona horaria. Los fragmentos `Prisma.raw` son constantes versionadas. |
| JWT corto, sesiones y revocación | ya estaba | `session-security-postgres.test.ts`, `auth-guard`, `auth-lockout`: acceso 15 minutos; refresh 7 días, sólo hash almacenado y rotación de uso único; usuario activo, versión y sesión vigente. |
| Cookies de renovación malformadas y vencimiento exacto | corregido | Cookie JSON, formato/tamaño inválidos, vencimiento en el instante actual y logout con cookie malformada; PostgreSQL real. |
| Cambio obligatorio de contraseña | ya estaba | Guardia y flujo existentes; se conserva política de cajero de seis números y política fuerte de administración/gerencia. |
| PIN con cuenta pendiente o revocada durante la espera | corregido | Se centralizaron los cinco consumidores duplicados. Cinco rutas HTTP con PostgreSQL rechazan al gerente pendiente y admiten tras cambiar su contraseña realmente; carrera con bloqueo asesor. |
| Freno de intentos de login y PIN | ya estaba | `rate-limit-l1`, `auth-lockout`, `calidad-seguridad-api` y nueva suite de sesión. Se conservan cinco fallos/bloqueo 15 minutos y presupuestos adicionales por cuenta/solicitante/sucursal. |
| Bitácora atómica en credenciales, permisos y precios | corregido | Trigger PostgreSQL que rechaza `AuditLog`: revierte altas de usuarios/clientes, cambio de acceso, revocaciones y promociones. Cambio obligatorio de contraseña también se revierte si falla la auditoría. Casos de éxito verifican evidencia sin contraseñas/PIN. |
| Auditoría de ventas, caja, inventario, pagos e incentivos | ya estaba | Revisión de transacciones y suites existentes de dinero. No se modificaron fórmulas monetarias ni reglas de aprobación. |
| CSP/HSTS/frame/nosniff en las respuestas normales de la web | ya estaba | Configuración de Nginx revisada sólo en lectura y sonda local con Nginx real: `/` 200 y `/healthz` 204. [Evidencia](validacion/3ag-cabeceras-local.json). |
| Esas cabeceras al responder `/healthz/deep` con 503 | pendiente | `deploy/render/nginx.conf.template`, bloque `@nexora_api_down`: su `add_header Cache-Control` elimina la herencia. Reproducido localmente; corresponde a Claude por la exclusión de `deploy/**`. |
| CORS limitado a un origen propio | corregido | Se conserva origen único y se valida `WEB_ORIGIN`: HTTP(S), sin credenciales, ruta, comodín o lista. `security-data-3ag.test.ts`. |
| Respuestas privadas fuera de cachés HTTP | corregido | Middleware API `Cache-Control: no-store`; fetch/descargas/SSE con `cache: no-store`; comprobación HTTP local en nueva suite de datos. |
| Token en memoria y refresh protegido | ya estaba | Access token sin persistencia; cookie refresh HttpOnly, SameSite strict y Secure en producción. Revisión y pruebas de sesión. Esto no hace inmune una sesión activa frente a XSS. |
| PWA sin cachear API privada | ya estaba | Precache de archivos estáticos, sin runtime cache de `/api`; suites `pwa-update`, `web-privacy` y `cloud-deploy`. |
| Caché local separada por usuario/sucursal/rol/permisos | corregido | `browser-session-security.test.ts`: claves lógicas compatibles, `owner` obligatorio exacto en cada copia y escrituras transaccionales; React Query, admin→seller aun con permisos idénticos, respuesta/refresh tardíos y cierre fallido con cookie vigente. Los lectores/escritores de POS y tiempo real usan los mismos helpers. |
| Renderizado sin HTML crudo | ya estaba | Búsqueda en la web sin usos de `dangerouslySetInnerHTML`/`innerHTML`; CSP limita scripts al propio origen. |
| Tipo y tamaño real de archivos y límites multipart | corregido | Ocho rutas multipart revisadas. Factura valida bytes/MIME/tamaño; CSV binario rechazado; catálogo/logo/evidencia no admiten campos de texto. Pruebas HTTP con archivo genuino → 201 y campo extra → 400 antes de escribir. Descarga de factura privada, attachment y nosniff. |
| Guardas XLSX contra descompresión y exceso de celdas | ya estaba | `xlsx-bomb`, `inventory-import-core` y `merchandise-template`; se conservan límites y guardas previas a ExcelJS. |
| Dependencias sin avisos altos/críticos | corregido | Vitest 4.1.12 y restricción de shell-quote corregido; `pnpm audit --json`: 0 vulnerabilidades (incluidas altas/críticas). Sin excepciones de vulnerabilidades aceptadas. |
| Secretos por configuración y errores sin texto sensible | corregido | JWT validado por longitud/fortaleza; diagnóstico de consola de formato cerrado en API, arranque, sync, reportes, alertas, créditos, retención e importación. El arranque admite sólo dos mensajes constantes completos de configuración, nunca sus valores. Regresiones con secretos ficticios y revisión de monitoreo. |
| Escaneo acotado de secretos del árbol rastreado | ya estaba | 802 archivos de texto iniciales; sin patrones de tokens reales de alta confianza ni claves privadas. Repetido sobre 819 archivos de texto del árbol de entrega, incluidos los documentos nuevos, también sin coincidencias. No se inspeccionaron valores de credenciales del entorno ni datos de producción; no es escaneo del historial ni validación de configuración productiva. |

## Excepciones y límites del alcance

Las siete rutas públicas son salud (tres alias), login, cambio obligatorio de contraseña, refresh y callback de Google. Las de credenciales aplican sus validaciones y frenos; el callback valida estado firmado, cookie de un uso y administración vigente. Las diez rutas `authenticated` requieren identidad, y donde corresponde validan dueño, sucursal, secreto de equipo o PIN. Las 35 rutas con `*` conservan el acceso sólo de administración.

Los atributos de variantes y umbrales usan registros dinámicos acotados. La credencial opcional de equipo se acepta como desconocida para tratar formatos inválidos como equipo no aprobado; su esquema interno es estricto. El sobre de sync conserva campos para validar y rechazar cada venta individualmente. Las rutas sin body/query/param consumidos no procesan los campos ignorados. Estos contratos no son un permiso para asignar atributos arbitrarios a la base.

Role, Brand, ExpenseCategory, AlertRule y los respaldos son globales de la instalación según el esquema actual. Esta entrega endurece el sistema de la tienda; no lo convierte en un SaaS con aislamiento entre negocios.

Después de actualizar, cada usuario debe conectarse una vez para descargar su catálogo/cachés con propietario. Las copias antiguas sin dueño se ignoran. Cada clave lógica conserva la última copia: si otra identidad la sustituye, la anterior deberá conectarse para recuperarla. Las consultas no reutilizan esa copia ajena. Se conservan ventas, entradas y borradores pendientes de su dueño.

## AUTOAUDITORÍA y evidencia

| Bloque | Antes del arreglo | Después, focal |
|---|---|---|
| Autorización/IDOR | 16 fallan / 152 pasan; ausencia de permiso permitía acceso | Inventario completo más regresiones PostgreSQL; resultado combinado en entrega |
| Entradas | 35 fallan / 1 pasa; casa preview aceptaba texto extra hasta el lector | 39/39 |
| Sesión/PIN | 12 fallan / 8 pasan; cinco consumidores duplicados reproducidos por HTTP | 28/28 |
| Navegador | 9 fallos iniciales; 5 fallos posteriores al cierre; 2 fallos por cambio de rol | 24/24 |
| Compatibilidad y atomicidad de caché | Primer CI: 140 E2E pasan y 2 fallan porque las claves físicas cambiaron; reproducción local de ambos fallos y 3 regresiones unitarias rojas | 36/36 controles de navegador y ambos E2E focales pasan con claves originales, datos reales y dueño obligatorio; no se modificó E2E |
| Archivos | 17 fallan / 3 pasan | 20/20 |
| Bitácora | 4 fallan / 2 pasan; alta de cliente adicional también persistía tras fallar auditoría | 8/8 |
| Matriz de variantes | Crecimiento por encima de 500 antes de validar | 2/2 |
| Registros internos | Dos fugas reproducidas en API/retención y otra en importación | Suite de datos de formato cerrado |
| Diagnóstico de arranque | El formato cerrado ocultaba también la indicación segura de configuración | 21/21 controles de datos y tres arranques reales con secretos inválidos rechazados sin conectarse a la base |
| Reportes diarios de la web | 4/4 fallan al validar la consulta generada por sus botones | 4/4; formato de día y filtro de usuario compatibles, sin ampliar la aceptación de entradas |
| Dependencias | 3 críticos y 2 moderados | Sin vulnerabilidades en la auditoría posterior |

Se probaron otro usuario/sucursal, rol sin permiso, cambio de rol manteniendo permisos, campos extra anidados, cookie inválida, doble renovación y respuestas simultáneas con cambio de identidad. Las suites de integración existentes comprueban idempotencia, concurrencia, importes extremos, caja, kardex, incentivos, créditos y sync. Las pruebas de precio extra offline, anulación con campos extra y rol falsificado exigen rechazo sin escrituras; las peticiones válidas conservan todas sus afirmaciones monetarias. OAuth acepta los parámetros legítimos acotados y rechaza los desconocidos antes de llamar al servicio. La prueba SSE identifica sus eventos por el id del servidor y mantiene el orden de commit, incluida la ausencia del evento aún no confirmado.

La ejecución local general de navegador obtuvo 139/142; los tres focales posteriores pasan tras corregir el entorno LAN y exportar la configuración demo de pruebas, pero el escaneo con foco en descuento mostró intermitencia: dos de tres focales correctos con el cambio frente a tres de tres en `804ba61`; causa no determinada. La comparación y el CI del último SHA se detallan en la entrega; no se considera una ejecución completa verde ni se relajaron umbrales o pruebas.

Los [resúmenes de salida real de regresiones](validacion/3ag-regresiones.txt) conservan conteos y tiempos sin datos de peticiones. Los resultados finales, comandos y CI se registran en [RESULTADOS_CHATGPT.md](coordinacion/RESULTADOS_CHATGPT.md).

La sonda de cabeceras utiliza Nginx 1.26.3 local, no la instancia ni la imagen 1.30.5 de producción. Claude debe corregir el bloque 503, verificar con la imagen desplegable y revisar adversariamente esta entrega antes de integrar y desplegar. No hubo despliegue ni cambios en `deploy/**`, `render.yaml`, `.github/workflows/**` o `tests/e2e/**`.
