# Rutas de la API y permisos (solo lectura)

Borrador verificado por script. PARCIAL: el @Permit se busca solo 3 líneas arriba de cada ruta; un permiso puesto a nivel de clase no se ve aquí.

| ruta | método | permiso | archivo:línea |
|---|---|---|---|
| customers | GET | SIN @Permit | apps/api/src/admin.ts:250 |
| customers | POST | SIN @Permit | apps/api/src/admin.ts:276 |
| customers/:id | PATCH | SIN @Permit | apps/api/src/admin.ts:295 |
| customers/:id/anonymize | POST | SIN @Permit | apps/api/src/admin.ts:351 |
| suppliers | GET | purchase:write | apps/api/src/admin.ts:568 |
| suppliers | POST | SIN @Permit | apps/api/src/admin.ts:576 |
| supplier-payments | POST | SIN @Permit | apps/api/src/admin.ts:587 |
| expense-categories | GET | expense:write | apps/api/src/admin.ts:643 |
| expense-categories | POST | expense:write | apps/api/src/admin.ts:646 |
| expense-categories/:id | PATCH | expense:write | apps/api/src/admin.ts:656 |
| expenses | GET | expense:write | apps/api/src/admin.ts:665 |
| expenses | POST | SIN @Permit | apps/api/src/admin.ts:675 |
| expenses/:id/void | POST | SIN @Permit | apps/api/src/admin.ts:722 |
| quotes | GET | sale:write | apps/api/src/admin.ts:739 |
| quotes | POST | sale:write | apps/api/src/admin.ts:745 |
| quotes/:id/convert | POST | SIN @Permit | apps/api/src/admin.ts:802 |
| settings | GET | catalog:read | apps/api/src/admin.ts:821 |
| settings | PUT | SIN @Permit | apps/api/src/admin.ts:839 |
| settings/logo | POST | SIN @Permit | apps/api/src/admin.ts:899 |
| terminals/:id/register | PATCH | SIN @Permit | apps/api/src/admin.ts:935 |
| staff | GET | sale:write | apps/api/src/admin.ts:1004 |
| users | GET | * | apps/api/src/admin.ts:1024 |
| users | POST | SIN @Permit | apps/api/src/admin.ts:1056 |
| users/:id | PATCH | SIN @Permit | apps/api/src/admin.ts:1111 |
| users/:id/reset-password | POST | SIN @Permit | apps/api/src/admin.ts:1228 |
| roles | GET | * | apps/api/src/admin.ts:1296 |
| roles/:id | PUT | * | apps/api/src/admin.ts:1299 |
| audit-log | GET | * | apps/api/src/admin.ts:1321 |
| promotions | GET | catalog:read | apps/api/src/admin.ts:1332 |
| promotions | POST | SIN @Permit | apps/api/src/admin.ts:1340 |
| promotions/:id | PATCH | SIN @Permit | apps/api/src/admin.ts:1386 |
| alerts | GET | alerts:write | apps/api/src/alerts.ts:841 |
| alerts/:id | PATCH | alerts:write | apps/api/src/alerts.ts:876 |
| promotions/clearance-candidates | GET | SIN @Permit | apps/api/src/alerts.ts:904 |
| alert-rules | GET | * | apps/api/src/alerts.ts:909 |
| alert-rules | PUT | * | apps/api/src/alerts.ts:912 |
| alerts/evaluate | POST | alerts:write | apps/api/src/alerts.ts:937 |
| health/live | GET | SIN @Permit | apps/api/src/app.ts:54 |
| login | POST | SIN @Permit | apps/api/src/auth.ts:421 |
| change-password | POST | SIN @Permit | apps/api/src/auth.ts:512 |
| password | POST | authenticated | apps/api/src/auth.ts:645 |
| refresh | POST | SIN @Permit | apps/api/src/auth.ts:755 |
| logout | POST | authenticated | apps/api/src/auth.ts:792 |
| me | GET | authenticated | apps/api/src/auth.ts:814 |
| pin | POST | authenticated | apps/api/src/auth.ts:824 |
| (raíz) | GET | SIN @Permit | apps/api/src/cash.ts:759 |
| open | POST | SIN @Permit | apps/api/src/cash.ts:837 |
| :id/movements | POST | SIN @Permit | apps/api/src/cash.ts:949 |
| :id/transfer | POST | SIN @Permit | apps/api/src/cash.ts:1061 |
| :id/close | POST | SIN @Permit | apps/api/src/cash.ts:1112 |
| opening-suggestion | GET | SIN @Permit | apps/api/src/cash.ts:1433 |
| :id/descuadre | POST | SIN @Permit | apps/api/src/cash.ts:1469 |
| :id/cuadre | GET | SIN @Permit | apps/api/src/cash.ts:1512 |
| :id/reports/:name | GET | SIN @Permit | apps/api/src/cash.ts:1543 |
| mine | GET | SIN @Permit | apps/api/src/cashier-survey.ts:12 |
| mine | POST | SIN @Permit | apps/api/src/cashier-survey.ts:21 |
| summary | GET | SIN @Permit | apps/api/src/cashier-survey.ts:38 |
| catalog-template.xlsx | GET | SIN @Permit | apps/api/src/catalog.ts:195 |
| categories | GET | SIN @Permit | apps/api/src/catalog.ts:231 |
| categories | POST | SIN @Permit | apps/api/src/catalog.ts:236 |
| brands | GET | SIN @Permit | apps/api/src/catalog.ts:260 |
| brands | POST | SIN @Permit | apps/api/src/catalog.ts:265 |
| products | GET | SIN @Permit | apps/api/src/catalog.ts:272 |
| products/:id | GET | SIN @Permit | apps/api/src/catalog.ts:346 |
| products | POST | SIN @Permit | apps/api/src/catalog.ts:377 |
| products/:id | PATCH | SIN @Permit | apps/api/src/catalog.ts:407 |
| products/:id/variants | POST | SIN @Permit | apps/api/src/catalog.ts:431 |
| variants/:id | PATCH | SIN @Permit | apps/api/src/catalog.ts:495 |
| products/import | POST | SIN @Permit | apps/api/src/catalog.ts:587 |
| kits | POST | SIN @Permit | apps/api/src/catalog.ts:651 |
| sales/:id/courier | PATCH | SIN @Permit | apps/api/src/courier.ts:67 |
| courier/pending | GET | SIN @Permit | apps/api/src/courier.ts:119 |
| courier/payouts | GET | SIN @Permit | apps/api/src/courier.ts:161 |
| courier/payouts | POST | SIN @Permit | apps/api/src/courier.ts:196 |
| status | GET | SIN @Permit | apps/api/src/drive-backup.ts:1441 |
| run | POST | SIN @Permit | apps/api/src/drive-backup.ts:1447 |
| google/connect | GET | SIN @Permit | apps/api/src/drive-backup.ts:1465 |
| google/disconnect | POST | SIN @Permit | apps/api/src/drive-backup.ts:1474 |
| google/callback | GET | SIN @Permit | apps/api/src/drive-backup.ts:1482 |
| reports/formal | GET | SIN @Permit | apps/api/src/formal-report.ts:42 |
| appointments | GET | SIN @Permit | apps/api/src/gv-citas.ts:316 |
| appointments/:id | GET | SIN @Permit | apps/api/src/gv-citas.ts:349 |
| appointments | POST | SIN @Permit | apps/api/src/gv-citas.ts:365 |
| appointments/:id | PATCH | SIN @Permit | apps/api/src/gv-citas.ts:407 |
| appointments/:id/payments | POST | SIN @Permit | apps/api/src/gv-citas.ts:451 |
| leads | GET | SIN @Permit | apps/api/src/gv-citas.ts:476 |
| leads | POST | SIN @Permit | apps/api/src/gv-citas.ts:493 |
| leads/:id | PATCH | SIN @Permit | apps/api/src/gv-citas.ts:532 |
| courses | GET | SIN @Permit | apps/api/src/gv.ts:150 |
| courses | POST | SIN @Permit | apps/api/src/gv.ts:192 |
| courses/:id | PATCH | SIN @Permit | apps/api/src/gv.ts:218 |
| courses/:id | GET | SIN @Permit | apps/api/src/gv.ts:245 |
| enrollments | POST | SIN @Permit | apps/api/src/gv.ts:284 |
| enrollments/:id | PATCH | SIN @Permit | apps/api/src/gv.ts:329 |
| payments | POST | SIN @Permit | apps/api/src/gv.ts:372 |
| banks | GET | SIN @Permit | apps/api/src/gv.ts:385 |
| payments/:id/void | POST | SIN @Permit | apps/api/src/gv.ts:395 |
| payments/:id/review | POST | SIN @Permit | apps/api/src/gv.ts:447 |
| reports | GET | SIN @Permit | apps/api/src/gv.ts:519 |
| transfers/pending | GET | SIN @Permit | apps/api/src/gv.ts:660 |
| import | POST | SIN @Permit | apps/api/src/gv.ts:692 |
| incentives | GET | SIN @Permit | apps/api/src/incentives.ts:743 |
| incentives/me | GET | SIN @Permit | apps/api/src/incentives.ts:754 |
| incentives/rates | GET | SIN @Permit | apps/api/src/incentives.ts:777 |
| incentives/rates | PUT | SIN @Permit | apps/api/src/incentives.ts:800 |
| incentives/close | POST | SIN @Permit | apps/api/src/incentives.ts:852 |
| incentives/export.xlsx | GET | SIN @Permit | apps/api/src/incentives.ts:926 |
| incentives/receipt.pdf | GET | SIN @Permit | apps/api/src/incentives.ts:1021 |
| reports/income-by-day | GET | SIN @Permit | apps/api/src/income-report.ts:292 |
| inventory-import/casa/preview | POST | SIN @Permit | apps/api/src/inventory-import.ts:314 |
| inventory-import/casa/apply | POST | SIN @Permit | apps/api/src/inventory-import.ts:346 |
| inventory-import/preview | POST | SIN @Permit | apps/api/src/inventory-import.ts:497 |
| inventory-import/apply | POST | SIN @Permit | apps/api/src/inventory-import.ts:559 |
| inventory/stock | GET | SIN @Permit | apps/api/src/inventory.ts:581 |
| inventory/movements | GET | SIN @Permit | apps/api/src/inventory.ts:618 |
| inventory/adjustments | POST | SIN @Permit | apps/api/src/inventory.ts:637 |
| purchase-orders | GET | SIN @Permit | apps/api/src/inventory.ts:954 |
| purchase-orders | POST | SIN @Permit | apps/api/src/inventory.ts:966 |
| purchase-orders/:id/document | PATCH | SIN @Permit | apps/api/src/inventory.ts:1015 |
| purchase-orders/:id/receive | POST | SIN @Permit | apps/api/src/inventory.ts:1039 |
| goods-receipts | GET | SIN @Permit | apps/api/src/inventory.ts:1337 |
| goods-receipts/export | GET | SIN @Permit | apps/api/src/inventory.ts:1360 |
| goods-receipts/:id | GET | SIN @Permit | apps/api/src/inventory.ts:1441 |
| goods-receipts/:id/document | PATCH | SIN @Permit | apps/api/src/inventory.ts:1452 |
| inventory/counts | GET | inventory:write | apps/api/src/inventory.ts:1487 |
| inventory/counts | POST | SIN @Permit | apps/api/src/inventory.ts:1495 |
| inventory/counts/:id/apply | POST | SIN @Permit | apps/api/src/inventory.ts:1550 |
| merchandise/options | GET | SIN @Permit | apps/api/src/merchandise.ts:160 |
| merchandise/profiles/:id | GET | SIN @Permit | apps/api/src/merchandise.ts:166 |
| merchandise/attachments/:id | GET | SIN @Permit | apps/api/src/merchandise.ts:179 |
| merchandise/import | POST | SIN @Permit | apps/api/src/merchandise.ts:194 |
| merchandise/operations | GET | SIN @Permit | apps/api/src/merchandise.ts:330 |
| merchandise/operations | POST | SIN @Permit | apps/api/src/merchandise.ts:341 |
| telegram/test | POST | SIN @Permit | apps/api/src/notifications.ts:1034 |
| status | GET | SIN @Permit | apps/api/src/notifications.ts:1059 |
| sales/offline-review/discard | POST | SIN @Permit | apps/api/src/offline-sale-review.ts:90 |
| sales/offline-resolution | POST | SIN @Permit | apps/api/src/offline-sales.ts:40 |
| terminals/register | POST | authenticated | apps/api/src/realtime.ts:160 |
| terminals/:id/approve | POST | SIN @Permit | apps/api/src/realtime.ts:257 |
| terminals/:id/approve-with-pin | POST | authenticated | apps/api/src/realtime.ts:264 |
| terminals/:id/rename | POST | authenticated | apps/api/src/realtime.ts:324 |
| terminals/current | GET | authenticated | apps/api/src/realtime.ts:359 |
| terminals | GET | SIN @Permit | apps/api/src/realtime.ts:367 |
| terminals/:id/revoke | POST | SIN @Permit | apps/api/src/realtime.ts:415 |
| events | GET | SIN @Permit | apps/api/src/realtime.ts:433 |
| dashboard/summary | GET | SIN @Permit | apps/api/src/reports.ts:235 |
| dashboard/year | GET | SIN @Permit | apps/api/src/reports.ts:553 |
| dashboard/breakdown | GET | SIN @Permit | apps/api/src/reports.ts:603 |
| reportes | GET | SIN @Permit | apps/api/src/reports.ts:684 |
| reports/:name | GET | SIN @Permit | apps/api/src/reports.ts:692 |
| sales/mine/:period | GET | SIN @Permit | apps/api/src/reports.ts:1356 |
| sales | POST | sale:write | apps/api/src/sales.ts:1475 |
| sales/sync | POST | SIN @Permit | apps/api/src/sales.ts:1481 |
| sales | GET | SIN @Permit | apps/api/src/sales.ts:1667 |
| void-requests | GET | SIN @Permit | apps/api/src/sales.ts:1819 |
| sales/:id/void-requests | POST | SIN @Permit | apps/api/src/sales.ts:1868 |
| void-requests/:id/cancel | POST | SIN @Permit | apps/api/src/sales.ts:1957 |
| void-requests/:id/reject | POST | SIN @Permit | apps/api/src/sales.ts:2007 |
| void-requests/:id/approve | POST | SIN @Permit | apps/api/src/sales.ts:2064 |
| sales/:id/mark-wholesale | POST | SIN @Permit | apps/api/src/sales.ts:2098 |
| sales/:id/seller | POST | SIN @Permit | apps/api/src/sales.ts:2147 |
| sales/:id/payments/:paymentId/correct-method | POST | SIN @Permit | apps/api/src/sales.ts:2198 |
| sales/:id/void | POST | SIN @Permit | apps/api/src/sales.ts:2405 |
| payments/pending-transfers | GET | SIN @Permit | apps/api/src/sales.ts:2674 |
| payments/:id/verify | POST | SIN @Permit | apps/api/src/sales.ts:2785 |
| payments/:id/unverify | POST | SIN @Permit | apps/api/src/sales.ts:2849 |
| payments/:id/move-cash-session | POST | SIN @Permit | apps/api/src/sales.ts:2942 |
| payments/:id/correct-transfer | POST | SIN @Permit | apps/api/src/sales.ts:3038 |
| payments/:id/reject | POST | SIN @Permit | apps/api/src/sales.ts:3111 |
| returns | POST | SIN @Permit | apps/api/src/sales.ts:3223 |
| credit-notes | GET | SIN @Permit | apps/api/src/sales.ts:3651 |
| returns/:id/credit-note.pdf | GET | SIN @Permit | apps/api/src/sales.ts:3695 |
| sales/:id/installments | POST | SIN @Permit | apps/api/src/sales.ts:3753 |
| sales/:id/cod-collections | POST | SIN @Permit | apps/api/src/sales.ts:3768 |
| payments/:id/proof | POST | SIN @Permit | apps/api/src/sales.ts:3782 |
| payments/:id/proof | GET | SIN @Permit | apps/api/src/sales.ts:3822 |
| credit-accounts | GET | SIN @Permit | apps/api/src/sales.ts:3859 |
| credit-accounts/:id | GET | SIN @Permit | apps/api/src/sales.ts:4011 |
| credit-accounts/:id/statement.pdf | GET | SIN @Permit | apps/api/src/sales.ts:4018 |
| credit-accounts/:id/collections | POST | SIN @Permit | apps/api/src/sales.ts:4083 |
| cod/pending | GET | SIN @Permit | apps/api/src/sales.ts:4237 |
| sales/:id/credit-collections | POST | SIN @Permit | apps/api/src/sales.ts:4407 |
| sales/:id/receipt.pdf | GET | SIN @Permit | apps/api/src/sales.ts:4676 |
| inventory/warehouses | GET | SIN @Permit | apps/api/src/warehouses.ts:45 |
| inventory/location-report | GET | SIN @Permit | apps/api/src/warehouses.ts:54 |
| inventory/transfers | GET | SIN @Permit | apps/api/src/warehouses.ts:94 |
| inventory/transfers | POST | SIN @Permit | apps/api/src/warehouses.ts:112 |
