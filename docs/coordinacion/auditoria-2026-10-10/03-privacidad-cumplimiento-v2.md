# 03 v2 · Privacidad y cumplimiento (RD) — Nexora POS

**Alcance.** Auditoría estática de solo lectura de `origin/nexora-cloud` en `a12c980` (worktree propio `wt-v2-privacidad-cumplimiento`). Se comparó con la v1 (`3e5521c`, 156 commits de diferencia, 152 archivos). No se tocó producción ni se cambió código. No se ejecutaron pruebas: no hay `node_modules` y el PostgreSQL del sistema (16/main) estaba detenido; la evidencia es de lectura de código, migraciones y de los tests que ya existen en el repositorio (se citan, no se corrieron).

**Aviso.** Quien firma no es abogado. Las leyes se citan por obligación o principio. Un abogado dominicano debe confirmar lo marcado como riesgo legal, y un contador lo fiscal.

## Resumen

| Severidad | Nuevos v2 | Pendientes de v1 (reclasificados) |
|---|---|---|
| Crítico | 0 | 0 |
| Alto | 0 | 2 (A3 transferencia internacional, A4 fiscal e-CF) |
| Medio | 3 (V2-01, V2-02, V2-03) | M1 parcial, M3 parcial, M4, M5, M6, M7 parcial, M8 parcial, M9, M10 parcial, M11 parcial, M12, A1 parcial (baja a medio) |
| Bajo | 3 (V2-04, V2-05, V2-06) | B2, B3 parcial, B5, B6, B7, B8, B9, B10, B11 |

Lo corregido de verdad: A2 (anonimización), B1 (IP), B4 (rama «COMPROBANTE FISCAL»), M2 (ITBIS en ticket). Avance sustancial: A1, M1, M3, M11.

---

## 1. Tabla v1 → estado en a12c980

