# Baja de cliente (técnico)

Procedimiento para personas: `docs/operacion/BAJA_DE_CLIENTE.md`. Aún no
desplegado (rama `claude-pc/instalador-ci-baja`).

## Piezas

- `apps/api/src/baja.ts`: `alcance`, `conteos`, `exportar`, `terminar`,
  `suprimir`. Sin Nest ni endpoint.
- `apps/api/scripts/baja-cliente.ts`: comando `pnpm --filter @fitstore/api baja
estado|terminar|exportar|suprimir|descifrar`.
- Tabla `BranchTermination` (migración aditiva
  `202611090001_baja_cliente`): `branchId`, `terminatedAt`, `exportedAt`,
  `exportSha256`, `suppressedAt`, `actaSha256`. Sin datos personales; la
  supresión no la borra (es la constancia).
- Prueba: `tests/baja-cliente-postgres.test.ts` (PostgreSQL real).

## Qué es «la sucursal»

- Toda tabla con columna `branchId` igual al indicado (se descubre en
  `information_schema`, así una tabla nueva con `branchId` entra sola).
- Las tablas hijas sin `branchId`, por su fila padre (`HIJAS` en `baja.ts`):
  RefreshToken y AuthSession (por usuario), KitComponent, LotIdentityConflict,
  VariantStock (por variante), LotStock (por lote), StockTransferLine,
  CourierPayoutItem, SaleItem y Payment (por venta), CreditNote (por
  devolución), PurchaseItem, CashMovement, GvProof, Settings (`id` =
  `branchId`) y Counter (`sale:`, `return:`, `gvrecibo:` + `branchId`).
- Globales, nunca se tocan (`GLOBALES`): `_prisma_migrations`,
  `BranchTermination`, Role, Brand, ExpenseCategory, AlertRule, AuthAttempt.
- Una tabla sin `branchId` que no esté en ninguna lista hace fallar las tres
  operaciones («Tablas sin clasificar»). Al agregar un modelo sin `branchId`,
  clasificarlo en `baja.ts`; la prueba lo detecta con la base migrada.

## Garantías

- **Aislamiento:** cada `DELETE` lleva la condición de la sucursal. Antes de
  borrar, `sinReferenciasAjenas` recorre todas las llaves foráneas
  (`pg_constraint`): si una fila de fuera apunta a una de dentro (la arrastraría
  un CASCADE) o una de dentro apunta a otra sucursal, se detiene sin borrar.
- **Orden:** el borrado sigue el orden topológico de las llaves (hijas antes que
  padres) y va en una sola transacción.
- **Exportación = conteos:** una instantánea `REPEATABLE READ`; el manifiesto
  trae filas y SHA-256 del contenido por tabla; la prueba descifra cada
  archivo y compara con `conteos`.
- **Cifrado:** formato NXBK v1 de `drive-backup-core.ts` (AES-256-GCM, scrypt),
  frase `BAJA_CLAVE` de 32+ caracteres y no simple (`secret-strength.ts`).
- **Bloqueo:** usuarios `active=false` con `authVersion+1` (el guard rechaza la
  sesión en la siguiente petición), tokens y sesiones borrados, terminales
  revocadas.
- **Supresión:** frase `SUPRIMIR <branchId>` + fecha de hoy (Santo Domingo) +
  días mínimos desde terminar (por defecto 30) + exportación posterior a
  terminar. Idempotente: repetirla borra 0 filas y conserva el acta.

## No probado / límites

- No se ejecutó contra Render ni contra datos reales.
- La exportación carga cada tabla en memoria (suficiente para una tienda;
  marcado `shortcut` en el código).
- Plazos y conservación legal: PENDIENTES de la dueña (ver el documento de
  operación).
