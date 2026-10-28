# Lote 1 para DeepSeek web (sin datos sensibles)

Entrada: scripts del package.json raíz, lista de archivos de apps/web/src y apps/api/src (solo nombres). Sin código, sin claves, sin variables de entorno.

## Tarea A · D44 · CONTRIBUTING.md y docs/DESARROLLO.md
Escribe en español: 1) CONTRIBUTING.md: cómo proponer cambios, ramas, un commit por arreglo, pruebas antes de PR, y qué no tocar sin autorización. 2) docs/DESARROLLO.md: cómo instalar (pnpm 11), correr check, verify, test:integration, y estructura del monorepo. Usa solo los scripts de la lista. No inventes comandos.
Criterio de aceptación: cada comando citado existe en la lista de scripts; ninguna ruta inventada.

## Tarea B · D43 · mapa de pantallas
Con la lista de archivos de apps/web/src, escribe docs/auditoria/MAPA_PANTALLAS.md: tabla con archivo, pantalla o función probable (por nombre), y si es componente o página. Marca como DUDOSO lo que no se pueda deducir del nombre.
Criterio de aceptación: no afirmes el contenido de un archivo, solo lo que indica su nombre.

## Entrada 1 · scripts.json
```json
{
  "name": "fitstore-pos",
  "packageManager": "pnpm@11.19.0",
  "scripts": {
    "dev": "concurrently -n api,web -c magenta,cyan \"pnpm --filter @fitstore/api dev\" \"pnpm --filter @fitstore/web dev\"",
    "build": "pnpm --filter @fitstore/web build && pnpm --filter @fitstore/api build",
    "typecheck": "pnpm -r typecheck",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:generate": "pnpm --filter @fitstore/api db:generate",
    "db:migrate": "pnpm --filter @fitstore/api db:migrate",
    "db:seed": "pnpm --filter @fitstore/api db:seed",
    "format": "prettier --write .",
    "lint": "eslint .",
    "check": "pnpm typecheck && pnpm lint && pnpm test && pnpm build",
    "db:local": "node scripts/local-db.mjs",
    "verify": "node scripts/verify.mjs",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "cloud:validate": "vitest run tests/cloud-deploy.test.ts",
    "backup": "node scripts/backup.mjs",
    "admin:create": "pnpm --filter @fitstore/api admin:create",
    "package:source": "node scripts/package.mjs",
    "package:changes": "node scripts/package-changes.mjs",
    "instalador:validar": "node instalador/tests/run-validation.mjs",
    "instalador:preparar": "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1 -SoloPreparar",
    "instalador:compilar": "powershell -NoProfile -ExecutionPolicy Bypass -File instalador/build.ps1"
  }
}
```

## Entrada 2 · apps/web/src (nombres)
```
App.tsx
CourierFeeEditor.tsx
CourierPayouts.tsx
CreditAccounts.tsx
Dashboard.tsx
DriveBackup.tsx
FormalReports.tsx
Gv.tsx
GvCitas.tsx
GvInteresadas.tsx
Incentives.tsx
IncomeByDay.tsx
InventoryImport.tsx
Management.tsx
Merchandise.tsx
MonthReport.tsx
POS.tsx
PasswordChangeFields.tsx
PaymentMixPie.tsx
Prints.tsx
Purchases.tsx
QuickQuestions.tsx
SaleEditPanel.tsx
Tienda.tsx
TransferReconciliation.tsx
VoidRequests.tsx
WarehousesPanel.tsx
YearPie.tsx
api.ts
cartDraft.ts
cartDraftPolicy.ts
courier-utils.ts
customer-display.ts
customerSearch.ts
helpers.tsx
main.tsx
managementMessages.ts
monitoring.ts
offlinePolicy.ts
passwordChange.ts
pendingSales.ts
polyfills.ts
posKeyboard.ts
pwaUpdate.ts
pwaUpdatePolicy.ts
realtime.tsx
scanSound.ts
transfer-reconciliation-utils.ts
vite-env.d.ts
year-report-utils.ts
```

## Entrada 3 · apps/api/src (nombres)
```
admin.ts
alerts.ts
app.ts
auth.ts
cash.ts
cashier-survey.ts
catalog.ts
common.ts
courier.ts
credit-allocation.ts
credit-reminder.ts
database-errors.ts
database-pool.ts
database-timezone.ts
drive-backup-core.ts
drive-backup.ts
formal-period.ts
formal-report.ts
gv-citas.ts
gv-money.ts
gv.ts
incentives.ts
income-day.ts
income-report.ts
inventory-import-core.ts
inventory-import.ts
inventory-resilience.ts
inventory.ts
invoice.ts
main.ts
merchandise.ts
monitoring.ts
notifications.ts
offline-sale-review.ts
offline-sales.ts
password-policy.ts
rate-limit.ts
realtime.ts
receipt-pdf.ts
reportes/base.ts
reportes/clientes.ts
reportes/dinero.ts
reportes/index.ts
reportes/inventario.ts
reportes/margen.ts
reportes/ventas.ts
reports.ts
require-password-change.ts
retention.ts
sales.ts
secret-strength.ts
security.ts
session-activity.ts
usd-rate.ts
warehouses.ts
xlsx-guard.ts
```