| ID v1 | Estado | Evidencia (archivo:línea / prueba) |
|---|---|---|
| **A1** Aviso de privacidad | **Parcial** | Hecho: `apps/web/public/privacidad.html` (resumen); aviso en formularios de cliente `helpers.tsx:210-224`, usado en `POS.tsx:1348` y `Management.tsx:2214,2223`; línea en el ticket `Prints.tsx:301-310,411`; enlace en «Acerca de» `App.tsx:151`. Falta: `docs/legal/POLITICA_PRIVACIDAD.md:8,30,32,37,50` sigue con `[NOMBRE LEGAL]`, `[CORREO…]`, `[N] años`, `[PLAZO]`, `[PROVEEDOR…]`; el PDF no lleva aviso (ver V2-02); la pantalla de login no enlaza; `CUMPLIMIENTO_20_PUNTOS.md` sigue marcando «Falta»; no hay prueba de contrato que exija el aviso. |
| **A2** Anonimización incompleta | **Corregido** | `admin.ts:326-537`: borra `Payment.proofUrl` (l.~437), redacta `voidedReason`, `discountReason`, `Payment.reference`, `SaleReturn.reason`, `InventoryMovement.reason`, auditoría de venta/pago/devolución/offline con `withoutImages` (`common.ts:298-310`), reescribe `NotificationOutbox.payload` (l.~490-512) y cierra alertas. Migración `202610210003_datos_privacidad` limpia `proofUrl` histórico en `AuditLog.before/after`; `audit()` (`common.ts:311-331`) ya no guarda imágenes. Pruebas: `tests/datos-integridad-postgres.test.ts:787` («03-A2…») y `tests/customer-anonymization-postgres.test.ts:205-235,380-396`. UI honesta: `Management.tsx:2237`. Límite residual: ver V2-04 y «No cubierto» abajo. |
| **A3** Transferencia internacional | **Abierto** | `render.yaml:15,41,77` sigue `region: virginia`; `REGISTRO_TERCEROS.md` sin DPA verificado; la política añade Google/Sentry opcional pero mantiene `[ABOGADO: revisar transferencias internacionales]` (l.37). |
| **A4** Fiscal NCF/e-CF | **Abierto** | Sin cambio de código (`admin.ts:101` `ncfMode` solo `disabled\|prepared`); `REQUISITOS_FISCALES_RD.md` solo 2 líneas tocadas. Hoy 10/10/2026: faltan 36 días para el 15/11/2026. |
| **M1** «Factura» en UI/PDF | **Parcial** | Corregido: UI del POS/Gestión ya no usa «factura» en botones; PDF `sales.ts:2416` y WhatsApp `POS.tsx:2103` usan `NON_FISCAL_LEGEND`; prueba `tests/caja-web-ticket.test.ts:86-95`. Abierto: Telegram sigue con «Factura V-…» (`notifications.ts:189,213,242,276,282`), «Avisos de facturas» (`Management.tsx:3290,3298`), columna `Factura` del Excel de ventas (`reports.ts:1208`) sin leyenda no fiscal. |
| **M2** ITBIS sin «incluido» | **Corregido** | `Prints.tsx:290-305` (`taxLabel`, «ITBIS incluido/adicional») y PDF `sales.ts:2444-2447`; prueba en `tests/caja-web-ticket.test.ts` (importa `taxLabel`). |
| **M3** Devoluciones e identificación | **Parcial** | Corregido: `returnPolicyText` impreso (`Prints.tsx:293-300,410`). Abierto: `configSchema` sigue sin exigir RNC/dirección/teléfono (`admin.ts:68-72`); encabezado por defecto «Nexora POS» + logo Grupo Macgen (`Prints.tsx:80,83`); PDF sin política de devolución. |
| **M4** Devolución bloqueada tras el plazo | **Abierto** | `sales.ts:1692-1697` sigue rechazando sin excepción; `returnDays` admite 0 (`admin.ts:82`). Se agrava con V2-01. |
| **M5** Cliente obligatorio | **Abierto** | `admin.ts:841-843` `requireCustomer: true` invariable. |
| **M6** Solicitud NCF sin seguimiento | **Abierto** | `Prints.tsx:400-402`, `sales.ts:2437-2441` imprimen «pendiente de emisión fiscal»; `fiscalStatus` no tiene vista ni flujo (`grep issued_external` vacío). |
| **M7** Telegram: empleados, registro, purga | **Parcial** | Purga corregida: `retention.ts:113-130` borra `failed` > 30 días y `sent` > 30 días (corre cada hora, también con Telegram apagado). Abierto: `REGISTRO_TERCEROS.md` no tiene fila de Telegram; la política (l.41) solo habla de clientes (no cajera/faltantes `notifications.ts:306-320`); `TERMINOS_DE_USO.md` sin aviso a empleados. |
| **M8** Documentación desactualizada | **Parcial** | Reescritos: `DATOS_PERSONALES_INVENTARIO.md` (completo), `REGISTRO_TERCEROS.md` (Sentry opt-in, fila Google Drive). Abierto: sin Telegram en el registro; `DATOS_PERSONALES_INVENTARIO.md:51` dice que `audit()` no rellena `AuditLog.ip` (ahora sí, V2-03); `CUMPLIMIENTO_20_PUNTOS.md` (commit `c0b7105`) intacto y obsoleto. |
| **M9** Respaldos cloud sin cifrar / OneDrive | **Abierto** | `scripts/pull-cloud-backup.ps1` y `Register-NexoraCloudBackupTask.ps1` no cambian. Mitigación nueva: el módulo Drive cifra (AES-256-GCM, formato NXBK, `drive-backup-core.ts`, `scripts/decrypt-backup.mjs`), pero el camino S3/laptop sigue en claro. |
| **M10** Rama Drive contradice política | **Parcial** | Ya mezclada: política `POLITICA_PRIVACIDAD.md:33,41` y registro (fila 9) documentan Drive, 30 diarias + 12 mensuales, hasta ~13 meses; existe `docs/RESPALDO_DRIVE.md`. Pendiente: `PROCEDIMIENTO_DERECHOS_DATOS.md:21` aún dice «se rotan en 30 días» (V2-04). |
| **M11** Sin plazos de conservación | **Parcial** | Nuevo `retention.ts:25-35` (RealtimeEvent 48 h, NotificationOutbox 30 d, AuthAttempt 48 h/30 d, RefreshToken 24 h) con prueba `datos-integridad-postgres.test.ts:652,734`; `security.ts:340-370` (IP de bitácora 90 d). Siguen sin plazo: clientes inactivos (`[N] años`), `Payment.proofUrl` de pagos saldados, `AuditLog`, `InvoiceAttachment` confirmada. |
| **M12** Derecho de acceso / registro de supresiones | **Abierto** | Sin endpoint de exportación de datos del cliente; `admin.ts:534-537` sigue guardando solo `{reasonRecorded, requestReferenceRecorded}`; sin lista reaplicable tras restaurar. |
| **B1** IP persistida | **Corregido** | `AuthAttempt.updatedAt` + disparador (`202610210003`), `retention.ts:131-153`, `security.ts:346-370`. La documentación quedó atrás (V2-03). |
| **B2** Notas del cliente sin máscara | **Abierto** | `common.ts:281-290` no enmascara `notes`; sin advertencia en el campo. |
| **B3** Teléfono/RNC en ticket y PDF | **Parcial** | Ticket corregido (`Prints.tsx:354-361`: sin teléfono, RNC solo con `ncfType`). El PDF sigue imprimiéndolos siempre (`sales.ts:2427-2433`, V2-02). |
| **B4** Rama «COMPROBANTE FISCAL» | **Corregido** | `Prints.tsx:342-352` exige `fiscalStatus==="issued"` y `ncfMode==="electronic"`; `ncfMode` ni siquiera admite `electronic` (`admin.ts:101`), así que es inalcanzable. |
| **B5** README y prueba de afirmaciones | **Abierto** | `README.md:1,3,5` igual («demostración», «no se ha publicado un servidor»); `tests/afirmaciones.test.ts:12-30` mismo alcance; `docs/MANUAL.md:19` «política segura». |
| **B6** Imprecisiones de la política | **Abierto** | Sin cambios en `POLITICA_PRIVACIDAD.md` líneas 17, 20, 58. |
| **B7** Sentry web, migas | **Abierto** | `monitoring.ts:135-140` sin depurar `breadcrumb.data` salvo `url`; ahora solo aplica si hay `VITE_SENTRY_DSN`. |
| **B8** Repo público con datos del negocio | **Abierto** | `gh api` → `visibility: public`; siguen `MANUAL-CAJERO.md`, `docs/tienda/CUADRE_REPORTES_FACTURA.md`, `VERIFICACION_MANUAL.md`, `COLA_HALLAZGOS_NEXORA.md` con nombres/ubicación. |
| **B9** ITBIS adicional muestra precio sin impuesto | **Abierto** | Sin cambio (`admin.ts` `taxIncluded`). |
| **B10** Proveedores sin máscara para almacén | **Abierto** | `admin.ts:543-550` devuelve la fila completa a `purchase:write`. |
| **B11** Licencias nativas | **Abierto / sin verificar** | No se revisó de nuevo; sin cambios en `licencias.txt`. |

