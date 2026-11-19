**Borrador sin verificar** (modelo local, orden 77, N20). **Revisión de Claude PC:** traducción de la tabla de pantallas; hereda el PARCIAL de PANTALLAS_BORRADOR.

| Page (id) | Phrase (menu label) | Permission | Component and file:line |
|---|---|---|---|
| `onboarding` | First steps | * | `Onboarding` · `apps/web/src/App.tsx:1346` |
| `billing` | Plan and billing | * | `Billing` · `apps/web/src/App.tsx:1347` |
| `dashboard` | Summary | reports:read | `Dashboard` · `apps/web/src/App.tsx:1348` |
| `month-report` | not in navigation | — | `MonthReport` · `apps/web/src/App.tsx:1355` |
| `pos` | Point of sale | sale:write | `POS` · `apps/web/src/App.tsx:1356` |
| `products` | Products | catalog:read | `Catalog` · `apps/web/src/App.tsx:1357` |
| `inventory` | Inventory | inventory:write | `Inventory` · `apps/web/src/App.tsx:1358` |
| `purchases` | Purchases | purchase:write | `Purchases` · `apps/web/src/App.tsx:1359` |
| `cash` | Cash | cash:write | `Cash` · `apps/web/src/App.tsx:1360` |
| `expenses` | Expenses | expense:write | `Expenses` · `apps/web/src/App.tsx:1361` |
| `customers` | Customers | customers:write | `Customers` · `apps/web/src/App.tsx:1362` |
| `promotions` | Promotions | promotions:write | `Promotions` · `apps/web/src/App.tsx:1363` |
| `reports` | Reports | reports:read | `Reports` · `apps/web/src/App.tsx:1364` |
| `alerts` | Alerts | alerts:write | `Alerts` · `apps/web/src/App.tsx:1365` |
| `settings` | not in navigation | — | `Configuration` · `apps/web/src/App.tsx:1366` |
| `sales` | Sales | sale:write | `SalesHistory` · `apps/web/src/App.tsx:1368` |
| `void-requests` | Void requests | sale:write | `VoidRequests` · `apps/web/src/App.tsx:1369` |
| `transfer-reconciliation` | Reconcile transfers | * | `TransferReconciliation` · `apps/web/src/App.tsx:1370` |
| `courier-payouts` | Courier payouts | * | `CourierPayouts` · `apps/web/src/App.tsx:1371` |
| `merchandise` | Merchandise | inventory:write | `Merchandise` · `apps/web/src/App.tsx:1372` |
| `incentives` | Incentives | sale:manage | `IncentivesPage` · `apps/web/src/App.tsx:1373` |

Qué hice: Traduje la tabla de pantallas al inglés, manteniendo los nombres de las rutas y archivos sin cambios.

Qué NO comprobé: No revisé el contenido de los archivos mencionados, solo traduje la tabla proporcionada.