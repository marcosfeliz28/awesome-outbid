# AUD-NUEVO · Auditoría estática de Nexora POS

**Fecha:** 25 de octubre de 2026  
**Auditor:** ChatGPT Nube  
**Base revisada:** `origin/producto-nexora` en `2f147d2`  
**Inicio sencillo revisado aparte:** `origin/claude/inicio-sencillo` en `605b241` contra `2f147d2`

## Alcance y método

Revisión estática, sin desplegar, sin tocar Render, producción, credenciales ni datos de la tienda. Se revisaron la IA (`assistant*.ts`), panel y rutas de plataforma (`platform*.ts`), cobro manual, solicitudes de pago y paquetes de IA, acceso de soporte, invitaciones, NCF por venta y el cambio propuesto de inicio sencillo. Los números de línea corresponden a los commits indicados arriba.

No se cambió código. Esta auditoría identifica defectos y riesgos verificables en el código; cuando una conclusión depende de una decisión comercial o fiscal, se indica expresamente.

## Resumen ejecutivo

Se confirmaron **37 hallazgos**: **15 altos, 20 medios y 2 bajos**. Las prioridades antes de cobrar o emitir NCF son:

1. hacer idempotentes los cobros y derivar monto/vigencia del plan;
2. cerrar las carreras y validaciones del NCF y conservar su trazabilidad fiscal;
3. reducir el alcance del acceso de soporte y reemplazar la credencial global de plataforma;
4. poner límites totales de costo/datos a una consulta de IA;
5. corregir crédito a «Consumidor final», identidad de equipos entre empresas y mensajes fiscales del inicio sencillo.

## Hallazgos

### A. IA y paquetes de preguntas

#### IA-01 — Alta — Una pregunta puede multiplicar el costo sin consumir más cuota

- **Archivo:línea:** `apps/api/src/assistant.ts:222-258`.
- **Evidencia:** una consulta permite seis vueltas; cada vuelta acepta hasta diez herramientas y cada resultado puede aportar hasta 20 000 caracteres. La cuota descuenta una sola pregunta, aunque el servidor puede hacer seis llamadas al modelo y acumular aproximadamente 1,2 millones de caracteres de herramientas.
- **Arreglo propuesto:** imponer por consulta un presupuesto total de vueltas, herramientas, bytes y tokens; detenerse antes de superar el presupuesto y contabilizar el consumo real o una unidad ponderada.

#### IA-02 — Media — Una respuesta HTTP truncada puede eludir la redacción estructurada

- **Archivo:línea:** `apps/api/src/assistant.ts:207-212` y `apps/api/src/assistant.ts:121-147`.
- **Evidencia:** el cuerpo se corta a 100 000 caracteres antes de intentar `JSON.parse`. Si el corte rompe el JSON, se trata como texto plano y no se eliminan claves sensibles con `redact()`.
- **Arreglo propuesto:** limitar la lectura sin cortar una estructura válida; rechazar respuestas truncadas o JSON inválido y aplicar una lista blanca por herramienta antes de enviar datos al proveedor.

#### IA-03 — Media — El cliente puede falsificar el historial del asistente

- **Archivo:línea:** `apps/api/src/assistant.ts:11-16` y `apps/api/src/assistant.ts:214-218`.
- **Evidencia:** la petición acepta mensajes anteriores con rol `assistant`. Un cliente modificado puede insertar cifras o afirmaciones falsas como si fueran respuestas previas del modelo.
- **Arreglo propuesto:** mantener el historial en el servidor, firmado y ligado a la sesión, o aceptar solo la pregunta actual. Añadir además un límite total de caracteres de la conversación.

#### IA-04 — Media — Una herramienta presentada como lectura modifica alertas

- **Archivo:línea:** `apps/api/src/assistant.ts:106-109`, `apps/api/src/alerts.ts:773` y `apps/api/src/alerts.ts:890`.
- **Evidencia:** `alertas_auditoria` ejecuta `GET /api/alerts`, pero esa ruta crea, actualiza y resuelve alertas al recalcularlas. Una pregunta al asistente puede, por tanto, escribir estado operativo.
- **Arreglo propuesto:** crear un endpoint de consulta estrictamente de solo lectura para la IA y probar que no cambia ninguna fila.

#### IA-05 — Media — Se envían al proveedor más datos de negocio de los necesarios

