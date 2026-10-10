# 03 · Privacidad, cumplimiento legal (RD) y veracidad de las afirmaciones — Nexora POS

**Alcance.** Auditoría de solo lectura de `marcosfeliz28/awesome-outbid`, rama `origin/nexora-cloud` en el commit `3e5521c` (worktree desacoplado, ya eliminado). También se revisó, sin mezclarla, la rama `origin/claude/respaldo-drive` (`0b10ea8`). No se tocó producción, Render ni datos reales, y no se usaron credenciales.

**Aviso.** Quien firma no es abogado. Las leyes se citan por obligación o principio, no por número de artículo. Antes de actuar, un abogado dominicano debe confirmar cada punto marcado como riesgo legal (Ley 172-13, Ley 358-05 y su reglamento, Código Tributario, Decreto 254-06 y Ley 32-23 / e-CF). Un contador debe confirmar los puntos fiscales.

**Hecho de contexto relevante.** El repositorio es **público** (`gh api` → `visibility: public`). Todo lo que está en `docs/` lo puede leer cualquiera.

## Resumen por severidad

| Severidad | Cantidad |
|---|---|
| BLOQUEANTE | 0 (A4 pasa a bloqueante el 15/11/2026 si la tienda no tiene otro mecanismo fiscal) |
| ALTO | 4 |
| MEDIO | 12 |
| BAJO | 11 |

**Lo que está bien hecho y se verificó:**
- El ticket térmico sin NCF dice exactamente «DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL» (`apps/web/src/Prints.tsx:318-320`).
- Ningún camino de la API escribe `Sale.ncf` (solo se lee en `sales.ts:168` y `reports.ts:696`).
- «Acerca de» incluye la nota no fiscal y las licencias (`App.tsx:115-158`), y `licencias.txt` cubre 73 componentes con sus textos.
- La caja ve cédula/RNC, teléfono y correo enmascarados: `customerForActor` (`common.ts:259-270`), `recipientLegalId` enmascarado (`sales.ts:171-174`) y PDF enmascarado para la vendedora (`sales.ts:2218-2225`).
- Sentry web y API solo se activan si hay DSN, y depuran los datos (`apps/web/src/monitoring.ts:6-11, 104-155`; `apps/api/src/monitoring.ts:10-85`).
- Telegram filtra cédula, teléfono y correo (`notifications.ts:96-104`).
- Existe la anonimización con bloqueo, comprobación de deuda y limpieza de la auditoría de cliente y de venta (`admin.ts:295-408`).
- Al cerrar sesión se borra la caché local (`api.ts:278-305`).
- Las contraseñas y el PIN se guardan con hash, y la bitácora de usuarios no guarda los hashes (`admin.ts:878-948`).

---

## Hallazgos

### ALTO

#### A1 · No hay aviso de privacidad en la app, en el ticket ni al capturar los datos del cliente; la política sigue siendo un borrador con campos vacíos
- **Dónde:**
  - Formulario «Nuevo cliente» de la caja (`apps/web/src/POS.tsx:1116-1199`) y de Clientes (`Management.tsx:1913-1925`): piden nombre, teléfono, cédula/RNC, correo y notas, sin ningún texto informativo.
  - Una búsqueda de «privacidad», «172-13», «datos personales» o «consentimiento» en `apps/web/src` solo encuentra comentarios.
  - El ticket (`Prints.tsx:288-379`) y el PDF (`sales.ts:2215-2297`) no traen aviso.
  - `docs/legal/POLITICA_PRIVACIDAD.md:5,8,18,30,32,37,49` sigue con `[NOMBRE LEGAL]`, `[CORREO DE CONTACTO]`, `[N] años`, `[PLAZO]` y `[PROVEEDOR DE ALOJAMIENTO]`.
  - `docs/legal/CUMPLIMIENTO_20_PUNTOS.md:9,14` lo marca como «Falta».
- **Obligación:** Ley 172-13, deber de informar al titular al recoger sus datos (responsable, finalidad, destinatarios, derechos y cómo ejercerlos) y consentimiento para los datos opcionales.
- **Escenario:** la cajera registra a una clienta con cédula y teléfono. La clienta no recibe información sobre quién trata sus datos, que salen a EE. UU. (Render, Telegram), cuánto tiempo se guardan ni cómo pedir que los borren. Si presenta un reclamo, la tienda no puede demostrar que la informó.
- **Arreglo:**
  1. Completar y revisar con un abogado `POLITICA_PRIVACIDAD.md` y publicarla: una ruta estática `/privacidad` en la PWA, un enlace en el inicio de sesión y en «Acerca de», y un cartel en caja.
  2. Añadir una línea bajo el formulario de cliente: «Usamos estos datos para su venta/crédito. Teléfono, correo y cédula son opcionales. Más info: [enlace/cartel]».
  3. Imprimir en el pie del ticket una línea corta con el aviso y el contacto de privacidad.
  4. Añadir una prueba de contrato que exija el enlace y el texto.

