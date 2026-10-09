# Cola de hallazgos Nexora (commit c0b7105)

Origen: 8 revisiones en paralelo de Claude (lectura de código; lo marcado «CONFIRMADO» se comprobó leyendo el código fuente de las dependencias). Orden: se resuelven de arriba abajo. «Prueba» = regresión que debe fallar hoy.

## P1 · bloquea salir a producción

| ID | Hallazgo | Dónde | Corrección | Prueba |
|---|---|---|---|---|
| L1 | **El limitador de login no cuenta nada** (CONFIRMADO). `app.use()` corre antes del parser JSON de Nest, así que `req.body` es undefined y no hay clave por cuenta. Los tests inyectan `body` a mano y no lo ven. | main.ts:33, rate-limit.ts:60 | Mover el límite a un guard o middleware posterior al parser; usar `normalizeUsername` del login; truncar/hashear la clave a ≤120 caracteres; limitar también /auth/pin y /auth/refresh; no expulsar claves legítimas al llenar el mapa. | App real (supertest): 61 logins → 429; 10 001 claves falsas no resetean el cubo de otro usuario. |
| C1 | **Contraentrega esquiva aprobación y límite de crédito.** Un vendedor vende RD$ 5,000 pagando todo en `cod`: sin PIN, sin revisar `allowCreditSales` ni `creditLimit` (límite 0 = ilimitado). DECIDE LA DUEÑA: reglas de COD. | sales.ts:243-244, 491-503 | Tratar `cod` como saldo pendiente igual que crédito: PIN/límite/bandera. Definir qué significa límite 0. | seller + cod 5,000 sin PIN → 400. |
| C2 | **Arqueo ciego filtrable**: el cuadre abierto da fondo, ventas por método y total; el reporte por forma de pago da lo mismo; `POST close` con nota vacía y `movements out` sirven de oráculo (búsqueda binaria). | cash.ts:786-817, 551, 694-705 | Para quien no tiene `profit:read`/`sale:manage`: cuadre/reportes sólo tras cerrar, sin esperados; la nota se exige siempre que haya diferencia, sin revelar su tamaño; "no hay suficiente efectivo" sin cifras. | seller con caja abierta no puede calcular el esperado por ninguna ruta. |
| P1a | **Cambio de usuario por PIN** permite probar PIN de un admin con la sesión de una vendedora; el contador es por solicitante, no por objetivo (3 contadores independientes). DECIDE LA DUEÑA: exigir contraseña o gerente presente. | auth.ts:318-340, cash.ts:592, sales.ts:259, realtime.ts:280 | Contador por `userId` objetivo compartido por los tres flujos; bloquear tras 5 fallos. | 6 intentos contra el mismo objetivo desde cuentas distintas → bloqueo. |
| N2 | **nginx fija la IP de la API al arrancar** (CONFIRMADO). Si la API se reemplaza, la web da 502 hasta reiniciarla; `/healthz` no lo detecta. | start-nginx.sh:32-38, template:9, /healthz | Resolver por nombre con el resolvedor, o recargar el upstream cada 10 s; `/healthz` debe probar la API. | `docker compose restart api` y /api/health vuelve a 200 sin tocar la web. |
| I1 | **Lote existente se mezcla con otro vencimiento** y se vende vencido; lote nulo nunca recibe fecha; "L1" y "l1" son lotes distintos. | inventory.ts:883-912, 564-590; schema.prisma:156 | Rechazar vencimiento distinto para el mismo lote (como merchandise.ts:602); lote sin distinguir mayúsculas. | Recibir L1 con dos vencimientos → 400. |
| O1 | **Venta sin conexión con precio viejo queda en conflicto para siempre** y bloquea el cierre de caja; sólo hay «Reintentar». | POS.tsx:1514-1540, sales.ts:434-438, Management.tsx:1519-1560 | Ofrecer repreciar o descartar (con auditoría) y desbloquear el cierre. | Cola con expectedTotal viejo → se puede repreciar/descartar. |

## P2

