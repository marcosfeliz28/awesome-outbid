Borrador sin verificar, hecho por script (grep sobre origin/nexora-cloud, solo lectura). Generado: 2026-10-29.

# Pruebas por área (por nombre de archivo)

INVENTARIO, no mapa por área: muchas pruebas salen como «sin área clara» porque su nombre no lo dice.

| Prueba | Área (por nombre) | Requiere Postgres (por nombre) |
|---|---|---|
| `tests/accessibility-contract.test.ts` | sin área clara | no (por nombre) |
| `tests/afirmaciones.test.ts` | sin área clara | no (por nombre) |
| `tests/alertas-postgres.test.ts` | sin área clara | sí |
| `tests/alertas-rendimiento.test.ts` | sin área clara | no (por nombre) |
| `tests/anular-caja-abierta-postgres.test.ts` | caja | sí |
| `tests/api-monitoring.test.ts` | sin área clara | no (por nombre) |
| `tests/api.test.ts` | sin área clara | no (por nombre) |
| `tests/auth-guard.test.ts` | sin área clara | no (por nombre) |
| `tests/auth-lockout.test.ts` | sin área clara | no (por nombre) |
| `tests/auth-username.test.ts` | sin área clara | no (por nombre) |
| `tests/backup-restore.test.ts` | instalador/operación | no (por nombre) |
| `tests/buscador-palabras.test.ts` | sin área clara | no (por nombre) |
| `tests/caja-cerrada-api.test.ts` | caja | no (por nombre) |
| `tests/caja-ciega-margen-api.test.ts` | caja | no (por nombre) |
| `tests/caja-fondo-sugerido.test.ts` | caja | no (por nombre) |
| `tests/caja-lote-verifon.test.ts` | caja | no (por nombre) |
| `tests/caja-por-usuario.test.ts` | caja | no (por nombre) |
| `tests/caja-web-ticket.test.ts` | caja | no (por nombre) |
| `tests/calidad-dinero-api.test.ts` | dinero | no (por nombre) |
| `tests/calidad-seguridad-api.test.ts` | sin área clara | no (por nombre) |
| `tests/calidad-unit.test.ts` | sin área clara | no (por nombre) |
| `tests/cart-draft-policy.test.ts` | sin área clara | no (por nombre) |
| `tests/cart-draft-race.test.ts` | sin área clara | no (por nombre) |
| `tests/cash-privacy.test.ts` | caja | no (por nombre) |
| `tests/claude-round2.test.ts` | sin área clara | no (por nombre) |
| `tests/cloud-deploy.test.ts` | instalador/operación | no (por nombre) |
| `tests/compliance.test.ts` | sin área clara | no (por nombre) |
| `tests/conciliar-transferencias.test.ts` | sin área clara | no (por nombre) |
| `tests/configuracion-pruebas.test.ts` | sin área clara | no (por nombre) |
| `tests/correo-avisos.test.ts` | sin área clara | no (por nombre) |
| `tests/courier-migration-postgres.test.ts` | sin área clara | sí |
| `tests/courier-utils.test.ts` | sin área clara | no (por nombre) |
| `tests/credit-allocation.test.ts` | dinero | no (por nombre) |
| `tests/credit-reasons.test.ts` | dinero | no (por nombre) |
| `tests/credito-api.test.ts` | dinero | no (por nombre) |
| `tests/credito-dias.test.ts` | dinero | no (por nombre) |
| `tests/customer-anonymization-postgres.test.ts` | sin área clara | sí |
| `tests/customer-display.test.ts` | sin área clara | no (por nombre) |
| `tests/customer-privacy.test.ts` | sin área clara | no (por nombre) |
| `tests/datos-concurrencia-api.test.ts` | sin área clara | no (por nombre) |
| `tests/datos-integridad-postgres.test.ts` | sin área clara | sí |
| `tests/datos-unit.test.ts` | sin área clara | no (por nombre) |
| `tests/db-errores.test.ts` | sin área clara | no (por nombre) |
| `tests/db-zona-horaria.test.ts` | sin área clara | no (por nombre) |
| `tests/descuadre-banner.test.ts` | dinero | no (por nombre) |
| `tests/dinero-auditoria.test.ts` | dinero | no (por nombre) |
| `tests/dinero-plazos.test.ts` | dinero | no (por nombre) |
| `tests/drive-backup-core.test.ts` | instalador/operación | no (por nombre) |
| `tests/drive-backup.test.ts` | instalador/operación | no (por nombre) |
| `tests/e2e-higiene.test.ts` | sin área clara | no (por nombre) |
| `tests/e2e/accesibilidad.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/acerca-de.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/almacenes.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/caja-borrador.spec.ts` | caja | no (por nombre) |
| `tests/e2e/caja-cierre-movil.spec.ts` | caja | no (por nombre) |
| `tests/e2e/caja-detalles.spec.ts` | caja | no (por nombre) |
| `tests/e2e/caja-fondo-sugerido.spec.ts` | caja | no (por nombre) |
| `tests/e2e/caja-por-usuario.spec.ts` | caja | no (por nombre) |
| `tests/e2e/caja-web.spec.ts` | caja | no (por nombre) |
| `tests/e2e/celular-http.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/contrasenas.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/costos-compras.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/credito.spec.ts` | dinero | no (por nombre) |
| `tests/e2e/cuatro-cajas.spec.ts` | caja | no (por nombre) |
| `tests/e2e/envio-mensajero.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/facturas.spec.ts` | fiscal | no (por nombre) |
| `tests/e2e/fuentes.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/gv-clary.spec.ts` | GV | no (por nombre) |
| `tests/e2e/importar-inventario.spec.ts` | inventario | no (por nombre) |
| `tests/e2e/incentivos.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/pago-dolares.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/pos-pantalla.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/preguntas.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/privacidad-sesion.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/repetible.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/respaldo-drive.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/solicitud-anulacion.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/store.spec.ts` | sin área clara | no (por nombre) |
| `tests/e2e/u1-pos.spec.ts` | sin área clara | no (por nombre) |
| `tests/formal-pdf.test.ts` | fiscal | no (por nombre) |
| `tests/formal-period.test.ts` | fiscal | no (por nombre) |
| `tests/gv-adversarial-independiente.test.ts` | GV | no (por nombre) |
| `tests/gv-adversarial-t5-postgres.test.ts` | GV | sí |
| `tests/gv-auditoria-migration-postgres.test.ts` | GV | sí |
| `tests/gv-citas-api.test.ts` | GV | no (por nombre) |
| `tests/gv-modulo-api.test.ts` | GV | no (por nombre) |
| `tests/gv-servicios-api.test.ts` | GV | no (por nombre) |
| `tests/gv-unit.test.ts` | GV | no (por nombre) |
| `tests/import-codes.test.ts` | sin área clara | no (por nombre) |
| `tests/incentives-api.test.ts` | sin área clara | no (por nombre) |
| `tests/incentives-calc.test.ts` | sin área clara | no (por nombre) |
| `tests/income-day.test.ts` | sin área clara | no (por nombre) |
| `tests/integration-api-check.test.ts` | sin área clara | no (por nombre) |
| `tests/inventario.test.ts` | inventario | no (por nombre) |
| `tests/inventory-import-api.test.ts` | sin área clara | no (por nombre) |
| `tests/inventory-import-core.test.ts` | sin área clara | no (por nombre) |
| `tests/inventory-resilience.test.ts` | sin área clara | no (por nombre) |
| `tests/invoice.test.ts` | fiscal | no (por nombre) |
| `tests/licencias.test.ts` | sin área clara | no (por nombre) |
| `tests/lot-migration-postgres.test.ts` | inventario | sí |
| `tests/management-messages.test.ts` | sin área clara | no (por nombre) |
| `tests/merchandise-template.test.ts` | inventario | no (por nombre) |
| `tests/minors.test.ts` | sin área clara | no (por nombre) |
| `tests/mis-ventas-preguntas-postgres.test.ts` | sin área clara | sí |
| `tests/offline-policy.test.ts` | sin área clara | no (por nombre) |
| `tests/offline-review-api.test.ts` | sin área clara | no (por nombre) |
| `tests/offline-review-web.test.ts` | sin área clara | no (por nombre) |
| `tests/pago-dolares-api.test.ts` | sin área clara | no (por nombre) |
| `tests/pago-dolares-migration-postgres.test.ts` | sin área clara | sí |
| `tests/password-account.test.ts` | sin área clara | no (por nombre) |
| `tests/perf-apertura.test.ts` | sin área clara | no (por nombre) |
| `tests/perf-api.test.ts` | sin área clara | no (por nombre) |
| `tests/perf-indexes-postgres.test.ts` | sin área clara | sí |
| `tests/pin-otra-persona-api.test.ts` | sin área clara | no (por nombre) |
| `tests/portabilidad.test.ts` | sin área clara | no (por nombre) |
| `tests/post-deploy-check.test.ts` | instalador/operación | no (por nombre) |
| `tests/promociones-paridad.test.ts` | sin área clara | no (por nombre) |
| `tests/promotion-name.test.ts` | sin área clara | no (por nombre) |
| `tests/promotion-ticket.test.ts` | sin área clara | no (por nombre) |
| `tests/pwa-update.test.ts` | sin área clara | no (por nombre) |
| `tests/rate-limit-l1.test.ts` | sin área clara | no (por nombre) |
| `tests/realtime.test.ts` | sin área clara | no (por nombre) |
| `tests/recibo-envio.test.ts` | sin área clara | no (por nombre) |
| `tests/reportes-clientes-api.test.ts` | sin área clara | no (por nombre) |
| `tests/reportes-dinero-api.test.ts` | dinero | no (por nombre) |
| `tests/reportes-inventario-api.test.ts` | inventario | no (por nombre) |
| `tests/reportes-margen-api.test.ts` | dinero | no (por nombre) |
| `tests/reportes-ventas-api.test.ts` | sin área clara | no (por nombre) |
| `tests/reports-memory-postgres.test.ts` | sin área clara | sí |
| `tests/restos-api.test.ts` | sin área clara | no (por nombre) |
| `tests/retencion-seguridad-postgres.test.ts` | sin área clara | sí |
| `tests/rutas-permiso.test.ts` | sin área clara | no (por nombre) |
| `tests/sales-pdf.test.ts` | sin área clara | no (por nombre) |
| `tests/seguridad-v2.test.ts` | sin área clara | no (por nombre) |
| `tests/sync-cola-web.test.ts` | sin área clara | no (por nombre) |
| `tests/sync-transitorio.test.ts` | sin área clara | no (por nombre) |
| `tests/telegram-render.test.ts` | sin área clara | no (por nombre) |
| `tests/telegram.test.ts` | sin área clara | no (por nombre) |
| `tests/u-credit-cleanup.test.ts` | dinero | no (por nombre) |
| `tests/variant-code-unique-postgres.test.ts` | sin área clara | sí |
| `tests/ventas-caja-ciega-postgres.test.ts` | caja | sí |
| `tests/void-requests-api.test.ts` | sin área clara | no (por nombre) |
| `tests/warehouses-postgres.test.ts` | sin área clara | sí |
| `tests/web-monitoring.test.ts` | sin área clara | no (por nombre) |
| `tests/web-privacy.test.ts` | sin área clara | no (por nombre) |
| `tests/xlsx-bomb.test.ts` | sin área clara | no (por nombre) |
| `tests/year-report.test.ts` | sin área clara | no (por nombre) |

Total: 147 archivos. El área se deduce del nombre; no se abrió ningún archivo.