#### A2 · La anonimización no borra todo lo que la pantalla promete («Se eliminarán los datos personales»)
- **Dónde:** el texto de la UI está en `apps/web/src/Management.tsx:2038`. La implementación es `apps/api/src/admin.ts:295-408`. Quedan sin borrar:
  1. **Fotos de comprobantes de pago:** `Payment.proofUrl`, imagen base64 de hasta 2 MB (`sales.ts:1941-1948`). Suelen mostrar el nombre del remitente, la cuenta o una conversación de WhatsApp. La anonimización no las toca.
  2. **Copias completas de esas fotos en la bitácora:**
     - `verify` y `reject` llaman a `audit(..., "payment", id, payment, ...)` con la fila `Payment` completa como `before` (`sales.ts:1444`, `sales.ts:1481`), y esa fila incluye `proofUrl`.
     - La anonimización solo depura `AuditLog` con `entity: "customer"` y `entity: "sale"` (`admin.ts:335-342, 359-378`). Las entradas `entity: "payment"` conservan la foto para siempre.
     - `GET /audit-log` las devuelve (`admin.ts:982-988`).
  3. **Columnas libres de la propia venta y el pago:**
     - `Sale.voidedReason` y `Payment.reference`/`bank` (en transferencias suele ir el nombre del remitente), `SaleReturn.reason`.
     - Solo se vacían `Sale.recipientLegalId` y `Sale.notes` (`admin.ts:355-358`).
     - La prueba `tests/customer-anonymization-postgres.test.ts:205-235, 380-396` solo comprueba la **bitácora**, no esas columnas.
  4. **Cola de Telegram:** `NotificationOutbox.payload` guarda el texto con «Cliente: <nombre>» (`notifications.ts:183-186, 240-243`). No se depura al anonimizar. Las filas enviadas duran 30 días y las `failed`/`pending` no se purgan nunca (`notifications.ts:648-655`). Los mensajes que ya están en el grupo de Telegram tampoco se pueden borrar.
  5. **Respaldos y equipos:** respaldos de 30 días o más, caché local de otros equipos. Esto se reconoce en el procedimiento, pero no en la UI.
- **Obligación:** Ley 172-13, derecho de supresión/cancelación y principio de calidad/veracidad. Además, afirmación inexacta en la UI.
- **Escenario:** una clienta que pagó un abono por transferencia pide su eliminación. El gerente pulsa «Anonimizar» y la app dice que se eliminaron sus datos. Su captura bancaria, con nombre y cuenta, sigue en `Payment.proofUrl` y dos veces en `AuditLog.before`. La referencia «Transf. María Pérez» sigue en el pago. El aviso «Cliente: María Pérez» sigue en la cola de Telegram.
- **Arreglo:**
  1. En `audit()` de verify/reject, guardar la fila sin `proofUrl` (`{...payment, proofUrl: payment.proofUrl ? "(imagen)" : null}`). Migrar las filas existentes con `before->>'proofUrl'`.
  2. Al anonimizar:
     - borrar `proofUrl` de los pagos saldados (o fijar un plazo contable con el contador);
     - aplicar `redactKnownCustomerPii` a `Sale.voidedReason`, `Payment.reference`, `SaleReturn.reason` y a la auditoría `entity: "payment"` de los pagos del cliente;
     - borrar o reescribir las filas de `NotificationOutbox` con `refId` de sus ventas.
  3. Cambiar el texto de la UI a uno honesto: «Se quitan nombre, teléfono, correo, cédula, notas y comprobantes. Los avisos ya enviados por Telegram y las copias de seguridad se eliminan al vencer su plazo (30 días).»
  4. Ampliar la prueba de PostgreSQL a esas columnas.

#### A3 · Toda la base de datos está en EE. UU. sin base jurídica documentada para la transferencia internacional; la política dice «algunos»
- **Dónde:**
  - `render.yaml:7, 32, 68`: web, API y PostgreSQL en `region: virginia`.
  - Terceros fuera de RD: Sentry (opcional), Anthropic (opcional, facturas de proveedor), Telegram (`notifications.ts`) y Google Drive en la rama sin mezclar.
  - `POLITICA_PRIVACIDAD.md:37` habla de proveedores «algunos con servidores fuera de la República Dominicana» y deja `[ABOGADO: revisar transferencias internacionales]`.
  - `REGISTRO_TERCEROS.md:35-39` reconoce que no se verificó ningún contrato ni DPA (Render, Sentry, Anthropic, AWS, Telegram).
- **Obligación:** Ley 172-13, transferencia internacional de datos (exige un país con protección adecuada, el consentimiento del titular u otra excepción legal) y obligación de seguridad con los encargados del tratamiento.
- **Escenario:** el 100 % de los clientes (nombres, cédulas, deudas, fotos de pagos) y de los empleados vive en Virginia. Ante una inspección o un reclamo no hay contrato de encargado firmado, ni evaluación, ni consentimiento informado de la transferencia.
- **Arreglo:**
  1. Que un abogado determine la base de la transferencia (consentimiento en el aviso de A1, cláusulas contractuales o DPA de Render, Telegram y Sentry).
  2. Aceptar o archivar los DPA de cada proveedor y anotarlos en `REGISTRO_TERCEROS.md`.
  3. Corregir la política: «El sistema y su base de datos están alojados en Render (EE. UU., Virginia)…».
  4. Evaluar si Telegram es necesario o si basta un resumen sin nombre de cliente.

