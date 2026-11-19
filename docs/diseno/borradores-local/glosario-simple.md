> **Borrador sin verificar, hecho por modelo local (cola N35).** Fuente: docs/sistema/* de origin/nexora-cloud @ e47a557d. Revisión de Claude PC: Solo se vio la parte inicial de GLOSARIO.md (4000 caracteres). Citas copiadas del documento; se verificaron con grep contra docs/sistema/GLOSARIO.md de origin/nexora-cloud.

| Término | Definición |
| --- | --- |
| Abono | Pago posterior a una venta con saldo (`apps/api/src/sales.ts:4414`). |
| Aprobar con PIN / PIN de gerente | Código 6 dígitos para autorizar operaciones de riesgo (`apps/api/src/security.ts:81-136`). |
| Arqueo / «Cerrar y arquear» | Contar dinero de la caja y compararlo con el sistema (`apps/web/src/Management.tsx:1693`). |
| B01 / B02 | Tipos de comprobante fiscal que se pueden solicitar (`apps/web/src/POS.tsx:2580-2608`). |
| Caja | Pantalla para abrir/cerrar turno y sesión de caja (`App.tsx:250`, `apps/api/prisma/schema.prisma:673`). |
| Caja ciega / arqueo ciego / conteo ciego | Contar dinero sin ver el monto esperado (`apps/web/src/managementMessages.ts:37-44`). |
| Casa | Almacén de mercancía guardada fuera de la tienda (`apps/api/prisma/migrations/202610240401_warehouses/migration.sql:56`). |
| Cierre de emergencia | Un gerente cierra la caja de otra persona (`apps/web/src/Tienda.tsx:321-328`). |
| Conciliar | Comparar transferencias del sistema con el estado del banco (`apps/web/src/TransferReconciliation.tsx:182-190`). |
| Conteo | Contar físicamente la existencia y aprobar ajuste (`apps/web/src/Management.tsx:951`, `:1007`). |
| Consumidor final | Cliente genérico para ventas sin datos (`apps/web/src/POS.tsx:360-377`). |
| Contraentrega (`cod`) | Venta con entrega de mensajero y cobro posterior (`apps/web/src/POS.tsx:2542-2548`). |
| Costo promedio (`costAvg`) | Costo recalculado en cada entrada (`apps/api/prisma/schema.prisma:120-135`). |
| Crédito | Venta a cuenta del cliente (`apps/web/src/Tienda.tsx:602`). |
| Cuadre | Resultado del cierre de caja con diferencias (`apps/web/src/Management.tsx:1693`). |

Qué hice: Creé una tabla con términos y definiciones del glosario del negocio y del sistema, siguiendo el formato solicitado.

Qué NO comprobé: No revisé archivos adicionales ni verifiqué información fuera de los primeros 4000 caracteres del archivo `docs/sistema/GLOSARIO.md`.

