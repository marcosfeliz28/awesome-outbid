# Pantallas del web (verificadas)

Fuente: `apps/web/src/App.tsx` de `origin/nexora-cloud` (SHA 9626b19f).
- Menú (etiqueta y permiso): arreglo `navigation`, líneas 194–282.
- Páginas: objeto `pages`, líneas 927–948.
Las líneas del borrador original (1345–1374) eran de `origin/producto-nexora`; aquí se usan las de la rama `nexora-cloud`.
El borrador original no se editó.

| Página (id) | Frase (etiqueta del menú) | Permiso | Componente y archivo:línea (nexora-cloud) |
|---|---|---|---|
| `onboarding` | Primeros pasos | * | **SIN RESPALDO en nexora-cloud**: no existe en `App.tsx`. |
| `billing` | Plan y facturación | * | **SIN RESPALDO en nexora-cloud**: no existe en `App.tsx`. |
| `dashboard` | Resumen | reports:read | `Dashboard` · `App.tsx:928` (menú: 202) |
| `month-report` | no está en el menú | — | `MonthReport` · `App.tsx:929` |
| `pos` | Punto de venta | sale:write | `POS` · `App.tsx:930` (menú: 208) |
| `products` | Productos | catalog:read | `Catalog` · `App.tsx:931` (menú: 233) |
| `inventory` | Inventario | inventory:write | `Inventory` · `App.tsx:932` (menú: 239) |
| `purchases` | Compras | purchase:write | `Purchases` · `App.tsx:933` (menú: 245) |
| `cash` | Caja | cash:write | `Cash` · `App.tsx:934` (menú: 250) |
| `expenses` | Gastos | expense:write | `Expenses` · `App.tsx:935` (menú: 252) |
| `customers` | Clientes | customers:write | `Customers` · `App.tsx:936` (menú: 258) |
| `promotions` | Promociones | promotions:write | `Promotions` · `App.tsx:937` (menú: 264) |
| `reports` | Reportes | reports:read | `Reports` · `App.tsx:938` (menú: 270) |
| `alerts` | Alertas | alerts:write | `Alerts` · `App.tsx:939` (menú: 275) |
| `settings` | no está en el menú | — | `Configuration` · `App.tsx:940` |
| `sales` | Ventas | sale:write | `SalesHistory` · `App.tsx:942` (menú: 213) |
| `void-requests` | Solicitudes de anulación | sale:write | `VoidRequests` · `App.tsx:943` (menú: 215) |
| `transfer-reconciliation` | Conciliar transferencias | * | `TransferReconciliation` · `App.tsx:944` (menú: 221) |
| `courier-payouts` | Envíos del mensajero | * | `CourierPayouts` · `App.tsx:945` (menú: 227) |
| `merchandise` | Mercancía | inventory:write | `Merchandise` · `App.tsx:946` (menú: 196) |
| `incentives` | Incentivos | sale:manage | `IncentivesPage` · `App.tsx:947` (menú: 277) |
| `gv` | GV Makeup Studio (no estaba en el borrador) | gv:read | `Gv` · `App.tsx:948` (menú: 282) |

## Resumen
- 20 de 22 filas respaldadas en nexora-cloud (etiqueta, permiso y componente), incluida la fila de `gv`, que faltaba en el borrador.
- `onboarding` y `billing` no existen en nexora-cloud. Sí existían en el borrador (que cita `producto-nexora`).

## Resuelto (ver `docs/sistema/RESPUESTAS_A_TALLER.md`, pregunta 9)
- «Primeros pasos» y «Plan y facturación» **solo existen en `producto-nexora`**. En `nexora-cloud` no están en el menú ni en `pages`. Las dos filas quedan **SIN RESPALDO en nexora-cloud**; no se publican en la tienda.