#### A4 · Fiscal: el sistema no emite NCF/e-CF y, según el propio repositorio, el plazo e-CF de un contribuyente pequeño vence el 15/11/2026
- **Dónde:**
  - `docs/fiscal/REQUISITOS_FISCALES_RD.md:9-21` (Aviso DGII 06-26: plazo prorrogado al 15/11/2026 para Pequeños, Micro y no clasificados; grupo de la tienda no confirmado).
  - `REQUISITOS_FISCALES_RD.md:197-200` dice que la decisión entre sistema propio, PSFE o Facturador Gratuito está pendiente.
  - En el código: `Management.tsx:3263-3264` («NCF/e-CF reservado para integración futura»), `admin.ts:96` (`ncfMode` solo `disabled|prepared`).
- **Obligación:** Código Tributario, Decreto 254-06 (comprobante fiscal por cada venta, incluido B02/E32 a consumidor final) y Ley 32-23 (facturación electrónica obligatoria y sanciones de sus arts. 26-27 según el documento).
- **Escenario:**
  - Hoy (10/10/2026) la tienda cobra precios con ITBIS incluido y entrega solo documentos no fiscales. Si no tiene un mecanismo paralelo (impresora fiscal, talonario B autorizado o Facturador Gratuito), cada venta queda sin comprobante fiscal.
  - Desde el 16/11/2026 la serie B dejaría de ser una alternativa ordinaria, si ese es su grupo.
  - **Esto no es un defecto del código** (el ticket se rotula bien), pero es el mayor riesgo legal de la operación.
- **Arreglo:**
  1. Que la dueña y el contador confirmen esta semana el grupo DGII y el mecanismo de emisión de cada venta.
  2. Documentar en `docs/` qué documento fiscal recibe hoy el cliente.
  3. Si es un mecanismo paralelo, añadir al flujo de caja un recordatorio («Emitir comprobante en …»).
  4. Planificar la integración e-CF o el uso de PSFE antes del plazo.

### MEDIO

#### M1 · La interfaz y los mensajes llaman «factura» a un documento no fiscal; el PDF y WhatsApp usan una leyenda más débil
- **Dónde:**
  - POS: `POS.tsx:1854` «Imprimir factura», `POS.tsx:1867` «Factura PDF».
  - Gestión: `Management.tsx:2592, 2608` (columna «Factura», «Buscar número de factura»), `2866-2874` («Sí, anular factura», «Factura anulada»), `3052` y `3133` («Imprimir la factura automáticamente»).
  - Telegram: `notifications.ts:182` («· Factura V-…») y `Management.tsx:3044` («Avisos de facturas por Telegram»).
  - Excel/PDF de ventas: columna `Factura` (`reports.ts:688`) junto a `NCF`, `Tipo_NCF` y `Estado_fiscal`, sin leyenda no fiscal (`reports.ts:950-1000`).
  - El PDF del recibo dice «Documento interno — no fiscal» (`sales.ts:2247`), no «NO ES COMPROBANTE FISCAL».
  - El texto de WhatsApp/correo dice «Documento interno, no fiscal.» (`POS.tsx:1819`).
  - El propio `docs/legal/TEXTO_PIE_TICKET.md:45` recomienda evitar «FACTURA».
- **Obligación:** normativa DGII sobre comprobantes («factura» se asocia a comprobante fiscal) y Ley 358-05, información veraz.
- **Escenario:** la cajera dice «le imprimo su factura» y entrega un PDF titulado V-000123.pdf que dice «Documento interno — no fiscal». La clienta cree que tiene una factura válida para gastos.
- **Arreglo:**
  1. Renombrar en la UI a «Imprimir ticket», «Recibo PDF», «Venta n.º» y «Anular venta».
  2. Poner en el PDF y en el texto de WhatsApp la misma leyenda que el ticket («DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL»).
  3. Añadir una fila de leyenda o un pie en los exportes de ventas.
  4. Ampliar `tests/afirmaciones.test.ts` para que prohíba `/factura/i` en etiquetas de botón del POS y exija la leyenda en `sales.ts`.

#### M2 · El ticket térmico muestra ITBIS sin decir «incluido» y la cuenta no cuadra a la vista
- **Dónde:** `Prints.tsx:347-358`.
  - Sub-Total = Σ qty × unitPrice (con ITBIS si `taxIncluded`), luego «Descuento», luego «ITBIS» y «Total a pagar» = Sub-Total − Descuento.
  - Con el ajuste por defecto (ITBIS incluido), Sub-Total − Descuento + ITBIS ≠ Total.
  - El PDF sí dice «ITBIS incluido/adicional» (`sales.ts:2274-2279`) y Telegram también (`notifications.ts:171-177`).
  - `docs/legal/NEGOCIO_DATOS_CHECKLIST.md:18` ya lo señalaba.
- **Obligación:** Ley 358-05 (información clara del precio y sus componentes). DGII: un documento no fiscal que desglosa ITBIS puede confundirse con un comprobante.
- **Escenario:** un cliente suma Sub-Total + ITBIS, cree que le cobraron de menos o de más y reclama.
- **Arreglo:** usar la etiqueta `sale.taxIncluded === false ? "ITBIS adicional" : "ITBIS incluido"` y añadir una prueba de render con los dos valores.

#### M3 · El ticket no informa la política de devoluciones y puede salir sin la identificación del negocio
- **Dónde:**
  - `returnDays` se aplica (`sales.ts:1553-1557`) pero no se imprime (`Prints.tsx:288-379`). `NEGOCIO_DATOS_CHECKLIST.md:14-15` lo confirma.
  - RNC, dirección y teléfono son opcionales (`admin.ts:68-72`: `legalId: z.string().max(30)` sin mínimo).
  - Sin configurar, el ticket se titula «Nexora POS» con el logo de Grupo Macgen (`Prints.tsx:79-83`, `sales.ts:2235`).
  - No hay campo para las condiciones de devolución ni para la garantía (`TEXTO_PIE_TICKET.md`, versiones A-C, sin implementar).
