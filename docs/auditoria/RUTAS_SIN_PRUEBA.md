Borrador sin verificar, hecho por script (solo lectura). Fecha: 2026-10-29. Fuente: apps/api/src/*.ts (decoradores de ruta) y tests/ (origin/producto-nexora).

PARCIAL: el prefijo de cada controlador no se resuelve; se compara el literal del decorador.

| Módulo | Ruta literal | ¿Nombrada en tests? |
|---|---|---|
| apps/api/src/admin.ts | `customers` | nombrada en tests |
| apps/api/src/admin.ts | `customers` | nombrada en tests |
| apps/api/src/admin.ts | `customers/:id` | nombrada en tests |
| apps/api/src/admin.ts | `customers/:id/anonymize` | no nombrada |
| apps/api/src/admin.ts | `suppliers` | nombrada en tests |
| apps/api/src/admin.ts | `suppliers` | nombrada en tests |
| apps/api/src/admin.ts | `supplier-payments` | nombrada en tests |
| apps/api/src/admin.ts | `expense-categories` | nombrada en tests |
| apps/api/src/admin.ts | `expense-categories` | nombrada en tests |
| apps/api/src/admin.ts | `expense-categories/:id` | nombrada en tests |
| apps/api/src/admin.ts | `expenses` | nombrada en tests |
| apps/api/src/admin.ts | `expenses` | nombrada en tests |
| apps/api/src/admin.ts | `expenses/:id/void` | no nombrada |
| apps/api/src/admin.ts | `quotes` | nombrada en tests |
| apps/api/src/admin.ts | `quotes` | nombrada en tests |
| apps/api/src/admin.ts | `quotes/:id/convert` | no nombrada |
| apps/api/src/admin.ts | `settings` | nombrada en tests |
| apps/api/src/admin.ts | `settings` | nombrada en tests |
| apps/api/src/admin.ts | `settings/usd-rate/confirm` | nombrada en tests |
| apps/api/src/admin.ts | `settings/logo` | nombrada en tests |
| apps/api/src/admin.ts | `terminals/:id/register` | no nombrada |
| apps/api/src/admin.ts | `staff` | nombrada en tests |
| apps/api/src/admin.ts | `users` | nombrada en tests |
| apps/api/src/admin.ts | `users` | nombrada en tests |
| apps/api/src/admin.ts | `users/:id` | nombrada en tests |
| apps/api/src/admin.ts | `users/:id/reset-password` | no nombrada |
| apps/api/src/admin.ts | `roles` | nombrada en tests |
| apps/api/src/admin.ts | `roles/:id` | nombrada en tests |
| apps/api/src/admin.ts | `audit-log` | nombrada en tests |
| apps/api/src/admin.ts | `promotions` | nombrada en tests |
| apps/api/src/admin.ts | `promotions` | nombrada en tests |
| apps/api/src/admin.ts | `promotions/:id` | nombrada en tests |
| apps/api/src/alerts.ts | `alerts` | nombrada en tests |
| apps/api/src/alerts.ts | `alerts/:id` | nombrada en tests |
| apps/api/src/alerts.ts | `promotions/clearance-candidates` | nombrada en tests |
| apps/api/src/alerts.ts | `alert-rules` | nombrada en tests |
| apps/api/src/alerts.ts | `alert-rules` | nombrada en tests |
| apps/api/src/alerts.ts | `alerts/evaluate` | nombrada en tests |
| apps/api/src/app.ts | `health/live` | nombrada en tests |
| apps/api/src/assistant.ts | `usage` | nombrada en tests |
| apps/api/src/assistant.ts | `ask` | nombrada en tests |
| apps/api/src/auth.ts | `login` | nombrada en tests |
| apps/api/src/auth.ts | `change-password` | nombrada en tests |
| apps/api/src/auth.ts | `password` | nombrada en tests |
| apps/api/src/auth.ts | `refresh` | nombrada en tests |
| apps/api/src/auth.ts | `logout` | nombrada en tests |
| apps/api/src/auth.ts | `me` | no nombrada |
| apps/api/src/auth.ts | `pin` | nombrada en tests |
| apps/api/src/cash.ts | `drawer-open/automatic` | nombrada en tests |
| apps/api/src/cash.ts | `drawer-open/automatic/sent` | nombrada en tests |
| apps/api/src/cash.ts | `drawer-open` | nombrada en tests |
| apps/api/src/cash.ts | `open` | nombrada en tests |
| apps/api/src/cash.ts | `:id/movements` | nombrada en tests |
| apps/api/src/cash.ts | `:id/transfer` | nombrada en tests |
| apps/api/src/cash.ts | `:id/close` | nombrada en tests |
| apps/api/src/cash.ts | `opening-suggestion` | nombrada en tests |
| apps/api/src/cash.ts | `:id/descuadre` | nombrada en tests |
| apps/api/src/cash.ts | `:id/cuadre` | nombrada en tests |
| apps/api/src/cash.ts | `:id/reports/:name` | nombrada en tests |
| apps/api/src/cashier-survey.ts | `mine` | nombrada en tests |
| apps/api/src/cashier-survey.ts | `mine` | nombrada en tests |
| apps/api/src/cashier-survey.ts | `summary` | nombrada en tests |
| apps/api/src/catalog.ts | `catalog-template.xlsx` | nombrada en tests |
| apps/api/src/catalog.ts | `categories` | nombrada en tests |
| apps/api/src/catalog.ts | `categories` | nombrada en tests |
| apps/api/src/catalog.ts | `brands` | nombrada en tests |
| apps/api/src/catalog.ts | `brands` | nombrada en tests |
| apps/api/src/catalog.ts | `products` | nombrada en tests |
| apps/api/src/catalog.ts | `products/:id` | nombrada en tests |
| apps/api/src/catalog.ts | `products` | nombrada en tests |
| apps/api/src/catalog.ts | `products/:id` | nombrada en tests |
| apps/api/src/catalog.ts | `products/:id/variants` | no nombrada |
| apps/api/src/catalog.ts | `variants/:id` | nombrada en tests |
| apps/api/src/catalog.ts | `products/import` | nombrada en tests |
| apps/api/src/catalog.ts | `kits` | nombrada en tests |
| apps/api/src/catalog.ts | `kits/:productId` | nombrada en tests |
| apps/api/src/courier.ts | `sales/:id/courier` | no nombrada |
| apps/api/src/courier.ts | `courier/pending` | nombrada en tests |
| apps/api/src/courier.ts | `courier/payouts` | nombrada en tests |
| apps/api/src/courier.ts | `courier/payouts` | nombrada en tests |
| apps/api/src/drive-backup.ts | `status` | nombrada en tests |
| apps/api/src/drive-backup.ts | `run` | nombrada en tests |
| apps/api/src/drive-backup.ts | `google/connect` | nombrada en tests |
| apps/api/src/drive-backup.ts | `google/disconnect` | nombrada en tests |
| apps/api/src/drive-backup.ts | `google/callback` | nombrada en tests |
| apps/api/src/formal-report.ts | `reports/formal` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives/me` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives/rates` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives/rates` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives/close` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives/export.xlsx` | nombrada en tests |
| apps/api/src/incentives.ts | `incentives/receipt.pdf` | nombrada en tests |
| apps/api/src/income-report.ts | `reports/income-by-day` | nombrada en tests |
| apps/api/src/inventory-import.ts | `inventory-import/casa/preview` | nombrada en tests |
| apps/api/src/inventory-import.ts | `inventory-import/casa/apply` | nombrada en tests |
| apps/api/src/inventory-import.ts | `inventory-import/preview` | nombrada en tests |
| apps/api/src/inventory-import.ts | `inventory-import/apply` | nombrada en tests |
| apps/api/src/inventory.ts | `inventory/stock` | nombrada en tests |
| apps/api/src/inventory.ts | `inventory/movements` | nombrada en tests |
| apps/api/src/inventory.ts | `inventory/adjustments` | nombrada en tests |
| apps/api/src/inventory.ts | `purchase-orders` | nombrada en tests |
| apps/api/src/inventory.ts | `purchase-orders` | nombrada en tests |
| apps/api/src/inventory.ts | `purchase-orders/:id/document` | no nombrada |
| apps/api/src/inventory.ts | `purchase-orders/:id/receive` | no nombrada |
| apps/api/src/inventory.ts | `goods-receipts` | nombrada en tests |
| apps/api/src/inventory.ts | `goods-receipts/export` | nombrada en tests |
| apps/api/src/inventory.ts | `goods-receipts/:id` | nombrada en tests |
| apps/api/src/inventory.ts | `goods-receipts/:id/document` | no nombrada |
| apps/api/src/inventory.ts | `inventory/counts` | nombrada en tests |
| apps/api/src/inventory.ts | `inventory/counts` | nombrada en tests |
| apps/api/src/inventory.ts | `inventory/counts/:id/apply` | no nombrada |
| apps/api/src/mcp.ts | `oauth/metadata` | nombrada en tests |
| apps/api/src/mcp.ts | `oauth/client` | nombrada en tests |
| apps/api/src/mcp.ts | `oauth/authorize` | nombrada en tests |
| apps/api/src/mcp.ts | `oauth/token` | nombrada en tests |
| apps/api/src/merchandise.ts | `merchandise/options` | nombrada en tests |
| apps/api/src/merchandise.ts | `merchandise/profiles/:id` | nombrada en tests |
| apps/api/src/merchandise.ts | `merchandise/attachments/:id` | nombrada en tests |
| apps/api/src/merchandise.ts | `merchandise/import` | nombrada en tests |
| apps/api/src/merchandise.ts | `merchandise/operations` | nombrada en tests |
| apps/api/src/merchandise.ts | `merchandise/operations` | nombrada en tests |
| apps/api/src/ncf-sequences.ts | `:id` | no nombrada |
| apps/api/src/notifications.ts | `telegram/test` | nombrada en tests |
| apps/api/src/notifications.ts | `status` | nombrada en tests |
| apps/api/src/offline-sale-review.ts | `sales/offline-review/discard` | nombrada en tests |
| apps/api/src/offline-sales.ts | `sales/offline-resolution` | nombrada en tests |
| apps/api/src/onboarding.ts | `profile` | nombrada en tests |
| apps/api/src/platform-ai-packs.ts | `tenants/:slug/ai-packs` | no nombrada |
| apps/api/src/platform-ai-packs.ts | `tenants/:slug/ai-usage` | no nombrada |
| apps/api/src/platform-billing.ts | `tenants/:slug/payments` | no nombrada |
| apps/api/src/platform-billing.ts | `tenants/:slug/payments/:id/void` | no nombrada |
| apps/api/src/platform-billing.ts | `tenants/:slug/payments` | no nombrada |
| apps/api/src/platform.ts | `tenants` | nombrada en tests |
| apps/api/src/platform.ts | `tenants` | nombrada en tests |
| apps/api/src/platform.ts | `summary` | nombrada en tests |
| apps/api/src/platform.ts | `tenants/:slug` | nombrada en tests |
| apps/api/src/platform.ts | `tenants/:slug/password-reset` | no nombrada |
| apps/api/src/platform.ts | `tenants/:slug/reinvite` | no nombrada |
| apps/api/src/platform.ts | `tenants/:slug/revoke-invitation` | no nombrada |
| apps/api/src/product-billing.ts | `plans` | nombrada en tests |
| apps/api/src/product-billing.ts | `providers` | nombrada en tests |
| apps/api/src/product-billing.ts | `requests` | nombrada en tests |
| apps/api/src/product-billing.ts | `requests` | nombrada en tests |
| apps/api/src/product-billing.ts | `requests/:id/proof` | no nombrada |
| apps/api/src/product-billing.ts | `requests/:id/proof` | no nombrada |
| apps/api/src/realtime.ts | `terminals/register` | nombrada en tests |
| apps/api/src/realtime.ts | `terminals/:id/approve` | no nombrada |
| apps/api/src/realtime.ts | `terminals/:id/approve-with-pin` | no nombrada |
| apps/api/src/realtime.ts | `terminals/:id/rename` | no nombrada |
| apps/api/src/realtime.ts | `terminals/current` | nombrada en tests |
| apps/api/src/realtime.ts | `terminals` | nombrada en tests |
| apps/api/src/realtime.ts | `terminals/:id/revoke` | no nombrada |
| apps/api/src/realtime.ts | `events` | nombrada en tests |
| apps/api/src/registration.ts | `register` | nombrada en tests |
| apps/api/src/registration.ts | `verify-email` | nombrada en tests |
| apps/api/src/registration.ts | `accept-invitation` | nombrada en tests |
| apps/api/src/registration.ts | `resend-verification` | nombrada en tests |
| apps/api/src/reports.ts | `dashboard/summary` | nombrada en tests |
| apps/api/src/reports.ts | `dashboard/year` | nombrada en tests |
| apps/api/src/reports.ts | `dashboard/breakdown` | nombrada en tests |
| apps/api/src/reports.ts | `reportes` | nombrada en tests |
| apps/api/src/reports.ts | `reports/:name` | nombrada en tests |
| apps/api/src/reports.ts | `sales/mine/:period` | nombrada en tests |
| apps/api/src/sales.ts | `sales` | nombrada en tests |
| apps/api/src/sales.ts | `sales/sync` | nombrada en tests |
| apps/api/src/sales.ts | `sales` | nombrada en tests |
| apps/api/src/sales.ts | `void-requests` | nombrada en tests |
| apps/api/src/sales.ts | `sales/:id/void-requests` | no nombrada |
| apps/api/src/sales.ts | `void-requests/:id/cancel` | no nombrada |
| apps/api/src/sales.ts | `void-requests/:id/reject` | no nombrada |
| apps/api/src/sales.ts | `void-requests/:id/approve` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/mark-wholesale` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/seller` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/payments/:paymentId/correct-method` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/void` | no nombrada |
| apps/api/src/sales.ts | `payments/pending-transfers` | nombrada en tests |
| apps/api/src/sales.ts | `payments/:id/verify` | no nombrada |
| apps/api/src/sales.ts | `payments/:id/correct-transfer` | no nombrada |
| apps/api/src/sales.ts | `payments/:id/reject` | no nombrada |
| apps/api/src/sales.ts | `returns` | nombrada en tests |
| apps/api/src/sales.ts | `credit-notes` | nombrada en tests |
| apps/api/src/sales.ts | `returns/:id/credit-note.pdf` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/installments` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/cod-collections` | no nombrada |
| apps/api/src/sales.ts | `payments/:id/proof` | no nombrada |
| apps/api/src/sales.ts | `payments/:id/proof` | no nombrada |
| apps/api/src/sales.ts | `credit-accounts` | nombrada en tests |
| apps/api/src/sales.ts | `credit-accounts/:id` | nombrada en tests |
| apps/api/src/sales.ts | `credit-accounts/:id/statement.pdf` | no nombrada |
| apps/api/src/sales.ts | `credit-accounts/:id/collections` | no nombrada |
| apps/api/src/sales.ts | `cod/pending` | nombrada en tests |
| apps/api/src/sales.ts | `sales/:id/credit-collections` | no nombrada |
| apps/api/src/sales.ts | `sales/:id/receipt.pdf` | no nombrada |
| apps/api/src/support-access.ts | `enable` | nombrada en tests |
| apps/api/src/support-access.ts | `disable` | nombrada en tests |
| apps/api/src/support-access.ts | `support-grants` | nombrada en tests |
| apps/api/src/support-access.ts | `tenants/:slug/support-session` | no nombrada |
| apps/api/src/tenant-export.ts | `export` | nombrada en tests |
| apps/api/src/tenant-lifecycle-controller.ts | `status` | nombrada en tests |
| apps/api/src/transfer-proof-review.ts | `:id/proof-review` | nombrada en tests |
| apps/api/src/warehouses.ts | `inventory/warehouses` | nombrada en tests |
| apps/api/src/warehouses.ts | `inventory/warehouses/:id` | nombrada en tests |
| apps/api/src/warehouses.ts | `inventory/location-report` | nombrada en tests |
| apps/api/src/warehouses.ts | `inventory/transfers` | nombrada en tests |
| apps/api/src/warehouses.ts | `inventory/transfers` | nombrada en tests |

Conteo por módulo (rutas no nombradas):
- apps/api/src/admin.ts: 5
- apps/api/src/alerts.ts: 0
- apps/api/src/app.ts: 0
- apps/api/src/assistant.ts: 0
- apps/api/src/auth.ts: 1
- apps/api/src/cash.ts: 0
- apps/api/src/cashier-survey.ts: 0
- apps/api/src/catalog.ts: 1
- apps/api/src/courier.ts: 1
- apps/api/src/drive-backup.ts: 0
- apps/api/src/formal-report.ts: 0
- apps/api/src/incentives.ts: 0
- apps/api/src/income-report.ts: 0
- apps/api/src/inventory-import.ts: 0
- apps/api/src/inventory.ts: 4
- apps/api/src/mcp.ts: 0
- apps/api/src/merchandise.ts: 0
- apps/api/src/ncf-sequences.ts: 1
- apps/api/src/notifications.ts: 0
- apps/api/src/offline-sale-review.ts: 0
- apps/api/src/offline-sales.ts: 0
- apps/api/src/onboarding.ts: 0
- apps/api/src/platform-ai-packs.ts: 2
- apps/api/src/platform-billing.ts: 3
- apps/api/src/platform.ts: 3
- apps/api/src/product-billing.ts: 2
- apps/api/src/realtime.ts: 4
- apps/api/src/registration.ts: 0
- apps/api/src/reports.ts: 0
- apps/api/src/sales.ts: 20
- apps/api/src/support-access.ts: 1
- apps/api/src/tenant-export.ts: 0
- apps/api/src/tenant-lifecycle-controller.ts: 0
- apps/api/src/transfer-proof-review.ts: 0
- apps/api/src/warehouses.ts: 0

Total de rutas: 206.
