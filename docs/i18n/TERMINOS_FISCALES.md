# Términos fiscales y dónde aparecen (tarea 78)

Borrador sin verificar. Fuente: `origin/producto-nexora` (`415f602a`), rama `claude-pc/cola-b13`. Conteo con `grep -c -w` (palabra exacta, mayúsculas exactas) sobre `apps/` y `packages/` en .ts/.tsx/.mjs/.js, excluidas pruebas (`*.test.*`, `*.spec.*`, carpetas tests).

| Término | Líneas | Archivos | Ejemplo (archivo:línea) |
|---|---|---|---|
| NCF | 69 | 18 | `apps/api/src/admin.ts:119:  // «sequences»: cada venta toma su NCF tradicional (B01/B02) de los rangos` |
| ITBIS | 73 | 29 | `apps/api/src/admin.ts:743:    // Cero es un ITBIS declarado válido; ausencia es diferente de cero.` |
| RNC | 53 | 21 | `apps/api/src/admin.ts:328:    // SEC-05: el formulario de la caja devuelve el teléfono, la cédula/RNC o` |
| DGII | 9 | 5 | `apps/api/src/admin.ts:446:          // (DGII), no de contacto: se conserva en la venta.` |
| e-CF | 8 | 5 | `apps/api/src/inventory.ts:115: * NCF en mayúsculas sin espacios (B + 10 dígitos o e-CF E + 12), fecha del` |

## Conteo por archivo (solo archivos con al menos una aparición)

| Archivo | NCF | ITBIS | RNC | DGII | e-CF |
|---|---|---|---|---|---|
| `apps/api/src/admin.ts` | 6 | 2 | 1 | 1 | 0 |
| `apps/api/src/alerts.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/api/src/assistant.ts` | 0 | 5 | 1 | 0 | 0 |
| `apps/api/src/cash.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/api/src/common.ts` | 1 | 1 | 2 | 0 | 0 |
| `apps/api/src/formal-report.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/api/src/inventory-import-core.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/api/src/inventory.ts` | 5 | 3 | 1 | 0 | 1 |
| `apps/api/src/invoice.ts` | 4 | 4 | 4 | 2 | 0 |
| `apps/api/src/merchandise.ts` | 0 | 0 | 2 | 1 | 0 |
| `apps/api/src/ncf-sequences.ts` | 3 | 0 | 0 | 0 | 0 |
| `apps/api/src/notifications.ts` | 0 | 1 | 2 | 0 | 0 |
| `apps/api/src/offline-sale-review.ts` | 1 | 1 | 0 | 0 | 0 |
| `apps/api/src/receipt-pdf.ts` | 6 | 1 | 3 | 0 | 0 |
| `apps/api/src/reportes/margen.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/api/src/reports.ts` | 6 | 12 | 1 | 0 | 0 |
| `apps/api/src/sales.ts` | 2 | 1 | 8 | 1 | 2 |
| `apps/web/src/App.tsx` | 1 | 1 | 1 | 0 | 1 |
| `apps/web/src/ExecutiveDashboard.tsx` | 0 | 4 | 0 | 0 | 0 |
| `apps/web/src/FormalReports.tsx` | 0 | 1 | 0 | 0 | 0 |
| `apps/web/src/Management.tsx` | 11 | 8 | 11 | 0 | 2 |
| `apps/web/src/Merchandise.tsx` | 2 | 1 | 2 | 0 | 0 |
| `apps/web/src/MonthReport.tsx` | 0 | 1 | 0 | 0 | 0 |
| `apps/web/src/NcfSequenceSettings.tsx` | 5 | 0 | 0 | 4 | 0 |
| `apps/web/src/Onboarding.tsx` | 1 | 1 | 1 | 0 | 0 |
| `apps/web/src/POS.tsx` | 5 | 2 | 4 | 0 | 0 |
| `apps/web/src/Prints.tsx` | 5 | 5 | 3 | 0 | 2 |
| `apps/web/src/Purchases.tsx` | 4 | 3 | 1 | 0 | 0 |
| `apps/web/src/YearPie.tsx` | 0 | 1 | 0 | 0 | 0 |
| `apps/web/src/catalogChecks.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/web/src/customer-display.ts` | 0 | 0 | 1 | 0 | 0 |
| `apps/web/src/dashboardQuestions.ts` | 0 | 1 | 0 | 0 | 0 |
| `apps/web/src/helpers.tsx` | 0 | 0 | 1 | 0 | 0 |
| `apps/web/src/monitoring.ts` | 0 | 0 | 1 | 0 | 0 |
| `packages/shared/src/index.ts` | 1 | 7 | 2 | 0 | 0 |