- **Obligación:** Ley 358-05 (informar antes de la compra las condiciones y restricciones de devolución e identificar al proveedor).
- **Escenario:** una clienta compra maquillaje y vuelve en el día 31. El sistema rechaza la devolución y nada impreso le avisó del plazo ni de que lo abierto no se devuelve.
- **Arreglo:**
  1. Añadir `returnPolicyText` y `warrantyDays` en Ajustes, e imprimir «Devoluciones: N días con ticket…» en el pie.
  2. Exigir RNC, dirección y teléfono antes de poder vender (validación en `configSchema` y aviso en Ajustes).
  3. Que el abogado revise el texto.

#### M4 · Pasado el plazo comercial la devolución se bloquea sin excepción, incluso con producto defectuoso o vencido
- **Dónde:** `apps/api/src/sales.ts:1553-1557` (`bad("La venta excede el plazo de devolución.")`). No hay excepción de gerente ni motivo «garantía/defecto». Además, `returnDays` admite 0 (`admin.ts:77`).
- **Obligación:** Ley 358-05, garantía legal y responsabilidad por producto defectuoso o vencido (no la limita una política comercial). `POLITICA_DEVOLUCIONES.md:24-26` reconoce ese derecho.
- **Escenario:** un suplemento vendido ya vencido se descubre el día 40. La tienda no puede registrar la devolución y termina haciéndola fuera del sistema (dinero sin rastro) o la niega.
- **Arreglo:** añadir una excepción con PIN de gerente y motivo obligatorio (`warranty`/`defect`), auditada, independiente de `returnDays`. Impedir `returnDays: 0` sin una confirmación explícita.

#### M5 · Toda venta exige un cliente con nombre (minimización)
- **Dónde:** `admin.ts:112-114, 633, 666` («la regla comercial es invariable: toda venta se guarda a nombre de un cliente»), `POS.tsx:395, 1566`. La política lo asume (`POLITICA_PRIVACIDAD.md:26`).
- **Obligación:** Ley 172-13, principio de calidad o proporcionalidad (datos adecuados, pertinentes y no excesivos).
- **Escenario:** una compra de contado de RD$ 300 obliga a pedir el nombre, y la base acumula una ficha por persona con historial de compras y gasto total (`admin.ts:204-218`, perfil de compra que la política no declara).
- **Arreglo:** permitir «Consumidor final» (venta sin `customerId` en contado), exigir cliente solo para crédito, contraentrega o B01, y declarar el uso «historial de compras» en la política o quitarlo. Validarlo con la dueña y el abogado.

#### M6 · La «Solicitud de NCF» deja al cliente con un ticket «pendiente de emisión fiscal» sin ningún seguimiento
- **Dónde:**
  - `POS.tsx:1941-1967` (B01 pide RNC), `sales.ts:686-690, 781` (guarda `ncfType` y `recipientLegalId`).
  - `Prints.tsx:371-373` y `sales.ts:2283-2286` imprimen «pendiente de emisión fiscal».
  - `fiscalStatus` siempre vale `not_issued` y solo aparece en el Excel de ventas (`reports.ts:697-698`). No hay lista de pendientes ni forma de marcarlas como emitidas.
- **Obligación:** DGII (B01 para crédito fiscal del comprador) y Ley 358-05 (cumplir lo ofrecido). Ley 172-13 (se guarda un RNC/cédula con una finalidad que no se completa).
- **Escenario:** una empresa compra, pide B01 y se va con «pendiente». Nadie tiene una lista que revisar y el comprobante nunca se emite.
- **Arreglo:** mantener `ncfMode` en `disabled` hasta que exista el proceso. Si se usa `prepared`, añadir una vista «Comprobantes pendientes» para gerencia con un estado `issued_external` y el NCF que asigne el sistema fiscal externo (validado `B\d{10}|E\d{12}`), y eliminar el RNC guardado cuando ya no haga falta.

#### M7 · Telegram recibe datos de empleados (y nombres de clientes) sin que la política, el registro ni los empleados lo reflejen; las filas fallidas nunca se purgan
- **Dónde:**
  - `notifications.ts:178-196` (cajera, incentivo por venta) y `306-320` (cierre de caja con «faltante/sobrante» por cajera).
  - `POLITICA_PRIVACIDAD.md:40` describe Telegram solo para clientes.
  - `REGISTRO_TERCEROS.md:7-16` no menciona Telegram.
  - `TERMINOS_DE_USO.md:22-25` no avisa a los empleados.
  - Purga: `notifications.ts:648-655` solo borra `status='sent'` de más de 30 días.
- **Obligación:** Ley 172-13 (información, finalidad y terceros), también para los datos de empleados.
- **Escenario:** los faltantes de caja de una cajera quedan para siempre en un servicio de mensajería de terceros, al que puede acceder cualquier miembro del grupo y cualquier persona añadida después.
- **Arreglo:** declarar Telegram en el registro de terceros y en la política (clientes y empleados) y en las condiciones de uso internas. Purgar también `failed` (por ejemplo a los 30 días). Valorar quitar el nombre del cliente y el incentivo del aviso.

