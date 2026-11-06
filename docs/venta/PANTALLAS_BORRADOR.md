# Pantallas del web (tarea 77, orden 70)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`415f602a`), rama `claude-pc/cola-b13`. Lista de páginas: objeto `pages` (`apps/web/src/App.tsx:1345-1374`); etiqueta y permiso: arreglo `navigation` (`apps/web/src/App.tsx:242-337`). Base: `origin/nexora-cloud:docs/diseno/MAPA_PANTALLAS.md` (parcial: solo rutas con path=...). **PARCIAL**: la frase de cada fila es la etiqueta del menú; no describe el contenido de cada pantalla.

| Página (id) | Frase (etiqueta del menú) | Permiso | Componente y archivo:línea |
|---|---|---|---|
| `onboarding` | Primeros pasos | * | `Onboarding` · `apps/web/src/App.tsx:1346` |
| `billing` | Plan y facturación | * | `Billing` · `apps/web/src/App.tsx:1347` |
| `dashboard` | Resumen | reports:read | `Dashboard` · `apps/web/src/App.tsx:1348` |
| `month-report` | no está en navigation | — | `MonthReport` · `apps/web/src/App.tsx:1355` |
| `pos` | Punto de venta | sale:write | `POS` · `apps/web/src/App.tsx:1356` |
| `products` | Productos | catalog:read | `Catalog` · `apps/web/src/App.tsx:1357` |
| `inventory` | Inventario | inventory:write | `Inventory` · `apps/web/src/App.tsx:1358` |
| `purchases` | Compras | purchase:write | `Purchases` · `apps/web/src/App.tsx:1359` |
| `cash` | Caja | cash:write | `Cash` · `apps/web/src/App.tsx:1360` |
| `expenses` | Gastos | expense:write | `Expenses` · `apps/web/src/App.tsx:1361` |
| `customers` | Clientes | customers:write | `Customers` · `apps/web/src/App.tsx:1362` |
| `promotions` | Promociones | promotions:write | `Promotions` · `apps/web/src/App.tsx:1363` |
| `reports` | Reportes | reports:read | `Reports` · `apps/web/src/App.tsx:1364` |
| `alerts` | Alertas | alerts:write | `Alerts` · `apps/web/src/App.tsx:1365` |
| `settings` | no está en navigation | — | `Configuration` · `apps/web/src/App.tsx:1366` |
| `sales` | Ventas | sale:write | `SalesHistory` · `apps/web/src/App.tsx:1368` |
| `void-requests` | Solicitudes de anulación | sale:write | `VoidRequests` · `apps/web/src/App.tsx:1369` |
| `transfer-reconciliation` | Conciliar transferencias | * | `TransferReconciliation` · `apps/web/src/App.tsx:1370` |
| `courier-payouts` | Envíos del mensajero | * | `CourierPayouts` · `apps/web/src/App.tsx:1371` |
| `merchandise` | Mercancía | inventory:write | `Merchandise` · `apps/web/src/App.tsx:1372` |
| `incentives` | Incentivos | sale:manage | `IncentivesPage` · `apps/web/src/App.tsx:1373` |