---

## 2. Hallazgos nuevos o regresiones

### MEDIO

#### V2-01 · El ticket promete «garantía de ley» para producto defectuoso o vencido, pero la API bloquea toda devolución fuera de plazo
- **Dónde:** `apps/web/src/Prints.tsx:296-299` («Producto defectuoso o vencido: tiene la garantía de ley.») contra `apps/api/src/sales.ts:1692-1697` (`bad("La venta excede el plazo de devolución.")`, sin excepción ni motivo «garantía/defecto»). Nace al corregir M3 sin corregir M4.
- **Obligación:** Ley 358-05, información veraz y garantía legal.
- **Escenario:** una suplemento vencido se descubre el día 45 (`returnDays` = 30). La clienta muestra el ticket que dice «tiene la garantía de ley»; la cajera no puede registrar la devolución en el sistema, y la tienda o la niega (contradice lo impreso) o la hace fuera del sistema (dinero y stock sin rastro).
- **Arreglo mínimo:** añadir una excepción por defecto/vencido con PIN de gerente y motivo obligatorio auditado, saltando el control de plazo en `sales.ts:1692`; o, mientras tanto, quitar la frase del ticket.

#### V2-02 · El PDF del recibo (lo que sale por WhatsApp/correo) sigue con teléfono y cédula del cliente, sin aviso de privacidad ni política de devolución
- **Dónde:** `sales.ts:2427-2433` imprime siempre `RNC/Cédula` y `Tel.` del cliente; `sales.ts:2400-2475` no incluye `returnPolicyText` ni `privacyNoticeText`. El ticket térmico ya se corrigió (`Prints.tsx:354-361,410-411`), por eso las dos salidas divergen.
- **Obligación:** Ley 172-13 (minimización; deber de informar), Ley 358-05 (condiciones de devolución).
- **Escenario:** la cajera envía el PDF por WhatsApp (tercero) a un número equivocado o reenviado: viaja la cédula completa y el teléfono, sin aviso al titular.
- **Arreglo mínimo:** replicar en el PDF la regla del ticket (RNC solo si `sale.ncfType`, sin teléfono) y añadir las dos líneas del pie. Prueba: ampliar `tests/caja-web-ticket.test.ts` para leer `sales.ts`.