#### M8 · La documentación de privacidad está desactualizada y contradice el código (rendición de cuentas)
- **Dónde:**
  - `REGISTRO_TERCEROS.md:9, 26, 30`: dice que Sentry web tiene «DSN fijo… siempre activo». Hoy es opcional por `VITE_SENTRY_DSN` (`apps/web/src/monitoring.ts:3-11`, `render.yaml:23-27`). No incluye Telegram ni Google Drive. La línea 32 dice que «no hay aviso de privacidad ni política», cuando hoy existe un borrador.
  - `DATOS_PERSONALES_INVENTARIO.md`:
    - la línea 12 dice que el email no tiene uso, pero hoy se usa en `mailto:` (`POS.tsx:1884-1890`);
    - la línea 13 sigue con `birthday`, que ya se eliminó en la migración `202610150002_remove_customer_birthday`;
    - la línea 32 dice que la IP solo está en memoria, pero se persiste (ver B1);
    - la línea 55 dice que editar no se audita, pero sí se audita (`admin.ts:277-290`);
    - la línea 59 dice que al cerrar sesión solo se borra `session`, pero hoy se borra la caché (`api.ts:293-305`).
  - `CUMPLIMIENTO_20_PUNTOS.md:3, 24, 28` es de commit `c0b7105` y marca como «Falta» cosas ya hechas (ticket «FACTURA», borrado).
- **Obligación:** Ley 172-13, demostrar el cumplimiento (registro fiel de tratamientos y encargados).
- **Arreglo:** regenerar los tres documentos contra `nexora-cloud` y añadir una prueba de contrato (por ejemplo, que `REGISTRO_TERCEROS.md` mencione cada host saliente: `api.telegram.org`, `sentry.io`, `anthropic`, `amazonaws`/`s3` y `googleapis` si se mezcla Drive).

#### M9 · Respaldos: volcados completos sin cifrado propio, copias locales en «Documentos» y una política que promete «protegidas» y «30 días»
- **Dónde:**
  - `deploy/render/backup/render-backup.mjs:168-195` (solo `--sse` de S3).
  - `scripts/pull-cloud-backup.ps1:25-63`: descarga el `.dump` completo sin cifrar a `$Destino` sin endurecer la ACL.
  - `scripts/Register-NexoraCloudBackupTask.ps1:6`: destino por defecto `%USERPROFILE%\Documents\Nexora POS\Respaldos cloud`, una carpeta que Windows suele sincronizar con OneDrive.
  - Retención configurable hasta 3650 días (`pull-cloud-backup.ps1:8`).
  - `POLITICA_PRIVACIDAD.md:33, 52` («copias de seguridad protegidas», «desaparecen en 30 días»).
  - El instalador local sí protege la ACL (`instalador/tests/Backup-Privacy.ps1`); el script cloud no.
- **Obligación:** Ley 172-13 (seguridad y confidencialidad; terceros no declarados como OneDrive) y veracidad de la política.
- **Escenario:** la laptop de la dueña sincroniza «Documentos» con OneDrive. Una copia completa de la base, con cédulas, deudas y fotos de pagos, acaba en otro proveedor no declarado, y en claro si se pierde el equipo.
- **Arreglo:** destino por defecto fuera de las carpetas sincronizadas (por ejemplo `%ProgramData%\Nexora\respaldos`), aplicar la misma ACL que `Protect-FitStoreBackupFile` y cifrar la copia (reutilizar el formato NXBK de la rama Drive). Ajustar la política a lo real.

#### M10 · La rama `claude/respaldo-drive` (sin mezclar) contradice la política y el registro de terceros
- **Dónde:**
  - `origin/claude/respaldo-drive:apps/api/src/drive-backup.ts:1-17` («retención 30 diarias + 12 mensuales»), `drive-backup-core.ts:546-551`.
  - Google Drive no figura en `REGISTRO_TERCEROS.md` ni en `POLITICA_PRIVACIDAD.md`.
  - Remite a `docs/RESPALDO_DRIVE.md`, que no está en el diff.
  - **Lo positivo:** cifrado AES-256-GCM antes de subir, ámbito `drive.file` mínimo y token cifrado.
- **Obligación:** Ley 172-13 (retención y terceros) y veracidad de la política («los datos eliminados desaparecen de [los respaldos] en 30 días», `POLITICA_PRIVACIDAD.md:33`).
- **Escenario:** si se mezcla tal cual, un cliente anonimizado sigue recuperable durante 12 meses en Drive, y la política promete 30 días.
- **Arreglo (condición de mezcla):** actualizar la política y el registro (Google LLC, EE. UU., copia cifrada, 12 meses), añadir `docs/RESPALDO_DRIVE.md` y documentar en `PROCEDIMIENTO_DERECHOS_DATOS.md` cómo volver a aplicar las anonimizaciones al restaurar.

#### M11 · No se implementa ningún plazo de conservación (los datos se guardan indefinidamente)
- **Dónde:**
  - No hay purga de clientes inactivos (la política dice `[N] años`, `POLITICA_PRIVACIDAD.md:30`).
  - `Payment.proofUrl` se guarda sin plazo (`[PLAZO]`, línea 32).
  - `AuditLog` no tiene retención.
  - `AuthAttempt`: `auth.ts:51-53` reconoce que las filas `login:missing:%` no se purgan.
  - `InvoiceAttachment` confirmado no se purga (solo los borradores de más de 7 días, `merchandise.ts:247-266`).
  - `NotificationOutbox` fallido no se purga (M7).