- **Archivo:línea:** `apps/api/src/assistant.ts:101-105`, `apps/api/src/sales.ts:1566` y `apps/api/src/sales.ts:3813`.
- **Evidencia:** algunas herramientas reutilizan listados generales de ventas y cuentas pendientes, con cientos de filas, nombres, notas y cobros, para responder preguntas que normalmente requieren totales o pocas columnas.
- **Arreglo propuesto:** endpoints específicos para IA con agregados y listas blancas mínimas; no enviar nombres, notas, referencias ni detalles de cobro salvo necesidad explícita y permiso suficiente.

#### IA-06 — Media — Los fallos posteriores borran el consumo de tokens de vueltas anteriores

- **Archivo:línea:** `apps/api/src/assistant.ts:219-227` y `apps/api/src/assistant.ts:283-290`.
- **Evidencia:** el consumo se acumula dentro de `askAssistant`, pero si una vuelta posterior lanza error el controlador registra `input: 0, output: 0`.
- **Arreglo propuesto:** persistir consumo después de cada vuelta o adjuntar el consumo acumulado a un error tipado y guardarlo al marcar la consulta fallida.

#### IA-07 — Media — Los fallos del proveedor consumen preguntas pagadas

- **Archivo:línea:** `apps/api/src/platform-ai-packs.ts:51-54`, `apps/api/src/platform-ai-packs.ts:75-103` y `apps/api/src/assistant.ts:288-292`.
- **Evidencia:** la reserva crea una fila `assistant.ask` antes de llamar al modelo y el conteo incluye también las marcadas `fallida`.
- **Arreglo propuesto:** contar consultas completadas más reservas activas; liberar o compensar la reserva al fallar. Si la dueña decide cobrar intentos fallidos, documentarlo claramente antes de vender paquetes.

#### IA-08 — Media — La referencia de un paquete no se normaliza ni representa el movimiento bancario completo

- **Archivo:línea:** `apps/api/src/platform-ai-packs.ts:116-122` y `apps/api/prisma/schema.prisma:1495-1505`.
- **Evidencia:** la unicidad distingue mayúsculas y se limita a una empresa. `ABC123`, `abc123` o la misma referencia aplicada a dos empresas pueden representar un solo depósito acreditado varias veces.
- **Arreglo propuesto:** guardar referencia normalizada y una clave de operación. Si varias empresas pagan a la misma cuenta, hacer única la combinación banco/cuenta/referencia global; si usan cuentas distintas, incluir la cuenta receptora.

### B. Plataforma, cobro manual y solicitudes de planes

#### PLA-01 — Alta — Una sola credencial permanente controla toda la plataforma

- **Archivo:línea:** `apps/api/src/platform.ts:25-38`, `apps/api/src/platform-billing.ts:52` y `apps/api/src/platform-ai-packs.ts:143-161`.
- **Evidencia:** el mismo `PLATFORM_ADMIN_TOKEN_SHA256` crea empresas, renueva invitaciones, registra pagos, acredita IA y abre soporte. La identidad de operadora procede de una variable global y varias acciones solo dejan `console.log`.
- **Arreglo propuesto:** cuentas individuales con MFA, sesiones cortas, permisos por función y bitácora durable con operadora, IP, empresa, motivo y resultado. Como transición, separar tokens por alcance y añadir identificador y rotación de clave.

#### PLA-02 — Alta — El cobro manual no es idempotente

- **Archivo:línea:** `apps/api/src/platform-billing.ts:46-72` y `apps/api/prisma/schema.prisma:1419-1433`.
- **Evidencia:** cada repetición extiende de nuevo `paidThroughAt` y crea otro `PlatformPayment`. `FOR UPDATE` evita que dos operaciones se pisen, pero hace que ambas se sumen; no existe clave única de operación.
- **Arreglo propuesto:** exigir `operationId`/`Idempotency-Key`, guardarlo con restricción única y devolver el pago original ante un reintento. Normalizar también la referencia bancaria.

#### PLA-03 — Alta — Monto, plan y período del cobro manual no están vinculados

- **Archivo:línea:** `apps/api/src/platform-billing.ts:14-20`, `apps/api/src/platform-billing.ts:51-68` y `apps/api/prisma/schema.prisma:1419-1433`.
- **Evidencia:** cualquier monto positivo puede activar de uno a doce meses; el asiento ni siquiera conserva el plan cobrado. Técnicamente RD$0,01 puede habilitar doce meses.
- **Arreglo propuesto:** enviar plan y ciclo, calcular el importe esperado en el servidor y guardar plan, precio, ciclo y descuento como fotografía inmutable. Una excepción manual debe requerir permiso especial y motivo.