#### V2-03 · `AuditLog.ip` ahora se rellena en cada acción y la documentación afirma lo contrario
- **Dónde:** `common.ts:324` (`ip: actor.ip`), `common.ts:687` (`ip: clientIp(req)`); `DATOS_PERSONALES_INVENTARIO.md:51` y `CUMPLIMIENTO_20_PUNTOS.md:~13` dicen «`audit()` no la rellena».
- **Mitigación existente (positiva):** `security.ts:340-370` pone la IP a NULL a los 90 días (`SecurityMaintenance`, cada 6 h, pero la primera ejecución llega 6 h después de arrancar).
- **Obligación:** Ley 172-13, rendición de cuentas (registro fiel) y transparencia hacia empleados (la IP es del empleado).
- **Escenario:** una inspección compara el inventario con la base: la IP de cada empleado aparece en la bitácora, no declarada, y sobrevive 90 días en la base y hasta ~13 meses en los respaldos de Drive.
- **Arreglo mínimo:** corregir el inventario, declarar la IP de empleados (90 días) en la política/términos internos. Hay que tener en cuenta que `scripts` de restauración no reaplican el borrado.

### BAJO

#### V2-04 · Los datos anonimizados siguen en los respaldos de Drive hasta ~13 meses y el procedimiento promete 30 días
- **Dónde:** `drive-backup-core.ts:541-591` (30 diarias + 12 mensuales); `PROCEDIMIENTO_DERECHOS_DATOS.md:21` («se rotan en 30 días… no se restaurarán datos eliminados»); `POLITICA_PRIVACIDAD.md:33` ya dice «hasta unos 13 meses» con `[ABOGADO: confirmar]`.
- **Escenario:** al atender una solicitud, el gerente informa al titular «30 días» (según el procedimiento), cuando la copia mensual cifrada persiste hasta un año. Tras una restauración, nadie sabe a quién reaplicar la anonimización (M12).
- **Arreglo mínimo:** corregir la línea 21 del procedimiento y exportar, al anonimizar, un registro `DSR-nnnn` con `customerId` fuera de la base; que `decrypt-backup.mjs`/restore documente «reaplicar la lista».

