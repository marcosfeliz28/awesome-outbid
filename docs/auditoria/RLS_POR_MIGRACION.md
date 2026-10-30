# Migraciones: tablas creadas vs RLS habilitado (tarea 92)

**Inventario, no conclusión de seguridad.** Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/cola-b14-resto`. Por migración en `apps/api/prisma/migrations/*/migration.sql`: número de `CREATE TABLE` y de `ENABLE ROW LEVEL SECURITY`, con `grep -c`.

| Migración | CREATE TABLE | ENABLE ROW LEVEL SECURITY |
|---|---|---|
| `202610030001_initial` | 33 | 0 |
| `202610040001_review` | 1 | 0 |
| `202610040002_sessions` | 1 | 0 |
| `202610040003_finance` | 0 | 0 |
| `202610040004_negative_stock` | 0 | 0 |
| `202610040005_round2` | 0 | 0 |
| `202610040006_round3` | 7 | 0 |
| `202610040007_commit_events` | 0 | 0 |
| `202610050001_round4_claude` | 0 | 0 |
| `202610050002_lot_index` | 0 | 0 |
| `202610060001_round6_audit` | 0 | 0 |
| `202610070001_round7` | 0 | 0 |
| `202610090001_r9_caja` | 0 | 0 |
| `202610100001_tienda_caja` | 0 | 0 |
| `202610100101_mercancia_recepciones` | 0 | 0 |
| `202610110001_r9_a01_devolucion_idempotente` | 0 | 0 |
| `202610110002_r9_a05_merma_devolucion` | 0 | 0 |
| `202610110003_r9_a03_total_factura` | 0 | 0 |
| `202610120001_usernames` | 0 | 0 |
| `202610130001_password_change_required` | 0 | 0 |
| `202610130002_discount_audit` | 0 | 0 |
| `202610140001_lot_identity` | 0 | 0 |
| `202610150001_customer_erasure_permission` | 0 | 0 |
| `202610150002_remove_customer_birthday` | 0 | 0 |
| `202610160001_sale_tax_included_snapshot` | 0 | 0 |
| `202610160002_lot_identity_reconciliation` | 1 | 0 |
| `202610160003_customer_anonymized_at` | 0 | 0 |
| `202610170001_perf_indexes` | 0 | 0 |
| `202610170001_variant_code_unique` | 0 | 0 |
| `202610180001_notification_outbox` | 1 | 0 |
| `202610190001_incentives` | 4 | 0 |
| `202610190001_sale_item_promotion_name` | 0 | 0 |
| `202610200001_perf_indexes_links` | 0 | 0 |
| `202610200101_drive_backup` | 1 | 0 |
| `202610200201_auth_attempt_window` | 0 | 0 |
| `202610210001_datos_indices` | 0 | 0 |
| `202610210002_datos_restricciones` | 0 | 0 |
| `202610210003_datos_privacidad` | 0 | 0 |
| `202610210004_dinero_idempotencia` | 0 | 0 |
| `202610220001_validar_restricciones` | 0 | 0 |
| `202610220101_seg_clave_temporal` | 0 | 0 |
| `202610230101_alertas_indices` | 0 | 0 |
| `202610240101_caja_por_usuario` | 0 | 0 |
| `202610240201_credito_cobros` | 0 | 0 |
| `202610240301_sale_void_requests` | 1 | 0 |
| `202610240401_warehouses` | 5 | 0 |
| `202610240501_credit_allocation_operation` | 1 | 0 |
| `202610250001_courier_fee` | 2 | 0 |
| `202610250101_auth_attempt_updated_at` | 0 | 0 |
| `202610250102_category_expiry_requires_lot` | 0 | 0 |
| `202610250201_receivable_kind` | 0 | 0 |
| `202610250301_pago_dolares` | 0 | 0 |
| `202610250401_courier_name_sin_default` | 0 | 0 |
| `202610260001_product_tenant` | 1 | 2 |
| `202610270001_product_tenant_slug` | 0 | 0 |
| `202610270002_product_tenant_unique` | 0 | 0 |
| `202610280001_product_registration` | 0 | 0 |
| `202610280003_product_tenant_lifecycle` | 1 | 1 |
| `202610280004_product_billing` | 2 | 2 |
| `202610280005_product_legal_acceptance` | 0 | 0 |
| `202610280006_product_cash_quota` | 0 | 0 |
| `202610280007_product_objects` | 1 | 1 |
| `202610280011_product_expense_documents` | 0 | 0 |
| `202610280012_product_object_schema_alignment` | 0 | 0 |
| `202610280013_pc13_ncf_sequence` | 1 | 1 |
| `202610280014_pc24_ai_pack_credit` | 1 | 1 |
| `202610280015_n15_mcp_oauth` | 1 | 1 |
| `202610280016_product_support_access` | 0 | 0 |
| `202610280023_pc23_platform_payment` | 1 | 1 |
| `202610280024_product_base_roles_customer` | 0 | 0 |
| `202610280025_ia08_ai_pack_reference` | 0 | 0 |
| `202610290001_sold_by_unit` | 0 | 0 |
| `202610290002_platform_payment_void` | 0 | 0 |
| `202610300001_ncf_coherencia` | 0 | 0 |
| `202610300002_pla02_platform_payment_operation` | 0 | 0 |
| `202610310001_cashier_survey` | 1 | 1 |
| `202611010001_tenant_fk_indice` | 0 | 0 |
| `202611020001_pc23_payment_reference_unique` | 0 | 0 |
| `202611030001_pc23_reference_space_class` | 0 | 0 |
| `202611040001_pc23_payment_previous_state` | 0 | 0 |
| `202611050001_change_requests` | 1 | 1 |

## Tablas creadas sin ENABLE ROW LEVEL SECURITY en la misma migración

| Migración | Tabla |
|---|---|
| `202610030001_initial` | `Alert` |
| `202610030001_initial` | `AlertRule` |
| `202610030001_initial` | `AuditLog` |
| `202610030001_initial` | `Brand` |
| `202610030001_initial` | `CashMovement` |
| `202610030001_initial` | `CashSession` |
| `202610030001_initial` | `Category` |
| `202610030001_initial` | `Counter` |
| `202610030001_initial` | `CreditNote` |
| `202610030001_initial` | `Customer` |
| `202610030001_initial` | `Expense` |
| `202610030001_initial` | `ExpenseCategory` |
| `202610030001_initial` | `GoodsReceipt` |
| `202610030001_initial` | `InventoryCount` |
| `202610030001_initial` | `InventoryMovement` |
| `202610030001_initial` | `KitComponent` |
| `202610030001_initial` | `Lot` |
| `202610030001_initial` | `Payment` |
| `202610030001_initial` | `Product` |
| `202610030001_initial` | `Promotion` |
| `202610030001_initial` | `PurchaseItem` |
| `202610030001_initial` | `PurchaseOrder` |
| `202610030001_initial` | `Quote` |
| `202610030001_initial` | `RefreshToken` |
| `202610030001_initial` | `Role` |
| `202610030001_initial` | `Sale` |
| `202610030001_initial` | `SaleItem` |
| `202610030001_initial` | `SaleReturn` |
| `202610030001_initial` | `Settings` |
| `202610030001_initial` | `Supplier` |
| `202610030001_initial` | `SupplierPayment` |
| `202610030001_initial` | `User` |
| `202610030001_initial` | `Variant` |
| `202610040001_review` | `AuthAttempt` |
| `202610040002_sessions` | `AuthSession` |
| `202610040006_round3` | `InvoiceAttachment` |
| `202610040006_round3` | `InvoiceDraft` |
| `202610040006_round3` | `MerchandiseOperation` |
| `202610040006_round3` | `RealtimeEvent` |
| `202610040006_round3` | `SupplierCode` |
| `202610040006_round3` | `SupplierImportProfile` |
| `202610040006_round3` | `Terminal` |
| `202610160002_lot_identity_reconciliation` | `LotIdentityConflict` |
| `202610180001_notification_outbox` | `NotificationOutbox` |
| `202610190001_incentives` | `IncentiveEntry` |
| `202610190001_incentives` | `IncentivePeriodClose` |
| `202610190001_incentives` | `IncentiveRate` |
| `202610190001_incentives` | `IncentiveSettlement` |
| `202610200101_drive_backup` | `DriveBackup` |
| `202610240301_sale_void_requests` | `SaleVoidRequest` |
| `202610240401_warehouses` | `LotStock` |
| `202610240401_warehouses` | `StockTransfer` |
| `202610240401_warehouses` | `StockTransferLine` |
| `202610240401_warehouses` | `VariantStock` |
| `202610240401_warehouses` | `Warehouse` |
| `202610240501_credit_allocation_operation` | `CreditAllocationOperation` |
| `202610250001_courier_fee` | `CourierPayout` |
| `202610250001_courier_fee` | `CourierPayoutItem` |
| `202610260001_product_tenant` | `Tenant` |
| `202610280003_product_tenant_lifecycle` | `TenantLifecycleNotice` |
| `202610280004_product_billing` | `BillingDecision` |
| `202610280004_product_billing` | `BillingRequest` |
| `202610280007_product_objects` | `TenantObjectDeletion` |
| `202610280013_pc13_ncf_sequence` | `NcfSequence` |
| `202610280014_pc24_ai_pack_credit` | `AiPackCredit` |
| `202610280015_n15_mcp_oauth` | `McpAuthorizationCode` |
| `202610280023_pc23_platform_payment` | `PlatformPayment` |
| `202610310001_cashier_survey` | `CashierSurvey` |
| `202611050001_change_requests` | `ChangeRequest` |