#### PLA-04 — Alta — El flujo de comprobantes permite otorgar hasta 370 días por un pago mensual

- **Archivo:línea:** `apps/api/src/product-billing.ts:73-85` y `apps/api/scripts/review-product-billing.ts:15-20,43-60`.
- **Evidencia:** la solicitud guarda el precio mensual, pero la operadora elige libremente una fecha futura de hasta 370 días y esa fecha se aplica sin relacionarla con el monto.
- **Arreglo propuesto:** unificar el libro de cobros; derivar la vigencia del plan, ciclo y monto. No aceptar una fecha libre como fuente de la suscripción.

#### PLA-05 — Media — Las rutas de plataforma usan una conexión propietaria de toda la base

- **Archivo:línea:** `apps/api/src/registration.ts:112`, `apps/api/src/platform-billing.ts:53` y `apps/api/src/platform-ai-packs.ts:152-160`.
- **Evidencia:** pagos y paquetes usan el `PrismaClient` raíz de registro, aunque existe un rol operacional restringido para facturación.
- **Arreglo propuesto:** cliente separado con rol de PostgreSQL de privilegio mínimo: lectura limitada de empresas, inserción en los libros necesarios y actualización exclusiva de campos de facturación.

#### PLA-06 — Media — Los avisos fallidos quedan marcados como enviados

- **Archivo:línea:** `apps/api/src/platform-notify.ts:59-63` y `apps/api/src/platform-notify.ts:90-108`.
- **Evidencia:** `sentAt` se llena antes de enviar correo o Telegram. Si ambos fallan, solo se registra una advertencia y la restricción única impide reclamar de nuevo el evento.
- **Arreglo propuesto:** crear el aviso como `pending`, marcarlo enviado solo después de una entrega exitosa y guardar intentos, último error y próximo reintento.

#### PLA-07 — Media — Una evidencia ausente puede derribar toda la lista de conciliación

- **Archivo:línea:** `apps/api/scripts/platform-billing-panel.ts:53-77` y `apps/api/src/product-billing.ts:46`.
- **Evidencia:** la lista carga con `Promise.all` hasta cien objetos de 2 MB. Un objeto ausente rechaza toda la operación y el pico de memoria puede rondar 200 MB.
- **Arreglo propuesto:** listar metadatos y cargar cada imagen bajo demanda; paginar y aislar el fallo de cada evidencia.

### C. Soporte e invitaciones

#### SOP-01 — Alta — Soporte recibe PII y datos financieros más amplios de lo necesario

- **Archivo:línea:** `packages/shared/src/index.ts:765`, `apps/api/src/common.ts:414-418`, `apps/api/src/reports.ts:1266` y `apps/api/src/inventory.ts:1376`.
- **Evidencia:** el rol incluye `reports:read` y `profit:read`; por ello puede obtener costos, márgenes, nombres de clientes, proveedores, RNC, NCF, importes y empleados en múltiples reportes.
- **Arreglo propuesto:** permisos específicos de soporte y DTO minimizado; enmascarar clientes, RNC, teléfonos, correos, referencias y personal. Habilitar cada categoría solo para un caso de soporte autorizado.

#### SOP-02 — Alta — Cambiar el rol de la cuenta de soporte elimina sus defensas especiales

- **Archivo:línea:** `apps/api/src/admin.ts:1190-1274`, `apps/api/src/common.ts:714,779,850-859` y `apps/api/src/support-access.ts:172-189`.
- **Evidencia:** el usuario técnico puede recibir otro `roleId`; el modo de solo lectura y el vencimiento dependen únicamente de que el rol se llame `support`. El cambio no revoca sesiones si la política de contraseña no se endurece.
- **Arreglo propuesto:** marcador inmutable `isSupportAccount`; impedir que las rutas genéricas cambien su rol/clave/estado y revocar sesiones ante todo cambio de rol. Aplicar vencimiento y solo lectura por el marcador.

#### SOP-03 — Media — El consentimiento no explica el alcance real de soporte

- **Archivo:línea:** `apps/web/src/SupportAccess.tsx:39` y `packages/shared/src/index.ts:765`.
- **Evidencia:** la pantalla dice de forma genérica que soporte puede consultar datos, sin advertir acceso a costos, margen y reportes con información personal.
- **Arreglo propuesto:** mostrar finalidad, duración, categorías exactas y actividad registrada antes de pedir confirmación.