- **Obligación:** Ley 172-13, suprimir los datos cuando dejen de ser necesarios para su finalidad (sin perjuicio de los 10 años fiscales, `REQUISITOS_FISCALES_RD.md:177`).
- **Arreglo:** fijar con el contador o el abogado una tabla de plazos y añadir una tarea diaria idempotente. Por ejemplo: limpiar `proofUrl` X meses después de saldar, anonimizar clientes sin compras ni deuda en N años, borrar `AuthAttempt` antiguos (añadir `updatedAt`) y `NotificationOutbox` de más de 30 días con cualquier estado.

#### M12 · No hay soporte técnico para el derecho de acceso ni un registro reproducible de las supresiones
- **Dónde:**
  - No existe ningún endpoint o vista «datos de este cliente». `PROCEDIMIENTO_DERECHOS_DATOS.md:16` pide armar el resumen a mano.
  - La anonimización descarta la referencia de la solicitud: guarda solo `{reasonRecorded: true, requestReferenceRecorded: true}` (`admin.ts:400-403`).
  - La UI envía `requestRef: APP-<fecha>` (`Management.tsx:2042-2045`), así que no queda vínculo con el libro de solicitudes.
  - Tras restaurar un respaldo anterior, la entrada `anonymize` desaparece y no hay una lista que reaplicar (`PROCEDIMIENTO_DERECHOS_DATOS.md:21`).
  - El procedimiento exige dos personas (paso 5), y el código permite que una sola (gerente) anonimice.
- **Obligación:** Ley 172-13, derechos de acceso, rectificación y cancelación, y capacidad de demostrar que se atendieron.
- **Arreglo:**
  - Añadir `GET /customers/:id/export` (gerencia) que genere un PDF o JSON con la ficha, las ventas, los pagos y las notas.
  - Guardar en la auditoría un identificador de solicitud no personal (consecutivo `DSR-0001`) y quién aprobó (PIN de un segundo usuario, como en los descuentos).
  - Exportar a un archivo fuera de la base la lista de `customerId` anonimizados, para reaplicarla tras una restauración.

### BAJO

#### B1 · Direcciones IP persistidas sin plazo en `AuthAttempt.key`
`auth.ts:246, 316` usan como clave `login:<id o hash>:<authVersion>:<IP>`, con la IP real (`auth.ts:96`). Las filas de usuarios inexistentes no se purgan (`auth.ts:51-53`). El inventario dice lo contrario (M8). Es un dato personal técnico (Ley 172-13, minimización). **Arreglo:** guardar un hash con sal de la IP o añadir `updatedAt` y purgar a las 24-48 h.

#### B2 · Las notas libres del cliente no se enmascaran ni llevan advertencia
`customerForActor` (`common.ts:259-270`) deja `notes` visible para la caja. El campo «Notas» (`Management.tsx:1924`) no advierte que no se escriban datos sensibles (salud, deudas de terceros). **Arreglo:** añadir la advertencia y ocultar `notes` a quien no tenga `canViewCustomerPii`.

#### B3 · El teléfono del cliente se imprime sin necesidad en el ticket y en el PDF
`Prints.tsx:325-330`, `sales.ts:2259-2264`. El ticket es para el propio cliente y puede quedar en una bolsa o en una papelera. El teléfono no hace falta. Imprimir el RNC solo tiene sentido con B01 (minimización). **Arreglo:** quitar el teléfono e imprimir el RNC solo si hay `ncfType`.

#### B4 · Rama latente «COMPROBANTE FISCAL» en el ticket
`Prints.tsx:312-316`. Si `sale.ncf` llega con valor (restauración de datos, migración manual o una futura integración a medias), el ticket se titula «COMPROBANTE FISCAL» sin que nada valide que el NCF fue autorizado. Hoy ningún camino lo rellena, pero las pruebas lo insertan directamente (`tests/customer-anonymization-postgres.test.ts:372`). **Arreglo:** eliminar esa rama hasta tener una integración e-CF real, o condicionarla a `fiscalStatus === "issued"` y `ncfMode === "electronic"`.

#### B5 · README desactualizado y alcance limitado de la prueba de afirmaciones
- `README.md:1, 3` dice «FitStore POS · Aplicación de demostración de facturación e inventario». La línea 5 dice «No se ha publicado un servidor externo», cuando el sistema está en Render con una tienda real.
- `tests/afirmaciones.test.ts:9-30` solo revisa `apps/web/src` (primer nivel), `index.html`, `vite.config.ts`, `packages/ui` y 8 documentos. No mira `apps/api/src` (PDF, Telegram, Swagger), `docs/legal/*`, `DESPLIEGUE.md`, `RESPALDO_CLOUD_RENDER.md`, `INCENTIVOS.md` ni `instalador/README.md`. Las revisiones con IA se buscan solo en `AUDITORIA_*.md`, no en `REVISION_CLAUDE*.md` ni `RONDA*_CLAUDE.md`.
- Las frases prohibidas son solo cuatro. Sigue `docs/MANUAL.md:19` («política segura»), ya señalada en `LICENCIAS_Y_AFIRMACIONES.md:70`.

