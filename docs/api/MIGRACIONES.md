Borrador sin verificar, hecho por script (grep sobre origin/nexora-cloud, solo lectura). Generado: 2026-10-29.

# Migraciones en orden

| Migración | Qué tablas toca |
|---|---|
| 202610030001_initial | CREATE Role; CREATE User; CREATE RefreshToken; CREATE Category |
| 202610040001_review | CREATE AuthAttempt; ALTER CashSession |
| 202610040002_sessions | ALTER User; ALTER RefreshToken; CREATE AuthSession; CREATE AuthSession_userId_idx |
| 202610040003_finance | ALTER Sale; ALTER Payment; ALTER CreditNote; ALTER SaleReturn |
| 202610040004_negative_stock | ALTER Variant |
| 202610040005_round2 | ALTER Customer; ALTER CreditNote |
| 202610040006_round3 | ALTER GoodsReceipt; ALTER AuditLog; ALTER AuthSession; CREATE Terminal |
| 202610040007_commit_events | NO ENCONTRADO |
| 202610050001_round4_claude | ALTER Terminal; ALTER GoodsReceipt; CREATE GoodsReceipt_supplierId_createdAt_idx; ALTER InventoryMovement |
| 202610050002_lot_index | CREATE InventoryMovement_lotId_idx |
| 202610060001_round6_audit | ALTER Terminal |
| 202610070001_round7 | NO ENCONTRADO |
| 202610090001_r9_caja | ALTER Quote |
| 202610100001_tienda_caja | ALTER Terminal; ALTER User; ALTER CashSession |
| 202610100101_mercancia_recepciones | ALTER PurchaseOrder; ALTER PurchaseItem; ALTER GoodsReceipt |
| 202610110001_r9_a01_devolucion_idempotente | ALTER SaleReturn |
| 202610110002_r9_a05_merma_devolucion | ALTER SaleReturn |
| 202610110003_r9_a03_total_factura | ALTER GoodsReceipt |
| 202610120001_usernames | ALTER User |
| 202610130001_password_change_required | ALTER User |
| 202610130002_discount_audit | ALTER Sale |
| 202610140001_lot_identity | ALTER Lot |
| 202610150001_customer_erasure_permission | NO ENCONTRADO |
| 202610150002_remove_customer_birthday | ALTER Customer |
| 202610160001_sale_tax_included_snapshot | ALTER Sale |
| 202610160002_lot_identity_reconciliation | CREATE IF; ALTER Lot; ALTER SaleItem |
| 202610160003_customer_anonymized_at | ALTER Customer |
| 202610170001_perf_indexes | CREATE IF |
| 202610170001_variant_code_unique | CREATE nadie |
| 202610180001_notification_outbox | CREATE IF |
| 202610190001_incentives | ALTER Sale; ALTER Quote; CREATE IF |
| 202610190001_sale_item_promotion_name | ALTER SaleItem |
| 202610200001_perf_indexes_links | CREATE CONCURRENTLY; CREATE IF |
| 202610200101_drive_backup | CREATE IF |
| 202610200201_auth_attempt_window | ALTER AuthAttempt |
| 202610210001_datos_indices | CREATE CONCURRENTLY; CREATE IF |
| 202610210002_datos_restricciones | NO ENCONTRADO |
| 202610210003_datos_privacidad | ALTER AuthAttempt |
| 202610210004_dinero_idempotencia | ALTER CashMovement; ALTER SupplierPayment; ALTER Expense |
| 202610220001_validar_restricciones | NO ENCONTRADO |
| 202610220101_seg_clave_temporal | ALTER User |
| 202610230101_alertas_indices | CREATE IF |
| 202610240101_caja_por_usuario | CREATE IF |
| 202610240201_credito_cobros | ALTER Sale; ALTER Payment |
| 202610240301_sale_void_requests | CREATE SaleVoidRequest; CREATE SaleVoidRequest_branchId_status_requestedAt_idx; CREATE SaleVoidRequest_saleId_idx; CREATE SaleVoidRequest_requestedById_requestedAt_idx |
| 202610240401_warehouses | CREATE Warehouse; CREATE VariantStock; CREATE VariantStock_warehouseId_idx; CREATE LotStock |
| 202610240501_credit_allocation_operation | CREATE CreditAllocationOperation; CREATE CreditAllocationOperation_branchId_customerId_createdAt_idx |
| 202610250001_courier_fee | ALTER Sale; CREATE IF |
| 202610250101_auth_attempt_updated_at | ALTER AuthAttempt |
| 202610250102_category_expiry_requires_lot | NO ENCONTRADO |
| 202610250201_receivable_kind | ALTER Sale |
| 202610250301_pago_dolares | ALTER Payment |
| 202610250401_courier_name_sin_default | ALTER Sale |
| 202610260901_gv | CREATE IF |
| 202610260902_gv_citas | CREATE IF; ALTER GvPayment |
| 202610260903_gv_auditoria | ALTER GvEnrollment; ALTER GvAppointment; ALTER GvPayment |
| 202610310001_cashier_survey | CREATE IF; ALTER CashierSurvey |
| 202610310002_gv_pago_completo | ALTER GvPayment |