#### SOP-04 — Media — No se identifica a la operadora que abrió la sesión ni el recurso consultado

- **Archivo:línea:** `apps/api/src/support-access.ts:121-138` y `apps/api/src/common.ts:850-856`.
- **Evidencia:** la apertura queda atribuida al usuario técnico; no registra identidad individual ni IP de operadora. Cada lectura guarda solo la plantilla de ruta, sin ID ni filtros normalizados.
- **Arreglo propuesto:** identidad individual de plataforma y bitácora con operadora, IP, motivo, sesión, tipo/ID de recurso y filtros seguros; excluir tokens, texto libre y PII de la bitácora.

#### INV-01 — Alta — La invitación activa la empresa sin consentimiento digital trazable

- **Archivo:línea:** `apps/api/src/platform.ts:80-87`, `apps/api/src/registration.ts:169-181` y `apps/web/src/Registration.tsx:123`.
- **Evidencia:** el alta deja términos y privacidad nulos; aceptar la invitación solo pide contraseña y PIN. El comentario menciona acuerdo en papel, pero el sistema no guarda versión, fecha, método ni referencia de ese acuerdo.
- **Arreglo propuesto:** exigir aceptación y versiones vigentes al activar. Si se conserva el camino en papel, registrar fecha, versión, método, operadora y referencia verificable.

#### INV-02 — Media — Falta revocación explícita y auditoría durable de invitaciones

- **Archivo:línea:** `apps/api/src/platform.ts:71-90,144-160` y `apps/api/src/registration.ts:169-181`.
- **Evidencia:** creación y reenvío usan `console.log`; no existe cancelar invitación y la aceptación no deja un evento durable del ciclo de vida.
- **Arreglo propuesto:** modelar `created`, `reissued`, `revoked`, `accepted` y `expired`, con operadora y fechas; añadir cancelación explícita.

### D. NCF por venta

#### NCF-01 — Alta — Una corrección administrativa puede competir con una venta

- **Archivo:línea:** `apps/api/src/ncf-sequences.ts:73-86` y `apps/api/src/ncf-sequences.ts:170-205`.
- **Evidencia:** la venta toma un candado por empresa/tipo, pero `PATCH` solo lo toma al activar. Corregir `nextNumber` o desactivar puede intercalarse entre la lectura y el incremento de una venta, producir huecos y devolver un número que administración declaró ya utilizado.
- **Arreglo propuesto:** tomar siempre el mismo candado antes de leer o modificar una secuencia. Añadir regresiones concurrentes venta/corrección y venta/desactivación.

#### NCF-02 — Alta — B01 acepta identificadores inválidos de diez dígitos

- **Archivo:línea:** `packages/shared/src/index.ts:581-582`, `apps/web/src/POS.tsx:2587` y `apps/api/src/sales.ts:981-991`.
- **Evidencia:** la entrada manual acepta cualquier cadena numérica de 9 a 11 dígitos; la ruta automática sí reconoce solo 9 u 11. Diez dígitos consumen un NCF y dejan la venta como emitida.
- **Arreglo propuesto:** exigir `^(\d{9}|\d{11})$`; confirmar con la contadora si también se requiere dígito verificador/consulta de razón social. Probar 9, 10 y 11 dígitos.

#### NCF-03 — Alta — Anonimizar al cliente borra el receptor fiscal del B01

- **Archivo:línea:** `apps/api/src/admin.ts:404-420` y `apps/api/src/sales.ts:1097-1098`.
- **Evidencia:** se conserva NCF e importes, pero se pone `recipientLegalId` en `null` para todas las ventas del cliente, incluso comprobantes emitidos.
- **Arreglo propuesto:** separar datos fiscales con conservación obligatoria de datos de contacto anonimizables; restringir y auditar su acceso. Validar la política final con la contadora antes de borrar identificadores históricos.

#### NCF-04 — Alta — Los NCF anulados desaparecen del reporte de ventas

- **Archivo:línea:** `apps/api/src/reports.ts:741-753` y `apps/api/src/reports.ts:1374-1431`.
- **Evidencia:** el informe filtra `status: "completed"`; una anulación conserva su NCF, pero desaparece del listado y deja un salto sin explicación.
- **Arreglo propuesto:** conservar el reporte comercial y crear un libro fiscal que incluya emitidos y anulados, con estado, fecha y motivo. Probar la exportación después de anular.