**Arreglo:** README con «Nexora POS · caja e inventario de uso interno; no emite comprobantes fiscales (NCF/e-CF)». Ampliar los globs de la prueba y añadir `/política segura/`, `/cumple con (la )?(dgii|ley)/`, `/certificad[oa] por/` y `/factura (fiscal|válida)/`.

#### B6 · Imprecisiones menores en la política de privacidad
- `POLITICA_PRIVACIDAD.md:17` dice «emitir recibo o comprobante fiscal», aunque el sistema no lo emite: aclarar que se hace por otro medio.
- La línea 20 dice «cifrados con hash» (lo correcto es hash irreversible).
- La línea 58 omite que el equipo guarda la lista de clientes, ventas pendientes (con últimos 4 dígitos y código de aprobación) y el catálogo (`api.ts:59-86`, `POS.tsx:249-258`).
- Falta el uso «historial y gasto por cliente» (M5).
- Faltan los canales WhatsApp y correo como terceros cuando la cajera los usa (`POS.tsx:1870-1898`).

#### B7 · Sentry web, si se activa: depuración por patrones
`scrubText` (`apps/web/src/monitoring.ts:28-45`) quita correos y números de 7 dígitos o más, pero no nombres. Las migas `ui.click` usan selectores o etiquetas (hoy solo con nombres de producto, `POS.tsx:896-949`). Los argumentos de las migas de consola (`breadcrumb.data.arguments`) no se depuran (líneas 135-140). Hay replay al fallar (5 %), con todo enmascarado. El riesgo es bajo porque es opcional. **Arreglo:** borrar `breadcrumb.data` salvo `url` y declarar el replay en la política.

#### B8 · El repositorio público expone información del negocio y del personal
- `docs/MANUAL-CAJERO.md:39, 80` nombra a «Marcos o Génesis» (administración).
- `docs/tienda/CUADRE_REPORTES_FACTURA.md:7-9` incluye la ubicación (Plaza Lope de Vega), la caja «GPRO STORE RD» y el número de cajero de ejemplo 1031.
- Hay estructura del inventario real (`docs/validacion/ronda7-tienda/carga-inventario.txt`) y revisiones internas de seguridad.
- No se encontraron cédulas, teléfonos ni correos reales: las búsquedas solo devuelven datos ficticios 555.

**Arreglo:** pasar el repositorio a privado o depurar `docs/` de nombres y ubicaciones reales.

#### B9 · El modo «ITBIS adicional» puede mostrar precios sin impuestos
`admin.ts:74` (`taxIncluded`), `Management.tsx:3259`. Ley 358-05 y Pro Consumidor exigen, en general, que el precio exhibido sea el final. **Arreglo:** advertir en Ajustes y consultarlo con el abogado.

#### B10 · Datos de proveedores personas físicas visibles sin máscara para el rol de almacén
`admin.ts:409-416` (`purchase:write`, que incluye `warehouse`) devuelve el RNC o cédula, el teléfono y el correo completos. **Arreglo:** que el almacén reciba solo el nombre.

#### B11 · Licencias: correctas en lo visible, sin cubrir las variantes nativas
`apps/web/public/licencias.txt` (73 componentes: MIT 57, ISC 11, Apache-2.0 2, OFL 2, 0BSD 1) y `instalador/THIRD_PARTY_NOTICES.txt` son coherentes con `apps/web/package.json`. No cubren las dependencias de Capacitor (`@capacitor/android`/`ios`) ni las de Tauri (Rust) si se distribuyen. El párrafo de «Acerca de» (`App.tsx:140-143`) enumera «MIT, ISC, Apache-2.0, 0BSD» y nombra OFL aparte, lo cual es correcto. **Arreglo:** si se publican apps nativas, generar sus avisos.

---

## Inventario de datos personales (estado real del código)