#### V2-05 · `privacidad.html` remite a un teléfono que puede no existir y calla destinatarios
- **Dónde:** `apps/web/public/privacidad.html` («llama al teléfono impreso en tu recibo»); `Prints.tsx:301-310` añade el teléfono solo si `config.phone` no está vacío, y `configSchema` lo permite vacío (`admin.ts:68-72`). El resumen no menciona Telegram, Sentry/Drive ni el alojamiento en EE. UU. (solo «pueden estar fuera»).
- **Escenario:** la tienda no completó el teléfono; el aviso apunta a un canal inexistente y el titular no sabe cómo ejercer sus derechos.
- **Arreglo mínimo:** exigir `phone` (y RNC/dirección) en `configSchema` y listar los terceros reales en la página.

#### V2-06 · La retención nueva no cubre `AuditLog`, `InvoiceAttachment` ni notificaciones `pending`
- **Dónde:** `retention.ts:19-24` excluye a propósito `AuditLog`; `NotificationOutbox` con `status='pending'` nunca se purga (`retention.ts:113-130`), por ejemplo si el worker queda detenido con nombres de clientes en el payload.
- **Escenario:** una tabla sin plazo acumula nombres/motivos de ventas indefinidamente; la política promete borrar al vencer el plazo.
- **Arreglo mínimo:** documentar el plazo del contador para `AuditLog`/adjuntos y purgar `pending` con más de 30 días (marcar `failed`).

---

## 3. Lo que se verificó sin hallazgo en las áreas nuevas

- **Migraciones 202610200001..210004:** solo aditivas y con `IF NOT EXISTS`/manejo de errores; `202610210003` limpia fotos en la bitácora. No se encontró dato personal nuevo en `202610210001/0002` (índices, CHECK, FK con `RESTRICT`: las FK de `Sale.customerId` y `CreditNote.customerId` son `Restrict`, coherente con anonimizar en vez de borrar) ni en `210004` (claves de idempotencia sin PII).
- **Módulo Drive:** ámbito `drive.file`, token cifrado con la frase (`sealSecret`), copia cifrada antes de salir (NXBK), correo de la cuenta enmascarado en la API (`maskAccount`), solo administración (`@Permit("*")`), alertas por Telegram sin datos de clientes. Riesgo operativo: si se pierde `BACKUP_ENCRYPTION_KEY` las copias no se leen, y quien tenga frase + cuenta Google lee todo.
- **Bloqueo de login / PIN de 6 dígitos:** las claves `login:<id>:<authVersion>:<ip|terminal>` y `missing:<sha256>` se purgan (1 día/2 días/30 días); `onLocked` registra IP solo con el borrado a 90 días. El PIN de 4-5 dígitos se acepta aún (`offline-sale-review.ts` `\d{4,6}`), documentado como compatibilidad.
- **Cola de escaneo y borrador del carrito:** la cola es solo memoria (`POS.tsx:701`); `cartDraft.ts` guarda `customerId`, líneas y descuento (sin nombre/teléfono) en `cache`, que se borra al cerrar sesión (`api.ts:293-305`, prueba `web-privacy.test.ts`).
- **Actualización PWA:** `pwaUpdate.ts` no recarga con carrito; `privacidad.html` queda precacheada (`globPatterns` incluye `html`) y se sirve sin fallback a `index.html`.
- **Reportes:** el Excel de clientes solo usa nombre (`reports.ts:1066-1085`); `returns-discounts` exporta `after` filtrado por `safe()` (lista blanca).

## 4. No cubierto / no verificado

- No se ejecutó ninguna prueba ni se probó contra PostgreSQL (clúster detenido, sin dependencias instaladas).
- Campos libres no revisados para anonimización: `CashMovement.reason`, `Expense`, `Payment.bank`. No se verificó si se rellenan con nombres de clientes.
- No se comprobó si producción tiene activos `TELEGRAM_*`, `SENTRY_DSN`, Drive o `ANTHROPIC_API_KEY`, ni los DPA de los proveedores.
- Las referencias legales (Ley 172-13, 358-05, 32-23, Decreto 254-06) deben confirmarse con un abogado/contador.
