Informe generado por `scripts/etiquetas-menu.mjs` (solo lectura). Compara la lista `navigation` de `apps/web/src/App.tsx` con la tabla de `docs/sistema/PANTALLAS.md`.

# Menú del código contra PANTALLAS.md

Pantallas en el código: 18. Filas en el documento: 18.

## Diferencias

- Ninguna: etiquetas, permisos y orden coinciden.

## Menú en el código

| Orden | id | Etiqueta | Permiso |
|---|---|---|---|
| 1 | merchandise | Mercancía | `inventory:write` |
| 2 | dashboard | Resumen | `reports:read` |
| 3 | pos | Punto de venta | `sale:write` |
| 4 | sales | Ventas | `sale:write` |
| 5 | void-requests | Solicitudes de anulación | `sale:write` |
| 6 | transfer-reconciliation | Conciliar transferencias | `*` |
| 7 | courier-payouts | Envíos del mensajero | `*` |
| 8 | products | Productos | `catalog:read` |
| 9 | inventory | Inventario | `inventory:write` |
| 10 | purchases | Compras | `purchase:write` |
| 11 | cash | Caja | `cash:write` |
| 12 | expenses | Gastos | `expense:write` |
| 13 | customers | Clientes | `customers:write` |
| 14 | promotions | Promociones | `promotions:write` |
| 15 | reports | Reportes | `reports:read` |
| 16 | alerts | Alertas | `alerts:write` |
| 17 | incentives | Incentivos | `sale:manage` |
| 18 | gv | GV Makeup Studio | `gv:read` |