| Dato | Dónde se guarda | Quién lo ve | Sale del sistema hacia | Retención real |
|---|---|---|---|---|
| Nombre del cliente | `Customer.name` | Todos los roles con `customers:write` (incluida la vendedora), reportes `customers` (`reports:read`) | Telegram (cada venta, anulación, devolución y cobro), ticket/PDF, Excel de clientes, respaldos | Indefinida hasta anonimizar |
| Teléfono del cliente | `Customer.phone`, `AuditLog.after` (creación) | Gerencia/admin completo; la caja «•••••••123» | Ticket/PDF, `wa.me` (WhatsApp/Meta) por acción manual, respaldos | Indefinida hasta anonimizar |
| Correo del cliente | `Customer.email` | Gerencia/admin; caja `m•••@dominio` | `mailto:` por acción manual, respaldos | Indefinida hasta anonimizar |
| Cédula/RNC del cliente | `Customer.legalId`, `Sale.recipientLegalId` (B01) | Gerencia/admin; caja enmascarado | Ticket/PDF, respaldos | Indefinida hasta anonimizar |
| Notas libres | `Customer.notes`, `Sale.notes`, `Quote.notes` | Todos los que ven al cliente o la venta, **sin máscara** | Respaldos | Indefinida hasta anonimizar (`Sale.voidedReason`, `SaleReturn.reason` no se limpian) |
| Historial y gasto del cliente | Calculado (`admin.ts:204-218`) | Gerencia/admin | Excel/PDF `customers` | n/a (derivado) |
| Límite de crédito, deuda, vencimiento | `Customer.creditLimit`, `Sale.creditBalance/creditDueDate`, `Alert.message` | Gerencia/admin; alertas | Telegram («Por cobrar») | Ventas: indefinida (fiscal, 10 años) |
| Datos de pago | `Payment.cardLast4`, `approvalCode`, `cardBrand`, `bank`, `reference` | Todos los que ven la venta (`safe()` los publica) | Respaldos; caché local de ventas pendientes | Indefinida (no se limpian al anonimizar) |
| Foto de comprobante de pago | `Payment.proofUrl` (base64, ≤2 MB) **y copia en `AuditLog.before`** (verify/reject) | Gerencia y quien registró el cobro; admin (bitácora) | Respaldos | **Indefinida; no se borra al anonimizar** |
| Empleado: nombre, usuario, correo, n.º de cajero | `User` | Admin (`GET /users` `*`); el nombre en tickets, cuadres y reportes | Telegram (cajera, incentivo, faltantes de caja), tickets impresos, respaldos | Indefinida (se desactiva, no se borra) |
| Contraseña / PIN | `User.passwordHash`, `pinHash` (bcrypt) | Nadie (hash) | Respaldos | Mientras exista el usuario |
| Sesiones | `RefreshToken` (hash, 7 días), `AuthSession`, cookie `fitstore_refresh` 7 días | Sistema | — | 7 días (purga de filas no verificada) |
| IP | `AuthAttempt.key` (en claro), memoria del limitador; `AuditLog.ip` siempre vacío | Sistema; Render (logs de acceso) | Sentry si se activa (lo infiere el servidor) | **Indefinida** para `login:missing:*` |
| Equipo/terminal | `Terminal` (nombre, último usuario) | Gerencia/admin | — | Indefinida |
| Bitácora | `AuditLog` (before/after: cliente al crear, venta, pago con foto, ajustes) | Admin (`GET /audit-log`, 300 últimas) | Excel `returns-discounts` (JSON de `after`) | Indefinida |
| Incentivos y cuadres | `IncentiveEntry`, `IncentiveSettlement.userName`, `CashSession` | Admin; reportes | Telegram (cierre de caja e incentivo por venta) | Indefinida |
| Proveedores (personas físicas) | `Supplier.legalId/phone/email` | Roles con `purchase:write` (incluido almacén), sin máscara | Respaldos | Indefinida |
| Facturas de proveedor (imagen/PDF) | `InvoiceAttachment.data` | Quien gestiona mercancía | **Anthropic (EE. UU.)** si hay `ANTHROPIC_API_KEY` y se sube una foto o PDF | Borradores: 7 días; confirmadas: indefinida |
| Avisos de Telegram | `NotificationOutbox.payload` y grupo de Telegram | Miembros del grupo | Telegram | Enviados: 30 días en la base; fallidos o pendientes: indefinida; en Telegram: indefinida |
| Caché del navegador | IndexedDB `fitstore-pos-v1`: `cache` (clientes, caja, catálogo, ajustes), `sales` (ventas pendientes con recibo y pagos), `merchandise`; `localStorage` (tema, identidad del equipo) | Quien use el equipo | — | `cache` se borra al cerrar sesión; `sales`/`merchandise` hasta sincronizar |
| Respaldos | Volcados `pg_dump` completos (local, S3 opcional, laptop vía `pull-cloud-backup.ps1`, Drive en una rama) | Quien acceda al almacenamiento | AWS S3; posible OneDrive (M9); Google Drive (rama) | Local 30 días (configurable hasta 3650); S3 según el ciclo de vida que se configure; Drive 30 diarias + 12 mensuales |
| Errores técnicos | Render logs (`console.error(exception)`, `common.ts:735`, `main.ts:65`); Sentry API/web si hay DSN | Render; Sentry | Render y Sentry (EE. UU.) | Según el proveedor (no verificado) |

---

## No verificado

- Si producción tiene activos `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID`, `VITE_SENTRY_DSN`, `SENTRY_DSN` y `ANTHROPIC_API_KEY`. `render.yaml` solo declara `VITE_SENTRY_DSN` (vacío) y `ANTHROPIC_MODEL`.
- Si la tienda tiene hoy un mecanismo fiscal paralelo (impresora fiscal, talonario B, Facturador Gratuito o PSFE), su grupo DGII y su plazo individual de e-CF (A4).
- Los contratos o DPA de Render, Sentry, Anthropic (retención y entrenamiento), Telegram, AWS y Google, y la configuración de Sentry («no guardar IP»).
- La retención de los respaldos propios de Render PostgreSQL y si el ciclo de vida de S3 está configurado (el documento dice «activación futura»).
- Si la carpeta «Documentos» del equipo de la dueña se sincroniza con OneDrive.
- Si los mensajes de error de Prisma que imprime `console.error` (`common.ts:735`) llegan con valores de clientes a los logs de Render. Es posible con `PrismaClientValidationError`; no se reprodujo.
- Si `RefreshToken` y `AuthSession` vencidos se purgan.
- La licencia exacta de `@zxing/library` (MIT según el paquete; deriva de ZXing, Apache-2.0) y las dependencias nativas de Capacitor/Tauri.
- Los números de artículo de la Ley 172-13 y la Ley 358-05 y las obligaciones concretas citadas: deben confirmarse con un abogado.
- Que las capturas de `docs/capturas` contengan solo datos ficticios (se confió en las notas del manual; no se revisaron las imágenes una a una).
- No se ejecutaron pruebas (no hay `node_modules` en el worktree). La revisión fue estática.