#### NCF-05 — Media — El exporte fiscal no incluye el receptor del B01

- **Archivo:línea:** `apps/api/src/reports.ts:1382-1393` y `apps/api/src/reports.ts:1419-1429`.
- **Evidencia:** se exportan NCF, tipo y estado, pero no `recipientLegalId`.
- **Arreglo propuesto:** exporte fiscal exclusivo de administración con NCF, tipo, estado, receptor, fecha, total, ITBIS y anulación; no exponer el identificador en informes generales.

#### NCF-06 — Media — Código, interfaz e impresión se contradicen sobre si el NCF fue emitido

- **Archivo:línea:** `apps/api/src/sales.ts:1049-1054`, `apps/web/src/NcfSequenceSettings.tsx:167-173`, `apps/web/src/Management.tsx:4215`, `apps/api/src/receipt-pdf.ts:598-602` y `apps/web/src/Prints.tsx:516`.
- **Evidencia:** la venta queda `fiscalStatus: "issued"`, mientras la interfaz dice que Nexora no emite NCF y el PDF termina «Documento interno, sin valor fiscal».
- **Arreglo propuesto:** decidir una semántica única con la contadora. Si `sequences` emite NCF tradicional, producir su representación correcta y quitar avisos contradictorios; si solo reserva números, no marcar `issued`.

#### NCF-07 — Media — La base no impone coherencia entre NCF, tipo y estado

- **Archivo:línea:** `apps/api/prisma/schema.prisma:386-431` y `apps/api/prisma/migrations/202610040003_finance/migration.sql:1`.
- **Evidencia:** hay unicidad por empresa, pero no restricciones para impedir `issued` sin NCF, NCF sin tipo, prefijo distinto del tipo o formato inválido.
- **Arreglo propuesto:** migración aditiva con `CHECK` de coherencia, precedida por validación de datos existentes y pruebas de rechazo.

### E. Rama `claude/inicio-sencillo`

Los siguientes números corresponden a `605b241`, no a la base `producto-nexora`.

#### INI-01 — Alta — Se puede vender a crédito a «Consumidor final»

- **Archivo:línea:** `apps/web/src/POS.tsx:519-527,1925-1927,1967-1973` y `apps/api/src/sales.ts:965-968`.
- **Evidencia:** con «Pedir cliente» apagado se selecciona automáticamente el cliente genérico. Crédito y contraentrega solo comprueban que exista un `customerId`, por lo que la deuda queda sin una persona identificable.
- **Arreglo propuesto:** marcar al cliente genérico con un campo estable y rechazar `credit`/`cod` para él; exigir seleccionar o crear un cliente real.

#### INI-02 — Alta — La interfaz promete comprobante fiscal, pero activa solo preparación interna

- **Archivo:línea:** `apps/web/src/Onboarding.tsx:121-123,205-212`, `apps/web/src/Management.tsx:4202-4206,4508-4516` y `apps/web/src/POS.tsx:2601-2604`.
- **Evidencia:** «¿Necesitas dar comprobante fiscal?» y «Doy comprobante fiscal» establecen `ncfMode: "prepared"`; ese modo no asigna NCF.
- **Arreglo propuesto:** decir «Preparar solicitudes de NCF» y «No emite NCF»; reservar «Emitir comprobante» para `sequences` con rangos confirmados.

#### INI-03 — Alta — Un navegador puede quedar bloqueado al cambiar de empresa

- **Archivo:línea:** `apps/web/src/realtime.tsx:67-116`, `apps/api/src/realtime.ts:178-229` y `apps/api/prisma/schema.prisma:1053-1075`.
- **Evidencia:** la identidad local usa `fitstore-equipment:main`, sin empresa. Dos empresas con sucursal `main` reutilizan el UUID; `Terminal.id` es global y la segunda alta choca. La E2E limpia `localStorage`, por lo que no reproduce el uso real.
- **Arreglo propuesto:** incluir empresa/tenant en la clave local y seleccionar credenciales según la empresa del inicio de sesión. Probar A → cerrar sesión → B sin limpiar el navegador.

#### INI-04 — Media — Reintentar el alta inicial puede duplicar productos

- **Archivo:línea:** `apps/web/src/Onboarding.tsx:129-156`.
- **Evidencia:** producto y existencia se guardan en dos solicitudes; la fila se retira solo al completar ambas. Si el producto se crea y falla el ajuste, reintentar crea otro producto.
- **Arreglo propuesto:** endpoint transaccional o `operationId` idempotente; como mínimo, conservar el ID creado y reintentar solo el ajuste.