| ID | Hallazgo | Dónde |
|---|---|---|
| D1 | Motivo de descuento obligatorio rompe ventas offline ya encoladas y reintentos de ventas guardadas: buscar por `offlineUuid` antes de exigirlo; aceptar vacío en legado. | sales.ts:269-282 |
| F1 | `GET /payments/:id/proof` usa `@Permit("*")` = sólo admin; gerentes pierden la foto. Debe ser `sale:manage` o la caja dueña. | sales.ts ~1628 |
| F2 | `safe()` no oculta `wasteCostTotal` y `GET /sales` incluye returns: fuga de costo a la cajera. Pasar a lista blanca. | common.ts:234-255, sales.ts:903 |
| E1 | Login: usuario inexistente/inactivo responde sin bcrypt (tiempo distinto); `change-password` revela cuentas pendientes. | auth.ts:139-141, 202 |
| E2 | Bloqueo incluye la IP: rotar IP evita el bloqueo por cuenta. DECIDE LA DUEÑA. | auth.ts:148 |
| M1 | Movimientos de caja y vales sin PIN ni tope: una falta se tapa con un `in` o un vale. | cash.ts:532-557, shared index.ts:563 |
| M2 | Dashboard: `revenue` resta devoluciones; daily/sellers/category/payments no. | reports.ts:142-194 |
| K1 | Ajustes y conteos `Serializable` sin reintento: 500 con ventas en paralelo (P2010/40001 no se traduce). | inventory.ts:521,615,1164,1206; common.ts:416 |
| K2 | Códigos únicos sin distinguir mayúsculas sólo en la aplicación; sin índice `lower()`; consulta recorre toda la tabla. | catalog.ts:59-96, schema.prisma:115 |
| S1 | PWA: `skipWaiting` + recarga puede perder el carrito en pleno cobro. | vite.config.ts:41, main.tsx:197 |
| S2 | Cola de ventas huérfana al cambiar vendedor con PIN / cerrar sesión; sin red la caja queda inutilizable. | App.tsx:714,497,819; api.ts:277,479 |
| S3 | `RD$ NaN` y `undefined%` cuando la API oculta campos por permiso; «Editar variante» exige `costAvg` oculto. | Management.tsx:1921-1930,582; Merchandise.tsx:1486 |
| S4 | F8 guarda y vacía el carrito con el modal de cobro abierto. | POS.tsx:357-366 |
| X1 | `.dockerignore` sólo cubre la raíz; `apps/api/.env` iría a la imagen. | .dockerignore:5-6 |
| X2 | API privada sin health check real; el despliegue se da por bueno al abrir el puerto. | render.yaml:32 |
| X3 | Sandbox de auditoría: falla en la 2.ª ejecución (volumen conserva contraseña vieja) y el comando usa rutas de binarios incorrectas. | Start-NexoraAuditSandbox.ps1:10; compose.audit.yaml:30 |
| X4 | Respaldos: nunca se restaura de verdad (sólo `pg_restore --list`); sin poda en S3; errores de pg_dump ocultos. | render-backup.mjs:48,107 |
| W1 | Instalador: instalación «nueva» sobrescribe `secrets.json` aunque haya base. | Install-FitStore.ps1:338-366 |
| W2 | Instalador: respaldos y respaldo final en Documentos públicos legibles por todos. | FitStore.nsi:109,243; Uninstall:83 |
| W3 | Instalador: API y web corren como LocalSystem. | service/*.xml.template |
| W4 | Instalador: marcador de actualización viejo dispara rollback que pisa ventas nuevas. | Preflight:35; FitStore.nsi:147; Rollback:138 |

## P3 (resumen; detalle en los informes de Claude)

Recepción/ajustes: merma con cantidad positiva suma stock (inventory.ts:510); impuestos capitalizados en el costo (merchandise.ts:510); importador sin límite de descompresión (catalog.ts:459); índices faltantes en InventoryMovement/GoodsReceipt. Caja: monto 0.004 o 1e15 en movimientos; reembolso en efectivo sin revisar gaveta; venta de total 0; diferencias se compensan y la alerta sólo mira efectivo; autorizador del descuento mal atribuido si el PIN fue por crédito y promoción sin regla. Auth: logout y refresh sin detección de reutilización; auditoría guarda `proofUrl` base64 y `approvalCode`; `editCustomer` sin auditoría; `roles` acepta permisos arbitrarios; `quotes` sin `branchId`. Web: blob URL sin revocar, `AbortSignal.timeout` en Safari viejo, `navigateFallbackDenylist` ausente, `aria-pressed`, datos de clientes en IndexedDB tras cerrar sesión. Infra: nginx como root, imágenes sin resumen, cabeceras duplicadas en /api, `Cache-Control` ausente en /api, CRLF reescribe schema.prisma. Kardex: devolución valorada distinto a `SaleReturn.costTotal`.

## Pendiente de recibir
- Suite de integración y navegador sobre PostgreSQL real (agente en curso).

## Cumplimiento (lista de 20 puntos; ver docs/legal/CUMPLIMIENTO_20_PUNTOS.md)

Prioridad P1 = antes de imprimir tickets reales a clientes.

| ID | Pri | Hallazgo | Dónde | Corrección | Prueba |
|---|---|---|---|---|---|
| G1 | P1 | **El ticket de 80 mm se titula «FACTURA», tiene «NCF:» vacío y no dice que no es fiscal.** | Prints.tsx:308-309 | Quitar «FACTURA»; imprimir «DOCUMENTO NO FISCAL – NO ES COMPROBANTE FISCAL» si no hay NCF; ocultar la fila NCF vacía. | Render del ticket sin NCF contiene la leyenda y no contiene «FACTURA». |
| G2 | P1 | Nombre y dirección fijos («Grupo Macgen», «Plaza Lope de Vega»); ignora Ajustes. | Prints.tsx:79-80 | Usar `name`, `branchName`, `address`, `phone`, `legalId` de Ajustes. | Cambiar el nombre en Ajustes cambia el ticket. |
| G3 | P2 | `legalId`, `address`, `phone` pueden guardarse vacíos. | admin.ts:58-61 | Obligatorios en Ajustes (DECIDE LA DUEÑA: confirmar datos). | PUT settings sin RNC → 400. |
| G4 | P2 | Sin política de devoluciones/garantía en ticket; `returnDays` sólo valida. | sales.ts:1263 | Campos `returnPolicyText` y `warrantyDays` en Ajustes e impresión en el pie. DECIDE LA DUEÑA: texto y días. | El ticket imprime la política configurada. |
| G5 | P2 | PDF de venta: sin teléfono ni hora; siempre «ITBIS incluido» aunque `taxIncluded` sea falso. PDF de nota de crédito: sin datos del negocio, fecha ni condiciones. | sales.ts:1527-1558, 1852-1938 | Completar encabezados y condiciones. | PDF contiene teléfono, hora y la leyenda de ITBIS correcta. |
| G6 | P2 | No hay forma de anonimizar un cliente; `editCustomer` sin auditoría; el audit-log guarda la ficha completa (teléfono, correo, RNC). | admin.ts:160-186 | `POST /customers/:id/anonymize` con permiso `customers:erase`; rechaza con deuda; conserva ventas y montos; depura AuditLog.before/after. | 403 vendedor; 409 con crédito pendiente; venta conserva total y número; audit-log sin el teléfono. |
| G7 | P2 | `Customer.birthday` y `email` sin uso; `AuditLog.ip` nunca se llena. | schema.prisma, admin.ts | Quitar `birthday` de esquema, API y migración; decidir `email`. | — |
| G8 | P2 | Sentry web siempre activo, DSN fijo, sin interruptor; mensajes de excepción sin sanear. | apps/web/src/monitoring.ts | Interruptor en Ajustes o variable; sanear mensajes. DECIDE LA DUEÑA. | Con el interruptor apagado no hay peticiones a Sentry. |
| G9 | P2 | Al cerrar sesión quedan en el navegador catálogo, ventas offline y datos de pago. | api.ts `endSession` | Limpiar tablas de clientes y caché cuando no haya ventas pendientes. | Tras cerrar sesión, IndexedDB no contiene datos de clientes. |
| G10 | P2 | Contraste bajo AA: botón Cobrar `#059669` (3.77), foco `#a78bfa` en claro (2.72), bordes de campo (1.20/1.34), avisos `#b96c0b`, rojos, gris `#a6aab8`. | styles.css | Valores propuestos en docs/legal/ACCESIBILIDAD.md. | Prueba de contraste (script) y axe en ambos temas. |
| G11 | P2 | F4/F8/F12 se disparan con un modal abierto (junto con S4). | POS.tsx:405-422 | Ignorar atajos si hay `[role=dialog]`. | E2E: F8 con el cobro abierto no vacía el carrito. |
| G12 | P3 | Subida de archivos sólo con mouse; buscador Ctrl+K sin nombre accesible; `listbox` inválido; menú lateral cerrado recibe foco; avisos a 6 s sin pausa; sesión por inactividad sin aviso previo. | Management.tsx:2559, Tienda.tsx:824, App.tsx:741, Merchandise.tsx:~233 | Ver ACCESIBILIDAD.md. | axe sin violaciones críticas. |
| G13 | P3 | Frases sin respaldo: «Lo más seguro», «Anulación auditada», «Respaldos cifrados», docs `AUDITORIA_*` presentados como auditoría independiente, «Facturación» en el manifest, título «Monitoreo seguro». | Management.tsx, docs/ENTREGA.md, SENTRY-API.md, vite manifest | Reescribir según docs/legal/LICENCIAS_Y_AFIRMACIONES.md. | grep de frases prohibidas en CI. |
| G14 | P3 | Faltan avisos de licencia (Inter y Plus Jakarta Sans OFL, lucide ISC, MIT/BSD en el JS compilado); THIRD_PARTY_NOTICES.txt sólo cubre 5 binarios; origen del ícono y de las SVG sin documentar. | public/, instalador/THIRD_PARTY_NOTICES.txt | Añadir avisos y página «Acerca de» con enlace legal. | La app expone /licencias con los avisos. |
| G15 | P3 | Mostrar qué promoción automática se aplicó; promoción sin regla guardada. | sales.ts:370-397 | Guardar y imprimir el nombre de la promoción. | Ticket con promoción la nombra. |


## Mejoras de interfaz (no bloquean producción)

| ID | Pri | Tarea | Condición |
|---|---|---|---|
| U1 | P3 | Rediseño de la pantalla de caja según `docs/coordinacion/PROMPT_UI_POS.md` (versión corregida del prompt de Gemini). | Sólo después de integración 157/157 y CI en verde, y de fusionar B0–B6 y O1/S1–S4. |
