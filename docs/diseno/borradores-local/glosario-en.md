> **Borrador sin verificar, hecho por modelo local (cola N41).** Fuente: docs/sistema/* de origin/nexora-cloud @ e47a557d. Revisión de Claude PC: Traducción del glosario de N35 (modelo qwen2.5-coder:14b). Incluye términos NCF/B01 tomados del código: no son promesa de la versión 1; revisar.

| Término | EN Term | EN Definition |
|---------|---------|---------------|
| Abono | Abono | Payment with `entryType = "installment"` (`apps/api/src/sales.ts:4414`). Screen: Sales › «Register Abono» (`apps/web/src/Management.tsx:3277`). |
| Aprobar con PIN / PIN de gerente | Approve with PIN / Manager PIN | 6-digit code of a user with `sale:manage` that authorizes a high-risk operation (large discount, large credit, discrepancy, voucher...). Cannot be the one requesting, except for the owner (`apps/api/src/security.ts:81-136`). See `ROLES_Y_PERMISOS.md` §5. |
| Arqueo / «Cerrar y arquear» | Arqueo / «Close and Arqueo» | Count the money in the cash register and compare it with what the system expects (`apps/web/src/Management.tsx:1693`). |
| B01 / B02 | B01 / B02 | Types of fiscal documents that can be *requested* if «Preparación de NCF» is active: B01 «Fiscal Credit» (requests RNC or ID) and B02 «Final Consumer». The system only prepares the request; it does not issue the document (`apps/web/src/POS.tsx:2580-2608`). |
| Caja | Cash Register | Two meanings: (1) the **screen** «Cash Register» to open/close the shift (`App.tsx:250`); (2) the **cash session** (`CashSession`) of a person, from opening to closing (`apps/api/prisma/schema.prisma:673`). A person can only have one open. |
| Caja ciega / arqueo ciego / conteo ciego | Blind Cash Register / Blind Arqueo / Blind Count | While the cash register is open, and when closing, the cashier **does not see** how much is expected; they declare what they counted and the system compares later. «Blind Arqueo active: while the cash register is open, you do not see the expected amounts» (`apps/web/src/managementMessages.ts:37-44`). Only those with `profit:read` or `sale:manage` see the expected amounts (`apps/api/src/common.ts:70-72`). Additionally, there is a flag to hide sales amounts from those who do not see the expected amounts, **turned off by default**: `NEXORA_VENTAS_CAJA_CIEGA` (`apps/api/src/sales.ts:151-152`). |
| Casa | Home Warehouse | Warehouse where the merchandise is stored outside the store (`kind=home`, not for sale). Only moves with explicit instruction from the owner (`.claude/skills/mercancia/SKILL.md:33`; `apps/api/prisma/migrations/202610240401_warehouses/migration.sql:56`). |
| Cierre de emergencia | Emergency Closure | A manager/administrator closes another person's cash register; it remains «closed by X on behalf of Y» (`apps/web/src/Tienda.tsx:321-328`; `apps/api/src/cash.ts:1335-1350`). |
| Conciliar | Reconcile | Compare the system transfers with the bank status before verifying them. Screen «Reconcile Transfers» (`apps/web/src/TransferReconciliation.tsx:182-190`). |
| Conteo | Count | Physically count the inventory. In the system: Inventory › «Count» creates a pending count that a manager approves with «Approve Adjustment» (`apps/web/src/Management.tsx:951`, `:1007`). Counts against the system are verified **four times** (`CLAUDE.md` point 6). |
| Consumidor final | Final Consumer | Generic customer for sales without data; if it exists in the list, it appears first when selecting a customer (`apps/web/src/POS.tsx:360-377`). Invoices must identify a person or company (`requireCustomer`, `apps/api/src/admin.ts:121-123`). It is also type B02. |
| Contraentrega (`cod`) | Contraentrega (`cod`) | Sale that leaves with the merchandise and is paid when the messenger brings the money. In the base, it is the same as credit (method `cod`); it only changes the statistical label (`apps/web/src/POS.tsx:2542-2548`, `:1798-1802`). |
| Costo promedio (`costAvg`) | Average Cost (`costAvg`) | Cost of a variant, recalculated with each entry (`apps/api/prisma/schema.prisma:120-135`). It is used to calculate the margin. |
| Crédito | Credit | Sale on account of the customer: the merchandise leaves now, it is paid later. Screen: «Pending Credits» within Cash Register (`apps/web/src/Tienda.tsx:602`). PIN rules: `packages/shared/src/index.ts:376-444`. |
| Cuadre | Settlement | The result of the cash register closure: the counted against the expected by method (cash, card, transfer, dollars), with differences; it is printed when closing. |

Qué hice:
- Traducí los términos y definiciones de la tabla proporcionada.
- Mantuve las citas de archivo y línea de la entrada.
- No inventé funciones, cifras ni pasos adicionales.
- No prometí seguridad, ganancias ni uso de NCF/e-CF.

Qué NO comprobé:
- No revisé el resto del documento más allá de los primeros 4000 caracteres.
- No verifiqué la precisión de las citas de archivo y línea.