#### INI-05 — Media — Una respuesta perdida deja una cajera creada sin clave recuperable en el asistente

- **Archivo:línea:** `apps/web/src/Onboarding.tsx:158-166` y `apps/api/src/admin.ts:1140-1202`.
- **Evidencia:** la contraseña se devuelve una sola vez después del commit; si se pierde la respuesta, repetir choca por usuario duplicado.
- **Arreglo propuesto:** creación idempotente con respuesta repetible por una ventana corta o salida directa a «Restablecer contraseña».

#### INI-06 — Media — Contraste insuficiente en Básico/Avanzado con tema oscuro

- **Archivo:línea:** `apps/web/src/styles.css:88-96,6447-6448`.
- **Evidencia:** blanco sobre `#A78BFA` da aproximadamente 2,72:1, por debajo de 4,5:1.
- **Arreglo propuesto:** texto `#0B0F19` (aprox. 7,04:1) o un fondo violeta suficientemente oscuro; añadir comprobación automatizada.

#### INI-07 — Media — El lector de pantalla puede anunciar la contraseña en voz alta

- **Archivo:línea:** `apps/web/src/Onboarding.tsx:243-248`.
- **Evidencia:** el bloque que contiene la contraseña temporal tiene `role="status"`.
- **Arreglo propuesto:** sacar el secreto de la región viva, usar `aria-live="off"` y botones explícitos «Mostrar» y «Copiar».

#### INI-08 — Baja — El cambio de paso no administra el foco

- **Archivo:línea:** `apps/web/src/Onboarding.tsx:103,185-274`.
- **Evidencia:** el botón enfocado desaparece al cambiar el contenido, sin enfocar el encabezado ni anunciar el nuevo paso.
- **Arreglo propuesto:** enfocar el `h2` con `tabIndex={-1}` y anunciar «Paso N de 5».

#### INI-09 — Baja — Un reintento concurrente de invitación puede invalidar más de una fila antes de fallar

- **Archivo:línea:** `apps/api/src/platform.ts:144-160`.
- **Evidencia:** `updateMany` cambia todas las invitaciones pendientes y solo después exige `count === 1`. Ante datos anómalos, invalida varias y no entrega el token nuevo.
- **Arreglo propuesto:** bloquear y seleccionar primero al propietario dentro de una transacción; actualizar solo su ID y el hash anterior esperado.

## Controles que sí se verificaron

- Herramientas de IA reutilizan el token del usuario y respetan sus permisos; no se confirmó fuga directa entre empresas ni escalada de permisos.
- Los paquetes de IA fijan tamaño y precio en el servidor, aíslan por empresa y serializan el consumo concurrente.
- Los tokens de invitación son aleatorios, se guardan resumidos, vencen y viajan en el fragmento de la URL.
- El soporte normal tiene aislamiento RLS, vencimiento, revocación y transacciones de solo lectura; los hallazgos se refieren a alcance, identidad y mutabilidad del rol.
- La asignación normal de NCF es transaccional, revierte si falla la venta y la unicidad por empresa evita que dos ventas normales guarden el mismo NCF.
- El panel local de cobros limita acceso a loopback, valida `Host`, exige autenticación y comprueba origen en operaciones POST.
- El CI publicado de `claude/inicio-sencillo` `605b241` está verde en `verify`, `windows-installer` y `render-images`; los escenarios INI-01 e INI-03 a INI-08 no están cubiertos por ese CI.

## Límites y pruebas pendientes

- Esta fue una auditoría de código; no se usó navegador ni se operó una instalación real.
- El worktree de la base no tenía dependencias instaladas para repetir toda la suite localmente. La revisión de la rama de inicio usó además el resultado publicado de su CI verde.
- Falta confirmar con la contadora la semántica fiscal de `sequences`, la conservación del receptor B01 y el contenido del libro fiscal.
- Falta una prueba PostgreSQL concurrente de venta contra corrección/desactivación de secuencia.
- Falta probar idempotencia de pago, mismo comprobante en solicitudes distintas, fallos de notificación y cambio de empresa sin limpiar almacenamiento local.
- No se recomienda desplegar ni mezclar cambios como consecuencia automática de este informe; cada arreglo debe llevar su regresión y revisión separada.
