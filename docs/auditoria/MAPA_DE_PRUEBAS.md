# Mapa de pruebas (archivo y primer describe)

Borrador verificado por script. Fuente: rama claude-pc/bloque15 sobre nexora-cloud.

| Archivo | Primer describe |
|---|---|
| tests/accessibility-contract.test.ts | U2 · identidad y ayuda de producción |
| tests/afirmaciones.test.ts | G13 · afirmaciones verificables |
| tests/alertas-postgres.test.ts | F7 · GET /alerts con 50 000 filas y 17 000 variantes |
| tests/alertas-rendimiento.test.ts | Alertas · rendimiento con catálogo grande |
| tests/anular-caja-abierta-postgres.test.ts | anular con la caja de la venta abierta |
| tests/api-monitoring.test.ts | API monitoring privacy guardrails |
| tests/api.test.ts | E1 · credenciales indistinguibles contra API real |
| tests/auth-guard.test.ts | AuthGuard · fallos de la base no cierran la sesión |
| tests/auth-lockout.test.ts | S-01 · el bloqueo por contraseñas erróneas no deja a la cajera fuera |
| tests/auth-username.test.ts | inicio de sesión con usuario corto |
| tests/backup-restore.test.ts | NO ENCONTRADO |
| tests/buscador-palabras.test.ts | Buscador palabra por palabra |
| tests/caja-cerrada-api.test.ts | #4 · venta sin conexión descartada con la mercancía entregada |
| tests/caja-ciega-margen-api.test.ts | #5 cierre ciego: no se adivina reintentando |
| tests/caja-fondo-sugerido.test.ts | W8 · fondo sugerido por persona |
| tests/caja-lote-verifon.test.ts | CPC-2 · lote del verifón al cerrar caja |
| tests/caja-por-usuario.test.ts | W6 · cada usuario tiene su propia caja |
| tests/caja-web-ticket.test.ts | 05-A1 · el recibo identifica al cliente |
| tests/calidad-dinero-api.test.ts | Cobro: reglas de la venta |
| tests/calidad-seguridad-api.test.ts | Aprobaciones con PIN (funciones de seguridad contra la base) |
| tests/calidad-unit.test.ts | SE06 · el secreto JWT exige 32 caracteres como mínimo |
| tests/cart-draft-policy.test.ts | 05-N3b: caducidad del borrador |
| tests/cart-draft-race.test.ts | cartDraft · carrera entre el borrado y un guardado en cola |
| tests/cash-privacy.test.ts | C2 · privacidad de arqueo por rutas indirectas |
| tests/claude-round2.test.ts | Auditoría Claude 2 · regresiones focales |
| tests/cloud-deploy.test.ts | Render · aislamiento reproducible |
| tests/compliance.test.ts | P2 · manual operativo de cajera |
| tests/conciliar-transferencias.test.ts | conciliación de transferencias |
| tests/configuracion-pruebas.test.ts | configuración de pruebas |
| tests/correo-avisos.test.ts | avisos por correo |
| tests/courier-migration-postgres.test.ts | NO ENCONTRADO |
| tests/courier-utils.test.ts | Envíos del mensajero |
| tests/credit-allocation.test.ts | 3v: reparto por antigüedad con centavos exactos |
| tests/credit-reasons.test.ts | 3x · misma decisión y motivo del PIN |
| tests/credito-api.test.ts | W7 · venta a crédito sin pago |
| tests/credito-dias.test.ts | Créditos / contraentregas · días que llevan sin cerrarse |
| tests/customer-anonymization-postgres.test.ts | G6 · anonimización contra PostgreSQL real |
| tests/customer-display.test.ts | P5: datos de clientes en la lista |
| tests/customer-privacy.test.ts | G6: anonimización de clientes |
| tests/datos-concurrencia-api.test.ts | N-A1 · devolución con nota de crédito contra ventas al mismo cliente |
| tests/datos-integridad-postgres.test.ts | Auditoría 06 · migraciones de datos en PostgreSQL real |
| tests/datos-unit.test.ts | D-M6 · el esperado de caja no carga las fotos de evidencia |
| tests/db-errores.test.ts | ApiExceptionFilter · errores de la base |
| tests/db-zona-horaria.test.ts | D-B7 · zona horaria de la base al arrancar |
| tests/descuadre-banner.test.ts | DescuadreBanner |
| tests/dinero-auditoria.test.ts | Auditoría 01 · dinero |
| tests/dinero-plazos.test.ts | D-M2 · plazo de las transacciones de dinero |
| tests/docs-sistema-citas.test.ts | citas de docs/sistema |
| tests/docs-sistema-indice.test.ts | índice de docs/sistema |
| tests/drive-backup-core.test.ts | Formato NXBK v1 (cifrado en flujo por bloques) |
| tests/drive-backup.test.ts | Respaldo a Google Drive · sin configuración |
| tests/e2e-higiene.test.ts | suite E2E · no ensucia el repositorio (WP-3) |
| tests/formal-pdf.test.ts | 3z · PDF formal |
| tests/formal-period.test.ts | 3z · períodos, margen y cajas de prueba |
| tests/gv-adversarial-independiente.test.ts | GV adversario · ${kind} |
| tests/gv-adversarial-t5-postgres.test.ts | T5 · dinero e idempotencia de pagos GV |
| tests/gv-auditoria-migration-postgres.test.ts | NO ENCONTRADO |
| tests/gv-citas-api.test.ts | GV · citas: permisos |
| tests/gv-modulo-api.test.ts | GV · permisos del rol |
| tests/gv-servicios-api.test.ts | GV · servicios sin existencia |
| tests/gv-unit.test.ts | GV · pendiente exacto |
| tests/import-codes.test.ts | Importador: códigos con ceros iniciales |
| tests/incentives-api.test.ts | INC · incentivos por cajera |
| tests/incentives-calc.test.ts | tarifas por categoría |
| tests/income-day.test.ts | 3w · movimientos por día de República Dominicana |
| tests/integration-api-check.test.ts | comprobación de la API de integración |
| tests/inventario.test.ts | importador de inventario · lectura del Excel |
| tests/inventory-import-api.test.ts | Importar inventario · permisos y archivo |
| tests/inventory-import-core.test.ts | importador de inventario · módulo compartido |
| tests/inventory-resilience.test.ts | I1 · identidad canónica de lote |
| tests/invoice.test.ts | Factura proveedor · Claude simulado (sin llamadas reales) |
| tests/licencias.test.ts | G14 · licencias de terceros |
| tests/lot-migration-postgres.test.ts | T1 · upgrade real de identidad de lotes |
| tests/management-messages.test.ts | P3 · estados de administración |
| tests/merchandise-template.test.ts | NO ENCONTRADO |
| tests/minors.test.ts | Menores de la cola |
| tests/mis-ventas-preguntas-postgres.test.ts | mis ventas de hoy |
| tests/offline-policy.test.ts | política de ventas offline |
| tests/offline-review-api.test.ts | 05-A2 · descartar una venta sin conexión en conflicto |
| tests/offline-review-web.test.ts | 05-A2 · conflicto de una venta sin conexión |
| tests/pago-dolares-api.test.ts | pago en dólares en efectivo |
| tests/pago-dolares-migration-postgres.test.ts | NO ENCONTRADO |
| tests/pagos-ajustes-api.test.ts | 1 · corregir el método de un cobro (abono) con la caja cerrada |
| tests/password-account.test.ts | Cambiar mi contraseña (POST /auth/password) |
| tests/perf-apertura.test.ts | PERF-5 · la devolución tiene el mismo plazo de transacción que la venta |
| tests/perf-api.test.ts | GET /cash-sessions con historial |
| tests/perf-indexes-postgres.test.ts | PERF-1 · índices de enlace y plan_cache_mode en PostgreSQL real |
| tests/pin-otra-persona-api.test.ts | PIN de gerente: siempre de otra persona (dueña, 25-oct) |
| tests/portabilidad.test.ts | Portabilidad · rutas y procesos de las pruebas |
| tests/post-deploy-check.test.ts | post-deploy-check · base de datos |
| tests/promociones-paridad.test.ts | NO ENCONTRADO |
| tests/promotion-name.test.ts | G15 · promoción aplicada en la venta |
| tests/promotion-ticket.test.ts | G15 · nombre de la promoción en ticket y PDF |
| tests/pwa-update.test.ts | PWA · actualización sin cortar ventas |
| tests/rate-limit-l1.test.ts | L1 · rate limiting sólo con identidades validadas |
| tests/realtime.test.ts | RealtimeHub · inicialización concurrente (R4-05) |
| tests/recibo-envio.test.ts | Recibo · envío del mensajero visible para el cliente |
| tests/reportes-clientes-api.test.ts | Reportes · Clientes y crédito |
| tests/reportes-dinero-api.test.ts | Reportes 40 · Dinero |
| tests/reportes-inventario-api.test.ts | Reportes de inventario (27-34) |
| tests/reportes-margen-api.test.ts | Reportes de margen |
| tests/reportes-ventas-api.test.ts | Reportes · Ventas |
| tests/reports-memory-postgres.test.ts | PERF-informes · informes del mes contra PostgreSQL real |
| tests/restos-api.test.ts | D-B11 · GET /credit-notes paginado |
| tests/retencion-seguridad-postgres.test.ts | V2-06 · retención de AuditLog, InvoiceAttachment y avisos pendientes |
| tests/rutas-permiso.test.ts | Permisos declarados en todas las rutas |
| tests/sales-pdf.test.ts | G5 · contenido real de PDF |
| tests/seguridad-v2.test.ts | N-05 · el administrador del script y del instalador exige PIN de 6 dígitos |
| tests/sync-cola-web.test.ts | N-M3 · cola de ventas sin conexión |
| tests/sync-transitorio.test.ts | N-M3 · /sales/sync y los errores transitorios |
| tests/telegram-render.test.ts | Telegram · renderizado de avisos |
| tests/telegram.test.ts | Telegram · avisos de facturas |
| tests/u-credit-cleanup.test.ts | U-crédito · contrato del cobro y manual |
| tests/variant-code-unique-postgres.test.ts | K2 · códigos únicos sin mayúsculas ni espacios en PostgreSQL real |
| tests/ventas-caja-ciega-postgres.test.ts | Ventas con caja ciega (B-01) |
| tests/void-requests-api.test.ts | 3p · solicitud de anulación |
| tests/warehouses-postgres.test.ts | 3y · almacenes con PostgreSQL real |
| tests/web-monitoring.test.ts | G8 · Sentry web sólo con VITE_SENTRY_DSN |
| tests/web-privacy.test.ts | G9 · service worker |
| tests/xlsx-bomb.test.ts | SEC-01 · bomba XLSX |
| tests/year-report.test.ts | círculo de ventas del año |
